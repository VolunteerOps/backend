import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listSchema} from '../src/modules/operations/operations.schema.js';
import {recordWhere,requireCoordinator,reviewLanes} from '../src/modules/operations/workspace-policy.js';
test('search and status preserve organization, region, owner and mission scope',()=>{
 const input=listSchema.parse({kind:'APPLICATION',q:'water',status:'APPLIED',parent_id:'00000000-0000-4000-8000-000000000003'});
 const where=recordWhere('org-a','region-a',7,'VOLUNTEER',input);
 assert.equal(where.organizationId,'org-a');assert.equal(where.regionId,'region-a');assert.equal(where.ownerId,7);assert.equal(where.parentId,input.parent_id);
 assert.equal((where.AND as unknown[]).length,2);
 assert.equal(recordWhere('org-a','region-a',7,'COORDINATOR',input).ownerId,undefined);
});
test('operational queue is coordinator-only and excludes completed records',()=>{
 for(const role of ['VOLUNTEER','PLATFORM_ADMIN',''])assert.throws(()=>requireCoordinator(role),{code:'CAPABILITY_REQUIRED'});
 for(const role of ['ORG_ADMIN','COORDINATOR'])assert.doesNotThrow(()=>requireCoordinator(role));
 for(const lane of reviewLanes)for(const status of lane.statuses)assert.ok(!['COMPLETED','RESOLVED','APPROVED','ACCEPTED'].includes(status));
});
test('list filters reject arbitrary fields and malformed statuses',()=>{
 for(const change of [{status:'ACTIVE OR 1=1'},{status:'x'.repeat(100)},{ownerId:2},{organizationId:'other'},{q:'x'},{q:'x'.repeat(101)}])assert.equal(listSchema.safeParse({kind:'MISSION',...change}).success,false);
 assert.equal(listSchema.safeParse({kind:'MISSION',status:'ACTIVE',q:'Water'}).success,true);
});
