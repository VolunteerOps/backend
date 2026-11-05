import {recordWhere} from './workspace-policy.js';
import {assertDispatchAllowed} from './dispatch-policy.js';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import {trainingCommand} from './training.service.js';
import { ApiError } from '../../core/errors.js';
import { withRegion } from '../sentinel/sentinel.context.js';
import type { Actor, TenantTransaction } from '../organizations/context.js';
import { commandSchema, validTransition, kinds, type CommandInput, type listSchema } from './operations.schema.js';
import type { z } from 'zod';
type Payload=Record<string,any>;
const data=(v:unknown)=>v as Payload;
function coordinator(role:string){if(!['ORG_ADMIN','COORDINATOR'].includes(role))throw ApiError.forbidden('Coordinator membership required','CAPABILITY_REQUIRED');}
function expected(actual:number,wanted:number){if(actual!==wanted)throw ApiError.conflict('This record changed. Refresh before trying again.','VERSION_CONFLICT');}
async function role(tx:TenantTransaction,actor:Actor,org:string){return (await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}})).role;}
export const OperationsService={
 async dispatch(actor:Actor,org:string,region:string){return withRegion(actor,org,region,false,async tx=>{
  const row=await tx.operationRecord.findFirst({where:{organizationId:org,regionId:region,kind:'DISPATCH_CONTROL'}});
  return {paused:row?data(row.payload).paused===true:false,version:row?.version??0,reason:row?data(row.payload).reason:'',updated_at:row?.updatedAt??null};
 });},
 async streamBoundary(actor:Actor,org:string,region:string,after?:number){return withRegion(actor,org,region,false,async tx=>{
  const where={organizationId:org,regionId:region,kind:'EVENT'};
  const latest=await tx.operationRecord.findFirst({where,orderBy:{sequence:'desc'},select:{sequence:true}});
  if(after!==undefined&&after!==0&&!await tx.operationRecord.findFirst({where:{...where,sequence:after},select:{id:true}}))
   throw new ApiError(409,'STREAM_RESNAPSHOT_REQUIRED','Replay position is no longer available; refresh your snapshot');
  return latest?.sequence??0;
 });},
 async assistantContext(actor:Actor,org:string,region:string){return withRegion(actor,org,region,false,async tx=>{
  const currentRole=await role(tx,actor,org);
  const missions=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'MISSION',OR:['STAGED','ACTIVE','PAUSED'].map(status=>({payload:{path:['status'],equals:status}}))},orderBy:{sequence:'desc'},take:21});
  const ownAssignments=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'ASSIGNMENT',ownerId:actor.userId},orderBy:{sequence:'desc'},take:21});
  const qualifications=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'CREDENTIAL',ownerId:actor.userId,payload:{path:['status'],equals:'VERIFIED'}},take:31});
  const resources=currentRole==='VOLUNTEER'?[]:await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'INVENTORY'},orderBy:{sequence:'desc'},take:21});
  return {verified_role:currentRole,missions:missions.slice(0,20).map(r=>{const p=data(r.payload);return{source_id:r.id,title:p.title,status:p.status,starts_at:p.starts_at,ends_at:p.ends_at,capacity:p.capacity,assigned_count:p.assigned_count,required_skills:p.required_skills};}),
   own_assignments:ownAssignments.slice(0,20).map(r=>({source_id:r.id,mission_id:r.parentId,status:data(r.payload).status})),
   own_qualifications:qualifications.filter(r=>Date.parse(data(r.payload).valid_until)>Date.now()).slice(0,30).map(r=>({source_id:r.id,skill:data(r.payload).skill,valid_until:data(r.payload).valid_until})),
   resources:resources.slice(0,20).map(r=>{const p=data(r.payload);return{source_id:r.id,title:p.title,unit:p.unit,available:p.quantity-p.reserved};}),
   truncated:missions.length>20||ownAssignments.length>20||qualifications.length>30||resources.length>20,
   limitation:'This bounded snapshot is not a reservation. Eligibility, capacity and inventory must be checked transactionally by a coordinator.'};
 });},
 async detail(actor:Actor,org:string,region:string,id:string){return withRegion(actor,org,region,false,async tx=>{
  const row=await tx.operationRecord.findFirst({where:{id,organizationId:org,regionId:region}});
  const membership=await role(tx,actor,org);
  if(!row||!(kinds as readonly string[]).includes(row.kind)||(['MISSION','COURSE'].includes(row.kind)&&data(row.payload).status==='DRAFT'&&membership==='VOLUNTEER'))throw ApiError.notFound('Record');
  if(row.kind==='EVENT'){
   const targetId=data(row.payload).record_id;
   const target=typeof targetId==='string'?await tx.operationRecord.findFirst({where:{id:targetId,organizationId:org,regionId:region,kind:{in:[...kinds].filter(k=>k!=='EVENT')}}}):null;
   if(!target||(['MISSION','COURSE'].includes(target.kind)&&data(target.payload).status==='DRAFT'&&membership==='VOLUNTEER'))throw ApiError.notFound('Record');
  }
  return row;
 });},
 async list(actor:Actor,org:string,region:string,input:z.infer<typeof listSchema>){return withRegion(actor,org,region,false,async tx=>{
  const membership=await role(tx,actor,org);

  const items=await tx.operationRecord.findMany({where:recordWhere(org,region,actor.userId,membership,input),orderBy:{sequence:'asc'},take:101});
  let visible=items.slice(0,100).filter(r=>!['MISSION','COURSE'].includes(input.kind)||membership!=='VOLUNTEER'||data(r.payload).status!=='DRAFT');
  // Event metadata follows the target record's RLS and draft visibility.
  if(input.kind==='EVENT'&&visible.length){
   const targetIds=visible.map(r=>data(r.payload).record_id).filter((id):id is string=>typeof id==='string');
   const targets=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,id:{in:targetIds},kind:{in:[...kinds].filter(k=>k!=='EVENT')}}});
   const allowed=new Set(targets.filter(r=>membership!=='VOLUNTEER'||!['MISSION','COURSE'].includes(r.kind)||data(r.payload).status!=='DRAFT').map(r=>r.id));
   visible=visible.filter(r=>allowed.has(data(r.payload).record_id));
  }
  if(input.kind==='COURSE'&&visible.length){
   await tx.$queryRaw`SELECT set_config('vops.training','true',true)`;
   const counts=await tx.operationRecord.groupBy({by:['parentId'],where:{organizationId:org,regionId:region,kind:'ENROLLMENT',parentId:{in:visible.map(r=>r.id)}},_count:{_all:true}});
   await tx.$queryRaw`SELECT set_config('vops.training','',true)`;
   visible=visible.map(r=>({...r,payload:{...data(r.payload),enrolled_count:counts.find(c=>c.parentId===r.id)?._count._all??0}}));
  }
  return {items:visible,next_cursor:items.length>100?items[99]!.sequence:null,scan_cursor:items.slice(0,100).at(-1)?.sequence??input.after};
 });},
 async command(actor:Actor,org:string,region:string,key:string,input:CommandInput){
  return withRegion(actor,org,region,false,tx=>executeOperationalCommand(tx,actor,org,region,key,input));
 },
};

export async function executeOperationalCommand(tx:TenantTransaction,actor:Actor,org:string,region:string,key:string,input:CommandInput){
  const parsed=commandSchema.parse(input);
  const fingerprint=createHash('sha256').update(JSON.stringify([org,region,parsed])).digest('hex');

   // Organization lock is acquired by withRegion; every mutation and lifecycle change serializes.
   const memberRole=await role(tx,actor,org);
   const previous=await tx.operationReceipt.findUnique({where:{userId_key:{userId:actor.userId,key}}});
   if(previous){if(previous.fingerprint!==fingerprint)throw ApiError.conflict('Idempotency key was already used for another request','IDEMPOTENCY_CONFLICT');return previous.result;}
   await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;
   const scope={organizationId:org,regionId:region};
   async function get(id:string,kind?:string){const row=await tx.operationRecord.findFirst({where:{...scope,id,...(kind?{kind}:{})}});if(!row)throw ApiError.notFound('Record');return row;}
   async function create(kind:string,payload:Payload,parentId?:string,ownerId=actor.userId){return tx.operationRecord.create({data:{id:randomUUID(),...scope,kind,ownerId,parentId,payload:payload as Prisma.InputJsonValue}});}
   async function update(id:string,version:number,payload:Payload){const row=await get(id);expected(row.version,version);return tx.operationRecord.update({where:{id},data:{payload:payload as Prisma.InputJsonValue,version:{increment:1},updatedAt:new Date()}});}
   const dispatch=await tx.operationRecord.findFirst({where:{...scope,kind:'DISPATCH_CONTROL'}});
   assertDispatchAllowed(dispatch?data(dispatch.payload).paused===true:false,parsed.action,'status' in parsed?parsed.status:undefined);
   let result;
   if(parsed.action==='SET_DISPATCH'){
    coordinator(memberRole);expected(dispatch?.version??0,parsed.expected_version);
    const payload={paused:parsed.paused,reason:parsed.reason,changed_by:actor.userId,changed_at:new Date().toISOString()};
    result=dispatch?await update(dispatch.id,dispatch.version,payload):await create('DISPATCH_CONTROL',payload);
    await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:parsed.paused?'REGIONAL_DISPATCH_PAUSED':'REGIONAL_DISPATCH_RESUMED',reason:parsed.reason,metadata:{region_id:region,version:result.version}}});
   }else if(parsed.action==='PUBLISH_BULLETIN'){
    coordinator(memberRole);result=await create('BULLETIN',{title:parsed.title,body:parsed.body,priority:parsed.priority,status:'PUBLISHED',published_by:actor.userId,published_at:new Date().toISOString(),audience:'REGION_MEMBERS'});
   }else if(parsed.action==='CREATE_COURSE'||parsed.action==='PUBLISH_COURSE'||parsed.action==='ENROLL_COURSE'||parsed.action==='SUBMIT_LESSON'||parsed.action==='REVIEW_TRAINING'||parsed.action==='REVOKE_CREDENTIAL'){
    result=await trainingCommand(parsed,{tx,actor,scope,memberRole,get,create,update});
    }else if(parsed.action==='CREATE_CAMPAIGN'){
    coordinator(memberRole);if(parsed.bulletin_id)await get(parsed.bulletin_id,'BULLETIN');
    result=await create('CAMPAIGN',{title:parsed.title,description:parsed.description,owner:parsed.owner,due_at:parsed.due_at,bulletin_id:parsed.bulletin_id??null,status:'ACTIVE',tasks:parsed.tasks.map(title=>({id:randomUUID(),title,completed:false}))});
   }else if(parsed.action==='UPDATE_CAMPAIGN_TASK'||parsed.action==='ARCHIVE_CAMPAIGN'){
    coordinator(memberRole);const row=await get(parsed.id,'CAMPAIGN'),p=data(row.payload);
    if(p.status==='ARCHIVED')throw ApiError.conflict('This campaign has been archived.','CAMPAIGN_ARCHIVED');
    if(parsed.action==='ARCHIVE_CAMPAIGN')result=await update(row.id,parsed.expected_version,{...p,status:'ARCHIVED',archive_reason:parsed.reason});
    else {if(!p.tasks.some((t:any)=>t.id===parsed.task_id))throw ApiError.notFound('Task');
     const tasks=p.tasks.map((t:any)=>t.id===parsed.task_id?{...t,completed:parsed.completed,updated_by:actor.userId,updated_at:new Date().toISOString()}:t);
     result=await update(row.id,parsed.expected_version,{...p,tasks,status:tasks.every((t:any)=>t.completed)?'COMPLETED':'ACTIVE'});}
   }else if(parsed.action==='CREATE_MISSION'){
    coordinator(memberRole);result=await create('MISSION',{...parsed.mission,status:'DRAFT',assigned_count:0});
   }else if(parsed.action==='CREATE_RESOURCE'){
    coordinator(memberRole);result=await create('INVENTORY',{title:parsed.title,unit:parsed.unit,location:parsed.location,quantity:parsed.quantity,reserved:0,...(parsed.vehicle_model?{vehicle_model:parsed.vehicle_model}:{}),...(parsed.plate_number?{plate_number:parsed.plate_number}:{})});
    await create('STOCK_LEDGER',{action:'OPENING',delta:parsed.quantity,balance:parsed.quantity,reason:'Opening stock count'},result.id);
   }else if(parsed.action==='SUPPORT'){
    result=await create('SUPPORT',{title:parsed.title,body:parsed.body,status:'OPEN'});
   }else{
    const row=await get(parsed.id);const payload=data(row.payload);
    if(parsed.action==='WITHDRAW_BULLETIN'){
     coordinator(memberRole);if(row.kind!=='BULLETIN')throw ApiError.notFound('Bulletin');
     if(payload.status!=='PUBLISHED')throw ApiError.conflict('Bulletin is no longer published','INVALID_TRANSITION');
     result=await update(row.id,parsed.expected_version,{...payload,status:'WITHDRAWN',withdrawal_reason:parsed.reason,withdrawn_by:actor.userId});
    }else if(parsed.action==='TRIAGE_REPORT'){
     coordinator(memberRole);if(row.kind!=='REPORT')throw ApiError.notFound('Report');
     if(parsed.related_report_id){
      if(parsed.related_report_id===row.id)throw ApiError.badRequest('A report cannot link to itself');
      await get(parsed.related_report_id,'REPORT');
     }
     result=await update(row.id,parsed.expected_version,{...payload,status:parsed.status,triage_reason:parsed.reason,related_report_id:parsed.related_report_id??null,reviewed_by:actor.userId,reviewed_at:new Date().toISOString()});
    }else if(parsed.action==='MODERATE_MESSAGE'){
     coordinator(memberRole);if(row.kind!=='MESSAGE')throw ApiError.notFound('Message');
     if(payload.status==='REMOVED')throw ApiError.conflict('Message was already removed','MESSAGE_REMOVED');
     result=await update(row.id,parsed.expected_version,{...payload,body:'Message removed by a coordinator.',status:'REMOVED',moderated_by:actor.userId,moderated_at:new Date().toISOString()});
     await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'MESSAGE_MODERATED',reason:parsed.reason,metadata:{region_id:region,message_id:row.id}}});
    }else if(parsed.action==='REPLY_SUPPORT'||parsed.action==='TRIAGE_SUPPORT'){
     if(row.kind!=='SUPPORT')throw ApiError.notFound('Support case');
     if(parsed.action==='TRIAGE_SUPPORT'){
      coordinator(memberRole);
      result=await update(row.id,parsed.expected_version,{...payload,status:parsed.status,resolution_note:parsed.reason,reviewed_by:actor.userId,reviewed_at:new Date().toISOString()});
     }else{
      if(row.ownerId!==actor.userId)coordinator(memberRole);
      if(payload.status==='RESOLVED')throw ApiError.conflict('Ask your coordinator to reopen this case before replying','CASE_RESOLVED');
      const replies=Array.isArray(payload.replies)?payload.replies:[];
      if(replies.length>=50)throw ApiError.conflict('This case has reached its reply limit. Open a linked follow-up case.','CASE_REPLY_LIMIT');
      result=await update(row.id,parsed.expected_version,{...payload,replies:[...replies,{author_id:actor.userId,coordinator:memberRole!=='VOLUNTEER',body:parsed.body,created_at:new Date().toISOString()}]});
     }
    }else if(parsed.action==='ADJUST_STOCK'||parsed.action==='TRANSFER_STOCK'){
     coordinator(memberRole);if(row.kind!=='INVENTORY')throw ApiError.notFound('Resource');expected(row.version,parsed.expected_version);
     const delta=parsed.action==='ADJUST_STOCK'?parsed.delta:-parsed.quantity;
     if(payload.quantity+delta<payload.reserved||payload.quantity+delta>1000000)throw ApiError.conflict('Available stock is insufficient or exceeds the resource limit','STOCK_UNAVAILABLE');
     if(parsed.action==='TRANSFER_STOCK'){
      if(parsed.target_id===row.id)throw ApiError.badRequest('Choose a different destination');
      const target=await get(parsed.target_id,'INVENTORY');expected(target.version,parsed.target_version);const dest=data(target.payload);
      if(dest.unit!==payload.unit||dest.title!==payload.title)throw ApiError.conflict('Transfers require matching resource name and unit','RESOURCE_MISMATCH');
      if(dest.quantity+parsed.quantity>1000000)throw ApiError.conflict('Destination stock limit reached','STOCK_LIMIT');
      await update(target.id,target.version,{...dest,quantity:dest.quantity+parsed.quantity});
      await create('STOCK_LEDGER',{action:'TRANSFER_IN',delta:parsed.quantity,balance:dest.quantity+parsed.quantity,reason:parsed.reason,related_resource:row.id},target.id);
     }
     result=await update(row.id,row.version,{...payload,quantity:payload.quantity+delta});
     await create('STOCK_LEDGER',{action:parsed.action,delta,balance:payload.quantity+delta,reason:parsed.reason,...(parsed.action==='TRANSFER_STOCK'?{related_resource:parsed.target_id}:{})},row.id);
    }else if(parsed.action==='TRANSITION_MISSION'){
     coordinator(memberRole);if(row.kind!=='MISSION')throw ApiError.notFound('Mission');expected(row.version,parsed.expected_version);
     if(!validTransition(payload.status,parsed.status))throw ApiError.conflict('Invalid mission transition','INVALID_TRANSITION');
     if(parsed.status==='COMPLETED'&&await tx.operationRecord.count({where:{...scope,parentId:row.id,kind:'ASSIGNMENT',NOT:{payload:{path:['status'],equals:'COMPLETED'}}}}))throw ApiError.conflict('Complete all assignments first','ASSIGNMENTS_OPEN');
     if(parsed.status==='CANCELLED'){
      const assignments=await tx.operationRecord.findMany({where:{...scope,parentId:row.id,kind:'ASSIGNMENT'}});
      for(const a of assignments){await update(a.id,a.version,{...data(a.payload),status:'CANCELLED'});await tx.$queryRaw`SELECT public.resq_responder_reserve(${a.ownerId}::integer,${row.id},1::integer,true)`;}
     }
     if(['CANCELLED','COMPLETED'].includes(parsed.status)){
      const holds=await tx.operationRecord.findMany({where:{...scope,kind:'RESOURCE_RESERVATION',parentId:row.id,payload:{path:['status'],equals:'RESERVED'}}});
      for(const hold of holds){const h=data(hold.payload);const stock=await get(h.resource_id,'INVENTORY');const inventory=data(stock.payload);const consume=parsed.status==='COMPLETED';
       await update(stock.id,stock.version,{...inventory,reserved:inventory.reserved-h.quantity,quantity:inventory.quantity-(consume?h.quantity:0)});
       await update(hold.id,hold.version,{...h,status:consume?'CONSUMED':'RELEASED'});
       await create('STOCK_LEDGER',{action:consume?'CONSUMED':'RELEASED',delta:consume?-h.quantity:0,quantity:h.quantity,mission_id:row.id,reason:consume?'Mission completed':'Mission cancelled'},stock.id);
      }
     }
     result=await update(row.id,row.version,{...payload,status:parsed.status});
    }else if(parsed.action==='APPLY'){
     if(row.kind!=='MISSION'||!['STAGED','ACTIVE'].includes(payload.status))throw ApiError.conflict('Mission is not accepting applications','MISSION_CLOSED');
     const prior=await tx.operationRecord.findFirst({where:{...scope,parentId:row.id,kind:'APPLICATION',ownerId:actor.userId}});
     if(prior&&!['SAVED','WITHDRAWN'].includes(data(prior.payload).status))throw ApiError.conflict('You already applied','APPLICATION_EXISTS');
     const applicationPayload={mission_title:payload.title,status:(payload.assigned_count??0)>=payload.capacity?'WAITLISTED':'APPLIED',note:parsed.note,saved:prior?data(prior.payload).saved===true:false};
     result=prior?await update(prior.id,prior.version,applicationPayload):await create('APPLICATION',applicationPayload,row.id);
    }else if(parsed.action==='SAVE_MISSION'){
     if(row.kind!=='MISSION'||payload.status==='DRAFT'||(parsed.saved&&!['STAGED','ACTIVE','PAUSED'].includes(payload.status)))throw ApiError.conflict('This mission is no longer available','MISSION_CLOSED');
     const prior=await tx.operationRecord.findFirst({where:{...scope,parentId:row.id,kind:'APPLICATION',ownerId:actor.userId}});
     result=prior?await update(prior.id,prior.version,{...data(prior.payload),saved:parsed.saved}):await create('APPLICATION',{status:'SAVED',saved:parsed.saved,mission_title:payload.title},row.id);
    }else if(parsed.action==='WITHDRAW_APPLICATION'){
     if(row.kind!=='APPLICATION'||row.ownerId!==actor.userId)throw ApiError.notFound('Your application');
     if(!['APPLIED','WAITLISTED'].includes(payload.status))throw ApiError.conflict('Contact your coordinator to change an accepted assignment','APPLICATION_NOT_WITHDRAWABLE');
     result=await update(row.id,parsed.expected_version,{...payload,status:'WITHDRAWN'});
    }else if(parsed.action==='ASSIGN'){
     coordinator(memberRole);expected(row.version,parsed.expected_version);
     if(row.kind!=='MISSION'||!['STAGED','ACTIVE'].includes(payload.status))throw ApiError.conflict('Mission cannot accept assignments','MISSION_CLOSED');
     await tx.$queryRaw`SELECT set_config('vops.roster','true',true)`;
     const responder=await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:org,userId:parsed.user_id}}});
     await tx.$queryRaw`SELECT set_config('vops.roster','',true)`;
     if(!responder||responder.status!=='ACTIVE'||(responder.regionIds.length&&!responder.regionIds.includes(region)))throw ApiError.forbidden('Responder is outside this region or no longer active','RESPONDER_SCOPE_REQUIRED');
     const application=await tx.operationRecord.findFirst({where:{...scope,parentId:row.id,kind:'APPLICATION',ownerId:parsed.user_id}});
     if(!application||!['APPLIED','WAITLISTED'].includes(data(application.payload).status))throw ApiError.conflict('An active volunteer application is required','APPLICATION_REQUIRED');
     if(await tx.operationRecord.findFirst({where:{...scope,parentId:row.id,kind:'ASSIGNMENT',ownerId:parsed.user_id}}))throw ApiError.conflict('Responder already assigned','ASSIGNMENT_EXISTS');
     const count=await tx.operationRecord.count({where:{...scope,parentId:row.id,kind:'ASSIGNMENT',NOT:{payload:{path:['status'],equals:'CANCELLED'}}}});
     if(count>=payload.capacity)throw ApiError.conflict('Mission capacity reached','CAPACITY_REACHED');
     for(const skill of payload.required_skills??[]){
      const qualification=await tx.operationRecord.findFirst({where:{...scope,kind:'CREDENTIAL',ownerId:parsed.user_id,AND:[{payload:{path:['skill'],equals:skill}},{payload:{path:['status'],equals:'VERIFIED'}},{payload:{path:['valid_until'],gt:new Date().toISOString()}}]}});
      if(!qualification)throw ApiError.conflict('A required qualification is missing, revoked or expired','QUALIFICATION_REQUIRED');
     }
     const duration=Math.ceil((Date.parse(payload.ends_at)-Date.now())/60000);
     if(duration<1)throw ApiError.conflict('This mission has already ended','ASSIGNMENT_WINDOW');
     const reservation=await tx.$queryRaw<Array<{available:boolean}>>`SELECT public.resq_responder_reserve(${parsed.user_id}::integer,${row.id},${duration}::integer,false) AS available`;
     if(!reservation[0]?.available)throw ApiError.conflict('Responder has a conflicting assignment','RESPONDER_UNAVAILABLE');
     for(const supply of parsed.supplies){
      const stock=await get(supply.resource_id,'INVENTORY');const inventory=data(stock.payload);
      if(inventory.quantity-inventory.reserved<supply.quantity)throw ApiError.conflict('Available stock cannot cover this assignment','STOCK_UNAVAILABLE');
      await update(stock.id,stock.version,{...inventory,reserved:inventory.reserved+supply.quantity});
      await create('RESOURCE_RESERVATION',{resource_id:stock.id,quantity:supply.quantity,status:'RESERVED',assignee_id:parsed.user_id},row.id);
      await create('STOCK_LEDGER',{action:'RESERVED',delta:0,quantity:supply.quantity,mission_id:row.id,assignee_id:parsed.user_id,reason:'Assignment confirmed'},stock.id);
     }
     result=await create('ASSIGNMENT',{status:'ASSIGNED',mission_title:payload.title},row.id,parsed.user_id);
     await update(application.id,application.version,{...data(application.payload),status:'ACCEPTED'});
     await update(row.id,row.version,{...payload,assigned_count:count+1});
    }else if(parsed.action==='CHECK_IN'||parsed.action==='COMPLETE_ASSIGNMENT'){
     if(row.kind!=='ASSIGNMENT'||row.ownerId!==actor.userId)throw ApiError.forbidden('Your assignment is required');
     expected(row.version,parsed.expected_version);const mission=await get(row.parentId!,'MISSION');
     if(data(mission.payload).status!=='ACTIVE')throw ApiError.conflict('Mission must be active','MISSION_NOT_ACTIVE');
     if(parsed.action==='CHECK_IN'){
      if(payload.status!=='ASSIGNED')throw ApiError.conflict('Assignment is not awaiting check-in','INVALID_TRANSITION');
      result=await update(row.id,row.version,{...payload,status:'CHECKED_IN',checked_in_at:new Date().toISOString()});
     }else{
      if(payload.status!=='CHECKED_IN')throw ApiError.conflict('Check in before completion','INVALID_TRANSITION');
      result=await update(row.id,row.version,{...payload,status:'COMPLETED',completed_at:new Date().toISOString()});
      await create('HOURS',{submitted_hours:parsed.hours,approved_hours:null,note:parsed.note,status:'PENDING'},row.parentId!,actor.userId);
      // Own reservation is released by a dedicated function that cannot release another responder.
      await tx.$queryRaw`SELECT public.resq_responder_release_own(${row.parentId!})::text`;
     }
    }else if(parsed.action==='APPROVE_HOURS'){
     coordinator(memberRole);if(row.kind!=='HOURS')throw ApiError.notFound('Hours');
     if(row.ownerId===actor.userId)throw ApiError.forbidden('Another coordinator must approve your hours');
     result=await update(row.id,parsed.expected_version,{...payload,status:'APPROVED',approved_hours:parsed.hours,reason:parsed.reason,approved_by:actor.userId});
    }else{
     if(row.kind!=='MISSION'||payload.status==='DRAFT')throw ApiError.notFound('Published mission');
     if(parsed.action==='REPORT')result=await create('REPORT',{title:parsed.title,body:parsed.body,status:'SUBMITTED'},row.id);
     else if(parsed.action==='MESSAGE'){
      if(parsed.reply_to){const parent=await get(parsed.reply_to,'MESSAGE');if(parent.parentId!==row.id||data(parent.payload).status==='REMOVED')throw ApiError.conflict('Choose an available message in this mission','THREAD_UNAVAILABLE');}
      result=await create('MESSAGE',{body:parsed.body,status:'PUBLISHED',reply_to:parsed.reply_to??null},row.id);
     }
    }
   }
   if(!result)throw ApiError.badRequest('Unsupported command');
   await create('EVENT',{action:parsed.action,record_id:result.id,record_kind:result.kind,version:result.version});
   const output=JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
   await tx.operationReceipt.create({data:{id:randomUUID(),userId:actor.userId,...scope,key,fingerprint,result:output}});
   return output;

}
