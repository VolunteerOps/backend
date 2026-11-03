import {withRegion} from './sentinel.context.js';
import type {Actor} from '../organizations/context.js';
import {requireCoordinator,statusWhere} from '../operations/workspace-policy.js';
import {ApiError} from '../../core/errors.js';
import type {PlanningSnapshot} from './planning-contract.js';

export async function readPlanningContext(actor:Actor,org:string,region:string,missionId:string):Promise<PlanningSnapshot> {
 return withRegion(actor,org,region,false,async tx=>{
  const membership=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(membership.role);
  const scope={organizationId:org,regionId:region};
  const mission=await tx.operationRecord.findFirst({where:{...scope,id:missionId,kind:'MISSION'}});
  if(!mission)throw ApiError.notFound('Mission');
  const p=mission.payload as Record<string,any>;
  if(!['STAGED','ACTIVE'].includes(p.status))throw ApiError.conflict('Stage the mission before planning allocations','MISSION_CLOSED');
  const applications=await tx.operationRecord.findMany({where:{...scope,parentId:missionId,kind:'APPLICATION',...statusWhere(['APPLIED','WAITLISTED'])},orderBy:{sequence:'asc'},take:101});
  const ids=applications.slice(0,100).map(a=>a.ownerId);
  await tx.$queryRaw`SELECT set_config('vops.roster','true',true)`;
  const members=await tx.organizationMembership.findMany({where:{organizationId:org,userId:{in:ids},status:'ACTIVE'},select:{userId:true,regionIds:true}});
  await tx.$queryRaw`SELECT set_config('vops.roster','',true)`;
  const credentials=await tx.operationRecord.findMany({where:{...scope,kind:'CREDENTIAL',ownerId:{in:ids},...statusWhere(['VERIFIED'])},take:3001});
  if(credentials.length>3000)throw new ApiError(422,'PLANNING_SCOPE_TOO_LARGE','Narrow the candidate pool before planning');
  const commitments=await tx.operationRecord.findMany({where:{...scope,kind:'ASSIGNMENT',ownerId:{in:ids},...statusWhere(['ASSIGNED','CHECKED_IN'])},take:1001});
  if(commitments.length>1000)throw new ApiError(422,'PLANNING_SCOPE_TOO_LARGE','Narrow the candidate pool before planning');
  const stock=await tx.operationRecord.findMany({where:{...scope,kind:'INVENTORY'},orderBy:{sequence:'asc'},take:201});
  const skillList=Array.isArray(p.required_skills)?p.required_skills as string[]:[];
  const commitmentMissions=commitments.length?await tx.operationRecord.findMany({where:{...scope,kind:'MISSION',id:{in:[...new Set(commitments.map(c=>c.parentId).filter(Boolean) as string[])]}},take:1001}):[];
  const missionWindow=(id:string|null)=>{const row=commitmentMissions.find(m=>m.id===id);const mp=row?.payload as Record<string,any>|undefined;const start=Date.parse(mp?.starts_at),end=Date.parse(mp?.ends_at);return Number.isFinite(start)&&Number.isFinite(end)&&end>start?{start,end}:null;};
  const missionStart=Date.parse(p.starts_at),missionEnd=Date.parse(p.ends_at);
  const missionHours=Number.isFinite(missionStart)&&Number.isFinite(missionEnd)&&missionEnd>missionStart?(missionEnd-missionStart)/3600000:0;
  // Fatigue guardrails: at least 8h rest before this mission and at most 60h of shifts in the 7 days before it (including this mission).
  const candidates=applications.slice(0,100).map(a=>{
   const member=members.find(m=>m.userId===a.ownerId);
   const active=!!member&&(!member.regionIds.length||member.regionIds.includes(region));
   const owned=credentials.filter(c=>c.ownerId===a.ownerId).map(c=>c.payload as Record<string,any>);
   const validSkills=[...new Set(owned.filter(c=>Date.parse(c.valid_until)>Date.now()).map(c=>String(c.skill)))];
   const missing=skillList.filter(skill=>!validSkills.includes(skill));
   const ownCommitments=commitments.filter(c=>c.ownerId===a.ownerId);
   const conflicts=ownCommitments.length;
   let recentHours=0,lastEnd=0;
   if(Number.isFinite(missionStart))for(const commitment of ownCommitments){const window=missionWindow(commitment.parentId);if(!window)continue;
    recentHours+=Math.max(0,Math.min(window.end,missionStart)-Math.max(window.start,missionStart-7*86400000))/3600000;
    if(window.end<=missionStart)lastEnd=Math.max(lastEnd,window.end);}
   const restHours=lastEnd?Math.round(((missionStart-lastEnd)/3600000)*10)/10:null;
   const recentRounded=Math.round(recentHours*10)/10;
   const fatigueEligible=!(restHours!==null&&restHours<8)&&recentRounded<60;
   return {user_id:a.ownerId,application_id:a.id,application_version:a.version,eligible:active&&!missing.length&&!conflicts&&fatigueEligible,missing_skills:missing,skills:validSkills,visible_commitments:conflicts,scope_active:active,recent_shift_hours_7d:recentRounded,rest_hours_before_mission:restHours,fatigue_eligible:fatigueEligible};
  });
  return {mission:{id:mission.id,version:mission.version,title:p.title,status:p.status,capacity:p.capacity,assigned_count:p.assigned_count,required_skills:skillList,starts_at:p.starts_at,ends_at:p.ends_at,meeting_point:p.meeting_point},candidates,
   resources:stock.slice(0,200).map(r=>{const p=r.payload as Record<string,any>;return{id:r.id,version:r.version,title:p.title,location:p.location,unit:p.unit,available:Math.max(0,p.quantity-p.reserved)};}),
   limitations:['Cross-workspace commitments are rechecked transactionally at approval. A visible absence of commitments does not prove availability.','Fatigue guardrails exclude responders with under 8 hours rest before this mission or already at 60 shift hours in the prior 7 days. Longer missions are staffed in shifts, so mission length itself does not disqualify.','Routes and current hazard restrictions require coordinator review.',...(applications.length>100?['Only the oldest 100 pending applications are included.']:[]),...(stock.length>200?['Only the first 200 inventory records are included.']:[])],
  };
 });
}
