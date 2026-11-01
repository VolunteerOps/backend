import {test} from 'node:test';import assert from 'node:assert/strict';import {payloadSchema} from '../portal/evidence-contract.js';
test('map evidence bounds and additions preserve legacy senders',()=>{
 const point={longitude:0,latitude:0,label:'Meeting point',kind:'mission'};
 const data={type:'resq.evidence',expires_at:Date.now()+1000,points:[point]};
 assert.equal(payloadSchema.safeParse(data).success,true);
 assert.equal(payloadSchema.safeParse({...data,scope:'region',selected_id:'mission-1',points:[{...point,id:'mission-1'}]}).success,true);
 for(const patch of [{latitude:91},{longitude:Infinity},{label:'x'.repeat(301)},{kind:'invented'}])assert.equal(payloadSchema.safeParse({...data,points:[{...point,...patch}]}).success,false);
 assert.equal(payloadSchema.safeParse({...data,points:Array(1501).fill(point)}).success,false);
});
