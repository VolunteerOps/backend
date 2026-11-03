import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import {withActor,requirePlatform,type Actor} from '../organizations/context.js';
import {withRegion} from '../sentinel/sentinel.context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {preferencesSchema,promoSchema,promoCode,eligiblePromo} from './portal.schema.js';
export async function preferences(actor:Actor,input?:z.infer<typeof preferencesSchema>){return withActor(actor,async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'portal:preferences:'+actor.userId},0))::text`;
 const [old]=await tx.$queryRaw<any[]>`SELECT payload,version FROM public.portal_preferences WHERE user_id=${actor.userId}`;
 if(!input)return old??{version:0,payload:null};
 const {expected_version,...payload}=preferencesSchema.parse(input);
 if((old?.version??0)!==expected_version)throw ApiError.conflict('Your preferences changed. Refresh before saving again.','VERSION_CONFLICT');
 await tx.$executeRaw`INSERT INTO public.portal_preferences(user_id,payload,version) VALUES(${actor.userId},${JSON.stringify(payload)}::json,1) ON CONFLICT(user_id) DO UPDATE SET payload=EXCLUDED.payload,version=portal_preferences.version+1,updated_at=now()`;
 return {payload,version:expected_version+1};
});}
export async function notifications(actor:Actor,org:string,region:string,before:number,readId?:string){return withRegion(actor,org,region,false,async tx=>{
 const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
 if(readId){const event=await tx.operationRecord.findFirst({where:{id:readId,organizationId:org,regionId:region,kind:'EVENT'}});if(!event)throw ApiError.notFound('Notification');
 await tx.$executeRaw`INSERT INTO public.portal_notification_reads(id,user_id,record_id) VALUES(${randomUUID()},${actor.userId},${readId}) ON CONFLICT(user_id,record_id) DO NOTHING`;return {read:true};}
 const [pref]=await tx.$queryRaw<any[]>`SELECT payload FROM public.portal_preferences WHERE user_id=${actor.userId}`;
 const excluded=[...(pref?.payload?.briefings===false?['CAMPAIGN']:[]),...(pref?.payload?.reminders===false?['COURSE','ENROLLMENT','CREDENTIAL']:[])];
 const rows=await tx.operationRecord.findMany({where:{organizationId:org,regionId:region,kind:'EVENT',NOT:excluded.map(kind=>({payload:{path:['record_kind'],equals:kind}})),...(before?{sequence:{lt:before}}:{})},orderBy:{sequence:'desc'},take:51});
 const read=await tx.$queryRaw<Array<{record_id:string}>>`SELECT record_id FROM public.portal_notification_reads WHERE user_id=${actor.userId} AND record_id=ANY(${rows.map(v=>v.id)}::text[])`;
 const ids=new Set(read.map(v=>v.record_id));return {items:rows.slice(0,50).map(v=>({...v,read:ids.has(v.id)})),next_cursor:rows.length>50?rows[49]!.sequence:null};
});}
export async function managePromo(actor:Actor,input?:z.infer<typeof promoSchema>){return withActor(actor,async tx=>{
 await requirePlatform(tx,actor);
 if(!input)return tx.$queryRaw<any[]>`SELECT code,payload,version,created_at,(SELECT count(*)::int FROM public.promo_redemptions r WHERE r.code=p.code) AS redemptions FROM public.promo_codes p ORDER BY created_at DESC LIMIT 200`;
 const p=promoSchema.parse(input);await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'portal:promo:'+p.code},0))::text`;
 const [old]=await tx.$queryRaw<any[]>`SELECT version FROM public.promo_codes WHERE code=${p.code}`;
 if((old?.version??0)!==p.expected_version)throw ApiError.conflict('This promotion changed. Refresh before saving.','VERSION_CONFLICT');
 // Terms cannot change after creation; disabling a code stops new redemptions but honors existing grants.
 if(old){await tx.$executeRaw`UPDATE public.promo_codes SET payload=jsonb_set(jsonb_set(payload::jsonb,'{enabled}',${JSON.stringify(p.enabled)}::jsonb),'{last_change}',${JSON.stringify({reason:p.reason,actor:actor.userId,at:new Date().toISOString()})}::jsonb)::json,version=version+1 WHERE code=${p.code}`;}
 else await tx.$executeRaw`INSERT INTO public.promo_codes(code,payload) VALUES(${p.code},${JSON.stringify({...p,created_by:actor.userId})}::json)`;
 await tx.personalAudit.create({data:{id:randomUUID(),userId:actor.userId,actorUserId:actor.userId,action:JSON.stringify({type:old?'PROMOTION_STATE_CHANGED':'PROMOTION_CREATED',code:p.code,enabled:p.enabled,reason:p.reason})}});
 return {code:p.code,version:p.expected_version+1};
});}
export async function promotion(actor:Actor,raw:string,redeem=false){return withActor(actor,async tx=>{
 const code=promoCode.parse(raw);await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'portal:promo:'+code},0))::text`;
 await tx.$queryRaw`SELECT set_config('vops.promo_code',${code},true)`;
 const [row]=await tx.$queryRaw<any[]>`SELECT payload FROM public.promo_codes WHERE code=${code}`;
 const [used]=await tx.$queryRaw<any[]>`SELECT expires_at FROM public.promo_redemptions WHERE code=${code} AND user_id=${actor.userId}`;
 if(used&&redeem)return {activated:new Date(used.expires_at).getTime()>Date.now(),expires_at:used.expires_at,already_redeemed:true};
 const [count]=await tx.$queryRaw<Array<{n:number}>>`SELECT count(*)::int AS n FROM public.promo_redemptions WHERE code=${code}`;
 if(!row||used||!eligiblePromo(row.payload,actor.identity.email,count!.n))throw new ApiError(422,'PROMO_UNAVAILABLE','This code is expired, used, or not available for this account.');
 const p=row.payload;
 if(redeem){if(p.percent!==100)throw new ApiError(409,'CHECKOUT_REQUIRED','Apply this discount at checkout. Pro starts after payment is confirmed.');
 const expires=new Date(Date.now()+p.days*86400000);
 await tx.$executeRaw`INSERT INTO public.promo_redemptions(id,code,user_id,expires_at) VALUES(${randomUUID()},${code},${actor.userId},${expires})`;
 return {activated:true,expires_at:expires};}
 return {code,percent:p.percent,days:p.days,requires_checkout:p.percent<100};
});}
export async function promotionalAccess(actor:Actor):Promise<Date|null>{return withActor(actor,async tx=>{
 const [row]=await tx.$queryRaw<Array<{expires_at:Date}>>`SELECT expires_at FROM public.promo_redemptions WHERE user_id=${actor.userId} AND expires_at>now() ORDER BY expires_at DESC LIMIT 1`;
 return row?.expires_at??null;
});}
export function checkoutUrl(uid:string,code?:string){
 const raw=process.env.REVENUECAT_WEB_PURCHASE_URL;if(!raw)return null;
 const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='pay.rev.cat')throw new ApiError(503,'CHECKOUT_NOT_CONFIGURED','Online checkout is not available yet.');
 url.pathname=url.pathname.replace(/\/$/,'')+'/'+encodeURIComponent(uid);
 if(code)url.searchParams.set('discount_code',code);return url.toString();
}
