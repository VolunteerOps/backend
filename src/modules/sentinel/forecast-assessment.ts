import { z } from 'zod';
import type { ForecastCell, ForecastVariable } from './providers/weathernext3.contract.js';

export const forecastPolicySchema = z.object({
  version: z.number().int().positive(),
  heat_c: z.number().min(25).max(60),
  wind_mps: z.number().min(5).max(100),
  hourly_rain_mm: z.number().min(1).max(500),
  maximum_run_age_hours: z.number().int().min(1).max(48).default(8),
}).strict();
export type ForecastPolicy = z.infer<typeof forecastPolicySchema>;
export interface ForecastIndicator {
  kind: 'HEAT' | 'STRONG_WIND' | 'HEAVY_RAIN';
  longitude: number; latitude: number; valid_time: string;
  threshold: number; unit: string; p50: number | null; p90: number;
  assessment: 'MEDIAN_EXCEEDANCE' | 'UPPER_RANGE_EXCEEDANCE';
  validation: 'UNVALIDATED_INDICATOR'; policy_version: number;
}
export function assessForecast(cells: ForecastCell[], policyInput: ForecastPolicy, now = Date.now()) {
  const policy = forecastPolicySchema.parse(policyInput);
  const definitions: Array<{ kind: ForecastIndicator['kind']; variable: ForecastVariable; threshold: number; unit: string }> = [
    { kind: 'HEAT', variable: 'temperature_2m', threshold: policy.heat_c, unit: 'degC' },
    { kind: 'STRONG_WIND', variable: 'wind_speed_10m', threshold: policy.wind_mps, unit: 'm/s' },
    { kind: 'HEAVY_RAIN', variable: 'total_precipitation_1hr', threshold: policy.hourly_rain_mm, unit: 'mm' },
  ];
  const indicators: ForecastIndicator[] = [];
  let missingValues = 0, staleCells = 0;
  for (const cell of cells) {
    if (Date.parse(cell.initTime) > now || now - Date.parse(cell.initTime) >= policy.maximum_run_age_hours * 3600000 ||
        Date.parse(cell.validTime) <= now) { staleCells++; continue; }
    for (const definition of definitions) {
      const values = cell.values[definition.variable];
      missingValues += Object.values(values).filter(value => value === null).length;
      if (values.p90 === null) continue;
      if (values.p90 < definition.threshold) continue;
      indicators.push({ kind: definition.kind, longitude: cell.longitude, latitude: cell.latitude, valid_time: cell.validTime,
        threshold: definition.threshold, unit: definition.unit, p50: values.p50, p90: values.p90,
        assessment: values.p50 !== null && values.p50 >= definition.threshold ? 'MEDIAN_EXCEEDANCE' : 'UPPER_RANGE_EXCEEDANCE',
        validation: 'UNVALIDATED_INDICATOR', policy_version: policy.version });
    }
  }
  return { indicators, missing_values: missingValues, stale_cells: staleCells,
    operational_warning: false, automatic_deployment: false,
    interpretation: 'Forecast threshold exceedances. Flood, fire, landslide and impact estimates require additional validated models and observations.' };
}
