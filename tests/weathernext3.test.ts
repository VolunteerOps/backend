import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundsWkt, forecastHorizon, normalizeForecastRow, statistics } from '../src/modules/sentinel/providers/weathernext3.contract.js';
import type { BigQuery } from '@google-cloud/bigquery';
import { WeatherNext3BigQuery, buildForecastQuery } from '../src/modules/sentinel/providers/weathernext3.bigquery.js';
import { assessForecast } from '../src/modules/sentinel/forecast-assessment.js';

const init = '2026-09-30T00:00:00.000Z';
const bounds = { west: 36, east: 37, south: -2, north: -1 };
function row() {
  const values: Record<string, unknown> = { init_time: { value: init }, valid_time: { value: '2026-09-30T02:00:00.000Z' },
    lead_hours: 2, longitude: 36.5, latitude: -1.5 };
  for (const stat of statistics) {
    values['temperature_2m_' + stat] = 310;
    values['wind_speed_10m_' + stat] = 20;
    values['total_precipitation_1hr_' + stat] = 0.04;
  }
  return values;
}
test('WeatherNext 3 preserves synoptic and interim hourly forecast horizons', () => {
  assert.equal(forecastHorizon(init), 360);
  assert.equal(forecastHorizon('2026-09-30T01:00:00.000Z'), 48);
  assert.throws(() => forecastHorizon('2026-09-30T01:30:00.000Z'));
});
test('BigQuery source is partitioned, parameterized and bounded by billing and row budgets', () => {
  const query = buildForecastQuery({ projectId: 'sentinel-test', datasetId: 'weather', location: 'US',
    maximumBytesBilled: 100000000, maxRows: 1000 }, { initTime: init, fromHour: 1, toHour: 24, bounds });
  assert.match(query.query, /t.init_time = @init_time/);
  assert.match(query.query, /weathernext_3_0_0_0p1deg/);
  assert.doesNotMatch(query.query, /SELECT \*/);
  assert.equal(query.params.row_limit, 1001);
  assert.equal(query.maximumBytesBilled, '100000000');
  assert.throws(() => buildForecastQuery({ projectId: 'sentinel-test', datasetId: 'evil` SQL', location: 'US',
    maximumBytesBilled: 1, maxRows: 100 }, { initTime: init, fromHour: 1, toHour: 3, bounds }));
});
test('normalization converts units once and preserves missing values', () => {
  const input = row(); input.wind_speed_10m_p10 = null;
  const cell = normalizeForecastRow(input, init, bounds);
  assert.ok(Math.abs(cell.values.temperature_2m.mean! - 36.85) < 0.000001);
  assert.equal(cell.values.total_precipitation_1hr.p90, 40);
  assert.equal(cell.values.wind_speed_10m.p10, null);
  assert.equal(cell.validTime, '2026-09-30T02:00:00.000Z');
});
test('normalization rejects wrong run, bad units, unordered percentiles and out-of-region cells', () => {
  for (const patch of [
    { init_time: '2026-09-30T01:00:00Z' }, { valid_time: '2026-09-30T03:00:00Z' },
    { temperature_2m_mean: 36 }, { wind_speed_10m_p10: 30 }, { longitude: 0 }, { total_precipitation_1hr_mean: 'NaN' },
  ]) assert.throws(() => normalizeForecastRow({ ...row(), ...patch }, init, bounds));
});
test('dateline regions are split into two polygons', () => {
  const wkt = boundsWkt({ west: 179, east: -179, south: -2, north: -1 });
  assert.match(wkt, /^MULTIPOLYGON/);
  assert.match(wkt, /180 -2/);
  assert.match(wkt, /-180 -2/);
  assert.throws(() => boundsWkt({ west: 1, east: 1, south: 0, north: 1 }));
  assert.throws(() => boundsWkt({ west: 180, east: -180, south: 0, north: 1 }));
  assert.match(boundsWkt({west:180,east:-179,south:0,north:1}), /^POLYGON/);
});
test('forecast indicators do not become calibrated disaster probabilities or movement orders', () => {
  const cell = normalizeForecastRow(row(), init, bounds);
  const policy = { version: 1, heat_c: 35, wind_mps: 18, hourly_rain_mm: 30, maximum_run_age_hours: 8 };
  const assessment = assessForecast([cell], policy, Date.parse(init) + 3600000);
  assert.equal(assessment.indicators.length, 3);
  const missing = structuredClone(cell);missing.values.wind_speed_10m.p10 = null;
  assert.equal(assessForecast([missing], policy, Date.parse(init) + 3600000).missing_values, 1);
  assert.equal(assessment.operational_warning, false);
  assert.equal(assessment.automatic_deployment, false);
  assert.ok(assessment.indicators.every(i => i.validation === 'UNVALIDATED_INDICATOR'));
  const stale = assessForecast([cell], policy, Date.parse(init) + 9 * 3600000);
  assert.equal(stale.indicators.length, 0);
  assert.equal(stale.stale_cells, 1);
});

test('BigQuery query execution rejects overflow and cancels failed or aborted provider jobs', async () => {
 const config={projectId:'sentinel-test',datasetId:'weather',location:'US',maximumBytesBilled:100000000,maxRows:100};
 const request={initTime:init,fromHour:1,toHour:3,bounds};
 let cancelled=0,created=0;
 let results:unknown[]=[[row()],null];
 const job={id:'test-job',cancel:async()=>{cancelled++;},getQueryResults:async()=>results};
 const client={createQueryJob:async()=>{created++;return [job];}} as unknown as BigQuery;
 const provider=new WeatherNext3BigQuery(config,client);
 assert.equal((await provider.fetch(request,new AbortController().signal)).cells.length,1);
 assert.equal(cancelled,0);
 results=[[row()],{pageToken:'more'}];
 await assert.rejects(provider.fetch(request,new AbortController().signal),/REQUIRES_TILING/);
 assert.equal(cancelled,1);
 results=[[],null];
 await assert.rejects(provider.fetch(request,new AbortController().signal),/RUN_UNAVAILABLE/);
 const controller=new AbortController();controller.abort();const before=created;
 await assert.rejects(provider.fetch(request,controller.signal));assert.equal(created,before);
 results=[[row(),row()],null];
 await assert.rejects(provider.fetch(request,new AbortController().signal),/DUPLICATE_FORECAST_CELL/);
});
