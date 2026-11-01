import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeEntitlement } from '../src/modules/billing/billing.service.js';
test('paid access requires a current entitlement, including valid lifetime ownership',()=>{
 const now=Date.parse('2026-10-01T00:00:00Z');
 const purchase={product_identifier:'resq_monthly',purchase_date:'2026-09-01T00:00:00Z',expires_date:'2026-10-02T00:00:00Z'};
 const subscriber=(e:unknown)=>({entitlements:{resq_pro:e},subscriptions:{resq_monthly:{...purchase,is_sandbox:false,refunded_at:null}}});
 assert.equal(activeEntitlement(subscriber(purchase),'resq_pro',now),true);
 assert.equal(activeEntitlement(subscriber({...purchase,expires_date:null}),'resq_pro',now),true);
 for(const invalid of [undefined,{}, {...purchase,expires_date:'2026-10-01T00:00:00Z'},{...purchase,expires_date:'bad'},{...purchase,purchase_date:'2027-01-01'}])assert.equal(activeEntitlement(subscriber(invalid),'resq_pro',now),false);
 assert.equal(activeEntitlement(subscriber(purchase),'resqops_pro',now),false);
});

test('sandbox, unknown provenance and refunds fail closed while active grace and real lifetime purchases are honored',()=>{
 const now=Date.parse('2026-10-01T00:00:00Z');
 const entitlement={product_identifier:'resq_pro_monthly',purchase_date:'2026-09-01T00:00:00Z',expires_date:'2026-09-30T00:00:00Z',grace_period_expires_date:'2026-10-03T00:00:00Z'};
 const customer=(purchase:any)=>({entitlements:{resq_pro:entitlement},subscriptions:{resq_pro_monthly:purchase}});
 const paid={is_sandbox:false,purchase_date:entitlement.purchase_date,refunded_at:null};
 assert.equal(activeEntitlement(customer(paid),'resq_pro',now),true);
 assert.equal(activeEntitlement(customer({...paid,refunded_at:'2026-09-30'}),'resq_pro',now),false);
 assert.equal(activeEntitlement(customer({...paid,is_sandbox:true}),'resq_pro',now),false);
 assert.equal(activeEntitlement(customer({...paid,is_sandbox:true}),'resq_pro',now,true),true);
 assert.equal(activeEntitlement({entitlements:{resq_pro:entitlement}},'resq_pro',now),false);
 const lifetime={entitlements:{resq_pro:{...entitlement,product_identifier:'lifetime',expires_date:null}},non_subscriptions:{lifetime:[paid]}};
 assert.equal(activeEntitlement(lifetime,'resq_pro',now),true);
 assert.equal(activeEntitlement({...lifetime,non_subscriptions:{lifetime:[{...paid,is_sandbox:true}]}},'resq_pro',now),false);
});
