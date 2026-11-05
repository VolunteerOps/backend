import { z } from 'zod';
import { boundedJson } from './http.js';
import {completeHourlySum, type CanonicalObservation} from '../engine.js';

const hourlySchema = z.object({
  latitude: z.number(), longitude: z.number(),
  hourly: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nullable()).optional(),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    temperature_2m: z.array(z.number().nullable()).optional(),
    relative_humidity_2m: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()).optional(),
    wind_gusts_10m: z.array(z.number().nullable()).optional(),
    soil_moisture_0_to_7cm: z.array(z.number().nullable()).optional(),
  }),
}).passthrough();
const floodSchema = z.object({
  latitude: z.number(), longitude: z.number(),
  daily: z.object({ time: z.array(z.string()), river_discharge: z.array(z.number().nullable()) }).passthrough(),
}).passthrough();

const num = (xs: Array<number | null> | undefined, i: number): number | null =>
  xs && typeof xs[i] === 'number' && Number.isFinite(xs[i]) ? (xs[i] as number) : null;
const maxOf = (xs: Array<number | null>): number | null => { const vs = xs.filter((v): v is number => v !== null); return vs.length ? Math.max(...vs) : null; };
const sumOf = (xs: Array<number | null>): number | null => { let total = 0; for (const v of xs) { if (v === null) return null; total += v; } return total; };

export function normalizeOpenMeteo(input: unknown, receivedAt = new Date().toISOString()): CanonicalObservation {
  const d = hourlySchema.parse(input);
  const times = d.hourly.time.map(t=>new Date(/Z$|[+-]\d\d:\d\d$/.test(t)?t:t+'Z').toISOString());
  const n = times.length;
  if(!n)throw new Error('EMPTY_FORECAST');
  const rain: Array<number | null> = [], temps: Array<number | null> = [], hum: Array<number | null> = [],
    wind: Array<number | null> = [], gust: Array<number | null> = [], soil: Array<number | null> = [];
  for (let i = 0; i < n; i++) {
    rain.push(num(d.hourly.precipitation, i)); temps.push(num(d.hourly.temperature_2m, i));
    hum.push(num(d.hourly.relative_humidity_2m, i));
    const w = num(d.hourly.wind_speed_10m, i); wind.push(w === null ? null : w / 3.6);
    const g = num(d.hourly.wind_gusts_10m, i); gust.push(g === null ? null : g / 3.6);
    soil.push(num(d.hourly.soil_moisture_0_to_7cm, i));
  }
  const humVals = hum.slice(0,24).filter((v): v is number => v !== null);
  const soilVals = soil.slice(0,24).filter((v): v is number => v !== null);
  return {
    source: 'OPEN_METEO', upstream: 'open-meteo',
    externalId: `open-meteo:${d.longitude},${d.latitude}:${d.hourly.time[0] ?? ''}`,
    longitude: d.longitude, latitude: d.latitude,
    observedAt: receivedAt, validFrom:times[0], validAt:times[Math.min(23,n-1)], receivedAt, evidenceKind:'FORECAST', spatialPrecision:'GRID',
    rain24ValidTo:times[23],rain72ValidTo:times[71],
    fireWeatherSamples:times.slice(0,24).flatMap((time,i)=>temps[i]!==null&&hum[i]!==null&&wind[i]!==null?[{time,temperatureC:temps[i]!,humidityPct:hum[i]!,windMps:wind[i]!}]:[]),
    rain24Mm: completeHourlySum(times.map((time,i)=>({time,value:rain[i]})),24), rain72Mm: completeHourlySum(times.map((time,i)=>({time,value:rain[i]})),72),
    maxHourlyRainMm: maxOf(rain.slice(0,24).filter((v): v is number => v !== null)),
    maxTempC: maxOf(temps.slice(0,24).filter((v): v is number => v !== null)),
    minHumidityPct: humVals.length ? Math.min(...humVals) : null,
    maxWindMps: maxOf(wind.slice(0,24).filter((v): v is number => v !== null)),
    maxGustMps: maxOf(gust.slice(0,24).filter((v): v is number => v !== null)),
    soilMoisture: soilVals.length ? soilVals.reduce((a, b) => a + b, 0) / soilVals.length : null,
    dischargeM3s: null, dischargePercentile: null, magnitude: null, depthKm: null,
    alertSeverity: null, title: null,
  };
}

/** Keyless forecast for bounded sample points. Fails per-point, never throws for one bad point. */
export async function fetchOpenMeteoPoints(points: Array<{ longitude: number; latitude: number }>, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ observations: CanonicalObservation[]; status: string }> {
  const observations: CanonicalObservation[] = [];
  let successfulPoints=0;
  await Promise.all(points.slice(0,5).map(async p=>{
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&hourly=precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,soil_moisture_0_to_7cm&forecast_days=3&timezone=UTC`;
      const res = await fetcher(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
      observations.push(...normalizeOpenMeteoSeries(await boundedJson(res, 2_000_000)));successfulPoints++; 
    } catch { /* point unavailable; other points still count */ }
  }));
  return { observations, status: !successfulPoints?'UNAVAILABLE':successfulPoints<Math.min(points.length,5)?'PARTIAL':'OK' };
}

export function normalizeOpenMeteoSeries(input:unknown,receivedAt=new Date().toISOString()):CanonicalObservation[]{
  const d=hourlySchema.parse(input);const out:CanonicalObservation[]=[];
  for(let offset=0;offset<d.hourly.time.length;offset+=24){
    const hourly=Object.fromEntries(Object.entries(d.hourly).map(([key,values])=>[key,values?.slice(offset)]));
    out.push(normalizeOpenMeteo({...d,hourly},receivedAt));
  }
  return out;
}
export function normalizeFlood(input:unknown,base:CanonicalObservation):CanonicalObservation {
  const d=floodSchema.parse(input);
  const rows=d.daily.time.map((time,i)=>({time:new Date(time+'T00:00:00Z').toISOString(),value:d.daily.river_discharge[i]})).filter(r=>typeof r.value==='number'&&Number.isFinite(r.value)&&r.value>=0);
  const peak=rows.reduce<typeof rows[number]|null>((a,b)=>!a||b.value!>a.value!?b:a,null);
  // A discharge forecast is not a climatological percentile or a basin flood threshold.
  return {...base,source:'OPEN_METEO_FLOOD',upstream:'glofas',longitude:d.longitude,latitude:d.latitude,externalId:`glofas:${d.longitude},${d.latitude}:${d.daily.time[0]??''}`,validFrom:rows[0]?.time??base.validAt,validAt:rows.at(-1)?.time??base.validAt,evidenceKind:'FORECAST',spatialPrecision:'GRID',dischargeM3s:peak?.value??null,dischargePercentile:null};
}

export async function fetchFloodForPoint(point: { longitude: number; latitude: number }, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<CanonicalObservation | null> {
  try {
    const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${point.latitude}&longitude=${point.longitude}&daily=river_discharge&forecast_days=7&timezone=UTC`;
    const res = await fetcher(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } });
    const raw = await boundedJson(res, 1_000_000);
    const stub: CanonicalObservation = {
      source: 'OPEN_METEO_FLOOD', upstream: 'glofas', externalId: 'glofas', longitude: point.longitude, latitude: point.latitude,
      observedAt: new Date().toISOString(), validAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
      rain24Mm: null, rain72Mm: null, maxHourlyRainMm: null, maxTempC: null, minHumidityPct: null,
      maxWindMps: null, maxGustMps: null, soilMoisture: null, dischargeM3s: null, dischargePercentile: null,
      magnitude: null, depthKm: null, alertSeverity: null, title: null,
    };
    return normalizeFlood(raw, stub);
  } catch { return null; }
}
