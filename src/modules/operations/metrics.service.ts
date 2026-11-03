import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import {withRegion} from '../sentinel/sentinel.context.js';
import type {Actor} from '../organizations/context.js';
import {authorizeCapability} from '../billing/capabilities.js';
export const metricsQuery=z.object({from:z.string().datetime(),to:z.string().datetime()}).strict().refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=31*86400000,'Choose a positive interval of at most 31 days');
export async function operationalMetrics(actor:Actor,org:string,region:string,input:z.infer<typeof metricsQuery>,exporting=false){
 const range=metricsQuery.parse(input);
 if(exporting)await authorizeCapability(actor,org,region,'analytics.export');
 return withRegion(actor,org,region,false,async tx=>{
  const role=(await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}})).role;
  const records=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:{in:['MISSION','HOURS','REPORT','CREDENTIAL']},createdAt:{gte:new Date(range.from),lt:new Date(range.to)}},orderBy:{sequence:'asc'},take:1001});
  if(records.length>1000)throw new ApiError(422,'METRICS_RANGE_TOO_LARGE','Choose a shorter date interval; results are never silently truncated');
  const missions=records.filter(r=>r.kind==='MISSION'&&(role!=='VOLUNTEER'||(r.payload as any).status!=='DRAFT'));
  const hours=records.filter(r=>r.kind==='HOURS'&&(role!=='VOLUNTEER'||r.ownerId===actor.userId));
  const result={...range,scope:role==='VOLUNTEER'?'OWN_HOURS_AND_SHARED_ACTIVITY':'WORKSPACE_REGION',date_basis:'RECORD_CREATED_AT',mission_count:missions.length,active_missions:missions.filter(r=>(r.payload as any).status==='ACTIVE').length,completed_missions:missions.filter(r=>(r.payload as any).status==='COMPLETED').length,report_count:records.filter(r=>r.kind==='REPORT').length,recorded_hours:hours.reduce((sum,r)=>sum+Number((r.payload as any).submitted_hours??0),0),verified_qualifications:records.filter(r=>r.kind==='CREDENTIAL'&&(r.payload as any).status==='VERIFIED'&&Date.parse((r.payload as any).valid_until)>Date.now()).length,approved_hours:hours.filter(r=>(r.payload as any).status==='APPROVED').reduce((sum,r)=>sum+Number((r.payload as any).approved_hours??0),0),pending_hour_reviews:hours.filter(r=>(r.payload as any).status==='PENDING').length};
  if(exporting)await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'OPERATIONAL_METRICS_EXPORTED',reason:'Coordinator exported a bounded operational summary',metadata:{region_id:region,...range,record_count:records.length}}});
  return result;
 });
}
export function metricsCsv(value:Awaited<ReturnType<typeof operationalMetrics>>){
 // Keys are server-defined; neutralize spreadsheet formulas even if future fields become user supplied.
 const cell=(value:unknown)=>'"'+String(value).replace(/^[=+@\-]/,"'").replaceAll('"','""')+'"';
 return 'metric,value\r\n'+Object.entries(value).map(([key,value])=>cell(key)+','+cell(value)).join('\r\n')+'\r\n';
}

export async function recordExport(actor:Actor,org:string,region:string,kind:'MISSION'|'HOURS',input:z.infer<typeof metricsQuery>){
 const range=metricsQuery.parse(input);z.enum(['MISSION','HOURS']).parse(kind);
 await authorizeCapability(actor,org,region,'analytics.export');
 return withRegion(actor,org,region,false,async tx=>{
  const records=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind,createdAt:{gte:new Date(range.from),lt:new Date(range.to)}},orderBy:{sequence:'asc'},take:1001});
  if(records.length>1000)throw new ApiError(422,'METRICS_RANGE_TOO_LARGE','Choose a shorter date interval; exports are never silently truncated');
  const columns=kind==='MISSION'?['record_id','created_at','title','status','starts_at','ends_at','capacity','meeting_point']:['record_id','created_at','volunteer_id','mission_id','status','submitted_hours','approved_hours'];
  const cell=(v:unknown)=>{let text=String(v??'');if(/^[\s]*[=+@\-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const lines=records.map(r=>{const p=r.payload as Record<string,unknown>;const row:Record<string,unknown>={...p,record_id:r.id,created_at:r.createdAt.toISOString(),volunteer_id:r.ownerId,mission_id:r.parentId};return columns.map(k=>cell(row[k])).join(',');});
  await tx.organizationAudit.createMany({data:{id:randomUUID(),organizationId:org,actorUserId:actor.userId,action:'OPERATIONAL_RECORDS_EXPORTED',reason:'Coordinator exported records for the selected reporting interval',metadata:{region_id:region,kind,...range,record_count:records.length}}});
  return columns.join(',')+'\r\n'+lines.join('\r\n')+'\r\n';
 });
}
