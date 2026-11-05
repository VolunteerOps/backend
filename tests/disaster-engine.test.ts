import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fusePredictions, dedupeObservations, samplePointsForBounds, SOURCE_REGISTRY, type CanonicalObservation } from '../src/modules/sentinel/engine.js';
import { normalizeOpenMeteo } from '../src/modules/sentinel/providers/open-meteo.js';

const now = Date.parse('2026-09-30T10:00:00Z');
function obs(partial: Partial<CanonicalObservation>): CanonicalObservation {
  return {
    source: 'OPEN_METEO', upstream: 'open-meteo', externalId: 'x1', longitude: 36.8, latitude: -1.3,
    observedAt: new Date(now).toISOString(), validAt: new Date(now).toISOString(), receivedAt: new Date(now).toISOString(),
    rain24Mm: null, rain72Mm: null, maxHourlyRainMm: null, maxTempC: null, minHumidityPct: null,
    maxWindMps: null, maxGustMps: null, soilMoisture: null, dischargeM3s: null, dischargePercentile: null,
    magnitude: null, depthKm: null, alertSeverity: null, title: null, ...partial,
  };
}

test('WeatherNext carries the highest model weight; USGS/NWS outrank models', () => {
  const wn = SOURCE_REGISTRY.find(s => s.id === 'WEATHERNEXT3')!;
  const om = SOURCE_REGISTRY.find(s => s.id === 'OPEN_METEO')!;
  assert.ok(wn.authority > om.authority);
  assert.equal(SOURCE_REGISTRY.find(s => s.id === 'NWS')!.authority, 1);
});

test('flood detector fires on heavy 24h rain and landslide stays capped without slope data', () => {
  const preds = fusePredictions([obs({ rain24Mm: 120, rain72Mm: 160, maxHourlyRainMm: 30 })], undefined, now);
  const flood = preds.find(p => p.hazard === 'FLOOD')!;
  assert.ok(flood && flood.severity >= 0.6, JSON.stringify(preds));
  assert.equal(flood.calibratedProbability, null);
  assert.equal(flood.operationalWarning, false);
  assert.equal(flood.validation, 'UNVALIDATED_INDICATOR');
  const slide = preds.find(p => p.hazard === 'LANDSLIDE');
  if (slide) assert.ok(slide.severity < 0.6 && slide.missingInputs.length > 0);
});

test('syndicated copies count once; independent corroboration raises confidence', () => {
  const a = obs({ externalId: 'same', rain24Mm: 120 });
  const dup = obs({ externalId: 'same', rain24Mm: 120 });
  assert.equal(dedupeObservations([a, dup]).length, 1);
  const single = fusePredictions([a], undefined, now).find(p => p.hazard === 'FLOOD')!;
  const multi = fusePredictions([a, obs({ source: 'WEATHERNEXT3', upstream: 'weathernext3', externalId: 'wn1', rain24Mm: 110 })], undefined, now).find(p => p.hazard === 'FLOOD')!;
  assert.equal(multi.independentSources, 2);
  assert.ok(multi.confidence > single.confidence, `${multi.confidence} > ${single.confidence}`);
});

test('contradiction lowers confidence; weather never creates an earthquake', () => {
  const calm = fusePredictions([obs({ rain24Mm: 120 }), obs({ source: 'WEATHERNEXT3', upstream: 'weathernext3', externalId: 'wn-calm', rain24Mm: 1 })], undefined, now);
  const agreed = fusePredictions([obs({ rain24Mm: 120 }), obs({ source: 'WEATHERNEXT3', upstream: 'weathernext3', externalId: 'wn-wet', rain24Mm: 115 })], undefined, now);
  assert.ok(calm.find(p => p.hazard === 'FLOOD')!.confidence < agreed.find(p => p.hazard === 'FLOOD')!.confidence);
  assert.equal(fusePredictions([obs({ maxTempC: 44 })], undefined, now).some(p => p.hazard === 'EARTHQUAKE'), false);
  const eq = fusePredictions([obs({ source: 'USGS', upstream: 'usgs', externalId: 'eq1', magnitude: 6.1, depthKm: 10 })], undefined, now).find(p => p.hazard === 'EARTHQUAKE')!;
  assert.equal(eq.kind, 'OBSERVED');
});

test('missing inputs produce no prediction, not zero risk', () => {
  assert.deepEqual(fusePredictions([obs({})], undefined, now), []);
  const pts = samplePointsForBounds({ west: 36, east: 37, south: -2, north: -1 });
  assert.ok(pts.length >= 1 && pts.length <= 5);
});

test('Open-Meteo normalization converts km/h wind and sums rain', () => {
  const time = Array.from({ length: 72 }, (_, i) => new Date(now + i * 3600000).toISOString());
  const fill = (v: number) => time.map(() => v);
  const o = normalizeOpenMeteo({ latitude: -1.3, longitude: 36.8, hourly: {
    time, precipitation: fill(2), temperature_2m: fill(36), relative_humidity_2m: fill(15),
    wind_speed_10m: fill(36), wind_gusts_10m: fill(90), soil_moisture_0_to_7cm: fill(0.4),
  } }, new Date(now).toISOString());
  assert.equal(o.rain24Mm, 48);
  assert.equal(o.maxWindMps, 10);
  assert.equal(o.maxGustMps, 25);
  const preds = fusePredictions([o], undefined, now);
  assert.ok(preds.some(p => p.hazard === 'HEAT'));
  assert.ok(preds.some(p => p.hazard === 'WILDFIRE_WEATHER'));
});
