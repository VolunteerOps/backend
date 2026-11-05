import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionReady,locationGrounded} from '../src/modules/sentinel/mission-planner-contract.js';
test('a complete mission still waits for clarification before review',()=>{
 assert.equal(missionReady(true,'meeting_point'),false);
 assert.equal(missionReady(false,'review'),false);
 assert.equal(missionReady(true,'review'),true);
});
test('mission coordinates must come from supplied draft or retrieved places',()=>{
 assert.equal(locationGrounded({latitude:-1,longitude:36},[]),false);
 assert.equal(locationGrounded({latitude:null,longitude:null},[]),true);
 assert.equal(locationGrounded({latitude:-1,longitude:36},[{latitude:-1,longitude:36}]),true);
 assert.equal(locationGrounded({latitude:-1,longitude:36},[{latitude:-1,longitude:37}]),false);
});
