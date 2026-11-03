import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activeEntitlement,requirePro,subscriptionStatusForUid} from '../src/modules/billing/billing.service.js';
import type {Actor} from '../src/modules/organizations/context.js';

const now=Date.now(),purchaseDate=new Date(now-3600000).toISOString(),expiry=new Date(now+86400000).toISOString();
const promotional={entitlements:{resqops_pro:{product_identifier:'rc_promo_resqops_pro_custom',purchase_date:purchaseDate,expires_date:expiry}},subscriptions:{rc_promo_resqops_pro_custom:{store:'promotional',is_sandbox:false,purchase_date:purchaseDate,expires_date:expiry,refunded_at:null}}};
test('administrator-granted Pro works while expired, revoked, and sandbox access remain denied',()=>{
 assert.equal(activeEntitlement(promotional,'resqops_pro',now),true);
 assert.equal(activeEntitlement(promotional,'resqops_pro',now+2*86400000),false);
 assert.equal(activeEntitlement({...promotional,entitlements:{}},'resqops_pro',now),false);
 assert.equal(activeEntitlement({...promotional,subscriptions:{rc_promo_resqops_pro_custom:{...promotional.subscriptions.rc_promo_resqops_pro_custom,is_sandbox:true}}},'resqops_pro',now),false);
});
test('server checks the authenticated account using configured ops credentials and retains the paid gate',async t=>{
 const names=['REVENUECAT_SECRET_API_KEY','REVENUECAT_OPS_SECRET_API_KEY','REVENUECAT_API_KEY','REVENUECAT_OPS_API_KEY'];const previous=names.map(name=>process.env[name]);
 t.after(()=>names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];}));names.forEach(name=>delete process.env[name]);
 const actor={identity:{uid:'confirmed-firebase-user'}} as Actor;
 await assert.rejects(requirePro(actor,'ORG_ADMIN',undefined,async()=>null),(e:any)=>e.code==='BILLING_NOT_CONFIGURED');
 process.env.REVENUECAT_OPS_API_KEY='goog_test_fixture';let subscriber:any=promotional;
 t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{assert.equal(url,'https://api.revenuecat.com/v1/subscribers/confirmed-firebase-user');assert.equal((options.headers as Record<string,string>).Authorization,'Bearer goog_test_fixture');return new Response(JSON.stringify({subscriber}),{status:200});});
 assert.equal((await subscriptionStatusForUid(actor.identity.uid,'ops')).resqops_pro,true);await requirePro(actor,'ORG_ADMIN',undefined,async()=>null);
 subscriber={entitlements:{},subscriptions:{}};
 await assert.rejects(requirePro(actor,'ORG_ADMIN',undefined,async()=>null),(e:any)=>e.code==='PRO_REQUIRED');
});
