import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import {withRegion} from '../sentinel/sentinel.context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {caseIntake,caseDecision,nextCaseStatus,responseDue} from './safety.schema.js';
import type {Prisma} from '../../generated/prisma/client.js';
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const payload=(v:unknown)=>v as Record<string,any>;
async function role(tx:TenantTransaction,actor:Actor,org:string){return(await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}})).role;}
async function member(tx:TenantTransaction,org:string,region:string,id:number,coordinator=false){
 await tx.$queryRaw`SELECT set_config('vops.roster','true',true)`;
 const row=await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:org,userId:id}}});
 await tx.$queryRaw`SELECT set_config('vops.roster','',true)`;
 if(!row||row.status!=='ACTIVE'||(row.regionIds.length&&!row.regionIds.includes(region))||(coordinator&&!['ORG_ADMIN','COORDINATOR'].includes(row.role)))throw ApiError.badRequest('Choose an active member with access to this region');
}
export const SafetyService={
 async list(actor:Actor,org:string,region:string,after=0,status?:string){return withRegion(actor,org,region,false,async tx=>{
  const own=!['ORG_ADMIN','COORDINATOR'].includes(await role(tx,actor,org));
  const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'ASSISTANCE_CASE',sequence:{gt:after},...(own?{ownerId:actor.userId}:{}),...(status?{payload:{path:['status'],equals:status}}:{})},orderBy:{sequence:'asc'},take:51});
  return{items:rows.slice(0,50),next_cursor:rows.length>50?rows[49]!.sequence:null,as_of:new Date().toISOString()};
 });},
 async timeline(actor:Actor,org:string,region:string,id:string,after=0){return withRegion(actor,org,region,false,async tx=>{
  const own=!['ORG_ADMIN','COORDINATOR'].includes(await role(tx,actor,org));
  const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region,kind:'ASSISTANCE_CASE',...(own?{ownerId:actor.userId}:{})}});
  if(!row)throw ApiError.notFound('Assistance case');
  const items=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'ASSISTANCE_EVENT',parentId:id,sequence:{gt:after}},orderBy:{sequence:'asc'},take:51});
  return{case:row,items:items.slice(0,50),next_cursor:items.length>50?items[49]!.sequence:null};
 });},
 async intake(actor:Actor,org:string,region:string,key:string,input:z.infer<typeof caseIntake>){
  const request=caseIntake.parse(input);
  return withRegion(actor,org,region,false,async tx=>{
   const currentRole=await role(tx,actor,org),owner=request.affected_user_id??actor.userId;
   if(owner!==actor.userId||request.source!=='IN_APP')requireCoordinator(currentRole);
   if(owner!==actor.userId)await member(tx,org,region,owner);
   // Serialize intake and decisions in this region before reading receipts or case state.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+region+':assistance'},0))::text`;
   const fingerprint=createHash('sha256').update(JSON.stringify([org,region,'INTAKE',request])).digest('hex');
   const receipt=await tx.operationReceipt.findUnique({where:{userId_key:{userId:actor.userId,key}}});
   if(receipt){if(receipt.fingerprint!==fingerprint)throw ApiError.conflict('Request key was used with different input','IDEMPOTENCY_CONFLICT');return receipt.result;}
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const scope={organizationId:org,regionId:region};
   const existing=await tx.operationRecord.findFirst({where:{...scope,kind:'ASSISTANCE_CASE',ownerId:owner,NOT:{payload:{path:['status'],equals:'RESOLVED'}}}});
   // Repeated requests attach evidence to the open case rather than implying a second response.
   let row=existing;
   if(!row)row=await tx.operationRecord.create({data:{id:randomUUID(),...scope,kind:'ASSISTANCE_CASE',ownerId:owner,payload:json({title:request.summary.slice(0,120),summary:request.summary,status:'OPEN',severity:request.severity,source:request.source,location:request.location??null,coordinator_id:null,opened_at:new Date().toISOString(),response_due_at:responseDue(request.severity),escalations:0,dispatch_confirmed:false})}});
   else {
    const old=payload(row.payload),rank:Record<string,number>={STANDARD:0,HIGH:1,URGENT:2};
    const raised=rank[request.severity]!>rank[old.severity]!;
    row=await tx.operationRecord.update({where:{id:row.id},data:{version:{increment:1},updatedAt:new Date(),payload:json({...old,last_request_at:new Date().toISOString(),...(raised?{severity:request.severity,response_due_at:new Date(Math.min(Date.parse(old.response_due_at),Date.parse(responseDue(request.severity)))).toISOString()}:{})})}});
   }
   await tx.operationRecord.create({data:{id:randomUUID(),...scope,kind:'ASSISTANCE_EVENT',ownerId:owner,parentId:row.id,payload:json({action:existing?'ADDITIONAL_REQUEST':'REQUESTED',actor_id:actor.userId,at:new Date().toISOString(),summary:request.summary,source:request.source,severity:request.severity,location:request.location??null})}});
   const result={...row,merged_into_existing:!!existing};
   await tx.operationReceipt.create({data:{id:randomUUID(),...scope,userId:actor.userId,key,fingerprint,result:json(result)}});
   return result;
  });
 },
 async decide(actor:Actor,org:string,region:string,id:string,key:string,input:z.infer<typeof caseDecision>){
  const request=caseDecision.parse(input);
  return withRegion(actor,org,region,false,async tx=>{
   const currentRole=await role(tx,actor,org);requireCoordinator(currentRole);
   const scope={organizationId:org,regionId:region};
   // Serialize intake and decisions in this region before reading receipts or case state.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+region+':assistance'},0))::text`;
   const fingerprint=createHash('sha256').update(JSON.stringify([org,region,id,request])).digest('hex');
   const receipt=await tx.operationReceipt.findUnique({where:{userId_key:{userId:actor.userId,key}}});
   if(receipt){if(receipt.fingerprint!==fingerprint)throw ApiError.conflict('Request key was used with different input','IDEMPOTENCY_CONFLICT');return receipt.result;}
   const row=await tx.operationRecord.findFirst({where:{...scope,id,kind:'ASSISTANCE_CASE'}});if(!row)throw ApiError.notFound('Assistance case');
   if(row.version!==request.expected_version)throw ApiError.conflict('Case changed. Review its latest timeline','VERSION_CONFLICT');
   const p=payload(row.payload);let status:string;
   try{status=nextCaseStatus(p.status,request.action);}catch{throw ApiError.conflict('This case does not allow that action','INVALID_TRANSITION');}
   if(request.coordinator_id)await member(tx,org,region,request.coordinator_id,true);
   if(request.action!=='ACKNOWLEDGE'&&request.action!=='ESCALATE'&&p.coordinator_id!==actor.userId&&!(request.action==='HANDOVER'&&currentRole==='ORG_ADMIN'))throw ApiError.conflict('The case owner must record this decision or hand over responsibility','CASE_OWNER_REQUIRED');
   const next={...p,status,coordinator_id:request.coordinator_id??(request.action==='ACKNOWLEDGE'?actor.userId:p.coordinator_id),escalations:(p.escalations??0)+(request.action==='ESCALATE'?1:0),last_action_at:new Date().toISOString(),...(status==='RESOLVED'?{resolved_at:new Date().toISOString(),resolution:request.reason}:{})};
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const result=await tx.operationRecord.update({where:{id},data:{version:{increment:1},updatedAt:new Date(),payload:json(next)}});
   await tx.operationRecord.create({data:{id:randomUUID(),...scope,kind:'ASSISTANCE_EVENT',ownerId:row.ownerId,parentId:id,payload:json({action:request.action,actor_id:actor.userId,at:new Date().toISOString(),reason:request.reason,coordinator_id:next.coordinator_id})}});
   await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'ASSISTANCE_'+request.action,reason:request.reason,metadata:{case_id:id,region_id:region}}});
   await tx.operationReceipt.create({data:{id:randomUUID(),...scope,userId:actor.userId,key,fingerprint,result:json(result)}});
   return result;
  });
 },
};
