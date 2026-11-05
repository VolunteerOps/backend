import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessmentEvidence} from '../src/modules/sentinel/planning-evidence.js';
test('linked weather evidence rejects stale forecasts, changed regional policy and empty results',()=>{
 const now=Date.parse('2026-10-30T03:00:00Z');
 const region={forecastPolicy:{version:2,heat_c:35,wind_mps:12,hourly_rain_mm:10,maximum_run_age_hours:8},forecastBounds:{west:36,east:37,south:-2,north:-1}};
 const payload={status:'DRAFT',source:{source_id:'query',init_time:'2026-10-30T00:00:00Z',bounds:region.forecastBounds},evidence:{policy_version:2,points:[{}]},narrative:{summary:'Review preparations'},validation:'UNVALIDATED_WEATHER_INDICATORS'};
 const row={id:'assessment',version:1,payload};
 assert.equal(assessmentEvidence(row,region,now).source.source_id,'query');
 assert.deepEqual(assessmentEvidence(row,region,now).thresholds,{heat_c:35,wind_mps:12,hourly_rain_mm:10});
 const rich={...row,payload:{...payload,evidence:{policy_version:2,thresholds:{heat_c:35,wind_mps:12,hourly_rain_mm:10},points:[{expected_rainfall_mm:24,maximum_hourly_mean_rain_mm:12,hours_with_mean_rain_at_or_above_threshold:2,longest_median_heat_exceedance_hours:3,longest_median_wind_exceedance_hours:1},{expected_rainfall_mm:9,maximum_hourly_mean_rain_mm:5,hours_with_mean_rain_at_or_above_threshold:0,longest_median_heat_exceedance_hours:0,longest_median_wind_exceedance_hours:4}]}}};
 assert.deepEqual(assessmentEvidence(rich,region,now).indicators,{maximum_expected_rainfall_mm:24,maximum_hourly_mean_rain_mm:12,most_hours_with_mean_rain_at_or_above_threshold:2,longest_median_heat_exceedance_hours:3,longest_median_wind_exceedance_hours:4});
 assert.throws(()=>assessmentEvidence(row,region,now+8*3600000),{code:'ASSESSMENT_STALE'});
 assert.throws(()=>assessmentEvidence(row,{...region,forecastPolicy:{...region.forecastPolicy,version:3}},now),{code:'ASSESSMENT_POLICY_CHANGED'});
 assert.throws(()=>assessmentEvidence(row,{...region,forecastBounds:{...region.forecastBounds,west:35}},now),{code:'ASSESSMENT_POLICY_CHANGED'});
 assert.throws(()=>assessmentEvidence({...row,payload:{...payload,evidence:{...payload.evidence,points:[]}}},region,now),{code:'ASSESSMENT_UNAVAILABLE'});
});

test('historical review preserves old policy and evidence without allowing stale allocation approval',()=>{
 const region={forecastPolicy:{version:3,heat_c:35,wind_mps:12,hourly_rain_mm:10,maximum_run_age_hours:8},forecastBounds:{west:36,east:37,south:-2,north:-1}};
 const row={id:'old',version:1,payload:{status:'DRAFT',source:{init_time:'2026-10-01T00:00:00Z',bounds:{west:35,east:37,south:-2,north:-1}},evidence:{policy_version:1,from:'2026-10-01T01:00:00Z',to:'2026-10-02T00:00:00Z',points:[{expected_rainfall_mm:10}]}}};
 const now=Date.parse('2026-11-05T00:00:00Z');
 assert.throws(()=>assessmentEvidence(row,region,now),{code:'ASSESSMENT_STALE'});
 const old=assessmentEvidence(row,region,now,true);assert.equal(old.policy_version,1);assert.equal(old.thresholds,null);assert.equal(old.indicators.maximum_expected_rainfall_mm,10);
});
