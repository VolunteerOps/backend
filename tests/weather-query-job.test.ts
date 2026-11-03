import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {BigQuery} from '@google-cloud/bigquery';
import {weatherQueryJobId,createOrResumeWeatherQuery} from '../src/modules/sentinel/providers/weather-query-job.js';
test('provider retries resume the same deterministic job instead of scanning twice',async()=>{
 const query={query:'SELECT forecast FROM approved_source WHERE init_time=@init',params:{init:'2026-10-30'},location:'US',maximumBytesBilled:'100000000'};
 const id=weatherQueryJobId(query,'resq-test');
 assert.equal(id,weatherQueryJobId({...query},'resq-test'));
 assert.notEqual(id,weatherQueryJobId({...query,params:{init:'2026-10-29'}},'resq-test'));
 let resumed='';const existing={id};
 const client={createQueryJob:async(options:any)=>{assert.equal(options.jobId,id);throw Object.assign(new Error('already exists'),{code:409});},job:(jobId:string)=>{resumed=jobId;return existing;}} as unknown as BigQuery;
 assert.equal(await createOrResumeWeatherQuery(client,query,'resq-test'),existing);
 assert.equal(resumed,id);
 await assert.rejects(createOrResumeWeatherQuery({createQueryJob:async()=>{throw Object.assign(new Error('denied'),{code:403});}} as unknown as BigQuery,query,'resq-test'),{code:'WEATHER_ACCESS_DENIED'});
});

test('billing-cap rejection becomes a safe actionable error without provider query details',async()=>{
 const client={createQueryJob:async()=>{throw {errors:[{reason:'bytesBilledLimitExceeded',message:'sensitive query details'}]};}} as unknown as BigQuery;
 await assert.rejects(createOrResumeWeatherQuery(client,{query:'SELECT 1',location:'US'},'project'),error=>{
  assert.equal((error as any).code,'FORECAST_QUERY_BUDGET_EXCEEDED');
  assert.equal((error as any).statusCode,422);
  assert.doesNotMatch(String(error),/sensitive query details/);
  return true;
 });
});

test('a new request can recover a failed billing job without replaying a successful scan',async()=>{
 const query={query:'SELECT 1',location:'US',maximumBytesBilled:'2000000000000'};let attempts:string[]=[];
 const base=weatherQueryJobId(query,'resq-test');const retry={id:'recovered'};
 const client={createQueryJob:async(options:any)=>{attempts.push(options.jobId);if(options.jobId===base)throw Object.assign(Error('exists'),{code:409});return [retry];},job:()=>({getMetadata:async()=>[{status:{state:'DONE',errorResult:{reason:'quotaExceeded'}}}]})} as unknown as BigQuery;
 assert.equal(await createOrResumeWeatherQuery(client,query,'resq-test'),retry);assert.equal(attempts.length,2);assert.match(attempts[1]!,/_recovery_/);
 attempts=[];const successful={getMetadata:async()=>[{status:{state:'DONE'}}]};(client as any).job=()=>successful;
 assert.equal(await createOrResumeWeatherQuery(client,query,'resq-test'),successful);assert.equal(attempts.length,1);
});
