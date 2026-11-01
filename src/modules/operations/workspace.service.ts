import { withRegion } from '../sentinel/sentinel.context.js';
import type { Actor } from '../organizations/context.js';
import { reviewLanes, requireCoordinator, statusWhere } from './workspace-policy.js';

/** A bounded decision queue. Counts are current scoped state, never fabricated trends. */
export async function coordinationOverview(actor:Actor,organizationId:string,regionId:string) {
 return withRegion(actor,organizationId,regionId,false,async tx=>{
  const membership=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId,userId:actor.userId}}});
  requireCoordinator(membership.role);
  const scope={organizationId,regionId};
  const lanes=await Promise.all(reviewLanes.map(async lane=>{
   const where={...scope,kind:lane.kind,...statusWhere(lane.statuses)};
   const [count,items]=await Promise.all([
    tx.operationRecord.count({where}),
    tx.operationRecord.findMany({where,orderBy:{sequence:'asc'},take:4}),
   ]);
   return {key:lane.key,count,destination:lane.destination,action:lane.action,items};
  }));
  const missionWhere={...scope,kind:'MISSION',...statusWhere(['STAGED','ACTIVE','PAUSED'])};
  const [missions,active,staged,checkedIn,dispatch,events]=await Promise.all([
   tx.operationRecord.findMany({where:missionWhere,orderBy:{sequence:'desc'},take:8}),
   tx.operationRecord.count({where:{...scope,kind:'MISSION',...statusWhere(['ACTIVE'])}}),
   tx.operationRecord.count({where:{...scope,kind:'MISSION',...statusWhere(['STAGED'])}}),
   tx.operationRecord.count({where:{...scope,kind:'ASSIGNMENT',...statusWhere(['CHECKED_IN'])}}),
   tx.operationRecord.findFirst({where:{...scope,kind:'DISPATCH_CONTROL'}}),
   tx.operationRecord.findMany({where:{...scope,kind:'EVENT'},orderBy:{sequence:'desc'},take:6}),
  ]);
  // Filter event targets using the same RLS-visible set as other operational reads.
  const ids=events.map(e=>(e.payload as Record<string,unknown>).record_id).filter((v):v is string=>typeof v==='string');
  const targets=await tx.operationRecord.findMany({where:{...scope,id:{in:ids}},select:{id:true}});
  const allowed=new Set(targets.map(r=>r.id));
  return {as_of:new Date().toISOString(),counts:{active_missions:active,staged_missions:staged,checked_in:checkedIn,awaiting_review:lanes.reduce((sum,lane)=>sum+lane.count,0)},lanes,missions,activity:events.filter(e=>allowed.has((e.payload as Record<string,unknown>).record_id as string)),dispatch:dispatch?.payload??{paused:false}};
 });
}
