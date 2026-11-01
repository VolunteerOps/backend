import {featureCatalog} from './feature-catalog.js';
import { ApiError } from '../../core/errors.js';
import type { Actor } from '../organizations/context.js';
import { boundedJson } from '../sentinel/providers/http.js';
export const proCatalog = {
 version:featureCatalog.version, policy:featureCatalog,
 currency_options:['USD','KES'], pricing_status:'CATALOG_PENDING_STORE_CONFIGURATION',
 checkout_note:'The store presents the final localized price and currency before payment. KES catalog prices are proposed regional prices, not a live exchange-rate conversion.',
 volunteer:{name:'ResQ Pro',entitlement:'resq_pro',plans:[{period:'monthly',usd:4.99,kes:650},{period:'yearly',usd:39.99,kes:5200},{period:'lifetime',usd:149.99,kes:19500}],features:['Personal Sentinel preparedness insights','Forecast and hazard evidence map','Role-aware assistant with usage limits']},
 ops:{name:'ResQOps Pro',entitlement:'resqops_pro',plans:[{period:'monthly',usd:19.99,kes:2600},{period:'yearly',usd:159.99,kes:20800},{period:'lifetime',usd:599.99,kes:78000}],features:['Coordinator Sentinel insights','Mission planning assistant with human approval','Workspace coordination summaries','Sponsor up to three existing workspace volunteers']},
};
export function activeEntitlement(subscriber:any,identifier:string,now=Date.now(),allowSandbox=false) {
 const entitlement=subscriber?.entitlements?.[identifier];
 if(!entitlement||typeof entitlement.product_identifier!=='string'||!Number.isFinite(Date.parse(entitlement.purchase_date))||Date.parse(entitlement.purchase_date)>now)return false;
 const product=entitlement.product_identifier;
 const subscription=subscriber?.subscriptions?.[product];
 const oneTime=subscriber?.non_subscriptions?.[product];
 const purchases=subscription?[subscription]:Array.isArray(oneTime)?oneTime:[];
 // The server verifies purchase provenance; a Test Store grant cannot unlock production.
 const ownership=purchases.some((purchase:any)=>purchase&&purchase.refunded_at==null&&
  (purchase.is_sandbox===false||(allowSandbox&&purchase.is_sandbox===true))&&
  Number.isFinite(Date.parse(purchase.purchase_date))&&Date.parse(purchase.purchase_date)<=now&&
  (subscription||Date.parse(purchase.purchase_date)===Date.parse(entitlement.purchase_date)));
 if(!ownership)return false;
 if(entitlement.expires_date===null)return true;
 const expires=Date.parse(entitlement.expires_date),grace=Date.parse(entitlement.grace_period_expires_date);
 return Number.isFinite(expires)&&Math.max(expires,Number.isFinite(grace)?grace:0)>now;
}
export async function subscriptionStatus(actor:Actor){return subscriptionStatusForUid(actor.identity.uid);}
export async function subscriptionStatusForUid(uid:string,app:'volunteer'|'ops'|'all'='all'){
 const keys={volunteer:process.env.REVENUECAT_SECRET_API_KEY,ops:process.env.REVENUECAT_OPS_SECRET_API_KEY||process.env.REVENUECAT_SECRET_API_KEY};
 const cache=new Map<string,Promise<unknown>>();
 async function read(key:string|undefined){
  if(!key)return null;
  if(!cache.has(key))cache.set(key,(async()=>{
   try{
    const response=await fetch('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(uid),{headers:{Authorization:'Bearer '+key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('BILLING_PROVIDER_UNAVAILABLE');
    return (await boundedJson(response,128000) as {subscriber?:unknown}).subscriber;
   }catch{throw new ApiError(503,'BILLING_UNAVAILABLE','Subscription verification is temporarily unavailable');}
  })());
  return cache.get(key)!;
 }
 const [volunteer,ops]=await Promise.all([app==='ops'?null:read(keys.volunteer),app==='volunteer'?null:read(keys.ops)]);
 const allowSandbox=process.env.REVENUECAT_ALLOW_SANDBOX==='true'&&['staging','test'].includes(process.env.RAILWAY_ENVIRONMENT_NAME||process.env.NODE_ENV||'')&&(process.env.REVENUECAT_SANDBOX_UIDS||'').split(',').map(v=>v.trim()).includes(uid);
 return {status:(app==='ops'?keys.ops:app==='volunteer'?keys.volunteer:keys.volunteer||keys.ops)?'VERIFIED':'NOT_CONFIGURED',resq_pro:activeEntitlement(volunteer,'resq_pro',Date.now(),allowSandbox),resqops_pro:activeEntitlement(ops,'resqops_pro',Date.now(),allowSandbox)};
}
export async function requirePro(actor:Actor,role:string,organizationId?:string){
 const status=await subscriptionStatusForUid(actor.identity.uid,role==='VOLUNTEER'?'volunteer':'ops');
 if(role==='VOLUNTEER'&&!status.resq_pro&&organizationId){const {sponsoredPro}=await import('./sponsorship.service.js');if(await sponsoredPro(actor,organizationId))return;}
 if(status.status!=='VERIFIED')throw new ApiError(503,'BILLING_NOT_CONFIGURED','Pro activation is awaiting billing configuration');
 if(role==='VOLUNTEER'?!status.resq_pro:!status.resqops_pro)throw new ApiError(403,'PRO_REQUIRED',role==='VOLUNTEER'?'ResQ Pro is required':'ResQOps Pro is required');
}
