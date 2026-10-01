import { randomUUID, randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, type Actor, type TenantTransaction } from '../organizations/context.js';
import { invitationHash } from '../organizations/organizations.service.js';
import type { profileSchema, directorySchema, directoryQuery, consentSchema } from './personal.schema.js';

async function lockPersonal(tx: TenantTransaction, userId: number) {
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'resq:personal:'+userId},0))::text`;
}
async function audit(tx: TenantTransaction, actor: Actor, action: string) {
 await tx.personalAudit.create({ data: { id: randomUUID(), userId: actor.userId, actorUserId: actor.userId, action } });
}
function recent(actor: Actor) {
 const age=Date.now()/1000-actor.identity.authTime;
 if(age<0 || age>300) throw ApiError.unauthorized('Sign in again before this action','RECENT_AUTH_REQUIRED');
}
const directoryProjection = (p: { publicId: string; displayName: string; biography: string; region: string; skills: string[]; availability: string; showAvailability: boolean }) => ({
 id:p.publicId, display_name:p.displayName, biography:p.biography, region:p.region, self_declared_skills:p.skills,
 availability:p.showAvailability?p.availability:null,
});
export const PersonalService = {
 async home(actor:Actor) { return withActor(actor,async tx=>({
  profile:await tx.volunteerProfile.findUnique({where:{userId:actor.userId}}),
  directory:await tx.directoryPreferences.findUnique({where:{userId:actor.userId}}),
  deletion:await tx.accountDeletionRequest.findUnique({where:{userId:actor.userId}}),
  invitations:await tx.organizationInvitation.findMany({where:{recipientEmail:actor.identity.email.toLowerCase(),revokedAt:null,acceptedAt:null,declinedAt:null,expiresAt:{gt:new Date()}},
   select:{id:true,organizationId:true,role:true,expiresAt:true},orderBy:{id:'asc'},take:100}),
  opportunities:{items:[],readiness:'OPERATIONAL_APIS_PENDING'},
 })); },
 async saveProfile(actor:Actor,input:z.infer<typeof profileSchema>) { return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  const current=await tx.volunteerProfile.findUnique({where:{userId:actor.userId}});
  if((current?.version??0)!==input.expected_version) throw ApiError.conflict('Profile changed','STALE_VERSION');
  const projection={displayName:input.display_name,biography:input.biography,region:input.region,
   skills:[...new Set(input.skills)],availability:input.availability};
  const profile=await tx.volunteerProfile.upsert({where:{userId:actor.userId},
   create:{userId:actor.userId,publicId:randomUUID(),...projection,privateDetails:input.private_details},
   update:{...projection,privateDetails:input.private_details,version:{increment:1},updatedAt:new Date()}});
  await tx.directoryPreferences.upsert({where:{userId:actor.userId},
   create:{userId:actor.userId,publicId:profile.publicId,...projection},update:{...projection,version:{increment:1}}});
  await audit(tx,actor,'PROFILE_UPDATED');return profile;
 }); },
 async directorySettings(actor:Actor,input:z.infer<typeof directorySchema>) { return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  const changed=await tx.directoryPreferences.updateMany({where:{userId:actor.userId,version:input.expected_version},data:{
   discoverable:input.discoverable,publicPreview:input.public_preview,showAvailability:input.show_availability,version:{increment:1}}});
  if(changed.count!==1) throw ApiError.conflict('Profile preferences changed or profile missing','STALE_VERSION');
  await tx.consentRecord.createMany({data:[{id:randomUUID(),userId:actor.userId,purpose:'DIRECTORY',policyVersion:'directory-v1',granted:input.discoverable},
   {id:randomUUID(),userId:actor.userId,purpose:'PUBLIC_PROFILE',policyVersion:'directory-v1',granted:input.public_preview}]});
  await audit(tx,actor,'DIRECTORY_PREFERENCES_UPDATED');
  return tx.directoryPreferences.findUniqueOrThrow({where:{userId:actor.userId}});
 }); },
 async consent(actor:Actor,input:z.infer<typeof consentSchema>) { return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  if(['SENSING','LOCATION','RELAY'].includes(input.purpose)) throw ApiError.conflict('Update the registered device consent so its version and pending work are invalidated','DEVICE_CONSENT_REQUIRED');
  if(input.granted && ['DIRECTORY','PUBLIC_PROFILE'].includes(input.purpose)) throw ApiError.badRequest('Use directory preferences to opt in');
  if(!input.granted) {
   if(input.purpose==='DIRECTORY') await tx.directoryPreferences.updateMany({where:{userId:actor.userId},data:{discoverable:false,version:{increment:1}}});
   if(input.purpose==='PUBLIC_PROFILE') await tx.directoryPreferences.updateMany({where:{userId:actor.userId},data:{publicPreview:false,version:{increment:1}}});
  }
  return tx.consentRecord.create({data:{id:randomUUID(),userId:actor.userId,purpose:input.purpose,policyVersion:input.policy_version,granted:input.granted}});
 }); },
 async export(actor:Actor,after?:string) { recent(actor);return withActor(actor,async tx=>{
  const consents=await tx.consentRecord.findMany({where:{userId:actor.userId,...(after?{id:{gt:after}}:{})},orderBy:{id:'asc'},take:1001});
  return {
   profile:await tx.volunteerProfile.findUnique({where:{userId:actor.userId}}),
   preferences:await tx.directoryPreferences.findUnique({where:{userId:actor.userId}}),
   user_id:actor.userId,
   consents:consents.slice(0,1000),
   consents_next_cursor:consents.length>1000?consents[999]!.id:null,
   memberships:await tx.organizationMembership.findMany({where:{userId:actor.userId},select:{id:true,organizationId:true,role:true,status:true}}),
   scope:'PERSONAL_PROFILE_AND_CONSENT',
  };
 }); },
 async shares(actor:Actor) {return withActor(actor,tx=>tx.profileShare.findMany({where:{userId:actor.userId},
  select:{id:true,createdAt:true,expiresAt:true,revokedAt:true},orderBy:{createdAt:'desc'},take:100}));},
 async share(actor:Actor,hours:number) {return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  const prefs=await tx.directoryPreferences.findUnique({where:{userId:actor.userId}});
  if(!prefs?.publicPreview) throw ApiError.forbidden('Enable public profile preview first','CONSENT_REQUIRED');
  if(await tx.profileShare.count({where:{userId:actor.userId,revokedAt:null,expiresAt:{gt:new Date()}}})>=10) throw new ApiError(429,'SHARE_LIMIT','Revoke an existing share first');
  const token=randomBytes(32).toString('base64url'); const id=randomUUID();
  const expiresAt=new Date(Date.now()+hours*3600000);
  await tx.profileShare.create({data:{id,userId:actor.userId,tokenHash:invitationHash(token),expiresAt}});
  await audit(tx,actor,'PROFILE_SHARE_CREATED');return {id,token,expires_at:expiresAt};
 });},
 async revokeShare(actor:Actor,id:string) {return withActor(actor,async tx=>{
  const result=await tx.profileShare.updateMany({where:{id,userId:actor.userId},data:{revokedAt:new Date()}});
  if(!result.count) throw ApiError.notFound('Share');await audit(tx,actor,'PROFILE_SHARE_REVOKED');return {id,status:'REVOKED'};
 });},
 async preview(token:string) {return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT set_config('vops.share_hash',${invitationHash(token)},true),set_config('vops.user_id','',true),set_config('vops.directory','',true)`;
  const share=await tx.profileShare.findUnique({where:{tokenHash:invitationHash(token)}});
  if(!share||share.revokedAt||share.expiresAt<=new Date()) throw ApiError.notFound('Profile');
  const profile=await tx.directoryPreferences.findFirst({where:{userId:share.userId,publicPreview:true}});
  if(!profile) throw ApiError.notFound('Profile');return directoryProjection(profile);
 });},
 async directory(actor:Actor,orgId:string,input:z.infer<typeof directoryQuery>) {return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.invite');
  await tx.$queryRaw`SELECT set_config('vops.directory','true',true)`;
  const rows=await tx.directoryPreferences.findMany({where:{discoverable:true,
   ...(input.after?{publicId:{gt:input.after}}:{}),...(input.region?{region:input.region}:{}),
   ...(input.skill?{skills:{has:input.skill}}:{}),...(input.available==='true'?{showAvailability:true,availability:{in:['WEEKDAYS','WEEKENDS','FLEXIBLE']}}:{})},
   orderBy:{publicId:'asc'},take:51});
  await audit(tx,actor,'DIRECTORY_SEARCH');return {items:rows.slice(0,50).map(directoryProjection),next_cursor:rows.length>50?rows[49]!.publicId:null};
 });},
 async block(actor:Actor,organizationId:string,reason?:string) {return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  // Only an organization that has actually contacted this verified recipient can be blocked/reported.
  const contacted=await tx.organizationInvitation.findFirst({where:{organizationId,recipientEmail:actor.identity.email.toLowerCase()}});
  if(!contacted) throw ApiError.notFound('Invitation');
  await tx.recruitmentBlock.upsert({where:{userId_organizationId:{userId:actor.userId,organizationId}},
   create:{id:randomUUID(),userId:actor.userId,organizationId},update:{}});
  await tx.organizationInvitation.updateMany({where:{organizationId,recipientEmail:actor.identity.email.toLowerCase(),acceptedAt:null},data:{revokedAt:new Date(),deliveryStatus:'CANCELLED'}});
  if(reason) await tx.recruitmentReport.create({data:{id:randomUUID(),userId:actor.userId,organizationId,reason}});
  await audit(tx,actor,'RECRUITMENT_BLOCKED');return {status:'BLOCKED'};
 });},
 async deletion(actor:Actor,cancel:boolean) {recent(actor);return withActor(actor,async tx=>{
  await lockPersonal(tx,actor.userId);
  if(!cancel){
   const admins=await tx.organizationMembership.findMany({where:{userId:actor.userId,role:'ORG_ADMIN',status:'ACTIVE'}});
   // Membership handover must complete first; never delete a shared identity from an organization action.
   if(admins.length) throw ApiError.conflict('Complete administrator handover before requesting deletion','HANDOVER_REQUIRED');
   await tx.directoryPreferences.updateMany({where:{userId:actor.userId},data:{discoverable:false,publicPreview:false,version:{increment:1}}});
   await tx.profileShare.updateMany({where:{userId:actor.userId,revokedAt:null},data:{revokedAt:new Date()}});
  }
  const record=await tx.accountDeletionRequest.upsert({where:{userId:actor.userId},
   create:{id:randomUUID(),userId:actor.userId,status:cancel?'CANCELLED':'REQUESTED'},
   update:{status:cancel?'CANCELLED':'REQUESTED',requestedAt:new Date(),cancelledAt:cancel?new Date():null}});
  await audit(tx,actor,cancel?'ACCOUNT_DELETION_CANCELLED':'ACCOUNT_DELETION_REQUESTED');return record;
 });},
};
