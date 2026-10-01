import { randomBytes,randomUUID } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import type { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { withActor,requireOrganization,requirePlatform,lockOrganization,type Actor } from '../organizations/context.js';
import { appendAudit,invitationHash } from '../organizations/organizations.service.js';
import type { partnerSchema,policySchema,supportSchema,coordinationSchema } from './enterprise.schema.js';
export const EnterpriseService={
 async reserve(actor:Actor,orgId:string,userId:number,resource:string,minutes:number,release:boolean){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'dispatch.approve');
  const results=await tx.$queryRaw<Array<{available:boolean}>>`SELECT public.resq_responder_reserve(${userId}::integer,${resource},${minutes}::integer,${release}) AS available`;
  if(!results[0]?.available)throw ApiError.conflict('Responder unavailable or conflicting reservation','RESPONDER_UNAVAILABLE');
  await appendAudit(tx,actor,orgId,release?'RESPONDER_RELEASED':'RESPONDER_RESERVED','Scoped coordinator availability reservation',{user_id:userId});
  return {status:release?'RELEASED':'RESERVED'};
 });},
 async apply(actor:Actor,input:z.infer<typeof partnerSchema>){return withActor(actor,async tx=>{
  if(await tx.partnerApplication.count({where:{userId:actor.userId,status:'PENDING'}})>=3) throw new ApiError(429,'APPLICATION_LIMIT','Pending application limit reached');
  return tx.partnerApplication.create({data:{id:randomUUID(),userId:actor.userId,...input}});
 });},
 async applications(actor:Actor,platform=false){return withActor(actor,async tx=>{
  if(platform)await requirePlatform(tx,actor);
  return tx.partnerApplication.findMany({where:platform?{}:{userId:actor.userId},orderBy:{createdAt:'desc'},take:100});
 });},
 async review(actor:Actor,id:string,status:'APPROVED'|'DECLINED',reason:string,organizationId?:string){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);
  if(status==='APPROVED' && (!organizationId || !await tx.organization.findUnique({where:{id:organizationId}}))) throw ApiError.badRequest('Provision and select the reviewed workspace before approval');
  const changed=await tx.partnerApplication.updateMany({where:{id,status:'PENDING'},data:{status,reviewReason:reason,organizationId:status==='APPROVED'?organizationId:null}});
  if(changed.count!==1) throw ApiError.conflict('Application already reviewed','STALE_VERSION');
  await tx.auditLog.create({data:{userId:actor.userId,action:'PARTNERSHIP_REVIEWED',entityType:'PartnerApplication',newValues:{id,status,reason}}});return {id,status};
 });},
 async units(actor:Actor,orgId:string,name?:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,name?'members.manage':'organization.read');
  if(!name)return tx.organizationUnit.findMany({where:{organizationId:orgId},select:{id:true,name:true,active:true},take:100});
  await tx.$queryRaw`SELECT set_config('vops.operations','true',true),set_config('vops.all_regions','true',true)`;
  const unit=await tx.organizationUnit.create({data:{id:randomUUID(),organizationId:orgId,name}});
  await appendAudit(tx,actor,orgId,'ORGANIZATION_UNIT_CREATED','Administrator created a workspace unit',{unit_id:unit.id});return unit;
 });},
 async domain(actor:Actor,orgId:string,domain:string,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.manage');
  const token=randomBytes(32).toString('base64url');
  const existing=await tx.domainClaim.findFirst({where:{organizationId:orgId,domain}});
  if(existing?.disputed)throw ApiError.conflict('Domain dispute requires owner review','DOMAIN_DISPUTED');
  let claim;
  try{claim=await tx.domainClaim.upsert({where:{domain},create:{id:randomUUID(),organizationId:orgId,domain,tokenHash:invitationHash(token),expiresAt:new Date(Date.now()+86400000)},update:{tokenHash:invitationHash(token),expiresAt:new Date(Date.now()+86400000),verifiedUntil:null}});}
  catch{throw ApiError.conflict('Domain claim requires review','DOMAIN_CLAIM_CONFLICT');}
  if(claim.organizationId!==orgId)throw ApiError.conflict('Domain claim requires review','DOMAIN_CLAIM_CONFLICT');
  await appendAudit(tx,actor,orgId,'DOMAIN_PROOF_REQUESTED',reason,{claim_id:claim.id});
  return {id:claim.id,record:'_resq-verification.'+domain,type:'TXT',value:'resq-proof='+token,expires_at:claim.expiresAt};
 });},
 async verifyDomain(actor:Actor,orgId:string,id:string,resolve?: (name:string)=>Promise<string[][]>){
  const claim=await withActor(actor,async tx=>{await requireOrganization(tx,actor,orgId,'members.manage');return tx.domainClaim.findFirst({where:{id,organizationId:orgId}});});
  if(!claim || claim.disputed || claim.expiresAt<=new Date())throw ApiError.conflict('DNS proof expired or unavailable','DOMAIN_PROOF_UNAVAILABLE');
  const resolver=new Resolver({timeout:3000,tries:2});let records:string[][];
  try{records=await (resolve??(name=>resolver.resolveTxt(name)))('_resq-verification.'+claim.domain);}catch{throw new ApiError(503,'DNS_PROOF_UNAVAILABLE','DNS proof was not found; retry after propagation');}finally{resolver.cancel();}
  const valid=records.slice(0,50).some(parts=>{const text=parts.join('');return text.startsWith('resq-proof=') && invitationHash(text.slice(11))===claim.tokenHash;});
  if(!valid)throw ApiError.conflict('Exact DNS proof not found','DOMAIN_PROOF_MISMATCH');
  return withActor(actor,async tx=>{await requireOrganization(tx,actor,orgId,'members.manage');
   const until=new Date(Date.now()+30*86400000);
   const changed=await tx.domainClaim.updateMany({where:{id,organizationId:orgId,tokenHash:claim.tokenHash,disputed:false,expiresAt:{gt:new Date()}},data:{verifiedUntil:until}});
   if(changed.count!==1)throw ApiError.conflict('Domain proof changed','STALE_VERSION');
   await appendAudit(tx,actor,orgId,'DOMAIN_PROOF_VERIFIED','Exact domain DNS challenge matched',{claim_id:id});return {verified_until:until,enrollment:'REQUIRES_SEPARATE_INSTITUTION_REVIEW'};
  });
 },
 async dispute(actor:Actor,id:string,reason:string){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);const claim=await tx.domainClaim.update({where:{id},data:{disputed:true,verifiedUntil:null}});
  await appendAudit(tx,actor,claim.organizationId,'DOMAIN_DISPUTED',reason,{claim_id:id});return {status:'DISPUTED'};
 });},
 async policy(actor:Actor,orgId:string,input:z.infer<typeof policySchema>){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);await lockOrganization(tx,orgId);
  const enabled=new Set((process.env.FIREBASE_ENTERPRISE_PROVIDERS??'').split(',').filter(Boolean));
  if(input.allowed_providers.some(p=>(p.startsWith('saml.')||p.startsWith('oidc.'))&&!enabled.has(p)))throw new ApiError(503,'SSO_PROVIDER_NOT_CONFIGURED','Configure and verify the institution provider first');
  const updated=await tx.organization.updateMany({where:{id:orgId,version:input.expected_version},data:{allowedProviders:input.allowed_providers,requireMfa:input.require_mfa,version:{increment:1}}});
  if(updated.count!==1)throw ApiError.conflict('Workspace changed','STALE_VERSION');
  await tx.organizationInvitation.updateMany({where:{organizationId:orgId,acceptedAt:null},data:{revokedAt:new Date()}});
  await appendAudit(tx,actor,orgId,'AUTHENTICATION_POLICY_CHANGED',input.reason,{version:input.expected_version+1});return {version:input.expected_version+1};
 });},
 async overview(actor:Actor){return withActor(actor,async tx=>{await requirePlatform(tx,actor);return {
  organizations:await tx.organization.groupBy({by:['status'],_count:true}),pending_partnerships:await tx.partnerApplication.count({where:{status:'PENDING'}}),
  grants:await tx.platformGrant.findMany({select:{userId:true,active:true,role:true},take:100}),
  provider_readiness:{identity:process.env.FIREBASE_PROJECT_ID?'CONFIGURED_UNVERIFIED':'NOT_CONFIGURED',email:process.env.INVITATION_EMAIL_ENABLED==='true'?'CONFIGURED_UNVERIFIED':'NOT_CONFIGURED',enterprise_providers:(process.env.FIREBASE_ENTERPRISE_PROVIDERS??'').split(',').filter(Boolean)},
  entitlements:{status:'STAGE_4_PENDING'},reports:await tx.recruitmentReport.findMany({where:{status:'PENDING'},take:100,orderBy:{createdAt:'desc'}}),
 };});},
 async grant(actor:Actor,userId:number,active:boolean,reason:string){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);
  const user=await tx.user.findUnique({where:{id:userId},select:{isActive:true,firebaseIdentity:true}});
  if(!user?.isActive||!user.firebaseIdentity)throw ApiError.notFound('Verified active user');
  const current=await tx.platformGrant.findUnique({where:{userId}});
  if(!active&&current?.active&&await tx.platformGrant.count({where:{active:true}})<=1)throw ApiError.conflict('Retain the last platform owner','LAST_OWNER_REQUIRED');
  const result=await tx.platformGrant.upsert({where:{userId},create:{userId,active},update:{active}});
  await tx.auditLog.create({data:{userId:actor.userId,action:'PLATFORM_GRANT_CHANGED',entityType:'User',entityId:userId,newValues:{active,reason}}});return result;
 });},
 async support(actor:Actor,orgId:string,input:z.infer<typeof supportSchema>){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);await lockOrganization(tx,orgId);
  if(!await tx.platformGrant.findFirst({where:{userId:input.user_id,active:true}}))throw ApiError.forbidden('Support recipient must be an active platform operator');
  const grant=await tx.supportAccessGrant.create({data:{id:randomUUID(),organizationId:orgId,userId:input.user_id,reason:input.reason,expiresAt:new Date(Date.now()+input.expires_in_minutes*60000)}});
  await appendAudit(tx,actor,orgId,'SUPPORT_ACCESS_GRANTED',input.reason,{grant_id:grant.id});return grant;
 });},
 async supportRead(actor:Actor,id:string){return withActor(actor,async tx=>{
  await requirePlatform(tx,actor);const grant=await tx.supportAccessGrant.findFirst({where:{id,userId:actor.userId,revokedAt:null,expiresAt:{gt:new Date()}}});
  if(!grant)throw ApiError.forbidden('Active time-bound support grant required','SUPPORT_GRANT_REQUIRED');
  await lockOrganization(tx,grant.organizationId);const organization=await tx.organization.findFirst({where:{id:grant.organizationId,status:'ACTIVE'},select:{id:true,displayName:true,status:true,version:true}});
  if(!organization)throw ApiError.forbidden('Workspace is not active','ORG_NOT_ACTIVE');
  await appendAudit(tx,actor,grant.organizationId,'SUPPORT_ACCESS_USED',grant.reason,{grant_id:id});return {organization,scope:'WORKSPACE_CONFIGURATION_ONLY'};
 });},
 async revokeSupport(actor:Actor,id:string,reason:string){return withActor(actor,async tx=>{await requirePlatform(tx,actor);const grant=await tx.supportAccessGrant.update({where:{id},data:{revokedAt:new Date()}});await appendAudit(tx,actor,grant.organizationId,'SUPPORT_ACCESS_REVOKED',reason,{grant_id:id});return {status:'REVOKED'};});},
 async coordinate(actor:Actor,orgId:string,input:z.infer<typeof coordinationSchema>){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.manage');
  if(input.partner_organization_id===orgId || ![orgId,input.partner_organization_id].includes(input.lead_organization_id))throw ApiError.badRequest('Two distinct organizations and one participating lead are required');
  const grant=await tx.coordinationGrant.create({data:{id:randomUUID(),organizationId:orgId,partnerOrganizationId:input.partner_organization_id,leadOrganizationId:input.lead_organization_id,resourceReference:input.resource_reference,expiresAt:new Date(Date.now()+input.expires_in_hours*3600000)}});
  await appendAudit(tx,actor,orgId,'COORDINATION_PROPOSED',input.reason,{grant_id:grant.id});return grant;
 });},
 async coordinationAction(actor:Actor,orgId:string,id:string,accept:boolean,reason:string){return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,orgId,'members.manage');
  const grant=await tx.coordinationGrant.findFirst({where:{id,OR:[{organizationId:orgId},{partnerOrganizationId:orgId}]}});
  if(!grant || grant.revokedAt || grant.expiresAt<=new Date())throw ApiError.notFound('Coordination grant');
  if(accept&&grant.partnerOrganizationId!==orgId)throw ApiError.forbidden('The partner organization must explicitly accept');
  const result=await tx.coordinationGrant.update({where:{id},data:accept?{acceptedAt:new Date()}:{revokedAt:new Date()}});
  await appendAudit(tx,actor,orgId,accept?'COORDINATION_ACCEPTED':'COORDINATION_REVOKED',reason,{grant_id:id});return result;
 });},
};
