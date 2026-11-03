import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deploymentState,uploadId} from './deploy-railway.mjs';
const id='00000000-0000-4000-8000-000000000001';
test('only the uploaded deployment can satisfy a release',()=>{
  assert.equal(deploymentState([{id:'another',status:'SUCCESS'},{id,status:'BUILDING'}],id),'pending');
  assert.equal(deploymentState([{id,status:'SUCCESS'}],id),'ready');
  assert.equal(deploymentState([],id),'pending');
  for(const status of ['FAILED','CRASHED','SKIPPED','REMOVED','NEEDS_APPROVAL'])assert.throws(()=>deploymentState([{id,status}],id));
});
test('a running migration container is not proof that migrations completed',()=>{
  assert.equal(deploymentState([{id,status:'SUCCESS'}],id,true,[]),'pending');
  assert.equal(deploymentState([{id,status:'SUCCESS'}],id,true,['MIGRATION_VERIFIED']),'ready');
  assert.throws(()=>deploymentState([{id,status:'SUCCESS'}],id,true,['MIGRATION_FAILED']));
});
test('upload must return an explicit deployment identity',()=>{
  assert.equal(uploadId(JSON.stringify({deploymentId:id})),id);
  for(const value of [{},{deploymentId:''},{status:'SUCCESS'}])assert.throws(()=>uploadId(JSON.stringify(value)));
});
