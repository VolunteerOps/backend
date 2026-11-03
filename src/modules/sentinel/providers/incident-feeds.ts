import {createHash} from 'node:crypto';
import {z} from 'zod';

/**
 * Credible open incident feeds. GDACS (UN/EU) publishes a GeoRSS feed with
 * coordinates and event types; coordinators can add further credible RSS
 * feeds (news agencies, civil protection, ReliefWeb-style digests) through
 * INCIDENT_RSS_FEEDS. Social-media content is only ingested when a verified
 * source republishes it through one of these feeds - raw social posts are
 * never treated as verified, and every ingested item keeps REPORTED status
 * until a coordinator verifies it.
 */
export const incidentTypes=['EARTHQUAKE','FLOOD','SEVERE_RAIN','STORM','DROUGHT','FAMINE','EL_NINO','LANDSLIDE','WILDFIRE','BUILDING_COLLAPSE','STRUCTURE_FIRE','EXPLOSION','INDUSTRIAL_ACCIDENT','TRANSPORT_ACCIDENT','OTHER'] as const;
export type IncidentType=typeof incidentTypes[number];
export interface FeedIncident {
  external_id:string; title:string; type:IncidentType; category:'NATURAL'|'WEATHER'|'ARTIFICIAL';
  severity:'LOW'|'MODERATE'|'HIGH'|'SEVERE'; description:string; source_name:string; source_url:string;
  published_at:string; latitude:number|null; longitude:number|null;
}
const gdacsTypes:Record<string,IncidentType>={EQ:'EARTHQUAKE',FL:'FLOOD',TC:'STORM',DR:'DROUGHT',WF:'WILDFIRE',VO:'OTHER'};
const artificial:[RegExp,IncidentType][]=[
  [/building|bridge|structure|dam|wall|roof[^.]{0,60}collaps|collaps[^.]{0,60}(building|bridge|structure|dam|tower|apartment|school|hospital)/i,'BUILDING_COLLAPSE'],
  [/explosion|exploded|blast/i,'EXPLOSION'],
  [/industrial|factory|chemical|warehouse|plant[^.]{0,60}(accident|fire|leak|explosion)/i,'INDUSTRIAL_ACCIDENT'],
  [/(structure|building|warehouse|market|hotel|factory)[^.]{0,40}fire|fire[^.]{0,40}(building|warehouse|market|factory)/i,'STRUCTURE_FIRE'],
  [/(train|bus|ferry|plane|truck)[^.]{0,40}(crash|collision|derail|capsiz)|crash[^.]{0,40}(train|bus|ferry|plane)/i,'TRANSPORT_ACCIDENT'],
];
const natural:[RegExp,IncidentType][]=[
  [/el\s*ni(n|ñ)o/i,'EL_NINO'],
  [/famine|food crisis|starvation/i,'FAMINE'],
  [/drought/i,'DROUGHT'],
  [/landslide|mudslide/i,'LANDSLIDE'],
  [/earthquake|tremor|quake/i,'EARTHQUAKE'],
  [/flash flood|flooding|flood/i,'FLOOD'],
  [/heavy rain|severe rain|downpour|storm/i,'SEVERE_RAIN'],
];
export function classifyIncident(title:string,description:string,gdacsType?:string):{type:IncidentType;category:FeedIncident['category']} {
  if(gdacsType&&gdacsTypes[gdacsType]){const type=gdacsTypes[gdacsType];return {type,category:type==='EARTHQUAKE'?'NATURAL':'WEATHER'};}
  const text=title+' '+description;
  for(const [pattern,type] of artificial)if(pattern.test(text))return {type,category:'ARTIFICIAL'};
  for(const [pattern,type] of natural)if(pattern.test(text))return {type,category:type==='EARTHQUAKE'||type==='LANDSLIDE'?'NATURAL':'WEATHER'};
  return {type:'OTHER',category:'NATURAL'};
}
const decode=(value:string)=>value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const field=(block:string,tag:string)=>{const match=block.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>','i'));return match?decode(match[1]!):'';};
/** Parse a bounded RSS/GeoRSS document into feed incidents. Pure. */
export function parseIncidentFeed(xml:string,sourceName:string):FeedIncident[] {
  if(xml.length>2_000_000)throw new Error('FEED_TOO_LARGE');
  const items=xml.split(/<item[\s>]/i).slice(1,201);
  const incidents:FeedIncident[]=[];
  for(const raw of items){
    const block=raw.slice(0,20000);
    const title=field(block,'title');const link=field(block,'link')||block.match(/<link[^>]*href="([^"]+)"/i)?.[1]||'';
    if(!title||!link)continue;
    const description=field(block,'description').slice(0,1200);
    const point=block.match(/<geo:Point>[\s\S]*?<geo:lat>(-?[\d.]+)<\/geo:lat>[\s\S]*?<geo:long>(-?[\d.]+)<\/geo:long>/i)
      ??block.match(/<georss:point>\s*(-?[\d.]+)\s+(-?[\d.]+)\s*<\/georss:point>/i);
    const latitude=point?Number(point[1]):null,longitude=point?Number(point[2]):null;
    const gdacsType=field(block,'gdacs:eventtype')||undefined;
    const alert=field(block,'gdacs:alertlevel').toUpperCase();
    const {type,category}=classifyIncident(title,description,gdacsType);
    const published=field(block,'pubDate')||field(block,'dc:date');
    incidents.push({external_id:createHash('sha256').update(sourceName+'|'+link).digest('hex').slice(0,40),
      title:title.slice(0,300),type,category,
      severity:alert==='RED'?'SEVERE':alert==='ORANGE'?'HIGH':category==='ARTIFICIAL'?'HIGH':'MODERATE',
      description,source_name:sourceName,source_url:link.slice(0,1000),
      published_at:Number.isFinite(Date.parse(published))?new Date(published).toISOString():new Date().toISOString(),
      latitude:Number.isFinite(latitude as number)&&(latitude as number)>=-90&&(latitude as number)<=90?latitude:null,
      longitude:Number.isFinite(longitude as number)&&(longitude as number)>=-180&&(longitude as number)<=180?longitude:null});
  }
  return incidents;
}
export function configuredFeeds(env:NodeJS.ProcessEnv=process.env):Array<{name:string;url:string}> {
  const feeds=[{name:'GDACS',url:'https://www.gdacs.org/xml/rss.xml'}];
  for(const entry of (env.INCIDENT_RSS_FEEDS??'').split(',').map(v=>v.trim()).filter(Boolean)){
    const [name,url]=entry.includes('=')?entry.split(/=(.*)/s).slice(0,2):['Custom feed',entry];
    if(url&&/^https:\/\//i.test(url))feeds.push({name:(name??'Custom feed').slice(0,60),url:url.slice(0,500)});
  }
  return feeds;
}
export const feedIncidentSchema=z.object({external_id:z.string(),title:z.string()}).passthrough();
export async function fetchIncidentFeeds(signal:AbortSignal,fetcher:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env):Promise<{incidents:FeedIncident[];feeds:Array<{name:string;status:string;count:number}>}> {
  const incidents:FeedIncident[]=[];const feeds=[];
  for(const feed of configuredFeeds(env)){
    try{
      const response=await fetcher(feed.url,{signal,redirect:'error',headers:{'User-Agent':'ResQOps incident ingestion'}});
      if(!response.ok)throw new Error('FEED_HTTP_'+response.status);
      const text=(await boundedJsonText(response)).slice(0,2_000_000);
      const parsed=parseIncidentFeed(text,feed.name);
      incidents.push(...parsed);feeds.push({name:feed.name,status:'OK',count:parsed.length});
    }catch{feeds.push({name:feed.name,status:'UNAVAILABLE',count:0});}
  }
  return {incidents,feeds};
}
async function boundedJsonText(response:Response):Promise<string> {
  // Feeds are XML, not JSON: reuse the bounded reader through a text pass.
  const text=await response.text();
  if(text.length>2_000_000)throw new Error('FEED_TOO_LARGE');
  return text;
}

