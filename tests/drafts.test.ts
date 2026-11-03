import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draftKey,draftPut} from '../src/modules/drafts/drafts.service.js';
test('draft keys allow cross-device form and chat keys but reject paths and oversize payloads',()=>{
 assert.equal(draftKey.parse('planning:weather:org-1:region-2'),'planning:weather:org-1:region-2');
 assert.equal(draftKey.parse('mission-chat:org-1:region-2'),'mission-chat:org-1:region-2');
 assert.equal(draftKey.parse('form:/missions:Create:mission'),'form:/missions:Create:mission');
 assert.throws(()=>draftKey.parse('has space'));
 assert.deepEqual(draftPut.parse({payload:{values:{question:'Draft'}}}).payload,{values:{question:'Draft'}});
 assert.throws(()=>draftPut.parse({payload:{blob:'x'.repeat(70_000)}}));
});
