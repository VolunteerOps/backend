import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {withRegion} from './sentinel.context.js';
import {runMetaAgent,metaModels,type ControlledTool} from './meta-agent.js';
import {runStored} from './planning.service.js';
import {readPlanningContext} from './planning-context.js';
import {assessmentEvidence} from './planning-evidence.js';
import {resourcePlanOutput,validateResourcePlan} from './planning-contract.js';
import {SentinelService} from './sentinel.service.js';
import {applyScenario,planDiff,shortageOptions,expiryFindings,gaugeCrossings,specialisedOutput,briefingOutput,afterActionOutput,
 evidenceCreate,floodRequest,watchRequest,heatRequest,windRequest,multiRegionRequest,outcomeRequest,
 foresightRequest,whatIfRequest,shortageRequest,briefingRequest,translateRequest,reviewRequest,
 afterActionRequest,gapWorklistRequest,gapTaskUpdate} from './specialised-contract.js';

const payload=(v:unknown)=>v as Record<string,any>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
const noArguments=z.object({}).strict();
async function coordinator(tx:TenantTransaction,actor:Actor,org:string){
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
}
const check=(actor:Actor,org:string,region:string)=>withRegion(actor,org,region,false,tx=>coordinator(tx,actor,org));
async function evidenceRows(tx:TenantTransaction,org:string,region:string,kind?:string){
 const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIAL_EVIDENCE'},orderBy:{sequence:'desc'},take:501});
 return (rows.map(r=>({id:r.id,...payload(r.payload)})) as Array<Record<string,any>&{id:string}>).filter(r=>!kind||r.evidence_kind===kind);
}
async function localEvidence(actor:Actor,org:string,region:string){
 return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
  const all=await evidenceRows(tx,org,region);
  const by=(kind:string)=>all.filter(r=>r.evidence_kind===kind);
  return {gauges:gaugeCrossings(by('GAUGE_READING')),roads:by('ROAD_STATUS'),vulnerability:by('VULNERABILITY_PROFILE'),
   observations:by('FIELD_OBSERVATION'),substitutes:by('SUBSTITUTE_LINK')};});
}
async function assessmentContext(actor:Actor,org:string,region:string,assessmentId?:string,historical=false){
 return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
  const row=assessmentId?await tx.operationRecord.findFirst({where:{id:assessmentId,organizationId:org,regionId:region,kind:'WEATHER_ANALYSIS'}})
   :await tx.operationRecord.findFirst({where:{organizationId:org,regionId:region,kind:'WEATHER_ANALYSIS'},orderBy:{sequence:'desc'}});
  if(!row)return null;
  const unit=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});
  try{const evidence=assessmentEvidence(row,unit,Date.now(),historical);const p=payload(row.payload);
   return {assessment_id:row.id,evidence,narrative:p.narrative??null,points:payload(row.payload).evidence?.points??[],limitations:payload(row.payload).evidence?.missing_inputs??[]};}
  catch{return {assessment_id:row.id,status:'STALE_OR_CHANGED',note:'The latest assessment no longer matches current regional policy, bounds or freshness. Run a new assessment.'};}});
}
function analysis(actor:Actor,org:string,region:string,key:string,type:string,input:unknown,compute:()=>Promise<Record<string,unknown>>){
 return runStored(actor,org,region,key,'SPECIALISED',{analysis_type:type,...payload(input)},async()=>({analysis_type:type,...await compute()}));
}
const floodLimitation='No validated local flood-impact model is connected. Rainfall and gauge evidence support preparedness judgements, not a local flood-impact estimate.';

export const SpecialisedService={
 async createEvidence(actor:Actor,org:string,region:string,input:z.infer<typeof evidenceCreate>){
  const data=evidenceCreate.parse(input);
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const {kind,...rest}=data;
   const row=await tx.operationRecord.create({data:{id:randomUUID(),organizationId:org,regionId:region,kind:'SPECIAL_EVIDENCE',ownerId:actor.userId,payload:json({evidence_kind:kind,...rest,recorded_by:actor.userId})}});
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'SPECIAL_EVIDENCE_RECORDED',reason:'Coordinator recorded '+kind,metadata:{region_id:region,evidence_id:row.id,kind}}});
   return row;});
 },
 async listEvidence(actor:Actor,org:string,region:string,kind?:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);return {items:await evidenceRows(tx,org,region,kind)};});
 },
 async list(actor:Actor,org:string,region:string,after=0){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIALISED',...(after?{sequence:{lt:after}}:{})},orderBy:{sequence:'desc'},take:51});
   return {items:rows.slice(0,50),next_cursor:rows.length>50?rows[50-1]!.sequence:null};});
 },
 async flood(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof floodRequest>){
  const request=floodRequest.parse(input);
  return analysis(actor,org,region,key,'FLOOD_SYNTHESIS',request,async()=>{
   const local=await localEvidence(actor,org,region);const assessment=await assessmentContext(actor,org,region,request.assessment_id);
   const tools:ControlledTool[]=[
    {name:'read_forecast_rainfall',description:'Read the linked or latest weather assessment: rainfall indicators, thresholds and limitations.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return assessment??{status:'NO_ASSESSMENT',missing_inputs:['Run a weather assessment first']};}},
    {name:'read_gauges',description:'Read the latest level per recorded river gauge against its coordinator-set watch level.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {gauges:local.gauges,missing_inputs:local.gauges.length?[]:['No gauge readings recorded for this region']};}},
    {name:'read_local_evidence',description:'Read recorded field observations and vulnerability profiles for this region.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {observations:local.observations,vulnerability:local.vulnerability};}},
   ];
   const result=await runMetaAgent({harness:{planFirst:true,verify:(draft)=>{const issues:string[]=[];if(/flood (depth|impact) (is|of) [0-9]/i.test(draft.summary))issues.push('The draft states a numeric flood depth or impact, which no tool supports');if(!draft.missing_inputs.length)issues.push('The draft lists no missing inputs; flood evidence always has local gaps');return issues;}},model:metaModels.weather,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Prepare a flood-preparedness synthesis. Combine forecast rainfall indicators with recorded gauge levels against their watch levels and any local observations. '+floodLimitation+' Never estimate flood depth, extent, affected people or safe routes. Name missing local inputs explicitly.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Flood preparedness synthesis',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,
    gauge_crossings:local.gauges,assessment_id:assessment?.assessment_id??null,flood_impact_estimate:null,limitation:floodLimitation};});
 },
 async watch(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof watchRequest>){
  const request=watchRequest.parse(input);
  return analysis(actor,org,region,key,'WATCH_BRIEF',request,async()=>{
   const local=await localEvidence(actor,org,region);const assessment=await assessmentContext(actor,org,region);
   const crossings=local.gauges.filter(g=>g.at_or_above_watch);
   const tools:ControlledTool[]=[
    {name:'read_gauges',description:'Read latest gauge levels, watch levels and crossings.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {gauges:local.gauges,crossings};}},
    {name:'read_forecast',description:'Read the latest weather assessment and its rainfall indicators, or its absence.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return assessment??{status:'NO_ASSESSMENT'};}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.weather,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Prepare a rising-water watch brief. State which gauges are at or above their coordinator-set watch levels and what forecast rainfall adds. Watch levels are local screening levels, not flood predictions. Recommend checks and escalation to the coordinator; issue no warnings.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Rising-water watch brief',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,
    crossings,alert:crossings.length>0,flood_impact_estimate:null,limitation:floodLimitation};});
 },
 async scheduleWatch(actor:Actor,org:string,region:string){
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const businessKey=JSON.stringify(['watch-brief',org,region,new Date().toISOString().slice(0,13)]);
   const existing=await tx.durableJob.findUnique({where:{businessKey}});if(existing)return {job_id:existing.id,state:existing.state};
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const job=await tx.durableJob.create({data:{id:randomUUID(),organizationId:org,priority:2,queue:'forecast',kind:'WATCH_BRIEF',businessKey,deadline:new Date(Date.now()+1800000),maxAttempts:2,
    payload:json({actor,organizationId:org,regionId:region})}});
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'WATCH_BRIEF_SCHEDULED',reason:'Coordinator scheduled a rising-water watch brief',metadata:{region_id:region,job_id:job.id}}});
   return {job_id:job.id,state:job.state};});
 },
 async heat(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof heatRequest>){
  const request=heatRequest.parse(input);
  return analysis(actor,org,region,key,'HEAT_HEALTH',request,async()=>{
   const local=await localEvidence(actor,org,region);const assessment=await assessmentContext(actor,org,region,request.assessment_id);
   const tools:ControlledTool[]=[
    {name:'read_heat_assessment',description:'Read sustained-heat indicators and regional thresholds from the weather assessment.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return assessment??{status:'NO_ASSESSMENT',missing_inputs:['Run a weather assessment first']};}},
    {name:'read_vulnerability',description:'Read coordinator-recorded vulnerability profiles: groups, counts and stated needs.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {profiles:local.vulnerability,missing_inputs:local.vulnerability.length?[]:['No vulnerability profiles recorded; heat advice stays general']};}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Prepare heat-health preparation proposals: shade, water, rest cycles and staffing adjustments, weighed against recorded vulnerability profiles. This is preparation guidance, not medical advice. Do not invent population counts; use only recorded profiles and say when none exist.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Heat-health preparation',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,assessment_id:assessment?.assessment_id??null};});
 },
 async wind(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof windRequest>){
  const request=windRequest.parse(input);
  return analysis(actor,org,region,key,'WIND_ACCESS',request,async()=>{
   const local=await localEvidence(actor,org,region);const assessment=await assessmentContext(actor,org,region);
   const snapshot=await readPlanningContext(actor,org,region,request.mission_id);
   const tools:ControlledTool[]=[
    {name:'read_wind_assessment',description:'Read strong-wind duration indicators and thresholds.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return assessment??{status:'NO_ASSESSMENT'};}},
    {name:'read_road_status',description:'Read recorded road, bridge and ferry access status for this region.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {access:local.roads,missing_inputs:local.roads.length?[]:['No access status recorded; every route needs a manual check']};}},
    {name:'read_mission_context',description:'Read the mission window, meeting point, capacity and candidate context.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return snapshot.mission;}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Assess wind and access risk for this mission. Flag every assignment assumption that depends on a restricted or closed access record, or on strong-wind durations at or above threshold. You cannot verify routes; list exactly what the coordinator must re-check before any approval. Issue no movement orders.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Wind & access assessment',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,
    access_concerns:local.roads.filter(r=>r.status!=='OPEN'),mission_id:request.mission_id};});
 },
 async multiRegion(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof multiRegionRequest>){
  const request=multiRegionRequest.parse(input);
  return analysis(actor,org,region,key,'MULTI_REGION',request,async()=>{
   const regions=await SentinelService.regions(actor,org);
   const tools:ControlledTool[]=[
    {name:'read_all_regions',description:'Read each scoped region: latest assessment indicator peaks, thresholds and evidence quality.',arguments:noArguments,execute:async()=>{
     const summaries=[];
     for(const entry of regions){const summary=await assessmentContext(actor,org,entry.id).catch(()=>null);
      summaries.push({region_id:entry.id,region:entry.name,status:summary&&'evidence' in summary?'CURRENT':'NO_CURRENT_ASSESSMENT',
       indicators:summary&&(summary as any).evidence?(summary as any).evidence.indicators:null,thresholds:summary&&(summary as any).evidence?(summary as any).evidence.thresholds:null});}
     return {regions:summaries};}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.weather,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Compare preparedness concern across regions using only the returned indicator peaks, thresholds and evidence status. Rank attention by threshold exceedance, and say plainly where evidence is missing or stale instead of ranking those regions. Cite region names, not invented scores.',requiredTools:['read_all_regions'],tools});
   return {title:'Multi-region comparison',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,region_count:regions.length};});
 },
 async outcome(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof outcomeRequest>){
  const request=outcomeRequest.parse(input);
  return analysis(actor,org,region,key,'OUTCOME_REVIEW',request,async()=>{
   const local=await localEvidence(actor,org,region);const assessment=await assessmentContext(actor,org,region,request.assessment_id,true);
   const window=assessment&&'evidence' in assessment?assessment.evidence?.window:null;
   const observations=local.observations.filter(o=>window&&Date.parse(o.observed_at)>=Date.parse(window.from)&&Date.parse(o.observed_at)<Date.parse(window.to));
   const comparison=(()=>{if(!assessment||!('evidence' in assessment))return null;
    const observedMax=(variable:string)=>{const values=observations.filter(o=>o.variable===variable&&o.unit===({RAINFALL_MM:'mm',TEMPERATURE_C:'C',WIND_MPS:'m/s',RIVER_LEVEL_M:'m'} as Record<string,string>)[variable]).map(o=>Number(o.value));return values.length?Math.max(...values):null;};
    return {observed:{maximum_rainfall_mm:observedMax('RAINFALL_MM'),maximum_temperature_c:observedMax('TEMPERATURE_C'),maximum_wind_mps:observedMax('WIND_MPS'),maximum_river_level_m:observedMax('RIVER_LEVEL_M')},
     forecast_indicators:(assessment as any).evidence.indicators,thresholds:(assessment as any).evidence.thresholds,note:'Observed maxima are recorded field observations; forecast values are grid indicators. Rainfall accumulation periods and station locations are not recorded, so these maxima cannot establish forecast accuracy or numerical bias.'};})();
   const tools:ControlledTool[]=[
    {name:'read_assessment',description:'Read the earlier assessment narrative, indicators and source.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return assessment??{status:'NO_ASSESSMENT'};}},
    {name:'read_observations',description:'Read recorded field observations and the deterministic forecast-versus-observed comparison.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {observations,comparison,missing_inputs:observations.length?[]:['No field observations recorded within this assessment window']};}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.weather,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Review forecast versus outcome. Compare the earlier assessment with recorded observations, report where indicators over- or under-stated conditions, and name calibration gaps. Never rewrite the earlier forecast as if it had been an observation.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Forecast-versus-outcome review',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,comparison,assessment_id:request.assessment_id};});
 },
 async foresight(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof foresightRequest>){
  const request=foresightRequest.parse(input);
  return analysis(actor,org,region,key,'CREDENTIAL_FORESIGHT',request,async()=>{
   const data=await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const credentials=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'CREDENTIAL'},take:3001});
    const missions=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'MISSION'},orderBy:{sequence:'desc'},take:201});
    const valid=credentials.map(c=>payload(c.payload)).filter(c=>c.status==='VERIFIED');
    const missionRows=(missions.map(m=>({id:m.id,...payload(m.payload)})) as Array<Record<string,any>&{id:string}>).filter(m=>['STAGED','ACTIVE'].includes(m.status));
    return {findings:expiryFindings(valid,missionRows,request.horizon_days),missions:missionRows.slice(0,50)};});
   const tools:ControlledTool[]=[
    {name:'read_expiring_credentials',description:'Read skills with credentials expiring in the horizon and missions they affect.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {horizon_days:request.horizon_days,findings:data.findings,missing_inputs:data.findings.length?[]:['No credentials expire in this horizon']};}},
    {name:'read_mission_pipeline',description:'Read upcoming staged and active missions and required skills.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return data.missions;}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Highlight roles that will become unstaffable as credentials expire, which missions are affected, and renewal scheduling the coordinator should start. Use only the returned findings; do not invent volunteers or expiry dates.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Credential-expiry foresight',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,findings:data.findings,horizon_days:request.horizon_days};});
 },
 async whatIf(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof whatIfRequest>){
  const request=whatIfRequest.parse(input);
  return analysis(actor,org,region,key,'WHAT_IF',request,async()=>{
   const base=await readPlanningContext(actor,org,region,request.mission_id);
   const scenario=applyScenario(base,request);
   const basePlan=request.base_proposal_id?await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const row=await tx.operationRecord.findFirst({where:{id:request.base_proposal_id,organizationId:org,regionId:region,kind:'RESOURCE_PLAN'}});
    if(!row||payload(row.payload).mission_id!==request.mission_id||!payload(row.payload).recommendation)throw ApiError.conflict('Choose a completed proposal for this mission.','BASE_PROPOSAL_MISMATCH');
    return payload(row.payload).recommendation as z.infer<typeof resourcePlanOutput>;}):null;
   const tools:ControlledTool[]=[
    {name:'read_base_snapshot',description:'Read the current validated mission snapshot before scenario overrides.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return base;}},
    {name:'read_scenario_snapshot',description:'Read the snapshot after coordinator scenario overrides: capacity, skills and stock adjustments applied, eligibility recomputed.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return scenario;}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:resourcePlanOutput,signal:AbortSignal.timeout(90000),
    instruction:'Prepare an allocation for the SCENARIO snapshot only. Choose only eligible candidate IDs and known resource IDs in that snapshot, within its capacity and adjusted stock. State shortages and decisions. This is a what-if draft; it reserves nothing.',requiredTools:tools.map(t=>t.name),tools});
   validateResourcePlan(result.result,scenario);
   return {title:'What-if scenario: '+scenario.mission.title,model:result.model,tool_calls:result.tool_calls,harness:result.harness,recommendation:result.result,
    scenario_snapshot:scenario,diff:planDiff(basePlan??{allocations:[]},result.result),base_proposal_id:request.base_proposal_id??null,mission_id:request.mission_id};});
 },
 async shortage(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof shortageRequest>){
  const request=shortageRequest.parse(input);
  return analysis(actor,org,region,key,'SHORTAGE_OPTIONS',request,async()=>{
   const snapshot=await readPlanningContext(actor,org,region,request.mission_id);
   const local=await localEvidence(actor,org,region);
   const options=shortageOptions(snapshot,request.requirements,local.substitutes);
   const tools:ControlledTool[]=[
    {name:'read_shortage_options',description:'Read deterministic shortage options: shortfalls, splits across same-title stock locations and recorded substitutes.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return {options,limitations:snapshot.limitations};}},
    {name:'read_stock',description:'Read current stock with locations and available quantities.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return snapshot.resources;}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:specialisedOutput,signal:AbortSignal.timeout(90000),
    instruction:'Explain the shortage options the tool computed: what is short, what can be split across storage locations, what recorded substitutes exist, and what remains unmet. Recommend only option IDs and quantities the tool returned; every option still needs coordinator approval and stock revalidation.',requiredTools:tools.map(t=>t.name),tools});
   return {title:'Supply-shortage options',model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,options,mission_id:request.mission_id};});
 },
 async briefing(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof briefingRequest>){
  const request=briefingRequest.parse(input);
  return analysis(actor,org,region,key,'BRIEFING',request,async()=>{
   const source=await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const kind=request.source_kind==='ASSESSMENT'?'WEATHER_ANALYSIS':request.source_kind==='PROPOSAL'?'RESOURCE_PLAN':'SPECIALISED';
    const row=await tx.operationRecord.findFirst({where:{id:request.source_id,organizationId:org,regionId:region,kind}});
    if(!row)throw ApiError.notFound('Briefing source');
    if(!['DRAFT','APPROVED'].includes(payload(row.payload).status))throw ApiError.conflict('Choose a completed source for this briefing.','FOLLOW_UP_UNAVAILABLE');
    return {source_id:row.id,...payload(row.payload)};});
   const model=request.source_kind==='ASSESSMENT'?metaModels.weather:metaModels.planning;
   const audienceGuide={COORDINATOR:'a coordinator making decisions: full detail, decisions and gaps first',VOLUNTEER:'volunteers preparing to help: what to bring, when and where to report, safety checks, no internal deliberation',PUBLIC:'the public: plain language, what is known, what to do, what is not known, no internal detail'}[request.audience];
   const tools:ControlledTool[]=[{name:'read_source',description:'Read the source assessment, proposal or analysis to brief from.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return source;}}];
   const result=await runMetaAgent({model,question:'Draft a '+request.audience+' briefing in language "'+request.language+'" from the source record.',output:briefingOutput,signal:AbortSignal.timeout(90000),
    instruction:'Draft a briefing for '+audienceGuide+'. Write in the requested language. Keep every source citation and limitation from the source; add no facts, warnings or instructions the source does not support. This draft takes effect only after coordinator approval.',requiredTools:['read_source'],tools});
   return {title:result.result.headline,model:result.model,tool_calls:result.tool_calls,harness:result.harness,briefing:result.result,
    audience:request.audience,language:request.language,source_kind:request.source_kind,source_id:request.source_id,translation_of:null};});
 },
 async translate(actor:Actor,org:string,region:string,key:string,id:string,input:z.infer<typeof translateRequest>){
  const request=translateRequest.parse(input);
  return analysis(actor,org,region,key,'BRIEFING',{briefing_id:id,...request},async()=>{
   const source=await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'SPECIALISED'}});
    if(!row||payload(row.payload).analysis_type!=='BRIEFING')throw ApiError.notFound('Briefing');
    if(payload(row.payload).status!=='APPROVED')throw ApiError.conflict('Approve the briefing before translating it','BRIEFING_NOT_APPROVED');
    return payload(row.payload);});
   const tools:ControlledTool[]=[{name:'read_approved_briefing',description:'Read the approved briefing to translate.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return source.briefing;}}];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:'Translate this approved briefing into language "'+request.language+'".',output:briefingOutput,signal:AbortSignal.timeout(90000),
    instruction:'Translate faithfully into the requested language. Preserve every number, source citation and limitation exactly in meaning. Add nothing. The translation is a new draft and needs its own coordinator approval before use.',requiredTools:['read_approved_briefing'],tools});
   return {title:result.result.headline,model:result.model,tool_calls:result.tool_calls,harness:result.harness,briefing:result.result,
    audience:source.audience,language:request.language,source_kind:source.source_kind,source_id:source.source_id,translation_of:id};});
 },
 async review(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof reviewRequest>){
  const request=reviewRequest.parse(input);
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'SPECIALISED'}});
   if(!row)throw ApiError.notFound('Specialised record');const p=payload(row.payload);
   if(!['BRIEFING','AFTER_ACTION'].includes(p.analysis_type))throw ApiError.conflict('Only briefings and after-action drafts can be approved here','INVALID_TRANSITION');
   const fingerprint=createHash('sha256').update(JSON.stringify([actor.userId,request])).digest('hex');
   if(p.status==='APPROVED'&&p.approval_key===key){
    if(p.approval_fingerprint!==fingerprint)throw ApiError.conflict('This approval key was already used for a different request.','IDEMPOTENCY_CONFLICT');
    return row;
   }
   if(row.version!==request.expected_version)throw ApiError.conflict('Record changed. Review it again','VERSION_CONFLICT');
   if(p.status!=='DRAFT')throw ApiError.conflict('Only a draft can be approved','INVALID_TRANSITION');
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'SPECIALISED_APPROVED',reason:request.reason,metadata:{region_id:region,record_id:id,analysis_type:p.analysis_type}}});
   return tx.operationRecord.update({where:{id,version:row.version},data:{version:{increment:1},updatedAt:new Date(),payload:json({...p,status:'APPROVED',approval_key:key,approval_fingerprint:fingerprint,approved_by:actor.userId,approved_at:new Date().toISOString(),approval_reason:request.reason})}});});
 },
 async afterAction(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof afterActionRequest>){
  const request=afterActionRequest.parse(input);
  return analysis(actor,org,region,key,'AFTER_ACTION',request,async()=>{
   const record=await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
    const mission=await tx.operationRecord.findFirst({where:{id:request.mission_id,organizationId:org,regionId:region,kind:'MISSION'}});
    if(!mission)throw ApiError.notFound('Mission');
    if(!['COMPLETED','CANCELLED'].includes(payload(mission.payload).status))throw ApiError.conflict('Close the mission before preparing its after-action summary.','MISSION_NOT_CLOSED');
    const assignments=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'ASSIGNMENT',parentId:request.mission_id},take:501});
    const proposals=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'RESOURCE_PLAN'},orderBy:{sequence:'desc'},take:51});
    return {mission:{id:mission.id,...payload(mission.payload)} as Record<string,any>,assignments:assignments.map(a=>({user_id:a.ownerId,...payload(a.payload)})),
     proposals:proposals.filter(r=>payload(r.payload).mission_id===request.mission_id).map(r=>({id:r.id,status:payload(r.payload).status,recommendation:payload(r.payload).recommendation}))};});
   const tools:ControlledTool[]=[
    {name:'read_mission_record',description:'Read the mission, assignments and related resource proposals.',arguments:noArguments,execute:async()=>{await check(actor,org,region);return record;}},
   ];
   const result=await runMetaAgent({harness:{},model:metaModels.planning,question:request.question,output:afterActionOutput,signal:AbortSignal.timeout(90000),
    instruction:'Draft an after-action summary from the record: what happened, what worked, issues, lessons and follow-ups. Use only the record; do not invent outcomes, attendance or impacts. This is a draft for coordinator review and does not change operational history.',requiredTools:['read_mission_record'],tools});
   return {title:'After-action: '+record.mission.title,model:result.model,tool_calls:result.tool_calls,harness:result.harness,result:result.result,mission_id:request.mission_id};});
 },
 async gapWorklist(actor:Actor,org:string,region:string,input:z.infer<typeof gapWorklistRequest>){
  const request=gapWorklistRequest.parse(input);
  const assessment=await assessmentContext(actor,org,region,request.assessment_id);
  if(!assessment)throw ApiError.notFound('Weather assessment');
  if(!assessment.evidence)throw ApiError.conflict('Refresh the weather assessment before making a worklist.','ASSESSMENT_STALE');
  const missing=[...new Set([...(('evidence' in assessment)?(assessment as any).evidence.missing_inputs:[]),...(assessment.narrative?.missing_inputs??[]),...(assessment.limitations??[])])].slice(0,16);
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'gap-tasks:'+request.assessment_id},0))::text`;
   const existing=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIAL_TASK',parentId:request.assessment_id},take:100});
   const known=new Set(existing.map(r=>payload(r.payload).title));
   const created=[];
   for(const item of missing){const title='Obtain: '+item;if(known.has(title))continue;
    created.push(await tx.operationRecord.create({data:{id:randomUUID(),organizationId:org,regionId:region,kind:'SPECIAL_TASK',parentId:request.assessment_id,ownerId:actor.userId,
     payload:json({title,detail:'Evidence gap from weather assessment '+request.assessment_id+': '+item,status:'OPEN',assignee_user_id:null,source_assessment_id:request.assessment_id})}}));}
   return {created,existing_count:existing.length,missing_inputs:missing};});
 },
 async listGapTasks(actor:Actor,org:string,region:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'SPECIAL_TASK'},orderBy:{sequence:'desc'},take:200});
   return {items:rows};});
 },
 async updateGapTask(actor:Actor,org:string,region:string,id:string,input:z.infer<typeof gapTaskUpdate>){
  const request=gapTaskUpdate.parse(input);
  return withRegion(actor,org,region,true,async tx=>{await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'SPECIAL_TASK'}});
   if(!row)throw ApiError.notFound('Worklist task');
   if(request.assignee_user_id!=null){
    const member=await tx.organizationMembership.findFirst({where:{organizationId:org,userId:request.assignee_user_id,status:'ACTIVE'}});
    if(!member||(member.regionIds.length&&!member.regionIds.includes(region)))throw ApiError.conflict('Choose an active member who can work in this region.','ASSIGNEE_UNAVAILABLE');
   }
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   return tx.operationRecord.update({where:{id,version:row.version},data:{version:{increment:1},updatedAt:new Date(),payload:json({...payload(row.payload),status:request.status,assignee_user_id:request.assignee_user_id,updated_by:actor.userId})}});});
 },
};
export async function generateWatchBrief(actor:Actor,org:string,region:string,key:string){
 return SpecialisedService.watch(actor,org,region,key,{question:'Prepare the scheduled rising-water watch brief for this region.'});
}
