import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUsgs } from '../src/modules/sentinel/providers/usgs.js';
const now = Date.parse('2026-09-30T10:00:00Z');
function fixture() { return { type: 'FeatureCollection', metadata: { generated: now, status: 200 }, features: [{
  type: 'Feature', id: 'us-test', geometry: { type: 'Point', coordinates: [0, 0, 10] },
  properties: { mag: 5, place: 'Test region', time: now - 60000, updated: now,
    status: 'reviewed', type: 'earthquake', tsunami: 1, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us-test' },
}] }; }
test('USGS revisions preserve zero coordinates and never turn the tsunami flag into a warning', () => {
  const a = normalizeUsgs(fixture(), now)[0];
  assert.equal(a.longitude, 0); assert.equal(a.latitude, 0); assert.equal(a.tsunamiWarning, false);
  assert.equal(a.id, normalizeUsgs(fixture(), now)[0].id);
  const changed = fixture(); changed.features[0].properties.mag = 5.1;
  assert.notEqual(a.id, normalizeUsgs(changed, now)[0].id);
});
test('USGS rejects stale feeds, future event clocks and untrusted provenance URLs', () => {
  const stale = fixture(); stale.metadata.generated -= 16 * 60000;
  assert.throws(() => normalizeUsgs(stale, now));
  const future = fixture(); future.features[0].properties.time = now + 120000;
  assert.throws(() => normalizeUsgs(future, now));
  const forged = fixture(); forged.features[0].properties.url = 'https://example.org/fake';
  assert.throws(() => normalizeUsgs(forged, now));
});
