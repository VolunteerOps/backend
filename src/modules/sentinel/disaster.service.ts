import {weatherProbabilities} from './weather-probability.js';
import { randomUUID, createHash } from 'node:crypto';
import type { Actor } from '../organizations/context.js';
import { withRegion } from './sentinel.context.js';
import { boundsSchema, withinBounds } from './providers/weathernext3.contract.js';
import { forecastPolicySchema } from './forecast-assessment.js';
import { SentinelService } from './sentinel.service.js';
import { ENGINE_VERSION, ENGINE_MODE, SOURCE_REGISTRY, DEFAULT_THRESHOLDS, fusePredictions, observationsFromForecastCells, observationsFromEarthquakes, samplePointsForBounds, type CanonicalObservation, type HazardPrediction, type HazardKind } from './engine.js';
import { fetchOpenMeteoPoints, fetchFloodForPoint } from './providers/open-meteo.js';
import { fetchNwsAlerts } from './providers/nws-alerts.js';
import { fetchReliefWeb } from './providers/reliefweb.js';
import { ApiError } from '../../core/errors.js';

export interface SourceHealth {
  source:string; label:string; enabled:boolean; status:'OK'|'PARTIAL'|'UNAVAILABLE'|'DISABLED'|'NOT_CONFIGURED'|'OUTSIDE_COVERAGE'|'ACCESS_DENIED';
  observations:number; lastReceivedAt:string|null; keyless:boolean; note:string;
}
export const ENGINE_CAPABILITIES = [
  {name:'Weather indicators',status:'SHADOW',note:'Bounded forecast samples; thresholds are not region-validated disaster probabilities.'},
  {name:'Earthquake awareness',status:'OBSERVATIONS_ONLY',note:'USGS/GDACS events report earthquakes already detected. No advance-warning countdown.'},
  {name:'Flood preparedness',status:'PARTIAL',note:'Rainfall, discharge and recorded gauges; basin thresholds and local impact calibration are missing.'},
  {name:'Wildfire',status:'PARTIAL',note:'Fire-weather indicators and reports; FIRMS, fuel and exposure layers are not connected.'},
  {name:'Storm and tsunami alerts',status:'PARTIAL',note:'NWS official alerts in supported areas; no global CAP/coastal evacuation integration.'},
  {name:'Landslide',status:'UNVALIDATED',note:'Rainfall screening only; validated slope, soil and susceptibility inputs are missing.'},
  {name:'Phone sensing and arrival times',status:'UNAVAILABLE',note:'No validated cross-device seismic estimator is connected.'},
  {name:'Connectivity and impact zones',status:'UNAVAILABLE',note:'No eligible heartbeat baseline or reviewed impact polygon model is connected.'},
  {name:'Offline evidence relays',status:'UNAVAILABLE',note:'No verified multi-hop evidence pipeline is connected to this engine.'},
];
export interface DisasterEngineResult {
  status:'AVAILABLE'|'PARTIAL'|'UNAVAILABLE'; mode:typeof ENGINE_MODE;validation:'UNVALIDATED_INDICATOR';operationalWarning:false;
  weatherProbabilityEstimates:ReturnType<typeof weatherProbabilities>;
  engineVersion:string;generatedAt:string;expiresAt:string;source_id:string;policyVersion:number;regionFingerprint:string;region:{id:string;name:string};
  predictionCount:number;truncated:boolean;predictions:HazardPrediction[];sources:SourceHealth[];coverageGaps:string[];disclaimer:string;
  capabilities:typeof ENGINE_CAPABILITIES;contextReports:Array<{source:string;title:string;observedAt:string;scope:string}>;
}
const CACHE_MS=10*60*1000;
const cache=new Map<string,{at:number;expiresAt:number;result:DisasterEngineResult}>();
const pending=new Map<string,Promise<DisasterEngineResult>>();
const enabled=(flag:string,dflt=true)=>process.env[flag]===undefined?dflt:process.env[flag]==='true';
const authError=(e:unknown)=>{if(e instanceof ApiError&&[401,403].includes(e.statusCode))throw e;};
async function regionContext(actor:Actor,organizationId:string,regionId:string){
  // Always reconstruct current account, membership and region permissions, including cache hits.
  return withRegion(actor,organizationId,regionId,true,async tx=>{
    const region=await tx.organizationUnit.findUniqueOrThrow({where:{id:regionId}});
    return {id:region.id,name:region.name,bounds:boundsSchema.parse(region.forecastBounds),policy:forecastPolicySchema.parse(region.forecastPolicy)};
  });
}
export const DisasterEngineService={
 async predictions(actor:Actor,organizationId:string,regionId:string,force=false):Promise<DisasterEngineResult>{
  const region=await regionContext(actor,organizationId,regionId);
  const key=organizationId+':'+regionId+':'+createHash('sha256').update(JSON.stringify(region)).digest('hex');
  const hit=cache.get(key);
  if(!force&&hit&&Date.now()<hit.expiresAt)return structuredClone(hit.result);
  let job=pending.get(key);
  if(!job){
    job=compute(actor,organizationId,regionId,region).then(result=>{
      if(cache.size>=128)cache.delete(cache.keys().next().value!);
      cache.set(key,{at:Date.now(),expiresAt:Math.min(Date.parse(result.expiresAt),...result.predictions.filter(p=>p.kind==='OFFICIAL').map(p=>Date.parse(p.validTo))),result});return result;
    }).finally(()=>pending.delete(key));
    pending.set(key,job);
  }
  const result=await job;
  // Permission removal or a changed region while providers were running must not return old-scope data.
  const current=await regionContext(actor,organizationId,regionId);
  if(JSON.stringify(current)!==JSON.stringify(region))throw ApiError.conflict('The region changed during analysis. Refresh and try again.','REGION_CHANGED');
  return structuredClone(result);
 },
 async refresh(actor:Actor,organizationId:string,regionId:string){
  const result=await this.predictions(actor,organizationId,regionId,true);
  await withRegion(actor,organizationId,regionId,true,async tx=>{
    const current=await tx.organizationUnit.findUniqueOrThrow({where:{id:regionId}});
    if(createHash('sha256').update(JSON.stringify({id:current.id,name:current.name,bounds:boundsSchema.parse(current.forecastBounds),policy:forecastPolicySchema.parse(current.forecastPolicy)})).digest('hex')!==result.regionFingerprint)throw ApiError.conflict('The region changed during analysis. Refresh and try again.','REGION_CHANGED');
    await tx.operationRecord.create({data:{id:randomUUID(),organizationId,regionId,kind:'HAZARD_PREDICTION',ownerId:actor.userId,payload:JSON.parse(JSON.stringify(result))}});
    await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId,actorUserId:actor.userId,action:'DISASTER_ENGINE_RUN',reason:'Coordinator refreshed multi-source preparedness indicators',metadata:{region_id:regionId,predictions:result.predictions.length,engine_version:result.engineVersion}}});
  });return result;
 },
 async sourceHealth(actor:Actor,organizationId:string,regionId:string){const result=await this.predictions(actor,organizationId,regionId);return {sources:result.sources,engineVersion:result.engineVersion,mode:result.mode,generatedAt:result.generatedAt};},
};
async function compute(actor:Actor,organizationId:string,regionId:string,region:Awaited<ReturnType<typeof regionContext>>):Promise<DisasterEngineResult>{
 const generatedAt=new Date().toISOString(),points=samplePointsForBounds(region.bounds),centroid=points[0];
 const omOn=enabled('SENTINEL_OPEN_METEO_ENABLED'),nwsOn=enabled('SENTINEL_NWS_ENABLED'),rwOn=enabled('SENTINEL_RELIEFWEB_ENABLED'),usgsOn=enabled('SENTINEL_USGS_ENABLED',false);
 const usCoverage=centroid.longitude>=-125&&centroid.longitude<=-66&&centroid.latitude>=24&&centroid.latitude<=50;
 const [latest,hazards,open,flood,nws,relief,local]=await Promise.all([
  SentinelService.latest(actor,organizationId,regionId).catch(e=>{authError(e);return null;}),
  usgsOn?SentinelService.hazards(actor,organizationId,regionId).catch(e=>{authError(e);return null;}):null,
  omOn?fetchOpenMeteoPoints(points,AbortSignal.timeout(20000)):null,
  omOn?fetchFloodForPoint(centroid,AbortSignal.timeout(15000)):null,
  nwsOn&&usCoverage?fetchNwsAlerts(centroid,AbortSignal.timeout(15000)):null,
  rwOn?fetchReliefWeb(AbortSignal.timeout(15000)):null,
  withRegion(actor,organizationId,regionId,true,tx=>tx.operationRecord.findMany({where:{organizationId,regionId,kind:{in:['INCIDENT','SPECIAL_EVIDENCE']}},orderBy:{sequence:'desc'},take:500})),
 ]);
 const observations:CanonicalObservation[]=[],health=new Map<string,SourceHealth>(),gaps:string[]=[];
 const put=(source:string,isEnabled:boolean,status:SourceHealth['status'],count:number,note:string)=>{
  const d=SOURCE_REGISTRY.find(s=>s.id===source)!;
  health.set(source,{source,label:d.label,enabled:isEnabled,status,observations:count,lastReceivedAt:status==='OK'||status==='PARTIAL'?generatedAt:null,keyless:d.keyless,note});
 };
 const wn=latest?.status==='AVAILABLE'?observationsFromForecastCells(latest.cells):[];observations.push(...wn);
 put('WEATHERNEXT3',enabled('WEATHERNEXT_ACCESS_ENABLED',false),wn.length?'OK':'UNAVAILABLE',wn.length,wn.length?'Stored WeatherNext forecast. Its BigQuery and GCS copies are one model, never independent confirmation.':latest?.status==='STALE'?'The stored WeatherNext forecast is too old. Refresh the forecast.':'No current stored WeatherNext forecast is available. BigQuery access and GCS access are separate settings.');
 if(wn.length&&latest?.run)health.get('WEATHERNEXT3')!.lastReceivedAt=new Date(latest.run.retrieved_at).toISOString();
 if(!wn.length)gaps.push('A current stored WeatherNext forecast');
 const eq=observationsFromEarthquakes((hazards?.observations??[]) as Array<Record<string,unknown>>);observations.push(...eq);
 put('USGS',usgsOn,!usgsOn?'DISABLED':hazards?'OK':'UNAVAILABLE',eq.length,'Stored observed earthquakes from the past 24 hours; an empty event list is not a source-worker heartbeat.');
 observations.push(...open?.observations??[]);
 put('OPEN_METEO',omOn,!omOn?'DISABLED':open?.observations.length?(open.status==='PARTIAL'?'PARTIAL':'OK'):'UNAVAILABLE',open?.observations.length??0,'Forecasts at up to five sample points, not complete region coverage. Model weighting is provisional, not measured accuracy.');
 if(flood)observations.push(flood);
 put('OPEN_METEO_FLOOD',omOn,!omOn?'DISABLED':flood?.dischargeM3s!=null?'OK':'UNAVAILABLE',flood?.dischargeM3s!=null?1:0,'Forecast river discharge only. Without basin-specific thresholds it cannot establish flooding or a probability.');
 observations.push(...nws?.observations??[]);
 put('NWS',nwsOn,!nwsOn?'DISABLED':!usCoverage?'OUTSIDE_COVERAGE':nws?.status==='OK'?'OK':'UNAVAILABLE',nws?.observations.length??0,'Official alerts for one sample point in the contiguous US. This is not region-wide or global warning coverage.');
 // Country centroids are context, not disaster coordinates: never turn them into local hazard pins.
 const reports=relief?.reports??[];
 put('RELIEFWEB',rwOn,!rwOn?'DISABLED':relief?.status==='OK'?'OK':relief?.status==='NOT_CONFIGURED'?'NOT_CONFIGURED':relief?.status==='ACCESS_DENIED'?'ACCESS_DENIED':'UNAVAILABLE',reports.length,relief?.status==='ACCESS_DENIED'?'ReliefWeb rejected the configured app name. Confirm its read-API approval with ReliefWeb.':'Recent worldwide country-level reports; regional relevance is unverified. No disaster coordinates or local pins are inferred.');
 let gdacs=0,gauges=0;const seenGauges=new Set<string>();
 const ordered=local.slice().sort((a,b)=>Date.parse((b.payload as any).observed_at??b.updatedAt)-Date.parse((a.payload as any).observed_at??a.updatedAt));
 for(const row of ordered){
  const p=row.payload as Record<string,any>;
  if(typeof p.longitude!=='number'||typeof p.latitude!=='number'||!withinBounds(p.longitude,p.latitude,region.bounds))continue;
  const isGauge=p.evidence_kind==='GAUGE_READING';
  if(isGauge){const id=String(p.gauge_id??row.id);if(seenGauges.has(id))continue;seenGauges.add(id);}
  if(row.kind==='INCIDENT'&&p.source_name==='GDACS'&&p.status!=='DISMISSED'&&p.published_at){
    const hazard:HazardKind|undefined=({SEVERE_RAIN:'HEAVY_RAIN',FLOOD:'FLOOD',STORM:'STORM',EARTHQUAKE:'EARTHQUAKE',WILDFIRE:'WILDFIRE',DROUGHT:'DROUGHT',LANDSLIDE:'LANDSLIDE'} as Record<string,HazardKind>)[p.type];
    if(hazard){observations.push(reportObservation('GDACS',row.id,p.longitude,p.latitude,p.published_at,hazard,p.title,p.severity,generatedAt));gdacs++;}
  } else if(isGauge&&typeof p.level_m==='number'&&typeof p.watch_level_m==='number'&&p.observed_at&&Date.parse(p.observed_at)>Date.now()-6*3600000&&Date.parse(p.observed_at)<=Date.now()+300000){
    gauges++;if(p.level_m>=p.watch_level_m)observations.push(reportObservation('GAUGE',row.id,p.longitude,p.latitude,p.observed_at,'FLOOD',`Recorded gauge ${p.name??p.gauge_id??''}: ${p.level_m}m at or above its local watch level ${p.watch_level_m}m. Not a live sensor.`, 'Moderate',generatedAt));
  }
 }
 put('GDACS',enabled('INCIDENT_FEEDS_ENABLED',false),gdacs?'OK':enabled('INCIDENT_FEEDS_ENABLED',false)?'UNAVAILABLE':'DISABLED',gdacs,'Stored scoped GDACS reports; not independent forecasts or verified local impacts.');
 put('GAUGE',true,gauges?'OK':'UNAVAILABLE',gauges,'Geotagged coordinator gauge records from the past six hours, not live telemetry.');
 put('COMMUNITY',false,'NOT_CONFIGURED',0,'No validated sensor-candidate correlation adapter is connected.');
 gaps.push('Region-specific threshold validation','River basin thresholds and local flood-impact modelling','Validated slope, fuel and exposure layers','Global official warning coverage','Continuous phone and IoT sensor coverage');
 if(local.length===500)gaps.push('Local evidence listing reached its 500-record limit');
 const predictions=fusePredictions(observations,{...DEFAULT_THRESHOLDS,heatWatchC:region.policy.heat_c,heatSevereC:Math.max(region.policy.heat_c+5,DEFAULT_THRESHOLDS.heatSevereC),windWatchMps:region.policy.wind_mps,hourlyRainWatchMm:region.policy.hourly_rain_mm});
 if(predictions.length>200)gaps.push('Showing the 200 highest-ranked indicators; additional indicators are omitted from this response');
 const sources=SOURCE_REGISTRY.map(s=>health.get(s.id)!);
 return {weatherProbabilityEstimates:weatherProbabilities(latest?.status==='AVAILABLE'?latest.cells:[],region.policy),status:sources.some(s=>s.status==='OK'||s.status==='PARTIAL')?'PARTIAL':'UNAVAILABLE',mode:ENGINE_MODE,validation:'UNVALIDATED_INDICATOR',operationalWarning:false,engineVersion:ENGINE_VERSION,generatedAt,expiresAt:new Date(Math.min(Date.now()+CACHE_MS,latest?.status==='AVAILABLE'?new Date(latest.run!.expires_at).getTime():Infinity)).toISOString(),source_id:'engine-'+randomUUID(),policyVersion:region.policy.version,regionFingerprint:createHash('sha256').update(JSON.stringify(region)).digest('hex'),region:{id:region.id,name:region.name},predictionCount:predictions.length,truncated:predictions.length>200,predictions:predictions.slice(0,200),sources,coverageGaps:gaps,capabilities:ENGINE_CAPABILITIES,contextReports:reports.map(o=>({source:'RELIEFWEB',title:o.title,observedAt:o.observedAt,scope:'Country context: '+(o.countries.join(', ')||'unspecified')+'. Relevance to this operating region is unverified.'})),disclaimer:'Provisional preparedness indicators and source reports, not validated disaster forecasts. No calibrated probabilities, arrival countdowns, impact boundaries or movement authorization are produced. Confirm official warnings and local conditions.'};
}
function reportObservation(source:'GDACS'|'GAUGE',id:string,longitude:number,latitude:number,observedAt:string,hazard:HazardKind,title:string,alertSeverity:string,receivedAt:string):CanonicalObservation{
 return {source,upstream:source.toLowerCase(),externalId:id,longitude,latitude,observedAt,validAt:observedAt,receivedAt,hazard,title,alertSeverity,evidenceKind:'REPORTED',rain24Mm:null,rain72Mm:null,maxHourlyRainMm:null,maxTempC:null,minHumidityPct:null,maxWindMps:null,maxGustMps:null,soilMoisture:null,dischargeM3s:null,dischargePercentile:null,magnitude:null,depthKm:null};
}
export {SOURCE_REGISTRY};

/** Bound model context without silently dropping the fact that evidence was selected. */
export function engineAssistantEvidence(result:DisasterEngineResult){
 return {...result,predictions:result.predictions.slice(0,12),contextReports:result.contextReports.slice(0,8),
  weatherProbabilityEstimates:{...result.weatherProbabilityEstimates,estimates:result.weatherProbabilityEstimates.estimates.slice(0,6),truncated:result.weatherProbabilityEstimates.total>6},
  selection:{indicator_limit:12,indicator_total:result.predictionCount,probability_limit:6,country_report_limit:8,country_report_total:result.contextReports.length,note:'Highest-ranked indicators and probability ranges only. This is a selected summary, not exhaustive geographic coverage.'}};
}
