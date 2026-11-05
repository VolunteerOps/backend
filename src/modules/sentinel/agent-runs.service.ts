import {withParentRun,followUpContext} from './run-lifecycle.js';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {withRegion} from './sentinel.context.js';
import {PlanningService} from './planning.service.js';
import {weatherConversation} from './conversation.service.js';
import {SpecialisedService} from './specialised.service.js';

const payload=(v:unknown)=>v as Record<string,any>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
const RUN_KINDS=['RESOURCE_PLAN','WEATHER_ANALYSIS','SPECIALISED'];
async function coordinator(tx:TenantTransaction,actor:Actor,org:string){
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
}
async function findRun(actor:Actor,org:string,region:string,id:string){
 return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
  const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:{in:RUN_KINDS}}});
  if(!row)throw ApiError.notFound('Agent run');return row;});
}
export const followUpRequest=z.object({question:z.string().trim().min(3).max(2000)}).strict();

export const AgentRunsService={
 async list(actor:Actor,org:string,region:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:{in:RUN_KINDS}},orderBy:{sequence:'desc'},take:50});
   return {items:rows.map(row=>{const p=payload(row.payload);return {id:row.id,kind:row.kind,version:row.version,updatedAt:row.updatedAt,
    title:p.title??p.analysis_type??row.kind,status:p.status,model:p.model??null,analysis_type:p.analysis_type??null,
    parent_run_id:p.parent_run_id??null,steps:p.harness?.steps?.length??p.tool_calls?.length??0,
    plan_steps:p.harness?.plan?.length??0,summary:(p.result?.summary??p.narrative?.summary??p.recommendation?.summary??p.briefing?.headline??'').slice(0,240)};})};});
 },
 async detail(actor:Actor,org:string,region:string,id:string){return findRun(actor,org,region,id);},
 async cancel(actor:Actor,org:string,region:string,id:string){
  return withRegion(actor,org,region,false,async tx=>{await coordinator(tx,actor,org);
   const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:{in:RUN_KINDS}}});
   if(!row)throw ApiError.notFound('Agent run');const p=payload(row.payload);
   if(p.status!=='RUNNING')throw ApiError.conflict('Only a running agent run can be cancelled','INVALID_TRANSITION');
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   return tx.operationRecord.update({where:{id,version:row.version},data:{version:{increment:1},updatedAt:new Date(),payload:json({...p,status:'FAILED',error_code:'CANCELLED_BY_COORDINATOR',message:'This run was cancelled by a coordinator. Start a new run or branch a follow-up from a completed run.'})}});});
 },
 async followUp(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof followUpRequest>){
  const request=followUpRequest.parse(input);
  const parent=await findRun(actor,org,region,id);
  const p=payload(parent.payload);const prior=payload(p.request??{});
  if(['RUNNING','FAILED'].includes(p.status))throw ApiError.conflict('Choose a completed run before asking a follow-up.','FOLLOW_UP_UNAVAILABLE');
  const summary=String(p.result?.summary??p.narrative?.summary??p.recommendation?.summary??'');
  const context=followUpContext(id,request.question,String(prior.question??''),summary);
  return withParentRun(id,async()=>{
  let run:any;
  if(parent.kind==='RESOURCE_PLAN'){
   run=await PlanningService.resourcePlan(actor,org,region,key,{mission_id:p.mission_id,question:context,mode:prior.mode??'EXECUTE',...(p.weather_evidence?.assessment_id?{source_assessment_id:p.weather_evidence.assessment_id}:{})});
  }else if(parent.kind==='WEATHER_ANALYSIS'&&(p.workflow==='WEATHER_CONVERSATION'||prior.mode==='CHAT'||prior.mode==='DAILY_BRIEF')){
   const history=[...(prior.history??[]),{role:'user',content:String(prior.question??'Earlier weather question').slice(0,4000)},{role:'assistant',content:('Earlier run '+id+': '+summary).slice(0,4000)}].slice(-16);
   run=await weatherConversation(actor,org,region,key,{question:request.question,mode:'CHAT',history});
  }else if(parent.kind==='WEATHER_ANALYSIS'){
   run=await PlanningService.weather(actor,org,region,key,{question:context,init_time:prior.init_time,from:prior.from,to:prior.to,include_station_detail:!!prior.include_station_detail,mode:prior.mode??'EXECUTE'});
  }else{
   const type=p.analysis_type as string;const base={...prior};delete base.analysis_type;
   const withQuestion=(extra:Record<string,unknown>):any=>({...base,...extra,question:context});
   switch(type){
    case 'FLOOD_SYNTHESIS':run=await SpecialisedService.flood(actor,org,region,key,withQuestion({}));break;
    case 'WATCH_BRIEF':run=await SpecialisedService.watch(actor,org,region,key,{question:context});break;
    case 'HEAT_HEALTH':run=await SpecialisedService.heat(actor,org,region,key,withQuestion({}));break;
    case 'WIND_ACCESS':run=await SpecialisedService.wind(actor,org,region,key,withQuestion({}));break;
    case 'MULTI_REGION':run=await SpecialisedService.multiRegion(actor,org,region,key,{question:context});break;
    case 'OUTCOME_REVIEW':run=await SpecialisedService.outcome(actor,org,region,key,withQuestion({}));break;
    case 'CREDENTIAL_FORESIGHT':run=await SpecialisedService.foresight(actor,org,region,key,withQuestion({}));break;
    case 'WHAT_IF':run=await SpecialisedService.whatIf(actor,org,region,key,withQuestion({}));break;
    case 'SHORTAGE_OPTIONS':run=await SpecialisedService.shortage(actor,org,region,key,withQuestion({}));break;
    default:throw ApiError.conflict('Follow-up branching is not available for this run type. Create a new run instead.','FOLLOW_UP_UNSUPPORTED');
   }
  }
  return run;
  });
 },
};
