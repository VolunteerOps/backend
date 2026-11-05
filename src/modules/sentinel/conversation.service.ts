import {engineAssistantEvidence,DisasterEngineService,type DisasterEngineResult} from './disaster.service.js';
import {runWeatherExplanation} from './weather-explanation.js';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {ApiError} from '../../core/errors.js';
import {withActor,type Actor} from '../organizations/context.js';
import {withRegion} from './sentinel.context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {authorizeCapability} from '../billing/capabilities.js';
import {reserveUsage,finishUsage} from '../billing/usage.service.js';
import {featureCatalog} from '../billing/feature-catalog.js';
import {runMetaAgent,metaModels} from './meta-agent.js';
import {runStored} from './planning.service.js';
import {conversationRequest,missionConversationRequest,assistantAnswer,windowRequest,validateWindow,dailyWindow} from './assistant-contract.js';
import {exploreBigQuery,exploreGcs,sourceFailure} from './providers/weather-explorer.js';
import {boundsSchema} from './providers/weathernext3.contract.js';
import {forecastPolicySchema} from './forecast-assessment.js';
import {analyzeWeather} from './weather-analysis.js';
import {SentinelService} from './sentinel.service.js';
import {missionSchema} from '../operations/operations.schema.js';
import {searchPlaces} from './place-search.js';
import {missionFields as fields,missionReply,missionReady,locationGrounded} from './mission-planner-contract.js';
import {logger} from '../../core/logger.js';
const noArgs=z.object({}).strict();
async function regionContext(actor:Actor,org:string,region:string){return withRegion(actor,org,region,false,async tx=>{
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
 const row=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});
 return {name:row.name,bounds:boundsSchema.parse(row.forecastBounds),policy:forecastPolicySchema.parse(row.forecastPolicy)};
});}
export async function weatherConversation(actor:Actor,org:string,region:string,key:string,input:unknown,events?:(event:import("./meta-agent.js").AgentEvent)=>void){
 const request=conversationRequest.parse(input);
 return runStored(actor,org,region,key,'WEATHER_ANALYSIS',request,async()=>{
  const regionInfo=await regionContext(actor,org,region);const signal=AbortSignal.timeout(180000);
  let engineEvidence:DisasterEngineResult|undefined;
  const evidenceIds=()=>[...sources.map(source=>source.source_id).filter(Boolean),...(engineEvidence?[engineEvidence.source_id]:[])];
  const sources:any[]=[];const cache=new Map<string,unknown>();const unavailableSources=new Map<string,ReturnType<typeof sourceFailure>>();let searches=0;
  const analyze=async(raw:unknown)=>{
   await regionContext(actor,org,region);
   const args=windowRequest.parse(raw);let windows:ReturnType<typeof validateWindow>;
   try{windows=validateWindow(args.from,args.to);}catch{return {status:'UNSUPPORTED_WINDOW',message:'This data tool supports the previous 31 days and next 15 days, in spans of up to 14 days. A seasonal outlook needs a separate seasonal source. Explain the gap and offer a supported comparison; do not extrapolate.'};}
   const id=JSON.stringify(args);if(cache.has(id))return cache.get(id);
   if(++searches>3) return {status:'LIMIT',message:'Three broad searches are available in this turn and they are used. Ask a follow-up to explore another period.'};
   const results:any[]=[];
   for(const window of windows){
    await Promise.all([...new Set(args.sources)].map(async source=>{
     signal.throwIfAborted();
     if(unavailableSources.has(source)){const failed={surface:source,...window,...unavailableSources.get(source) as object};sources.push(failed);results.push(failed);return;}
     try{
      const batch=await (source==='GCS'?exploreGcs:exploreBigQuery)(window.from,window.to,regionInfo.bounds,signal,windows.length);
      const analysis=analyzeWeather(batch.cells,regionInfo.policy,window.from,window.to);
      const entry={source_id:batch.jobId,surface:source,forecast_init:batch.initTime,retrieved_at:batch.retrievedAt,from:window.from,to:window.to,kind:Date.parse(window.to)<=Date.now()?'ARCHIVED_FORECAST_NOT_OBSERVATIONS':'FORECAST',indicators:{...analysis,grid_cells:analysis.points.length,points:analysis.points.slice().sort((a,b)=>(b.maximum_hourly_mean_rain_mm||0)-(a.maximum_hourly_mean_rain_mm||0)).slice(0,8),point_selection:'Up to eight grid cells with highest hourly mean rainfall; not a regional average.'},bytes_read:'bytes_read' in batch?batch.bytes_read:undefined};
      sources.push(entry);results.push(entry);
     }catch(error){const failure=sourceFailure(error);if(['WEATHER_ACCESS_DENIED','WEATHER_BILLING_REQUIRED','WEATHERNEXT_NOT_CONFIGURED','FORECAST_REFRESH_DISABLED','GCS_NOT_CONFIGURED','FORECAST_QUERY_BUDGET_EXCEEDED'].includes(String(failure.code)))unavailableSources.set(source,failure);const unavailable={surface:source,...window,...failure};sources.push(unavailable);results.push(unavailable);}
    }));
   }
   const result={region:regionInfo.name,results,limitations:['WeatherNext archives are past predictions, not measured weather.','No seasonal ENSO outlook, rain gauges, river levels or local impact model is connected.','BigQuery and GCS are access paths to the same forecast model; agreement is not independent confirmation.']};cache.set(id,result);return result;
  };
  let automatic:unknown;
  if(request.mode==='DAILY_BRIEF')automatic=await analyze({...dailyWindow(),sources:['BIGQUERY','GCS']});
  const result=await runWeatherExplanation({stream:!!events,onEvent:events,sourceIds:evidenceIds,signal,question:JSON.stringify({question:request.question,history:request.history,automatic_evidence:automatic}),
   instruction:`You are ResQ's preparedness analyst for humanitarian officers. Current UTC time ${new Date().toISOString()}; region ${regionInfo.name}. Explain in everyday language. Interpret dates and ask focused follow-ups if ambiguous. Use analyze_weather_window to retrieve evidence for the user's actual dates (past 31 days, next 15 days, max 14-day span). It retrieves archived forecasts for past days, NOT observed weather. No seasonal/ENSO dataset is connected: never infer a month's outlook or El Nino status from short forecasts. Clearly explain unsupported periods, missing sources and spending limits. Give practical preparation checks, not evacuation/safe-route orders. Always distinguish successful evidence from failed retrieval. Unavailable sources are a valid outcome: explain what could not be checked, include the missing sources in missing_inputs, leave source_ids empty if no usable source was retrieved, and label preparation suggestions as general checks. Do not repeatedly retry unavailable sources. Once the required evidence tools have returned, provide your final answer. Cite only returned source_id values. A daily briefing covers previous three days and the next seven, explicitly acknowledging gaps. Numerical facts must come from the tools. read_disaster_indicators supplies current multi-source evidence, gaps and experimental weather probability ranges. A heuristic severity, confidence or source weight is not a disaster probability; never multiply it by 100 and call it a likelihood. Quote provided probability ranges only for their precise weather threshold, grid location and valid time, with the experimental/uncalibrated label. Do not turn weather exceedance into disaster-impact probability or extrapolate the engine snapshot to the requested historical dates. Official source warnings and observed events must remain distinct from new forecasts. Tools cannot deploy volunteers or change records.`,
   requiredTools:request.mode==='DAILY_BRIEF'?['read_local_reports','read_disaster_indicators']:['analyze_weather_window','read_local_reports','read_disaster_indicators'],tools:[
    {name:'read_disaster_indicators',description:'Read the current regional multi-source engine snapshot, experimental weather probability ranges, source status and missing capabilities. Snapshot dates must match any claim; heuristic scores are not probabilities.',arguments:noArgs,execute:async()=>{signal.throwIfAborted();try{engineEvidence=await DisasterEngineService.predictions(actor,org,region);signal.throwIfAborted();return engineAssistantEvidence(engineEvidence);}catch(error){if(signal.aborted)throw error;if(error instanceof ApiError&&[401,403].includes(error.statusCode))throw error;return {status:'UNAVAILABLE',message:'The multi-source snapshot could not be loaded. Do not infer safety or hazard probability.'};}}},
    {name:'analyze_weather_window',description:'Retrieve bounded regional forecast data from BigQuery and/or GCS Zarr and compute rainfall, heat and wind indicators. Up to three searches per turn; choose the complete period needed in one call when possible. Both sources are recommended for comparison.',arguments:windowRequest,execute:analyze},
    {name:'read_local_reports',description:'Read scoped hazard reports and current forecast coverage; earthquake reports do not establish flood conditions.',arguments:noArgs,execute:async()=>({hazards:await SentinelService.hazards(actor,org,region),latest:await SentinelService.insights(actor,org,region)})},
   ]});
  const valid=new Set(evidenceIds());
  if(result.result.source_ids.some((id:string)=>!valid.has(id)))throw new ApiError(503,'ANALYSIS_FAILED','The assistant cited a source that was not retrieved. Please try again.');
  const primary=sources.filter(s=>s.indicators?.points?.length&&Date.parse(s.to)>Date.now()).sort((a,b)=>Date.parse(b.forecast_init)-Date.parse(a.forecast_init))[0];
  return {source:primary?{source_id:primary.source_id,init_time:primary.forecast_init,retrieved_at:primary.retrieved_at,bounds:regionInfo.bounds}:undefined,evidence:primary?.indicators,validation:'WEATHER_INDICATORS_ONLY',workflow:'WEATHER_CONVERSATION',title:request.mode==='DAILY_BRIEF'?'Daily preparedness briefing':request.question.slice(0,120),model:result.model,narrative:result.result,sources,engine_evidence:engineEvidence,tool_calls:result.tool_calls,harness:result.harness,coverage:sources.some(s=>s.source_id)?'PARTIAL_OR_COMPLETE':engineEvidence?'ENGINE_EVIDENCE_ONLY':'NO_FORECAST_EVIDENCE',assumptions:result.result.assumptions,missing_inputs:result.result.missing_inputs};
 });
}
export async function missionConversation(actor:Actor,org:string,region:string,key:string,input:unknown,events?:(event:import("./meta-agent.js").AgentEvent)=>void){
 const request=missionConversationRequest.parse(input),{role}=await authorizeCapability(actor,org,region,'agent.chat');requireCoordinator(role);
 const context=await regionContext(actor,org,region);
 const usage=await reserveUsage(actor,{key,bucket:'agent.chat',limit:featureCatalog.assistant.ops_daily_attempts,fingerprint:createHash('sha256').update(JSON.stringify([org,region,'MISSION_CONVERSATION',request])).digest('hex')});
 if(usage.replayed){const prior=(usage.entry.metadata as any)?.assistant_result;if(prior)return prior;if(usage.entry.state==='FINALIZED')throw new ApiError(503,'ANALYSIS_INTERRUPTED','This reply stopped before it finished. Try again.');throw ApiError.conflict('This reply is still being prepared. Try again shortly to retrieve it.','AGENT_IN_PROGRESS');}
 try{
 const locations:Array<Record<string,unknown>>=[request.draft];
 const result=await runMetaAgent({stream:!!events,onEvent:events,harness:{verify:reply=>locationGrounded(reply.draft,locations)?[]:['Coordinates must match the supplied draft or a place actually returned by find_places. Otherwise leave coordinates null and ask the coordinator for the location.']},model:metaModels.planning,maxTokens:1600,output:missionReply,signal:AbortSignal.timeout(60000),question:JSON.stringify(request),requiredTools:['read_mission_requirements'],instruction:`Help a humanitarian coordinator plan a mission, one question at a time. Today is ${new Date().toISOString()}, user timezone ${request.timezone}. Retain all relevant extra details in brief or notes. Do not invent missing dates, coordinates, capacity, skills or meeting points. Ask for clarification when details conflict; accept corrections to previous answers. Set missing values null. Title 3-160 characters, brief 10-5000, capacity integer 1-1000, mission length positive with no fixed maximum - use the length the coordinator stipulates, meeting point 3-500, each skill 2-60. Convert agreed local times to ISO UTC. Search places when a location is given, ask the user to confirm the intended match before using coordinates; a city centre is not a verified meeting site. Never create or dispatch a mission: return a draft for review.`,tools:[
 {name:'read_mission_requirements',description:'Read the actual mission form constraints and selected region.',arguments:noArgs,execute:async()=>({context:await regionContext(actor,org,region),fields,maximum_duration_hours:null,capacity:{minimum:1,maximum:1000},saving:'Coordinator must review and explicitly create the mission.'})},
 {name:'find_places',description:'Look up real place matches for the mission location. Ask the coordinator to confirm.',arguments:z.object({query:z.string().min(2).max(200)}).strict(),execute:async(args:any)=>{const matches=await searchPlaces(actor,org,args.query);for(const place of matches.items)locations.push({longitude:place.center[0],latitude:place.center[1]});return matches;}}]});
 const draft=Object.fromEntries(Object.entries(result.result.draft).filter(([,v])=>v!==null));const check=missionSchema.safeParse(draft);
 const issues=check.success?[]:check.error.issues.map(i=>({field:i.path.join('.'),message:i.message}));
 const completedFields=Object.keys(draft);const answer={...result.result,draft,ready:missionReady(check.success,result.result.next_field),issues,model:result.model,region:context.name,actions_executed:[],harness:result.harness,progress:{completed_fields:completedFields,missing_fields:fields.filter(f=>!(f in draft))},checkpoint:{draft,completed_fields:completedFields,at:new Date().toISOString()}};
 await withActor(actor,async tx=>{await tx.$queryRaw`SELECT set_config('vops.usage','true',true)`;await tx.usageLedger.update({where:{id:usage.entry.id},data:{metadata:JSON.parse(JSON.stringify({...usage.entry.metadata as any,assistant_result:answer}))}});});
 return answer;
 }catch(error){
  const failure=error as {code?:string;name?:string;message?:string};
  logger.error('MISSION_PLANNER_FAILED',{model:metaModels.planning,category:failure.code||failure.name||'UNKNOWN',reason:/^[A-Z_0-9]+$/.test(failure.message||'')?failure.message:'REDACTED'});
  if(error instanceof ApiError)throw error;
  // Provider/network/schema failures are not user form errors. Do not expose model output.
  throw new ApiError(503,'AGENT_UNAVAILABLE','The mission planner could not finish this reply. Your mission has not been created. Try again.');
 }finally{await finishUsage(actor,usage.entry.id,'FINALIZED');}
}
