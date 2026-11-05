import {z} from 'zod';
import {boundedJson} from './http.js';
import type {CanonicalObservation} from '../engine.js';

const schema=z.object({data:z.array(z.object({id:z.union([z.string(),z.number()]),fields:z.object({
 name:z.string(),date:z.object({created:z.string()}),
 country:z.array(z.object({name:z.string().optional(),iso3:z.string().optional()})).optional(),
 type:z.array(z.object({name:z.string()})).optional(),url_alias:z.string().optional(),url:z.string().optional(),
})})).max(100)});
export interface ReliefReport {id:string;title:string;observedAt:string;countries:string[];countryCodes:string[];types:string[];sourceUrl:string|null}

/** Disaster records have country references, not event coordinates. Never invent map pins. */
export async function fetchReliefWeb(signal:AbortSignal,fetcher:typeof fetch=fetch,appname=process.env.SENTINEL_RELIEFWEB_APPNAME??'com.resqops.app'):
 Promise<{observations:CanonicalObservation[];reports:ReliefReport[];status:'OK'|'UNAVAILABLE'|'NOT_CONFIGURED'|'ACCESS_DENIED'}>{
 if(!appname)return {observations:[],reports:[],status:'NOT_CONFIGURED'};
 try{
  const query=new URLSearchParams({appname,limit:'50'});
  for(const field of ['name','date.created','country','type','url_alias','url'])query.append('fields[include][]',field);
  query.append('sort[]','date.created:desc');
  const response=await fetcher('https://api.reliefweb.int/v2/disasters?'+query,{signal,redirect:'error',headers:{Accept:'application/json'}});
  if(response.status===401||response.status===403){await response.body?.cancel();return {observations:[],reports:[],status:'ACCESS_DENIED'};}
  const feed=schema.parse(await boundedJson(response,2_000_000)),now=Date.now();
  const reports=feed.data.filter(d=>Number.isFinite(Date.parse(d.fields.date.created))&&Date.parse(d.fields.date.created)<=now+300000&&now-Date.parse(d.fields.date.created)<=30*86400000).map(d=>{
   const candidate=d.fields.url_alias??d.fields.url;let sourceUrl:string|null=null;
   try{const url=new URL(candidate??'');if(url.protocol==='https:'&&url.hostname==='reliefweb.int')sourceUrl=url.href;}catch{}
   return {id:String(d.id),title:d.fields.name,observedAt:d.fields.date.created,countries:(d.fields.country??[]).flatMap(c=>c.name?[c.name]:[]),countryCodes:(d.fields.country??[]).flatMap(c=>c.iso3?[c.iso3]:[]),types:(d.fields.type??[]).map(t=>t.name),sourceUrl};
  });
  return {observations:[],reports,status:'OK'};
 }catch{return {observations:[],reports:[],status:'UNAVAILABLE'};}
}
