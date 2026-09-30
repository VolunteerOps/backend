import { createHash } from 'node:crypto';
import { z } from 'zod';
import { boundedJson } from './http.js';

const featureSchema = z.object({
  type: z.literal('Feature'), id: z.string().min(1).max(120),
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([
    z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90), z.number().finite().min(-10).max(1000),
  ]) }),
  properties: z.object({
    mag: z.number().finite().min(-5).max(12).nullable(), place: z.string().max(1000).nullable(),
    time: z.number().int(), updated: z.number().int(), status: z.enum(['automatic', 'reviewed', 'deleted']),
    type: z.string().max(100), tsunami: z.number().int().min(0).max(1), url: z.string().url(),
  }),
});
const feedSchema = z.object({
  type: z.literal('FeatureCollection'), metadata: z.object({ generated: z.number().int(), status: z.literal(200) }),
  features: z.array(featureSchema).max(5000),
});
export interface EarthquakeRevision {
  id: string; source: 'USGS'; externalId: string; revisionAt: Date; observedAt: Date;
  longitude: number; latitude: number; magnitude: number | null; depthKm: number;
  status: string; title: string; sourceUrl: string; tsunamiWarning: false;
}
export function normalizeUsgs(input: unknown, now = Date.now()): EarthquakeRevision[] {
  const feed = feedSchema.parse(input);
  if (feed.metadata.generated > now + 60000 || now - feed.metadata.generated > 15 * 60000) throw new Error('USGS_FEED_STALE');
  return feed.features.filter(f => f.properties.type === 'earthquake').map(f => {
    const p = f.properties;
    const source = new URL(p.url);
    if (source.protocol !== 'https:' || source.hostname !== 'earthquake.usgs.gov' ||
        p.time > now + 60000 || p.updated > now + 60000 || p.updated < p.time) throw new Error('USGS_INVALID_PROVENANCE');
    return { id: createHash('sha256').update(JSON.stringify(['USGS', f.id, p.updated, f.geometry, p])).digest('hex'),
      source: 'USGS', externalId: f.id, revisionAt: new Date(p.updated), observedAt: new Date(p.time),
      longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1], depthKm: f.geometry.coordinates[2],
      magnitude: p.mag, status: p.status, title: (p.place ?? 'Earthquake').replace(/[\u0000-\u001f]/g, ''),
      sourceUrl: p.url, tsunamiWarning: false };
  });
}
export async function fetchUsgs(signal: AbortSignal) {
  const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
    signal, redirect: 'error', headers: { Accept: 'application/geo+json, application/json' },
  });
  return normalizeUsgs(await boundedJson(response, 5000000));
}
