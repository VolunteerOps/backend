import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessmentEvidence} from '../src/modules/sentinel/planning-evidence.js';
test('linked weather evidence rejects stale forecasts, changed regional policy and empty results',()=>{
 const now=Date.parse('2026-10-30T03:00:00Z');
 const region={forecastPolicy:{version:2,heat_c:35,wind_mps:12,hourly_rain_mm:10,maximum_run_age_hours:8},forecastBounds:{west:36,east:37,south:-2,north:-1}};
 const payload={status:'DRAFT',source:{source_id:'query',init_time:'2026-10-30T00:00:00Z',bounds:region.forecastBounds},evidence:{policy_version:2,points:[{}]},narrative:{summary:'Review preparations'},validation:'UNVALIDATED_WEATHER_INDICATORS'};
 const row={id:'assessment',version:1,payload};
 assert.equal(assessmentEvidence(row,region,now).source.source_id,'query');
 assert.throws(()=>assessmentEvidence(row,region,now+8*3600000),{code:'ASSESSMENT_STALE'});
 assert.throws(()=>assessmentEvidence(row,{...region,forecastPolicy:{...region.forecastPolicy,version:3}},now),{code:'ASSESSMENT_POLICY_CHANGED'});
 assert.throws(()=>assessmentEvidence(row,{...region,forecastBounds:{...region.forecastBounds,west:35}},now),{code:'ASSESSMENT_POLICY_CHANGED'});
 assert.throws(()=>assessmentEvidence({...row,payload:{...payload,evidence:{...payload.evidence,points:[]}}},region,now),{code:'ASSESSMENT_UNAVAILABLE'});
});
