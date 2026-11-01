import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertDispatchAllowed} from '../src/modules/operations/dispatch-policy.js';
import {commandSchema} from '../src/modules/operations/operations.schema.js';
test('pause prevents assignment and activation while allowing safe completion and evidence',()=>{
 for(const [action,status] of [['ASSIGN',undefined],['TRANSITION_MISSION','ACTIVE']])assert.throws(()=>assertDispatchAllowed(true,action!,status),{code:'DISPATCH_PAUSED'});
 for(const action of ['CHECK_IN','COMPLETE_ASSIGNMENT','REPORT','MESSAGE','SET_DISPATCH'])assert.doesNotThrow(()=>assertDispatchAllowed(true,action));
 for(const status of ['PAUSED','CANCELLED','COMPLETED'])assert.doesNotThrow(()=>assertDispatchAllowed(true,'TRANSITION_MISSION',status));
 assert.doesNotThrow(()=>assertDispatchAllowed(false,'ASSIGN'));
});
test('dispatch controls require an explicit state, version and bounded reason',()=>{
 const valid={action:'SET_DISPATCH',paused:true,expected_version:0,reason:'Weather conditions require a pause.'};
 assert.equal(commandSchema.safeParse(valid).success,true);
 for(const change of [{reason:''},{paused:'true'},{expected_version:-1},{role:'ORG_ADMIN'}])assert.equal(commandSchema.safeParse({...valid,...change}).success,false);
});
test('regional bulletins validate priority and reject spoofed audience or author',()=>{
 const valid={action:'PUBLISH_BULLETIN',title:'Shift handover',body:'Meet the coordinator at the community hall.',priority:'NOTICE'};
 assert.equal(commandSchema.safeParse(valid).success,true);
 for(const change of [{priority:'EMERGENCY'},{body:''},{audience:'ALL_ORGANIZATIONS'},{published_by:1}])assert.equal(commandSchema.safeParse({...valid,...change}).success,false);
});
