import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {lockOrganization} from '../organizations/context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {withRegion} from './sentinel.context.js';
import {boundsSchema} from './providers/weathernext3.contract.js';
import {fetchIncidentFeeds,incidentTypes,type FeedIncident} from './providers/incident-feeds.js';
import {SentinelService} from './sentinel.service.js';
import {gaugeCrossings} from './specialised-contract.js';
import {DisasterEngineService} from './disaster.service.js';

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
export async function insertFeedIncidents(tx:TenantTransaction,org:string,region:string,incidents:FeedIncident[],bounds:{west:number;east:number;south:number;north:number},ownerId:number){
 // Serialize overlapping worker/coordinator imports for this region, including legacy IDs.
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+region+':incidents'},0))::text`;
 const existing=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'INCIDENT',OR:incidents.map(i=>({payload:{path:['external_id'],equals:i.external_id}}))},select:{payload:true}});
 const known=new Set(existing.map(r=>payload(r.payload).external_id));
 let created=0;
 for(const incident of incidents){
  if(known.has(incident.external_id))continue;
  if(incident.latitude===null||incident.longitude===null||!inBounds(incident.latitude,incident.longitude,bounds))continue;
  await tx.operationRecord.create({data:{id:randomUUID(),organizationId:org,regionId:region,kind:'INCIDENT',ownerId,
   payload:json({...incident,status:'REPORTED',located:incident.latitude!==null&&incident.longitude!==null,ingested_at:new Date().toISOString()})}});
  known.add(incident.external_id);created++;
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
  await withRegion(actor,org,region,true,tx=>coordinator(tx,actor,org));
  const {incidents,feeds}=await fetchIncidentFeeds(AbortSignal.timeout(60000));
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const unit=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});
   const bounds=boundsSchema.parse(unit.forecastBounds);
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const created=await insertFeedIncidents(tx,org,region,incidents,bounds,actor.userId);
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'INCIDENTS_INGESTED',reason:'Coordinator ingested incident feeds',metadata:{region_id:region,created,feeds}}});
   return {created,feeds,unlocated:incidents.filter(i=>i.latitude===null||i.longitude===null).length,verification:'Every ingested item stays REPORTED until a coordinator verifies it. Feed republication is provenance, not confirmation.'};});
 },
 async list(actor:Actor,org:string,region:string,status?:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'INCIDENT',...(status?{payload:{path:['status'],equals:status}}:{})},orderBy:{sequence:'desc'},take:201});
   return {items:rows.slice(0,200),truncated:rows.length>200,next_cursor:null};});
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
  await withRegion(actor,org,region,false,tx=>coordinator(tx,actor,org));
  const unavailable:string[]=[];
  const recover=(source:string,fallback:any)=>(error:unknown)=>{
   if(error instanceof ApiError&&[401,403].includes(error.statusCode))throw error;
   unavailable.push(source);return fallback;
  };
  const engine=await DisasterEngineService.predictions(actor,org,region).catch(recover('Disaster engine',null));
  const [latest,hazards,incidents,gauges]=await Promise.all([
   SentinelService.latest(actor,org,region).catch(recover('Forecasts',null)),
   SentinelService.hazards(actor,org,region).catch(recover('Earthquake observations',null)),
   IncidentsService.list(actor,org,region).catch(recover('Incident reports',{items:[]})),
   withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIAL_EVIDENCE'},orderBy:{sequence:'desc'},take:201});
    return (rows.map(r=>({id:r.id,...payload(r.payload)})) as any[]).filter(r=>r.evidence_kind==='GAUGE_READING'&&typeof r.latitude==='number'&&typeof r.longitude==='number');}).catch(recover('Gauge readings',[])),
  ]);
  const pins:any[]=[];
  for(const indicator of latest?.assessment?.indicators??[]){
   const type=indicator.kind==='HEAVY_RAIN'?'SEVERE_RAIN':indicator.kind==='HEAT'?'HEAT':'STRONG_WIND';
   pins.push({id:'forecast-'+indicator.kind+'-'+indicator.longitude+'-'+indicator.latitude+'-'+indicator.valid_time,incident_type:type,
    type,category:'PREDICTION',status:'PREDICTED',title:(type==='SEVERE_RAIN'?'Severe rain':type==='HEAT'?'Sustained heat':'Strong wind')+' indicator',
    latitude:indicator.latitude,longitude:indicator.longitude,severity:indicator.assessment==='MEDIAN_EXCEEDANCE'?'HIGH':'MODERATE',
    source:'WeatherNext 3 forecast',source_url:null,observed_at:indicator.valid_time,
    detail:'Median '+indicator.p50+' / upper '+indicator.p90+' '+indicator.unit+' against threshold '+indicator.threshold+' '+indicator.unit+'. Unvalidated indicator, not an impact estimate.',
    route:{label:'Weather analysis',href:'/weather-analysis'}});
  }
  for(const source of engine?.sources??[])if(['UNAVAILABLE','PARTIAL','NOT_CONFIGURED','ACCESS_DENIED'].includes(source.status))unavailable.push(source.label);
  for(const prediction of engine?.predictions??[]){
   // Existing source-specific pins below already carry these observed/reported records.
   if(prediction.sources.some((s:string)=>['USGS','GDACS','GAUGE'].includes(s)))continue;
   pins.push({id:prediction.id,incident_type:prediction.hazard,type:prediction.hazard,category:prediction.kind==='PREDICTED'?'PREDICTION':'NATURAL',status:prediction.kind==='PREDICTED'?'PREDICTED':'REPORTED',
    title:prediction.hazard.replace(/_/g,' ')+' '+(prediction.kind==='PREDICTED'?'indicator':prediction.kind.toLowerCase()+' source alert'),latitude:prediction.latitude,longitude:prediction.longitude,
    severity:prediction.level==='SEVERE'?'SEVERE':prediction.level==='WARNING'?'HIGH':prediction.level==='WATCH'?'MODERATE':'LOW',
    source:'Disaster engine: '+prediction.sources.join(', '),source_url:null,observed_at:prediction.validFrom,
    detail:'Experimental risk score '+Math.round(prediction.severity*100)+'/100 (not a probability), '+prediction.independentSources+' source families. Valid '+prediction.validFrom+' to '+prediction.validTo+'. '+prediction.explanation.join('; ')+'. Unvalidated shadow indicator, not an impact estimate.',
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
    category:'SENSOR',status:'RECORDED',title:gauge.name||('Gauge '+gauge.gauge_id),
    latitude:gauge.latitude,longitude:gauge.longitude,severity:gauge.at_or_above_watch?'HIGH':'LOW',
    source:'Coordinator gauge record (not a live sensor feed)',source_url:null,observed_at:gauge.observed_at,
    detail:'Recorded level '+gauge.level_m+' m against watch level '+gauge.watch_level_m+' m ('+(gauge.at_or_above_watch?'at or above':'below')+' watch).',
    route:{label:'Flood synthesis',href:'/specialised'}});
  }
  return {unavailable_sources:unavailable,truncated:!!(incidents.truncated||hazards?.truncated),generated_at:new Date().toISOString(),region:latest?.region??null,pins,
   layers:['PREDICTION','NATURAL','WEATHER','ARTIFICIAL','SENSOR'],
   disclaimer:'Pins show predictions, reported observations and recorded sensors. A pin is not an impact estimate; artificial-disaster reports stay REPORTED until a coordinator verifies them.'};
 },
};
export {incidentTypes};

/** Background imports have an explicitly configured custodian, never synthetic user 0.
 * Recheck active membership and region grants on every batch. These reports are
 * still unverified; the custodian is ownership, not a claim of human verification.
 */
export async function importWorkerIncidents(tx:TenantTransaction,ownerId:number,incidents:FeedIncident[]){
 if(!Number.isSafeInteger(ownerId)||ownerId<=0)throw new Error('INCIDENT_FEED_OWNER_REQUIRED');
 await tx.$queryRaw`SELECT set_config('vops.user_id',${String(ownerId)},true)`;
 const account=await tx.user.findUnique({where:{id:ownerId}});
 if(!account?.isActive)throw new Error('INCIDENT_FEED_OWNER_INACTIVE');
 const memberships=await tx.organizationMembership.findMany({where:{userId:ownerId,status:'ACTIVE',role:{in:['ORG_ADMIN','COORDINATOR']}},orderBy:{organizationId:'asc'}});
 let regions=0,created=0;
 for(const grant of memberships){
  await lockOrganization(tx,grant.organizationId);
  const current=await tx.organizationMembership.findUnique({where:{id:grant.id}});
  const organization=await tx.organization.findUnique({where:{id:grant.organizationId}});
  if(!current||current.status!=='ACTIVE'||!['ORG_ADMIN','COORDINATOR'].includes(current.role)||organization?.status!=='ACTIVE')continue;
  await tx.$queryRaw`SELECT set_config('vops.organization_id',${grant.organizationId},true),set_config('vops.region_id','',true),set_config('vops.all_regions','',true)`;
  const units=await tx.organizationUnit.findMany({where:{organizationId:grant.organizationId,active:true,...(current.regionIds.length?{id:{in:current.regionIds}}:{})}});
  for(const unit of units){const bounds=boundsSchema.safeParse(unit.forecastBounds);if(!bounds.success)continue;
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true),set_config('vops.region_id',${unit.id},true),set_config('vops.all_regions','',true)`;
   created+=await insertFeedIncidents(tx,grant.organizationId,unit.id,incidents,bounds.data,ownerId);regions++;
  }
 }
 if(!regions)throw new Error('INCIDENT_FEED_NO_AUTHORIZED_REGIONS');
 return {regions,created};
}
