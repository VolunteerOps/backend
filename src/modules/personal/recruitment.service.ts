import { randomUUID } from 'node:crypto';
import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, lockOrganization, type Actor } from '../organizations/context.js';
import { issueInvitation, appendAudit, invitationHash } from '../organizations/organizations.service.js';
export const RecruitmentService={
 async recruitShare(actor:Actor,orgId:string,token:string,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.invite');
  await tx.$queryRaw`SELECT set_config('vops.share_hash',${invitationHash(token)},true)`;
  const share=await tx.profileShare.findUnique({where:{tokenHash:invitationHash(token)}});
  if(!share || share.revokedAt || share.expiresAt<=new Date())throw ApiError.notFound('Share');
  const profile=await tx.directoryPreferences.findFirst({where:{userId:share.userId,publicPreview:true}});
  if(!profile)throw ApiError.notFound('Profile');
  const user=await tx.user.findUniqueOrThrow({where:{id:profile.userId},select:{email:true,isActive:true}});
  if(!user.isActive)throw ApiError.notFound('Profile');
  return issueInvitation(tx,actor,orgId,{recipient_email:user.email,role:'VOLUNTEER',region_ids:[],expires_in_hours:48,reason});
 });},
 async workspaces(actor:Actor,after?:string){return withActor(actor,async tx=>{
  await tx.$queryRaw`SELECT set_config('vops.public_workspaces','true',true)`;
  const rows=await tx.organization.findMany({where:{recruitmentOpen:true,status:'ACTIVE',enrollmentReady:true,...(after?{id:{gt:after}}:{})},
   select:{id:true,slug:true,displayName:true},orderBy:{id:'asc'},take:51});
  return {items:rows.slice(0,50),next_cursor:rows.length>50?rows[49]!.id:null};
 });},
 async publish(actor:Actor,orgId:string,open:boolean,version:number,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.manage');
  await tx.$queryRaw`SELECT set_config('vops.organization_settings','true',true)`;
  const result=await tx.organization.updateMany({where:{id:orgId,version},data:{recruitmentOpen:open,version:{increment:1}}});
  if(result.count!==1) throw ApiError.conflict('Workspace changed','STALE_VERSION');
  await appendAudit(tx,actor,orgId,'RECRUITMENT_VISIBILITY_CHANGED',reason,{open});return {open,version:version+1};
 });},
 async request(actor:Actor,orgId:string,message:string){return withActor(actor,async tx=>{
  await tx.$queryRaw`SELECT set_config('vops.public_workspaces','true',true)`;
  await lockOrganization(tx,orgId);
  const org=await tx.organization.findFirst({where:{id:orgId,recruitmentOpen:true,status:'ACTIVE',enrollmentReady:true}});
  if(!org) throw ApiError.notFound('Workspace');
  if(await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:orgId,userId:actor.userId}}})) throw ApiError.conflict('Existing membership requires review','MEMBERSHIP_EXISTS');
  if(await tx.recruitmentBlock.findFirst({where:{organizationId:orgId,userId:actor.userId}})) throw ApiError.forbidden('Recruitment blocked','RECRUITMENT_UNAVAILABLE');
  const existing=await tx.joinRequest.findUnique({where:{userId_organizationId:{userId:actor.userId,organizationId:orgId}}});
  if(existing) return existing;
  if(await tx.joinRequest.count({where:{userId:actor.userId,createdAt:{gt:new Date(Date.now()-86400000)}}})>=10) throw new ApiError(429,'JOIN_REQUEST_LIMIT','Daily request limit reached');
  return tx.joinRequest.create({data:{id:randomUUID(),userId:actor.userId,organizationId:orgId,message}});
 });},
 async list(actor:Actor,orgId?:string){return withActor(actor,async tx=>{
  if(orgId) await requireOrganization(tx,actor,orgId,'members.invite');
  return tx.joinRequest.findMany({where:orgId?{organizationId:orgId}:{userId:actor.userId},orderBy:{createdAt:'desc'},take:100});
 });},
 async withdraw(actor:Actor,id:string){return withActor(actor,async tx=>{
  const changed=await tx.joinRequest.updateMany({where:{id,userId:actor.userId,status:'PENDING'},data:{status:'WITHDRAWN',version:{increment:1}}});
  if(changed.count!==1) throw ApiError.conflict('Join request is closed','REQUEST_CLOSED');return {status:'WITHDRAWN'};
 });},
 async review(actor:Actor,orgId:string,id:string,decision:'INVITE'|'DECLINE',version:number,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.invite');
  const request=await tx.joinRequest.findFirst({where:{id,organizationId:orgId,status:'PENDING',version}});
  if(!request) throw ApiError.conflict('Join request changed','STALE_VERSION');
  let invitation=null;
  if(decision==='INVITE'){
   const user=await tx.user.findUniqueOrThrow({where:{id:request.userId},select:{email:true,isActive:true}});
   if(!user.isActive) throw ApiError.notFound('Volunteer');
   invitation=await issueInvitation(tx,actor,orgId,{recipient_email:user.email,role:'VOLUNTEER',region_ids:[],expires_in_hours:48,reason});
  }
  await tx.joinRequest.update({where:{id},data:{status:decision==='INVITE'?'INVITED':'DECLINED',version:{increment:1}}});
  await appendAudit(tx,actor,orgId,'JOIN_REQUEST_REVIEWED',reason,{request_id:id,decision});return {status:decision==='INVITE'?'INVITED':'DECLINED',invitation};
 });},
 async recruit(actor:Actor,orgId:string,publicId:string,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.invite');
  await tx.$queryRaw`SELECT set_config('vops.directory','true',true)`;
  const profile=await tx.directoryPreferences.findFirst({where:{publicId,discoverable:true}});
  if(!profile) throw ApiError.notFound('Profile');
  const user=await tx.user.findUniqueOrThrow({where:{id:profile.userId},select:{email:true,isActive:true}});
  if(!user.isActive) throw ApiError.notFound('Profile');
  return issueInvitation(tx,actor,orgId,{recipient_email:user.email,role:'VOLUNTEER',region_ids:[],expires_in_hours:48,reason});
 });},
};
