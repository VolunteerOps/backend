import {ApiError} from '../../core/errors.js';
import type {OperationRecord} from '../../generated/prisma/client.js';
import type {Actor,TenantTransaction} from '../organizations/context.js';
import type {Command} from './operations.schema.js';
type Payload=Record<string,any>;
interface Context {tx:TenantTransaction;actor:Actor;scope:{organizationId:string;regionId:string};memberRole:string;get:(id:string,kind?:string)=>Promise<OperationRecord>;create:(kind:string,payload:Payload,parentId?:string,ownerId?:number)=>Promise<OperationRecord>;update:(id:string,version:number,payload:Payload)=>Promise<OperationRecord>}
export async function trainingCommand(input:Command,c:Context):Promise<OperationRecord>{
 const {tx,actor,scope,get,create,update}=c;
 const privileged=()=>{if(!['ORG_ADMIN','COORDINATOR'].includes(c.memberRole))throw ApiError.forbidden('Coordinator review required','CAPABILITY_REQUIRED');};
 if(input.action==='CREATE_COURSE'){
  privileged();for(const prerequisite of input.prerequisites){const required=await get(prerequisite,'COURSE');if((required.payload as Payload).status!=='PUBLISHED')throw ApiError.conflict('Prerequisites must be published','COURSE_PREREQUISITE');}
  const course=await create('COURSE',{title:input.title,skill:input.skill,capacity:input.capacity,prerequisites:input.prerequisites,status:'DRAFT',lessons:input.lessons.map(({answer,...lesson})=>lesson)});
  await create('COURSE_ASSESSMENT',{answers:input.lessons.map(l=>l.answer)},course.id);return course;
 }
 if(!('id' in input))throw ApiError.badRequest('Unsupported training action');
 const row=await get(input.id);const p=row.payload as Payload;
 if(input.action==='PUBLISH_COURSE'){
  privileged();if(row.kind!=='COURSE'||p.status!=='DRAFT')throw ApiError.conflict('Only a draft course can be published','COURSE_STATE');return update(row.id,input.expected_version,{...p,status:'PUBLISHED'});
 }
 if(input.action==='ENROLL_COURSE'){
  if(row.kind!=='COURSE'||p.status!=='PUBLISHED')throw ApiError.notFound('Published course');
  if(await tx.operationRecord.findFirst({where:{...scope,kind:'ENROLLMENT',parentId:row.id,ownerId:actor.userId}}))throw ApiError.conflict('You are already enrolled','ENROLLMENT_EXISTS');
  for(const prerequisite of p.prerequisites){if(!await tx.operationRecord.findFirst({where:{...scope,kind:'CREDENTIAL',parentId:prerequisite,ownerId:actor.userId,AND:[{payload:{path:['status'],equals:'VERIFIED'}},{payload:{path:['valid_until'],gt:new Date().toISOString()}}]}}))throw ApiError.forbidden('A current reviewed prerequisite is required','PREREQUISITE_REQUIRED');}
  await tx.$queryRaw`SELECT set_config('vops.training','true',true)`;
  const occupied=await tx.operationRecord.count({where:{...scope,kind:'ENROLLMENT',parentId:row.id}});
  await tx.$queryRaw`SELECT set_config('vops.training','',true)`;
  if(occupied>=p.capacity)throw ApiError.conflict('Course capacity reached','COURSE_FULL');
  return create('ENROLLMENT',{status:'IN_PROGRESS',course_title:p.title,next_lesson:0,attempts:0,course_version:row.version},row.id);
 }
 if(input.action==='SUBMIT_LESSON'){
  if(row.kind!=='ENROLLMENT'||row.ownerId!==actor.userId)throw ApiError.notFound('Your enrollment');
  if(p.status!=='IN_PROGRESS'||p.next_lesson!==input.lesson)throw ApiError.conflict('Complete lessons in order','LESSON_ORDER');
  if(p.last_attempt&&Date.now()-Date.parse(p.last_attempt)<30000)throw new ApiError(429,'ASSESSMENT_COOLDOWN','Review the lesson before retrying');
  const course=await get(row.parentId!,'COURSE');const courseData=course.payload as Payload;
  await tx.$queryRaw`SELECT set_config('vops.training','true',true)`;
  const key=await tx.operationRecord.findFirst({where:{...scope,kind:'COURSE_ASSESSMENT',parentId:course.id}});
  await tx.$queryRaw`SELECT set_config('vops.training','',true)`;
  if(!key)throw new ApiError(503,'ASSESSMENT_UNAVAILABLE','The assessment is unavailable');
  const correct=(key.payload as Payload).answers[input.lesson]===input.answer;
  const next=p.next_lesson+(correct?1:0);
  return update(row.id,input.expected_version,{...p,next_lesson:next,attempts:p.attempts+1,last_attempt:new Date().toISOString(),last_answer_correct:correct,status:next===courseData.lessons.length?'AWAITING_REVIEW':'IN_PROGRESS'});
 }
 if(input.action==='REVIEW_TRAINING'){
  privileged();if(row.kind!=='ENROLLMENT'||p.status!=='AWAITING_REVIEW')throw ApiError.conflict('Assessment completion is required first','REVIEW_NOT_READY');
  if(row.ownerId===actor.userId)throw ApiError.forbidden('Another coordinator must review your training');
  const expires=Date.parse(input.valid_until);if(expires<=Date.now()||expires>Date.now()+5*366*86400000)throw ApiError.badRequest('Choose a future expiry within five years');
  const course=await get(row.parentId!,'COURSE');
  if(input.approved)await create('CREDENTIAL',{skill:(course.payload as Payload).skill,status:'VERIFIED',valid_until:input.valid_until,reviewed_by:actor.userId,reviewed_at:new Date().toISOString(),reason:input.reason},course.id,row.ownerId);
  return update(row.id,input.expected_version,{...p,status:input.approved?'COMPLETED':'IN_PROGRESS',next_lesson:input.approved?p.next_lesson:0,review_reason:input.reason,reviewed_by:actor.userId});
 }
 if(input.action==='REVOKE_CREDENTIAL'){
  privileged();if(row.kind!=='CREDENTIAL')throw ApiError.notFound('Credential');
  return update(row.id,input.expected_version,{...p,status:'REVOKED',reason:input.reason,reviewed_by:actor.userId,reviewed_at:new Date().toISOString()});
 }
 throw ApiError.badRequest('Unsupported training action');
}
