import {test} from 'node:test';
import assert from 'node:assert/strict';
import {caseIntake,caseDecision,nextCaseStatus,responseDue} from '../src/modules/safety/safety.schema.js';
test('assistance transitions require acknowledgement and human ownership steps',()=>{
 assert.equal(nextCaseStatus('OPEN','ACKNOWLEDGE'),'ACKNOWLEDGED');
 assert.equal(nextCaseStatus('ACKNOWLEDGED','START_RESPONSE'),'IN_PROGRESS');
 assert.equal(nextCaseStatus('IN_PROGRESS','HANDOVER'),'IN_PROGRESS');
 assert.equal(nextCaseStatus('IN_PROGRESS','RESOLVE'),'RESOLVED');
 assert.throws(()=>nextCaseStatus('OPEN','RESOLVE'));
 for(const action of ['ACKNOWLEDGE','START_RESPONSE','HANDOVER','RESOLVE','ESCALATE'] as const)assert.throws(()=>nextCaseStatus('RESOLVED',action));
 assert.equal(responseDue('URGENT',0),'1970-01-01T00:05:00.000Z');
});
test('assistance intake and decisions reject unconsented location and arbitrary scope',()=>{
 const input={summary:'I need help reaching the assembly point',severity:'HIGH'};
 assert.equal(caseIntake.safeParse(input).success,true);
 assert.equal(caseIntake.safeParse({...input,location:{latitude:-1,longitude:36}}).success,false);
 assert.equal(caseIntake.safeParse({...input,organization_id:'other'}).success,false);
 assert.equal(caseDecision.safeParse({action:'HANDOVER',expected_version:1,reason:'Transfer to the incoming shift'}).success,false);
 assert.equal(caseDecision.safeParse({action:'RESOLVE',expected_version:1,reason:'Verified by phone with the volunteer',coordinator_id:3}).success,false);
});
