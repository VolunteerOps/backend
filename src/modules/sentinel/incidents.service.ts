import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {withRegion} from './sentinel.context.js';
import {boundsSchema} from './providers/weathernext3.contract.js';
import {fetchIncidentFeeds,incidentTypes,type FeedIncident} from './providers/incident-feeds.js';
import {SentinelService} from './sentinel.service.js';
import {gaugeCrossings} from './specialised-contract.js';

const payload=(v:unknown)=>v as Record<string,any>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
async function coordinator(tx:TenantTransaction,actor:Actor,org:string){
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
}
function inBounds(latitude:number,longitude:number,bounds:{west:number;east:number;south:number;north:number}){
 if(latitude<bounds.south||latitude>bounds.north)return false;
 return bounds.west<bounds.east?longitude>=bounds.west&&longitude<=bounds.east:longitude>=bounds.west||longitude<=bounds.east;
}
/** Insert feed incidents for one region inside an open tenant transaction. Returns created count. */
export async function insertFeedIncidents(tx:TenantTransaction,org:string,region:string,incidents:FeedIncident[],bounds:{west:number;east:number;south:number;north:number}){
 const existing=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'INCIDENT'},orderBy:{sequence:'desc'},take:1001});
 const known=new Set(existing.map(r=>payload(r.payload).external_id));
 let created=0;
 for(const incident of incidents){
  if(known.has(incident.external_id))continue;
  if(incident.latitude!==null&&incident.longitude!==null&&!inBounds(incident.latitude,incident.longitude,bounds))continue;
  await tx.operationRecord.create({data:{id:randomUUID(),organizationId:org,regionId:region,kind:'INCIDENT',ownerId:0,
   payload:json({...incident,status:'REPORTED',located:incident.latitude!==null&&incident.longitude!==null,ingested_at:new Date().toISOString()})}});
  created++;
 }
 return created;
}
export const incidentDecision=z.object({reason:z.string().trim().min(3).max(500)}).strict();
export const incidentLocate=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),reason:z.string().trim().min(3).max(500)}).strict();

const ROUTES:Record<string,{label:string;href:string}> = {
 FLOOD:{label:'Flood synthesis',href:'/specialised'},SEVERE_RAIN:{label:'Weather analysis',href:'/weather-analysis'},
 EARTHQUAKE:{label:'Assistance cases',href:'/assistance'},LANDSLIDE:{label:'Weather analysis',href:'/weather-analysis'},
 DROUGHT:{label:'Weather conversation',href:'/weather-analysis'},FAMINE:{label:'Resource planning',href:'/resource-planning'},
 EL_NINO:{label:'Weather conversation',href:'/weather-analysis'},STORM:{label:'Weather analysis',href:'/weather-analysis'},
 WILDFIRE:{label:'Assistance cases',href:'/assistance'},
 BUILDING_COLLAPSE:{label:'Resource planning',href:'/resource-planning'},STRUCTURE_FIRE:{label:'Assistance cases',href:'/assistance'},
 EXPLOSION:{label:'Assistance cases',href:'/assistance'},INDUSTRIAL_ACCIDENT:{label:'Assistance cases',href:'/assistance'},
 TRANSPORT_ACCIDENT:{label:'Assistance cases',href:'/assistance'},OTHER:{label:'Agent runs',href:'/agent-runs'},
};
export const IncidentsService={
 async ingest(actor:Actor,org:string,region:string){
  const {incidents,feeds}=await fetchIncidentFeeds(AbortSignal.timeout(60000));
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const unit=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});
   const bounds=boundsSchema.parse(unit.forecastBounds);
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const created=await insertFeedIncidents(tx,org,region,incidents,bounds);
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'INCIDENTS_INGESTED',reason:'Coordinator ingested incident feeds',metadata:{region_id:region,created,feeds}}});
   return {created,feeds,verification:'Every ingested item stays REPORTED until a coordinator verifies it. Feed republication is provenance, not confirmation.'};});
 },
 async list(actor:Actor,org:string,region:string,status?:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'INCIDENT'},orderBy:{sequence:'desc'},take:200});
   const items=rows.filter(r=>!status||payload(r.payload).status===status);
   return {items,next_cursor:null};});
 },
 async decide(actor:Actor,org:string,region:string,id:string,decision:'VERIFIED'|'DISMISSED',input:z.infer<typeof incidentDecision>){
  const request=incidentDecision.parse(input);
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'INCIDENT'}});
   if(!row)throw ApiError.notFound('Incident');
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'INCIDENT_'+decision,reason:request.reason,metadata:{region_id:region,incident_id:id}}});
   return tx.operationRecord.update({where:{id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...payload(row.payload),status:decision,decided_by:actor.userId,decided_at:new Date().toISOString(),decision_reason:request.reason})}});});
 },
 async locate(actor:Actor,org:string,region:string,id:string,input:z.infer<typeof incidentLocate>){
  const request=incidentLocate.parse(input);
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'INCIDENT'}});
   if(!row)throw ApiError.notFound('Incident');
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'INCIDENT_LOCATED',reason:request.reason,metadata:{region_id:region,incident_id:id}}});
   return tx.operationRecord.update({where:{id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...payload(row.payload),latitude:request.latitude,longitude:request.longitude,located:true,located_by:actor.userId})}});});
 },
 /** Aggregated pins for the Sentinel hazard radar: predictions, ongoing hazards, verified/reported incidents and gauge sensors. */
 async radar(actor:Actor,org:string,region:string){
  const [latest,hazards,incidents,gauges]=await Promise.all([
   SentinelService.latest(actor,org,region).catch(()=>null),
   SentinelService.hazards(actor,org,region).catch(()=>null),
   IncidentsService.list(actor,org,region).catch(()=>({items:[]} as any)),
   withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIAL_EVIDENCE'},orderBy:{sequence:'desc'},take:201});
    return (rows.map(r=>({id:r.id,...payload(r.payload)})) as any[]).filter(r=>r.evidence_kind==='GAUGE_READING'&&typeof r.latitude==='number'&&typeof r.longitude==='number');}).catch(()=>[] as any[]),
  ]);
  const pins:any[]=[];
  for(const indicator of latest?.assessment?.indicators??[]){
   const type=indicator.kind==='HEAVY_RAIN'?'SEVERE_RAIN':indicator.kind==='HEAT'?'HEAT':'STRONG_WIND';
   pins.push({id:'forecast-'+indicator.kind+'-'+indicator.longitude+'-'+indicator.latitude+'-'+indicator.valid_time,incident_type:type==='HEAT'?'OTHER':'SEVERE_RAIN',
    type,category:'PREDICTION',status:'PREDICTED',title:(type==='SEVERE_RAIN'?'Severe rain':type==='HEAT'?'Sustained heat':'Strong wind')+' indicator',
    latitude:indicator.latitude,longitude:indicator.longitude,severity:indicator.assessment==='MEDIAN_EXCEEDANCE'?'HIGH':'MODERATE',
    source:'WeatherNext 3 forecast',source_url:null,observed_at:indicator.valid_time,
    detail:'Median '+indicator.p50+' / upper '+indicator.p90+' '+indicator.unit+' against threshold '+indicator.threshold+' '+indicator.unit+'. Unvalidated indicator, not an impact estimate.',
    route:{label:'Weather analysis',href:'/weather-analysis'}});
  }
  for(const observation of (hazards?.observations??[]) as any[]){
   pins.push({id:'usgs-'+observation.id,incident_type:'EARTHQUAKE',type:'EARTHQUAKE',category:'NATURAL',status:'ONGOING',
    title:observation.title||'Reported earthquake',latitude:observation.latitude,longitude:observation.longitude,
    severity:(observation.magnitude??0)>=5?'SEVERE':(observation.magnitude??0)>=4?'HIGH':'MODERATE',
    source:'USGS',source_url:observation.source_url??null,observed_at:observation.observed_at,
    detail:'Magnitude '+observation.magnitude+', depth '+observation.depth_km+' km. Reported observation; no impact estimate.',
    route:ROUTES.EARTHQUAKE});
  }
  for(const row of incidents.items??[]){
   const p=payload(row.payload);
   if(p.status==='DISMISSED'||p.latitude==null||p.longitude==null)continue;
   pins.push({id:row.id,incident_type:p.type,type:p.type,category:p.category,status:p.status==='VERIFIED'?'VERIFIED':'REPORTED',
    title:p.title,latitude:p.latitude,longitude:p.longitude,severity:p.severity,source:p.source_name,source_url:p.source_url,
    observed_at:p.published_at,detail:(p.description||'').slice(0,600),route:ROUTES[p.type as string]??ROUTES.OTHER,
    verification:p.status==='VERIFIED'?'Verified by a coordinator':'Reported via '+p.source_name+' - not yet verified by a coordinator'});
  }
  for(const gauge of gaugeCrossings(gauges as any[])){
   pins.push({id:'gauge-'+gauge.gauge_id,incident_type:'FLOOD',type:gauge.at_or_above_watch?'FLOOD_WATCH':'GAUGE_SENSOR',
    category:'SENSOR',status:gauge.at_or_above_watch?'ONGOING':'REPORTED',title:gauge.name||('Gauge '+gauge.gauge_id),
    latitude:gauge.latitude,longitude:gauge.longitude,severity:gauge.at_or_above_watch?'HIGH':'LOW',
    source:'Coordinator gauge record',source_url:null,observed_at:gauge.observed_at,
    detail:'Level '+gauge.level_m+' m against watch level '+gauge.watch_level_m+' m ('+(gauge.at_or_above_watch?'at or above':'below')+' watch).',
    route:{label:'Flood synthesis',href:'/specialised'}});
  }
  return {generated_at:new Date().toISOString(),region:latest?.region??null,pins,
   layers:['PREDICTION','NATURAL','WEATHER','ARTIFICIAL','SENSOR'],
   disclaimer:'Pins show predictions, reported observations and recorded sensors. A pin is not an impact estimate; artificial-disaster reports stay REPORTED until a coordinator verifies them.'};
 },
};
export {incidentTypes};
