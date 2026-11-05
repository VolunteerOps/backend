/**
 * ResQOps Sentinel disaster engine.
 *
 * Multi-source, guard-dog style detection: every source is normalized to a
 * canonical observation, pure hazard detectors score known indicator patterns,
 * and a reliability-weighted fusion layer merges independent evidence without
 * double-counting correlated feeds. WeatherNext (private) carries the highest
 * model weight; open sources keep the engine running when WeatherNext GCS /
 * BigQuery access is unavailable.
 *
 * Safety contract (docs/volunteerops-sentinel-disaster-engine.md): thresholds
 * are provisional, region-calibratable indicators. They are NOT calibrated
 * disaster probabilities. Every output stays UNVALIDATED_INDICATOR in SHADOW
 * mode until held-out calibration and reviewer sign-off promote it. No output
 * is an operational warning and nothing auto-deploys people.
 */
import { createHash } from 'node:crypto';
import type { ForecastCell } from './providers/weathernext3.contract.js';

export const ENGINE_VERSION = 'disaster-engine/1.1.0';
export const ENGINE_MODE = 'SHADOW' as const;

export type HazardKind =
  | 'FLOOD' | 'HEAVY_RAIN' | 'HEAT' | 'STRONG_WIND' | 'STORM'
  | 'WILDFIRE_WEATHER' | 'LANDSLIDE' | 'EARTHQUAKE' | 'DROUGHT' | 'WILDFIRE' | 'TSUNAMI';

export type SourceId =
  | 'WEATHERNEXT3' | 'OPEN_METEO' | 'OPEN_METEO_FLOOD' | 'USGS'
  | 'GDACS' | 'NWS' | 'RELIEFWEB' | 'GAUGE' | 'COMMUNITY';

export interface SourceDescriptor {
  id: SourceId; label: string; authority: number; kind: 'MODEL' | 'OBSERVED' | 'OFFICIAL' | 'REPORTED';
  upstream: string; keyless: boolean; enabledByDefault: boolean; envFlag?: string;
  note: string;
}

/** Configured source preferences, not measured accuracy or calibrated reliability. */
export const SOURCE_REGISTRY: SourceDescriptor[] = [
  { id: 'WEATHERNEXT3', label: 'WeatherNext 3 (private)', authority: 0.9, kind: 'MODEL', upstream: 'weathernext3', keyless: false, enabledByDefault: false, envFlag: 'WEATHERNEXT_ACCESS_ENABLED', note: 'Private Google model via BigQuery/GCS. Highest model weight. Never a second vote with its own GCS copy.' },
  { id: 'USGS', label: 'USGS earthquakes', authority: 0.95, kind: 'OBSERVED', upstream: 'usgs', keyless: true, enabledByDefault: true, envFlag: 'SENTINEL_USGS_ENABLED', note: 'Observed seismic events only. Weather never raises seismic confidence.' },
  { id: 'NWS', label: 'NOAA / NWS alerts (US)', authority: 1.0, kind: 'OFFICIAL', upstream: 'nws', keyless: true, enabledByDefault: true, envFlag: 'SENTINEL_NWS_ENABLED', note: 'Authoritative US CAP alerts. Outside the US this source is unavailable, never zero risk.' },
  { id: 'GDACS', label: 'GDACS (UN/EU)', authority: 0.85, kind: 'REPORTED', upstream: 'gdacs', keyless: true, enabledByDefault: true, envFlag: 'INCIDENT_FEEDS_ENABLED', note: 'Global reported disasters. Syndicated copies count once.' },
  { id: 'RELIEFWEB', label: 'ReliefWeb (UN OCHA)', authority: 0.8, kind: 'REPORTED', upstream: 'reliefweb', keyless: true, enabledByDefault: true, envFlag: 'SENTINEL_RELIEFWEB_ENABLED', note: 'Humanitarian disaster reports. Reported, not verified.' },
  { id: 'OPEN_METEO_FLOOD', label: 'Open-Meteo Flood / GloFAS', authority: 0.7, kind: 'MODEL', upstream: 'glofas', keyless: true, enabledByDefault: true, envFlag: 'SENTINEL_OPEN_METEO_ENABLED', note: 'River discharge forecast. Where no basin exists the flood detector is unavailable.' },
  { id: 'OPEN_METEO', label: 'Open-Meteo forecast', authority: 0.6, kind: 'MODEL', upstream: 'open-meteo', keyless: true, enabledByDefault: true, envFlag: 'SENTINEL_OPEN_METEO_ENABLED', note: 'Keyless open forecast used at bounded region sample points. Independent upstream from WeatherNext.' },
  { id: 'GAUGE', label: 'Coordinator gauge records', authority: 0.75, kind: 'OBSERVED', upstream: 'gauge', keyless: true, enabledByDefault: true, note: 'Recorded levels, not a live sensor feed.' },
  { id: 'COMMUNITY', label: 'Community / device reports', authority: 0.3, kind: 'REPORTED', upstream: 'community', keyless: true, enabledByDefault: false, note: 'Lowest weight. Relay copies are never independent votes.' },
];
export const sourceAuthority = (id: SourceId): number =>
  SOURCE_REGISTRY.find(s => s.id === id)?.authority ?? 0.3;
export const sourceUpstream = (id: SourceId): string =>
  SOURCE_REGISTRY.find(s => s.id === id)?.upstream ?? id.toLowerCase();

export interface CanonicalObservation {
  source: SourceId; upstream: string; externalId: string;
  longitude: number; latitude: number;
  observedAt: string; validAt: string; receivedAt: string;
  validFrom?: string; expiresAt?: string; issuedAt?: string;
  rain24ValidTo?: string; rain72ValidTo?: string;
  fireWeatherSamples?: Array<{time:string;temperatureC:number;humidityPct:number;windMps:number}>;
  hazard?: HazardKind; evidenceKind?: 'FORECAST' | 'OBSERVED' | 'REPORTED' | 'OFFICIAL';
  spatialPrecision?: 'GRID' | 'POINT' | 'COUNTRY'; sourceUrl?: string;
  rain24Mm: number | null; rain72Mm: number | null; maxHourlyRainMm: number | null;
  maxTempC: number | null; minHumidityPct: number | null;
  maxWindMps: number | null; maxGustMps: number | null;
  soilMoisture: number | null; dischargeM3s: number | null; dischargePercentile: number | null;
  magnitude: number | null; depthKm: number | null;
  alertSeverity: string | null; title: string | null;
}

export interface HazardPrediction {
  id: string; hazard: HazardKind; kind: 'PREDICTED' | 'OBSERVED' | 'REPORTED' | 'OFFICIAL';
  level: 'MONITOR' | 'WATCH' | 'WARNING' | 'SEVERE';
  severity: number; confidence: number;
  evidenceScore: number; calibratedProbability: null;
  validation: 'UNVALIDATED_INDICATOR'; operationalWarning: false;
  longitude: number; latitude: number;
  validFrom: string; validTo: string; generatedAt: string;
  sources: SourceId[]; independentSources: number;
  detectorVersion: string; mode: typeof ENGINE_MODE;
  explanation: string[]; missingInputs: string[]; evidence: string[];
}

export interface EngineThresholds {
  floodRain24WatchMm: number; floodRain24SevereMm: number;
  rain72WatchMm: number; hourlyRainWatchMm: number;
  heatWatchC: number; heatSevereC: number;
  windWatchMps: number; gustWatchMps: number; gustSevereMps: number;
  fireTempC: number; fireHumidityPct: number; fireWindMps: number;
  landslideRain72Mm: number;
}
/** Provisional shadow-mode starting points. Region policy may override rain/heat/wind. */
export const DEFAULT_THRESHOLDS: EngineThresholds = {
  floodRain24WatchMm: 50, floodRain24SevereMm: 100,
  rain72WatchMm: 80, hourlyRainWatchMm: 20,
  heatWatchC: 35, heatSevereC: 40,
  windWatchMps: 14, gustWatchMps: 20, gustSevereMps: 25,
  fireTempC: 35, fireHumidityPct: 20, fireWindMps: 8,
  landslideRain72Mm: 80,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 0 below watch (scaled to at most 0.34), 0.35 at watch, 1.0 at severe. */
const ramp = (value: number | null, watch: number, severe: number): number => {
  if (value === null || !Number.isFinite(value)) return 0;
  if (value < watch) return clamp01(value / watch) * 0.34;
  return clamp01(0.35 + 0.65 * (value - watch) / Math.max(severe - watch, 1e-9));
};
const levelFor = (s: number): HazardPrediction['level'] =>
  s >= 0.8 ? 'SEVERE' : s >= 0.6 ? 'WARNING' : s >= 0.35 ? 'WATCH' : 'MONITOR';
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Deterministic dedupe id: same source event / syndicated copy counts once. */
export function observationKey(o: CanonicalObservation): string {
  return [sourceUpstream(o.source), o.externalId, o.longitude, o.latitude, o.validFrom ?? o.validAt].join('|');
}
export function dedupeObservations(list: CanonicalObservation[]): CanonicalObservation[] {
  const seen = new Map<string, CanonicalObservation>();
  for (const o of list) { const previous = seen.get(observationKey(o)); if (!previous || Date.parse(o.receivedAt) > Date.parse(previous.receivedAt)) seen.set(observationKey(o), o); }
  return [...seen.values()];
}

function cellKey(lon: number, lat: number): string {
  return `${Math.round(lon * 2) / 2},${Math.round(lat * 2) / 2}`;
}

interface Scored { obs: CanonicalObservation; severity: number; why: string[]; missing: string[] }

function scoreHazard(hazard: HazardKind, o: CanonicalObservation, t: EngineThresholds): Scored | null {
  const why: string[] = []; const missing: string[] = [];
  let severity = 0;
  switch (hazard) {
    case 'FLOOD': {
      if (o.rain24Mm === null && o.dischargePercentile === null) { missing.push('rainfall accumulation', 'river discharge'); return { obs: o, severity: 0, why, missing }; }
      severity = Math.max(ramp(o.rain24Mm, t.floodRain24WatchMm, t.floodRain24SevereMm),
        o.dischargePercentile !== null ? clamp01((o.dischargePercentile - 0.8) / 0.2) : 0);
      if (o.soilMoisture !== null && o.soilMoisture >= 0.35) { severity = clamp01(severity + 0.08); why.push(`saturated soil ${o.soilMoisture}`); }
      if (o.rain24Mm !== null) why.push(`rain 24h ${round(o.rain24Mm)}mm`);
      if (o.dischargePercentile !== null) why.push(`river discharge percentile ${round(o.dischargePercentile)}`);
      if (o.dischargePercentile === null) missing.push('river discharge / gauge level');
      break;
    }
    case 'HEAVY_RAIN':
      severity = ramp(o.maxHourlyRainMm, t.hourlyRainWatchMm, t.hourlyRainWatchMm * 2);
      if (o.maxHourlyRainMm !== null) why.push(`max hourly rain ${round(o.maxHourlyRainMm)}mm`);
      else missing.push('hourly rainfall');
      break;
    case 'HEAT':
      severity = ramp(o.maxTempC, t.heatWatchC, t.heatSevereC);
      if (o.maxTempC !== null) why.push(`max temperature ${round(o.maxTempC)}C`);
      else missing.push('temperature');
      break;
    case 'STRONG_WIND': case 'STORM':
      severity = Math.max(ramp(o.maxWindMps, t.windWatchMps, t.windWatchMps * 1.8), ramp(o.maxGustMps, t.gustWatchMps, t.gustSevereMps));
      if (o.maxGustMps !== null) why.push(`max gust ${round(o.maxGustMps)}m/s`);
      if (o.maxWindMps !== null) why.push(`maximum sustained wind ${round(o.maxWindMps)}m/s`);
      break;
    case 'WILDFIRE_WEATHER': {
      const samples=o.fireWeatherSamples??[];
      if(!samples.length){missing.push('Same-hour temperature, humidity and wind');return {obs:o,severity:0,why,missing};}
      for(const sample of samples){
        const hot=sample.temperatureC>=t.fireTempC,dry=sample.humidityPct<=t.fireHumidityPct,windy=sample.windMps>=t.fireWindMps;
        // Coincident hot, dry and windy conditions; daily maxima are not interchangeable.
        if(hot&&dry&&windy){severity=Math.max(severity,0.6);why.push(`Hot, dry and windy at ${sample.time}: ${round(sample.temperatureC)}C, ${round(sample.humidityPct)}%, ${round(sample.windMps)}m/s. Weather conditions only, not a fire prediction.`);}
      }
      missing.push('Fuel, ignition, vegetation and local fire-weather validation');
      break;
    }
    case 'LANDSLIDE': {
      severity = ramp(o.rain72Mm, t.landslideRain72Mm, t.landslideRain72Mm * 1.8) * 0.59;
      missing.push('validated slope / susceptibility layer (severity capped at WATCH)');
      if (o.rain72Mm !== null) why.push(`rain 72h ${round(o.rain72Mm)}mm`);
      break;
    }
    case 'EARTHQUAKE': {
      if (o.magnitude === null) return null;
      severity = clamp01((o.magnitude - 2.5) / 5);
      why.push(`observed magnitude ${o.magnitude}, depth ${o.depthKm ?? '?'}km`);
      break;
    }
    case 'DROUGHT': case 'WILDFIRE': case 'TSUNAMI': return null;
  }
  return { obs: o, severity: clamp01(severity), why, missing };
}

const HALF_LIFE_H: Partial<Record<HazardKind, number>> = { EARTHQUAKE: 6, FLOOD: 24, HEAVY_RAIN: 12, STORM: 12, STRONG_WIND: 12, HEAT: 48, WILDFIRE_WEATHER: 24, LANDSLIDE: 48 };
function freshness(validAt: string, hazard: HazardKind, now: number): number {
  const ageH = Math.max(0, (now - Date.parse(validAt)) / 3600000);
  return Math.pow(0.5, ageH / (HALF_LIFE_H[hazard] ?? 24));
}

/**
 * Fuse scored observations per hazard+cell. Correlated copies (same upstream)
 * are one vote. Agreement between independent upstreams raises confidence;
 * contradiction lowers it. Evidence score stays separate from any calibrated
 * probability, which remains null in shadow mode.
 */
export function fusePredictions(observations: CanonicalObservation[], thresholds: EngineThresholds = DEFAULT_THRESHOLDS, now = Date.now()): HazardPrediction[] {
  const groups = new Map<string, { hazard: HazardKind; scored: Scored[] }>();
  const hazards: HazardKind[] = ['FLOOD', 'HEAVY_RAIN', 'HEAT', 'STRONG_WIND', 'WILDFIRE_WEATHER', 'LANDSLIDE', 'EARTHQUAKE'];
  for (const obs of dedupeObservations(observations).filter(o => usableObservation(o, now))) {
    if (obs.evidenceKind === 'REPORTED' || obs.evidenceKind === 'OFFICIAL') continue;
    for (const hazard of hazards) {
      const end=hazard==='FLOOD'?obs.rain24ValidTo:hazard==='LANDSLIDE'?obs.rain72ValidTo:undefined;
      const s = scoreHazard(hazard, end?{...obs,validAt:end}:obs, thresholds);
      if (!s || !s.why.length) continue;
      const time = (obs.validFrom ?? obs.validAt).slice(0, 10);
      const key = hazard + '|' + cellKey(obs.longitude, obs.latitude) + '|' + time + '|' + s.obs.validAt + (hazard === 'EARTHQUAKE' ? '|' + obs.externalId : '');
      const g = groups.get(key) ?? { hazard, scored: [] };
      g.scored.push(s); groups.set(key, g);
    }
  }
  const out: HazardPrediction[] = [];
  for (const [key, g] of groups) {
    // One vote per upstream: keep its strongest observation.
    const byUpstream = new Map<string, Scored>();
    for (const s of g.scored) {
      const family = sourceUpstream(s.obs.source);
      const cur = byUpstream.get(family);
      if (!cur || Date.parse(s.obs.observedAt) > Date.parse(cur.obs.observedAt) || (s.obs.observedAt === cur.obs.observedAt && s.severity > cur.severity)) byUpstream.set(family, s);
    }
    const votes = [...byUpstream.values()];
    let wSum = 0, mean = 0;
    for (const v of votes) {
      const w = sourceAuthority(v.obs.source) * freshness(v.obs.issuedAt??v.obs.observedAt, g.hazard, now);
      wSum += w; mean += w * v.severity;
    }
    if (wSum <= 0) continue;
    mean /= wSum;
    let variance = 0;
    for (const v of votes) {
      const w = sourceAuthority(v.obs.source) * freshness(v.obs.issuedAt??v.obs.observedAt, g.hazard, now);
      variance += (w / wSum) * Math.pow(v.severity - mean, 2);
    }
    const independent = votes.length;
    const agreement = clamp01(1 - Math.sqrt(variance) * 1.6);
    const ageFactor=votes.reduce((sum,v)=>sum+freshness(v.obs.issuedAt??v.obs.observedAt,g.hazard,now),0)/votes.length;
    const confidence = round(clamp01(ageFactor * (0.35 + 0.2 * Math.min(independent, 3)) * (0.5 + 0.5 * agreement)));
    const severity = round(mean);
    const isEq = g.hazard === 'EARTHQUAKE';
    if (!isEq && severity < 0.35) continue;
    const best = votes.reduce((a, b) => (b.severity > a.severity ? b : a));
    const validTimes = votes.map(v => Date.parse(v.obs.validAt)).filter(Number.isFinite);
    out.push({
      id: 'pred-' + createHash('sha256').update(key).digest('hex').slice(0, 24),
      hazard: g.hazard, kind: isEq ? 'OBSERVED' : 'PREDICTED',
      level: levelFor(severity), severity, confidence,
      evidenceScore: severity, calibratedProbability: null,
      validation: 'UNVALIDATED_INDICATOR', operationalWarning: false,
      longitude: best.obs.longitude, latitude: best.obs.latitude,
      validFrom: new Date(Math.min(...votes.map(v => Date.parse(v.obs.validFrom ?? v.obs.validAt)))).toISOString(),
      validTo: new Date(Math.max(...validTimes)).toISOString(),
      generatedAt: new Date(now).toISOString(),
      sources: [...new Set(votes.map(v => v.obs.source))], independentSources: independent,
      detectorVersion: ENGINE_VERSION, mode: ENGINE_MODE,
      explanation: [...new Set(votes.flatMap(v => v.why))].slice(0, 8),
      missingInputs: [...new Set(votes.flatMap(v => v.missing))],
      evidence: votes.map(v => `${v.obs.source}:${v.obs.externalId}`),
    });
  }
  for (const obs of dedupeObservations(observations).filter(o => usableObservation(o, now))) {
    if (!obs.hazard || !['REPORTED','OFFICIAL'].includes(obs.evidenceKind ?? '') || obs.spatialPrecision === 'COUNTRY') continue;
    const severity = /extreme|severe/i.test(obs.alertSeverity ?? '') ? 0.85 : /moderate/i.test(obs.alertSeverity ?? '') ? 0.6 : 0.35;
    out.push({ id:'report-' + createHash('sha256').update(observationKey(obs)).digest('hex').slice(0,24), hazard:obs.hazard, kind:obs.evidenceKind as 'REPORTED'|'OFFICIAL', level:levelFor(severity), severity, confidence:0, evidenceScore:0, calibratedProbability:null, validation:'UNVALIDATED_INDICATOR', operationalWarning:false, longitude:obs.longitude,latitude:obs.latitude,validFrom:obs.validFrom??obs.observedAt,validTo:obs.validAt,generatedAt:new Date(now).toISOString(),sources:[obs.source],independentSources:1,detectorVersion:ENGINE_VERSION,mode:ENGINE_MODE,explanation:[obs.title??'Source report', 'Source classification; not a new forecast or local impact estimate.'],missingInputs:['Local verification and source updates'],evidence:[`${obs.source}:${obs.externalId}`] });
  }
  return out.sort((a, b) => b.severity - a.severity || b.confidence - a.confidence);
}

/** Bounded sample points for a region: centroid + inset corners (max 5). */
export function samplePointsForBounds(b: { west: number; east: number; south: number; north: number }): Array<{ longitude: number; latitude: number }> {
  const lonSpan = b.west < b.east ? b.east - b.west : b.east + 360 - b.west;
  const norm = (lon: number) => ((lon + 540) % 360) - 180;
  const cx = norm(b.west + lonSpan / 2), cy = (b.south + b.north) / 2;
  const dx = lonSpan * 0.25, dy = (b.north - b.south) * 0.25;
  const pts = [{ longitude: cx, latitude: cy },
    { longitude: norm(cx - dx), latitude: cy - dy }, { longitude: norm(cx + dx), latitude: cy - dy },
    { longitude: norm(cx - dx), latitude: cy + dy }, { longitude: norm(cx + dx), latitude: cy + dy }];
  const seen = new Set<string>();
  return pts.filter(p => { const k = p.longitude.toFixed(3) + ',' + p.latitude.toFixed(3); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Validate all supplied numeric/time fields before any scoring. Missing is not zero. */
export function usableObservation(o: CanonicalObservation, now: number): boolean {
  if (!SOURCE_REGISTRY.some(s=>s.id===o.source) || !o.externalId || !Number.isFinite(o.longitude) || !Number.isFinite(o.latitude) || Math.abs(o.longitude)>180 || Math.abs(o.latitude)>90) return false;
  if ([o.observedAt,o.validAt,o.receivedAt,o.validFrom??o.validAt,...(o.issuedAt?[o.issuedAt]:[]),...(o.rain24ValidTo?[o.rain24ValidTo]:[]),...(o.rain72ValidTo?[o.rain72ValidTo]:[])].some(t=>!Number.isFinite(Date.parse(t)))) return false;
  if (o.expiresAt && (!Number.isFinite(Date.parse(o.expiresAt)) || Date.parse(o.expiresAt)<=now)) return false;
  if (Date.parse(o.receivedAt)>now+300000 || now-Date.parse(o.receivedAt)>86400000) return false;
  if (o.issuedAt && (Date.parse(o.issuedAt)>now+300000 || now-Date.parse(o.issuedAt)>86400000)) return false;
  if (Date.parse(o.validAt)<now-86400000 || Date.parse(o.validFrom??o.validAt)>Date.parse(o.validAt)) return false;
  if(o.evidenceKind==='OBSERVED'&&Date.parse(o.observedAt)>now+300000)return false;
  if(o.fireWeatherSamples?.some(s=>!Number.isFinite(Date.parse(s.time))||![s.temperatureC,s.humidityPct,s.windMps].every(Number.isFinite)||s.humidityPct<0||s.humidityPct>100||s.windMps<0))return false;
  const nonnegative=[o.rain24Mm,o.rain72Mm,o.maxHourlyRainMm,o.maxWindMps,o.maxGustMps,o.soilMoisture,o.dischargeM3s,o.depthKm];
  if (nonnegative.some(n=>n!==null&&(!Number.isFinite(n)||n<0))) return false;
  if ([o.maxTempC,o.magnitude].some(n=>n!==null&&!Number.isFinite(n))) return false;
  if (o.minHumidityPct!==null&&(!Number.isFinite(o.minHumidityPct)||o.minHumidityPct<0||o.minHumidityPct>100)) return false;
  if (o.dischargePercentile!==null&&(!Number.isFinite(o.dischargePercentile)||o.dischargePercentile<0||o.dischargePercentile>1)) return false;
  return true;
}
export const nullableMax = (xs:Array<number|null>):number|null => { const valid=xs.filter((v):v is number=>v!==null&&Number.isFinite(v));return valid.length?Math.max(...valid):null; };
export function completeHourlySum(rows:Array<{time:string;value:number|null}>, hours:number):number|null {
  if(rows.length<hours)return null;
  const window=rows.slice(0,hours);
  if(window.some((r,i)=>r.value===null||!Number.isFinite(r.value)||r.value<0||!Number.isFinite(Date.parse(r.time))||(i>0&&Date.parse(r.time)-Date.parse(window[i-1].time)!==3600000)))return null;
  return window.reduce((sum,r)=>sum+r.value!,0);
}
/** Forecast means are in the canonical Celsius, m/s and mm units. Totals require full hourly coverage. */
export function observationsFromForecastCells(cells:ForecastCell[],source:SourceId='WEATHERNEXT3',receivedAt=new Date().toISOString()):CanonicalObservation[] {
  const points=new Map<string,ForecastCell[]>();
  for(const c of cells){const key=[c.longitude,c.latitude,c.initTime].join('|');const rows=points.get(key)??[];rows.push(c);points.set(key,rows);}
  const out:CanonicalObservation[]=[];
  for(const rows of points.values()){
    rows.sort((a,b)=>Date.parse(a.validTime)-Date.parse(b.validTime));
    for(let offset=0;offset<rows.length;offset+=24){
      const dayRows=rows.slice(offset,offset+24);
      const first=dayRows[0];const remaining=rows.filter(r=>Date.parse(r.validTime)>=Date.parse(first.validTime));
      const rain=remaining.map(r=>({time:r.validTime,value:r.values.total_precipitation_1hr.mean}));
      out.push({source,upstream:sourceUpstream(source),externalId:`forecast:${first.longitude},${first.latitude}:${first.initTime}:${first.validTime}`,longitude:first.longitude,latitude:first.latitude,observedAt:first.initTime,issuedAt:first.initTime,validFrom:first.validTime,validAt:dayRows.at(-1)!.validTime,receivedAt,evidenceKind:'FORECAST',spatialPrecision:'GRID',rain24Mm:completeHourlySum(rain,24),rain72Mm:completeHourlySum(rain,72),rain24ValidTo:remaining[23]?.validTime,rain72ValidTo:remaining[71]?.validTime,maxHourlyRainMm:nullableMax(dayRows.map(r=>r.values.total_precipitation_1hr.mean)),maxTempC:nullableMax(dayRows.map(r=>r.values.temperature_2m.mean)),maxWindMps:nullableMax(dayRows.map(r=>r.values.wind_speed_10m.mean)),minHumidityPct:null,maxGustMps:null,soilMoisture:null,dischargeM3s:null,dischargePercentile:null,magnitude:null,depthKm:null,alertSeverity:null,title:null});
    }
  }
  return out;
}
export function observationsFromEarthquakes(rows:Array<Record<string,unknown>>,receivedAt=new Date().toISOString()):CanonicalObservation[]{
  return rows.filter(r=>typeof r.longitude==='number'&&typeof r.latitude==='number'&&r.observed_at!=null&&Number.isFinite(new Date(r.observed_at as string).getTime())).map(r=>({source:'USGS' as const,upstream:'usgs',externalId:String(r.external_id??r.id??''),longitude:Number(r.longitude),latitude:Number(r.latitude),observedAt:new Date(r.observed_at as string).toISOString(),validAt:new Date(r.observed_at as string).toISOString(),receivedAt,evidenceKind:'OBSERVED' as const,rain24Mm:null,rain72Mm:null,maxHourlyRainMm:null,maxTempC:null,minHumidityPct:null,maxWindMps:null,maxGustMps:null,soilMoisture:null,dischargeM3s:null,dischargePercentile:null,magnitude:typeof r.magnitude==='number'?r.magnitude:null,depthKm:typeof r.depth_km==='number'?r.depth_km:null,alertSeverity:null,title:typeof r.title==='string'?r.title:null}));
}
