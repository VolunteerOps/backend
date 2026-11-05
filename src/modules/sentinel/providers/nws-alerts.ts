import { z } from 'zod';
import { boundedJson } from './http.js';
import type { CanonicalObservation, HazardKind } from '../engine.js';

const schema = z.object({
  features: z.array(z.object({
    id: z.string().optional(),
    properties: z.object({
      event: z.string(), severity: z.string().optional(), status:z.string().optional(), messageType:z.string().optional(),
      headline: z.string().nullable().optional(), effective: z.string(), expires: z.string(),
    }).passthrough(),
    geometry: z.unknown().optional(),
  }).passthrough()).max(200),
}).passthrough();

/** NOAA/NWS active alerts for a US point. US-only: elsewhere UNAVAILABLE, never "no risk". */
export async function fetchNwsAlerts(point: { longitude: number; latitude: number }, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ observations: CanonicalObservation[]; status: string }> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${point.latitude},${point.longitude}`;
    const res = await fetcher(url, { signal, redirect: 'error', headers: { Accept: 'application/geo+json', 'User-Agent': 'ResQOps Sentinel (contact: ops@resqops.local)' } });
    const feed = schema.parse(await boundedJson(res, 2_000_000));
    const now = new Date().toISOString();
    return {
      status: 'OK',
      observations: feed.features.filter(f => alertHazard(f.properties.event) && (!f.properties.status || f.properties.status === 'Actual') && f.properties.messageType !== 'Cancel' && Date.parse(f.properties.expires)>Date.now() && Number.isFinite(Date.parse(f.properties.effective))).map((f, i) => ({
        source: 'NWS' as const, upstream: 'nws', externalId: f.id ?? `nws:${i}:${f.properties.event ?? ''}`,
        longitude: point.longitude, latitude: point.latitude,
        observedAt: f.properties.effective, validFrom:f.properties.effective, validAt:f.properties.expires,expiresAt:f.properties.expires,receivedAt:now,hazard:alertHazard(f.properties.event)!,evidenceKind:'OFFICIAL' as const,spatialPrecision:'POINT' as const,
        rain24Mm: null, rain72Mm: null, maxHourlyRainMm: null, maxTempC: null, minHumidityPct: null,
        maxWindMps: null, maxGustMps: null, soilMoisture: null, dischargeM3s: null, dischargePercentile: null,
        magnitude: null, depthKm: null,
        alertSeverity: f.properties.severity ?? f.properties.event ?? 'alert',
        title: f.properties.headline ?? f.properties.event ?? 'NWS alert',
      })),
    };
  } catch { return { observations: [], status: 'UNAVAILABLE' }; }
}

export function alertHazard(event:string):HazardKind|null {
  if(/tsunami/i.test(event))return 'TSUNAMI';
  if(/flood/i.test(event))return 'FLOOD';
  if(/heat/i.test(event))return 'HEAT';
  if(/red flag|fire weather/i.test(event))return 'WILDFIRE_WEATHER';
  if(/hurricane|tropical storm|tornado|thunderstorm|cyclone/i.test(event))return 'STORM';
  if(/wind/i.test(event))return 'STRONG_WIND';
  return null;
}
