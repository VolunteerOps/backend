import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import {withActor,type Actor} from '../organizations/context.js';
const reservation=z.object({key:z.string().uuid(),bucket:z.literal('agent.chat'),limit:z.number().int().min(1).max(1000),fingerprint:z.string().max(10000)}).strict();
export async function reserveUsage(actor:Actor,input:z.infer<typeof reservation>){
 const value=reservation.parse(input),period=new Date().toISOString().slice(0,10);
 const fingerprint=createHash('sha256').update(JSON.stringify([value.bucket,value.fingerprint])).digest('hex');
 return withActor(actor,async tx=>{
  // User-wide lock: every device, workspace and role draws from the same daily bucket.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'resq:usage:'+actor.userId},0))::text`;
  const prior=await tx.usageLedger.findUnique({where:{userId_requestKey:{userId:actor.userId,requestKey:value.key}}});
  if(prior){if(prior.fingerprint!==fingerprint)throw ApiError.conflict('Usage key belongs to another request','IDEMPOTENCY_CONFLICT');return {entry:prior,replayed:true};}
  const total=await tx.usageLedger.aggregate({where:{userId:actor.userId,bucket:value.bucket,period,state:{in:['RESERVED','FINALIZED']}},_sum:{units:true}});
  if((total._sum.units??0)>=value.limit)throw new ApiError(429,'AGENT_DAILY_LIMIT','Daily personal assistant allowance reached. It resets at midnight UTC.');
  await tx.$queryRaw`SELECT set_config('vops.usage','true',true)`;
  const entry=await tx.usageLedger.create({data:{id:randomUUID(),userId:actor.userId,requestKey:value.key,fingerprint,bucket:value.bucket,period,units:1,metadata:{catalog_version:'2026-10-01',limit:value.limit}}});
  return {entry,replayed:false};
 });
}
export async function finishUsage(actor:Actor,id:string,outcome:'FINALIZED'|'RELEASED'){
 return withActor(actor,async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'resq:usage:'+actor.userId},0))::text`;
  const entry=await tx.usageLedger.findFirst({where:{id,userId:actor.userId}});
  if(!entry)throw ApiError.notFound('Usage reservation');
  if(entry.state!== 'RESERVED')return entry;
  await tx.$queryRaw`SELECT set_config('vops.usage','true',true)`;
  return tx.usageLedger.update({where:{id},data:{state:outcome,finalizedAt:new Date()}});
 });
}
export async function usageStatus(actor:Actor){return withActor(actor,async tx=>{
 const period=new Date().toISOString().slice(0,10);
 const total=await tx.usageLedger.aggregate({where:{userId:actor.userId,bucket:'agent.chat',period,state:{in:['RESERVED','FINALIZED']}},_sum:{units:true}});
 return {bucket:'agent.chat',period,timezone:'UTC',used:total._sum.units??0,scope:'PERSONAL_ACROSS_WORKSPACES'};
});}
