import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStationQuery,normalizeStationRow,stationVariables} from '../src/modules/sentinel/providers/weathernext3.station.js';
import {statistics} from '../src/modules/sentinel/providers/weathernext3.contract.js';
const request={initTime:'2026-10-30T00:00:00Z',fromHour:1,toHour:2,bounds:{west:36,east:37,south:-2,north:-1}};
test('station-head query uses its own table and fields with the same cost and partition limits',()=>{
 const result=buildStationQuery({projectId:'resq-25be9',billingProjectId:'billing-test',datasetId:'weathernext_3',location:'US',maximumBytesBilled:100000000,maxRows:1000},request);
 assert.match(result.query,/resq-25be9.weathernext_3.weathernext_3_0_0_0p05deg/);
 assert.match(result.query,/station_head_dewpoint_temperature_2m_p90/);
 assert.doesNotMatch(result.query,/total_precipitation|wind_speed/);
 assert.match(result.query,/t.init_time = @init_time/);assert.equal(result.maximumBytesBilled,'100000000');
});
test('station values preserve missing data and reject wrong time, geography and percentile order',()=>{
 const row:Record<string,unknown>={init_time:request.initTime,valid_time:'2026-10-30T01:00:00Z',lead_hours:1,longitude:36.5,latitude:-1.5};
 for(const v of stationVariables)for(const s of statistics)row[v+'_'+s]=300;
 row.station_head_dewpoint_temperature_2m_p10=null;
 const result=normalizeStationRow(row,request);
 assert.ok(Math.abs(result.values.station_head_temperature_2m!.mean!-26.85)<1e-8);
 assert.equal(result.values.station_head_dewpoint_temperature_2m!.p10,null);
 for(const patch of [{lead_hours:2},{longitude:40},{station_head_temperature_2m_p90:290},{station_head_temperature_2m_mean:undefined}])assert.throws(()=>normalizeStationRow({...row,...patch},request));
});

test('station timestamps normalize BigQuery timestamp wrappers with UTC offsets',()=>{
 const row:Record<string,unknown>={init_time:{value:'2026-10-30T03:00:00+03:00'},valid_time:{value:'2026-10-30T04:00:00+03:00'},lead_hours:1,longitude:36.5,latitude:-1.5};
 for(const v of stationVariables)for(const s of statistics)row[v+'_'+s]=300;
 assert.equal(normalizeStationRow(row,request).valid_time,'2026-10-30T01:00:00.000Z');
 assert.throws(()=>normalizeStationRow({...row,valid_time:{value:'not-a-time'}},request));
});
