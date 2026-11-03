import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {requireRecentMfa} from '../organizations/authorization.js';
import {authorizeCapability} from '../billing/capabilities.js';
import {reserveUsage,finishUsage} from '../billing/usage.service.js';
import {featureCatalog} from '../billing/feature-catalog.js';
import {withRegion} from './sentinel.context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {executeOperationalCommand} from '../operations/operations.service.js';
import {runMetaAgent,configuredMetaKey,metaModels} from './meta-agent.js';
import {assessmentEvidence} from './planning-evidence.js';
import {readPlanningContext} from './planning-context.js';
import {resourcePlanOutput,resourcePlanRequest,validateResourcePlan,planApproval,planRejection,planEdit,type PlanningSnapshot} from './planning-contract.js';
import {analyzeWeather,weatherAnalysisRequest,weatherNarrative} from './weather-analysis.js';
import {forecastPolicySchema} from './forecast-assessment.js';
import {boundsSchema} from './providers/weathernext3.contract.js';
import {configuredForecastProvider,configuredForecastSettings,SentinelService} from './sentinel.service.js';
import {WeatherNextStationBigQuery} from './providers/weathernext3.station.js';
import type {Prisma} from '../../generated/prisma/client.js';

const payload=(v:unknown)=>v as Record<string,any>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const noArguments=z.object({}).strict();
function abandoned(value:Record<string,any>){return value.status==='RUNNING'&&(!Number.isFinite(Date.parse(value.requested_at))||Date.now()-Date.parse(value.requested_at)>5*60000);}
async function expireAbandoned(tx:TenantTransaction,row:{id:string;payload:unknown}){
 await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
 return tx.operationRecord.update({where:{id:row.id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...payload(row.payload),status:'FAILED',error_code:'ANALYSIS_INTERRUPTED',message:'This analysis did not finish within its processing window. Review provider status before creating a new request.'})}});
}
// Explicit request shape; extra caller-controlled scope and model fields are rejected.
export const weatherRequest=z.object({question:z.string().trim().min(3).max(2000),init_time:z.string().datetime(),from:z.string().datetime(),to:z.string().datetime(),include_station_detail:z.boolean().default(false),mode:z.enum(['PLAN_FIRST','EXECUTE']).default('EXECUTE')}).strict();
async function coordinator(tx:TenantTransaction,actor:Actor,org:string){
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
}
export async function runStored(actor:Actor,org:string,region:string,key:string,type:'RESOURCE_PLAN'|'WEATHER_ANALYSIS'|'SPECIALISED',input:unknown,compute:()=>Promise<Record<string,unknown>>) {
 const {role}=await authorizeCapability(actor,org,region,'agent.chat');requireCoordinator(role);configuredMetaKey();
 const fingerprint=createHash('sha256').update(JSON.stringify([type,input])).digest('hex');
 const prior=await withRegion(actor,org,region,false,async tx=>{
  await coordinator(tx,actor,org);
  const existing=await tx.operationRecord.findFirst({where:{id:key,organizationId:org,regionId:region,kind:type,ownerId:actor.userId}});
  if(existing){
   if(payload(existing.payload).fingerprint!==fingerprint)throw ApiError.conflict('Request key was used with different input','IDEMPOTENCY_CONFLICT');
   if(abandoned(payload(existing.payload)))return expireAbandoned(tx,existing);
   if(payload(existing.payload).status==='RUNNING')throw ApiError.conflict('This analysis is still running. Refresh its history.','AGENT_IN_PROGRESS');
   return existing;
  }
  await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
  await tx.operationRecord.create({data:{id:key,organizationId:org,regionId:region,kind:type,ownerId:actor.userId,payload:json({status:'RUNNING',request:input,fingerprint,requested_at:new Date().toISOString()})}});
  return null;
 });
 if(prior)return prior;
 let usageId:string|undefined;
 try {
  const usage=await reserveUsage(actor,{key,bucket:'agent.chat',limit:featureCatalog.assistant.ops_daily_attempts,fingerprint:createHash('sha256').update(JSON.stringify([org,region,type,input])).digest('hex')});usageId=usage.entry.id;
  const result=await compute();
  return await withRegion(actor,org,region,false,async tx=>{
   await coordinator(tx,actor,org);await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const current=await tx.operationRecord.findUniqueOrThrow({where:{id:key}});
   if(payload(current.payload).status!=='RUNNING')throw ApiError.conflict('The processing window has closed. Review history before starting again','ANALYSIS_INTERRUPTED');
   return tx.operationRecord.update({where:{id:key},data:{version:{increment:1},updatedAt:new Date(),payload:json({...result,request:input,fingerprint,status:'DRAFT',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*60000).toISOString(),actions_executed:[]})}});
  });
 } catch(error) {
  await withRegion(actor,org,region,false,async tx=>{
   await coordinator(tx,actor,org);await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const current=await tx.operationRecord.findUnique({where:{id:key}});
   if(!current||payload(current.payload).status!=='RUNNING')return;
   await tx.operationRecord.update({where:{id:key},data:{version:{increment:1},updatedAt:new Date(),payload:json({request:input,status:'FAILED',fingerprint,error_code:error instanceof ApiError?error.code:'ANALYSIS_FAILED',message:error instanceof ApiError&&error.code==='FORECAST_QUERY_BUDGET_EXCEEDED'?error.message:'The analysis did not complete. Submit a new request after reviewing the source and configuration.'})}});
  }).catch(()=>{});
  if(error instanceof ApiError)throw error;
  throw new ApiError(503,'ANALYSIS_FAILED','The model could not complete an evidence-grounded assessment');
 } finally {if(usageId)await finishUsage(actor,usageId,'FINALIZED');}
}

export const PlanningService={
 async list(actor:Actor,org:string,region:string,type:'RESOURCE_PLAN'|'WEATHER_ANALYSIS',after=0){return withRegion(actor,org,region,false,async tx=>{
  await coordinator(tx,actor,org);
  const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:type,...(after?{sequence:{lt:after}}:{})},orderBy:{sequence:'desc'},take:51});
  const items=[];
  for(const row of rows.slice(0,50))items.push(abandoned(payload(row.payload))?await expireAbandoned(tx,row):row);
  return {items,next_cursor:rows.length>50?rows[49]!.sequence:null};
 });},
 async resourcePlan(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof resourcePlanRequest>){
  const request=resourcePlanRequest.parse(input);
  return runStored(actor,org,region,key,'RESOURCE_PLAN',request,async()=>{
   const snapshot=await readPlanningContext(actor,org,region,request.mission_id);
   const weatherEvidence=request.source_assessment_id?await withRegion(actor,org,region,false,async tx=>{
    await coordinator(tx,actor,org);
    const assessment=await tx.operationRecord.findFirst({where:{id:request.source_assessment_id,organizationId:org,regionId:region,kind:'WEATHER_ANALYSIS'}});
    if(!assessment)throw ApiError.notFound('Weather assessment');
    const unit=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});
    return assessmentEvidence(assessment,unit);
   }):null;
   const check=()=>withRegion(actor,org,region,false,tx=>coordinator(tx,actor,org));
   const result=await runMetaAgent({harness:{planFirst:request.mode==='PLAN_FIRST',verify:(plan)=>{try{validateResourcePlan(plan,snapshot);return [];}catch(error){return [error instanceof Error?error.message:'Plan failed validation'];}}},model:metaModels.planning,question:request.question,output:resourcePlanOutput,signal:AbortSignal.timeout(60000),
    instruction:'You prepare a resource allocation proposal for a humanitarian coordinator. Read mission requirements, candidate qualifications, stock and commitments using all four tools. Choose only eligible candidate IDs and known resource IDs. Account for location; do not assume transport or safe access. Do not exceed capacity or available stock across assignments. State shortages and decisions. When weather evidence is linked, weigh its indicators against the regional thresholds it reports and say what preparation it changes; weather evidence never authorizes travel or deployment. No recommendation is a reservation or permission to travel.',
    requiredTools:['read_mission','read_candidates','read_stock','read_commitments',...(weatherEvidence?['read_weather_assessment']:[])],
    tools:[
     ...(weatherEvidence?[{name:'read_weather_assessment',description:'Read linked weather preparedness evidence and its limitations. Weather evidence is not a safe-route or deployment authorization.',arguments:noArguments,execute:async()=>{await check();return weatherEvidence;}}]:[]),
     {name:'read_mission',description:'Read the current mission requirements and capacity.',arguments:noArguments,execute:async()=>{await check();return snapshot.mission;}},
     {name:'read_candidates',description:'Read consenting applicants and verified skill checks. Never invent people.',arguments:noArguments,execute:async()=>{await check();return snapshot.candidates;}},
     {name:'read_stock',description:'Read available stock after reservations, with units and storage location.',arguments:noArguments,execute:async()=>{await check();return snapshot.resources;}},
     {name:'read_commitments',description:'Read visible commitments and important cross-workspace and routing limitations.',arguments:noArguments,execute:async()=>{await check();return{candidates:snapshot.candidates.map(c=>({user_id:c.user_id,visible_commitments:c.visible_commitments})),limitations:snapshot.limitations};}},
    ],
   });
   validateResourcePlan(result.result,snapshot);
   return {title:snapshot.mission.title,mission_id:request.mission_id,model:result.model,tool_calls:result.tool_calls,harness:result.harness,recommendation:result.result,snapshot,weather_evidence:weatherEvidence};
  });
 },
 async weather(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof weatherRequest>){
  const request=weatherRequest.parse(input);
  weatherAnalysisRequest.parse({question:request.question,from:request.from,to:request.to});
  const init=Date.parse(request.init_time),from=Date.parse(request.from),to=Date.parse(request.to);
  if(init>Date.now())throw ApiError.badRequest('This forecast has not been issued yet. Choose an earlier time.','FORECAST_CYCLE_FUTURE');
  if(Date.now()-init>48*3600000)throw ApiError.badRequest('Choose a recent forecast, or use Ask Sentinel to explore earlier days.','STALE_FORECAST_RUN');
  if(from<init)throw ApiError.badRequest('The analysis starts before this forecast was issued. Choose a later start date.','FORECAST_WINDOW_BEFORE_CYCLE');
  if(init%3600000||(from-init)%3600000||(to-init)%3600000)throw ApiError.badRequest('Choose times on the hour, such as 09:00.','FORECAST_HOUR_REQUIRED');
  const provider=configuredForecastProvider();
  return runStored(actor,org,region,key,'WEATHER_ANALYSIS',request,async()=>{
   const settings=await withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);const row=await tx.organizationUnit.findUniqueOrThrow({where:{id:region}});return{bounds:boundsSchema.parse(row.forecastBounds),policy:forecastPolicySchema.parse(row.forecastPolicy)};});
   if(Date.now()-init>=settings.policy.maximum_run_age_hours*3600000)throw ApiError.badRequest('Select a newer forecast cycle');
   let evidence:ReturnType<typeof analyzeWeather>|undefined;
   let source:Record<string,unknown>|undefined;
   let reported:unknown;
   let station:Awaited<ReturnType<WeatherNextStationBigQuery['fetch']>>|undefined;
   const signal=AbortSignal.timeout(120000);
   const result=await runMetaAgent({harness:{planFirst:request.mode==='PLAN_FIRST'},model:metaModels.weather,question:request.question,output:weatherNarrative,signal,
    instruction:'Analyze weather preparedness using numerical services and the selected WeatherNext 3 forecast. Call query_weather_indicators and read_reported_hazards. Never calculate disaster probabilities, flood depth, affected populations or safe routes from language alone. Cite the exact source_id. Explain assumptions, missing inputs and limits. The tool computes rainfall from hourly means, and heat/wind durations from medians; do not call accumulated rainfall a percentile. Compare every indicator with the regional thresholds returned by the tool and name each threshold met or not met. State explicitly that rainfall evidence alone does not produce a local flood-impact estimate when the listed local inputs are missing. Reported earthquakes do not corroborate a flood prediction. No warning or deployment is issued.',
    requiredTools:['query_weather_indicators','read_reported_hazards',...(request.include_station_detail?['query_station_temperature']:[])],tools:[
     ...(request.include_station_detail?[{name:'query_station_temperature',description:'Read independent 0.05 degree station-head temperature and dew-point statistics in Celsius. No rain or wind is available from this table.',arguments:noArguments,execute:async()=>{
      await withRegion(actor,org,region,false,tx=>coordinator(tx,actor,org));
      station??=await new WeatherNextStationBigQuery(configuredForecastSettings()).fetch({initTime:request.init_time,fromHour:(from-init)/3600000+1,toHour:(to-init)/3600000,bounds:settings.bounds},signal);
      return {...station,cells:station.cells.slice(0,50),cell_count:station.cells.length,truncated:station.cells.length>50};
     }}]:[]),
     {name:'query_weather_indicators',description:'Run a bounded parameterized BigQuery forecast query for the already-authorized region, cycle and period, then compute weather indicators.',arguments:noArguments,execute:async()=>{
      await withRegion(actor,org,region,false,tx=>coordinator(tx,actor,org));
      if(!evidence){const batch=await provider.fetch({initTime:request.init_time,fromHour:(from-init)/3600000+1,toHour:(to-init)/3600000,bounds:settings.bounds},signal);evidence=analyzeWeather(batch.cells,settings.policy,request.from,request.to);source={source_id:batch.jobId,source:batch.source,model:batch.model,init_time:batch.initTime,retrieved_at:batch.retrievedAt,bounds:settings.bounds};}
      return{source,...evidence,points:evidence.points.slice(0,50),point_count:evidence.points.length,truncated:evidence.points.length>50};
     }},
     {name:'read_reported_hazards',description:'Read recent reported earthquake evidence and its authority limitations. This is not hydrological corroboration.',arguments:noArguments,execute:async()=>{reported=await SentinelService.hazards(actor,org,region);return reported;}},
    ]});
   if(!source||!result.result.source_ids.includes(String(source.source_id))||result.result.source_ids.some(id=>id!==source!.source_id&&id!==station?.source_id)||(station&&!result.result.source_ids.includes(station.source_id)))throw new Error('ASSESSMENT_SOURCE_MISMATCH');
   return {title:'Weather preparedness assessment',model:result.model,tool_calls:result.tool_calls,harness:result.harness,narrative:result.result,source,evidence,station_detail:station??null,reported_hazards:reported,validation:'UNVALIDATED_WEATHER_INDICATORS',flood_impact_estimate:null};
  });
 },
 async edit(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof planEdit>){
  const request=planEdit.parse(input);
  return withRegion(actor,org,region,false,async tx=>{
   await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'RESOURCE_PLAN'}});if(!row)throw ApiError.notFound('Resource proposal');
   const p=payload(row.payload),fingerprint=createHash('sha256').update(JSON.stringify([org,region,id,request])).digest('hex');
   const receipt=await tx.operationReceipt.findUnique({where:{userId_key:{userId:actor.userId,key}}});
   if(receipt){if(receipt.fingerprint!==fingerprint)throw ApiError.conflict('Request key reused with different input','IDEMPOTENCY_CONFLICT');return receipt.result;}
   if(row.version!==request.expected_version)throw ApiError.conflict('Proposal changed. Review it again','VERSION_CONFLICT');
   if(p.status!=='DRAFT'||Date.parse(p.expires_at)<=Date.now())throw ApiError.conflict('Recompute this expired proposal','PROPOSAL_EXPIRED');
   try{validateResourcePlan(request.recommendation,p.snapshot as PlanningSnapshot);}catch{throw ApiError.badRequest('The edited allocation exceeds the eligible candidates, capacity or stock in this proposal');}
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const result=await tx.operationRecord.update({where:{id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...p,recommendation:request.recommendation,original_recommendation:p.original_recommendation??p.recommendation,edited_by:actor.userId,edited_at:new Date().toISOString(),edit_reason:request.reason})}});
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'RESOURCE_PROPOSAL_EDITED',reason:request.reason,metadata:{region_id:region,proposal_id:id,version:result.version}}});
   await tx.operationReceipt.create({data:{id:randomUUID(),organizationId:org,regionId:region,userId:actor.userId,key,fingerprint,result:json(result)}});
   return result;
  });
 },
 async reject(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof planRejection>){
  const request=planRejection.parse(input);
  return withRegion(actor,org,region,false,async tx=>{
   await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'RESOURCE_PLAN'}});
   if(!row)throw ApiError.notFound('Resource proposal');
   const p=payload(row.payload);
   const fingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');
   if(p.status==='REJECTED'&&p.rejection_key===key&&p.rejected_by===actor.userId){if(p.rejection_fingerprint!==fingerprint)throw ApiError.conflict('Request key was used with different input','IDEMPOTENCY_CONFLICT');return row;}
   if(row.version!==request.expected_version)throw ApiError.conflict('Proposal changed. Review it again','VERSION_CONFLICT');
   if(p.status!=='DRAFT')throw ApiError.conflict('Only a draft proposal can be rejected','INVALID_TRANSITION');
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'RESOURCE_PROPOSAL_REJECTED',reason:request.reason,metadata:{region_id:region,proposal_id:id}}});
   return tx.operationRecord.update({where:{id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...p,status:'REJECTED',rejection_key:key,rejection_fingerprint:fingerprint,rejected_by:actor.userId,rejected_at:new Date().toISOString(),rejection_reason:request.reason})}});
  });
 },
 async approve(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof planApproval>){
  const request=planApproval.parse(input);requireRecentMfa(actor.identity);
  return withRegion(actor,org,region,false,async tx=>{
   await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'RESOURCE_PLAN'}});
   if(!row)throw ApiError.notFound('Resource proposal');
   const p=payload(row.payload);
   if(p.request?.mode==='PLAN_FIRST')throw ApiError.conflict('This was a plan-first run. Create an execution proposal before approving allocations','PLAN_ONLY');
   const approvalFingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');
   if(p.status==='APPROVED'&&p.approval_key===key&&p.approved_by===actor.userId){if(p.approval_fingerprint!==approvalFingerprint)throw ApiError.conflict('Approval key reused with a different request','IDEMPOTENCY_CONFLICT');return row;}
   if(row.version!==request.expected_version)throw ApiError.conflict('Proposal changed. Review it again','VERSION_CONFLICT');
   if(p.status!=='DRAFT'||Date.parse(p.expires_at)<=Date.now())throw ApiError.conflict('Create a fresh proposal before approving','PROPOSAL_EXPIRED');
   if(p.weather_evidence){
    const linked=await tx.operationRecord.findFirst({where:{id:p.weather_evidence.assessment_id,organizationId:org,regionId:region,kind:'WEATHER_ANALYSIS'}});
    if(!linked||linked.version!==p.weather_evidence.assessment_version)throw ApiError.conflict('The linked assessment changed. Recompute the proposal','ASSESSMENT_CHANGED');
    assessmentEvidence(linked,await tx.organizationUnit.findUniqueOrThrow({where:{id:region}}));
   }
   const snapshot=p.snapshot as PlanningSnapshot;
   const output=validateResourcePlan(resourcePlanOutput.parse(p.recommendation),snapshot);
   if(!output.allocations.length)throw ApiError.conflict('This proposal contains no allocations','EMPTY_PROPOSAL');
   const mission=await tx.operationRecord.findFirst({where:{id:snapshot.mission.id,organizationId:org,regionId:region,kind:'MISSION'}});
   if(!mission||mission.version!==snapshot.mission.version)throw ApiError.conflict('Mission changed. Recompute the proposal','VERSION_CONFLICT');
   for(const stock of snapshot.resources.filter(r=>output.allocations.some(a=>a.supplies.some(s=>s.resource_id===r.id)))){
    const latest=await tx.operationRecord.findFirst({where:{id:stock.id,organizationId:org,regionId:region,kind:'INVENTORY'}});
    if(!latest||latest.version!==stock.version)throw ApiError.conflict('Stock changed. Recompute the proposal','VERSION_CONFLICT');
   }
   // One transaction: all assignments/reservations and approval commit or roll back together.
   let version=mission.version;const assignments:unknown[]=[];
   for(const allocation of [...output.allocations].sort((a,b)=>a.user_id-b.user_id)){
    assignments.push(await executeOperationalCommand(tx,actor,org,region,randomUUID(),{action:'ASSIGN',id:mission.id,expected_version:version,user_id:allocation.user_id,supplies:allocation.supplies.map(s=>({resource_id:s.resource_id,quantity:s.quantity}))}));version++;
   }
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'RESOURCE_PROPOSAL_APPROVED',reason:request.reason,metadata:{region_id:region,proposal_id:id,mission_id:mission.id,assignment_count:assignments.length}}});
   return tx.operationRecord.update({where:{id},data:{version:{increment:1},payload:json({...p,status:'APPROVED',approval_key:key,approval_fingerprint:approvalFingerprint,approved_by:actor.userId,approved_at:new Date().toISOString(),approval_reason:request.reason,actions_executed:assignments})}});
  });
 },
};
