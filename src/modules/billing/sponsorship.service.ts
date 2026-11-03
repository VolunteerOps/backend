import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, type Actor } from '../organizations/context.js';
import { promotionalAccess } from '../portal/portal.service.js';
import { subscriptionStatusForUid } from './billing.service.js';
export const sponsorshipSchema=z.object({user_id:z.number().int().positive(),active:z.boolean(),expected_version:z.number().int().nonnegative()}).strict();
type Verify=(uid:string)=>Promise<{resqops_pro:boolean}>;
export async function manageSponsorship(actor:Actor,org:string,input:z.infer<typeof sponsorshipSchema>,verify:Verify=async(uid)=>(await promotionalAccess(actor))?{resqops_pro:true}:subscriptionStatusForUid(uid,'ops')){
 if(input.active&&!(await verify(actor.identity.uid)).resqops_pro)throw ApiError.forbidden('Active ResQOps Pro is required to sponsor a volunteer','PRO_REQUIRED');
 return withActor(actor,async tx=>{
  await requireOrganization(tx,actor,org,'members.invite');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'resq:sponsor:'+actor.userId},0))::text`;
  const target=await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:org,userId:input.user_id}}});
  if(!target||target.status!=='ACTIVE'||target.role!=='VOLUNTEER')throw ApiError.forbidden('Choose an active volunteer in this workspace','VOLUNTEER_MEMBERSHIP_REQUIRED');
  const old=await tx.proSponsorship.findUnique({where:{organizationId_userId:{organizationId:org,userId:input.user_id}}});
  if(old&&old.sponsorId!==actor.userId)throw ApiError.conflict('This volunteer already has another sponsor','SPONSOR_EXISTS');
  if((old?.version??0)!==input.expected_version)throw ApiError.conflict('Sponsorship changed; refresh first','VERSION_CONFLICT');
  if(input.active&&!old?.active&&await tx.proSponsorship.count({where:{sponsorId:actor.userId,active:true}})>=3)throw ApiError.conflict('All three sponsorship seats are assigned. Release a seat first.','SEAT_LIMIT');
  if(!old&&!input.active)throw ApiError.notFound('Sponsorship');
  return tx.proSponsorship.upsert({where:{organizationId_userId:{organizationId:org,userId:input.user_id}},create:{id:randomUUID(),organizationId:org,sponsorId:actor.userId,userId:input.user_id},update:{active:input.active,version:{increment:1}}});
 });
}
export async function listSponsorships(actor:Actor,org:string){return withActor(actor,async tx=>{await requireOrganization(tx,actor,org,'organization.read');return tx.proSponsorship.findMany({where:{organizationId:org},take:100,orderBy:{id:'asc'}});});}
export async function sponsoredPro(actor:Actor,org:string,verify:Verify=(uid)=>subscriptionStatusForUid(uid,'ops')){
 const sponsor=await withActor(actor,async tx=>{
  await requireOrganization(tx,actor,org,'organization.read');
  const seat=await tx.proSponsorship.findUnique({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});
  if(!seat?.active)return null;
  // Narrow internal membership lookup; no roster data is returned to the recipient.
  await tx.$queryRaw`SELECT set_config('vops.roster','true',true)`;
  const member=await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId:org,userId:seat.sponsorId}}});
  if(!member||member.status!=='ACTIVE'||!['ORG_ADMIN','COORDINATOR'].includes(member.role)||member.regionIds.length)return null;
  const identity=await tx.firebaseIdentity.findUnique({where:{userId:seat.sponsorId},include:{user:true}});
  if(!identity?.user.isActive||identity.projectId!==actor.identity.projectId)return null;
  const [grant]=await tx.$queryRaw<Array<{active:boolean}>>`SELECT EXISTS(SELECT 1 FROM public.promo_redemptions WHERE user_id=${seat.sponsorId} AND expires_at>now()) AS active`;
  return {uid:identity.uid,promotional:grant?.active===true};
 });
 return sponsor?(sponsor.promotional||(await verify(sponsor.uid)).resqops_pro):false;
}
