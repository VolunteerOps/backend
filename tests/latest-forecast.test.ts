import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {BigQuery} from '@google-cloud/bigquery';
import {WeatherNext3BigQuery,buildLatestForecastQuery} from '../src/modules/sentinel/providers/weathernext3.bigquery.js';
import {refreshSchema} from '../src/modules/sentinel/sentinel.service.js';
import {weatherQueryError} from '../src/modules/sentinel/providers/weather-query-job.js';
const cfg={projectId:'resq-25be9',datasetId:'weathernext_3',location:'US',maximumBytesBilled:2000000000000,maxRows:10000};
const bounds={west:36.7,east:36.9,south:-1.4,north:-1.2};
const now=new Date('2026-11-02T15:35:00Z');

test('latest forecast discovery is partitioned, regional, bounded and checks published time coverage',()=>{
 const q=buildLatestForecastQuery(cfg,bounds,48,8,now);
 assert.match(q.query,/MAX\(t.init_time\)/);assert.match(q.query,/BETWEEN @oldest AND @latest/);
 assert.match(q.query,/ST_INTERSECTS\(t.geography_polygon/);assert.match(q.query,/UNNEST\(t.forecast\).*f.time = @through/);
 assert.equal(q.params.through.toISOString(),'2026-11-04T15:00:00.000Z');assert.equal(q.params.oldest.toISOString(),'2026-11-02T07:35:00.000Z');
 assert.equal(q.maximumBytesBilled,'2000000000000');assert.equal(q.jobTimeoutMs,30000);
 assert.throws(()=>buildLatestForecastQuery(cfg,bounds,49,8,now));assert.throws(()=>buildLatestForecastQuery(cfg,{west:-180,east:180,south:-90,north:90},24,8,now));
});

test('automatic selection uses the returned publication, covering hours ahead of now rather than hours already past',async()=>{
 let rows:any[]=[{init_time:{value:'2026-11-02T12:00:00Z'}}],created=0,cancelled=0;
 const job={getQueryResults:async()=>[rows],cancel:async()=>{cancelled++;}};
 const client={createQueryJob:async()=>{created++;return [job];}} as unknown as BigQuery;
 const provider=new WeatherNext3BigQuery(cfg,client);
 const r=await provider.latestRequest(bounds,24,8,new AbortController().signal,now);
 assert.equal(r.initTime,'2026-11-02T12:00:00.000Z');assert.equal(r.fromHour,4);assert.equal(r.toHour,27);
 rows=[{init_time:{value:'2026-11-02T00:00:00Z'}}];await assert.rejects(provider.latestRequest(bounds,24,8,new AbortController().signal,now),{code:'FORECAST_LOOKUP_FAILED'});
 rows=[];await assert.rejects(provider.latestRequest(bounds,24,8,new AbortController().signal,now),{code:'FORECAST_LOOKUP_FAILED'});
 rows=[{init_time:{value:'2026-11-02T14:00:00Z'}}];await assert.rejects(provider.latestRequest(bounds,48,8,new AbortController().signal,now),{code:'FORECAST_LOOKUP_FAILED'});
 const stop=new AbortController();stop.abort();const before=created;await assert.rejects(provider.latestRequest(bounds,24,8,stop.signal,now));assert.equal(created,before);assert.equal(cancelled,3);
});

test('the exact invalid-minute request has a field-specific plain-language error',()=>{
 const parsed=refreshSchema.safeParse({init_time:'2026-11-02T15:35:00Z',from_hour:1,to_hour:24});assert.equal(parsed.success,false);
 if(!parsed.success){assert.deepEqual(parsed.error.issues[0].path,['init_time']);assert.match(parsed.error.issues[0].message,/minutes must be 00/);assert.doesNotMatch(parsed.error.issues[0].message,/UTC|initialization/);}
});

test('billing and permission failures have stable codes for useful portal messages',()=>{
 assert.equal((weatherQueryError({errors:[{reason:'billingNotEnabled'}]}) as any).code,'WEATHER_BILLING_REQUIRED');
 assert.equal((weatherQueryError({code:403}) as any).code,'WEATHER_ACCESS_DENIED');
});
