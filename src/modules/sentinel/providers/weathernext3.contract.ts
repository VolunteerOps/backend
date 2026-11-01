import { z } from 'zod';

export const statistics = ['mean', 'p10', 'p25', 'p50', 'p75', 'p90'] as const;
export type Statistic = typeof statistics[number];
export const forecastVariables = {
  temperature_2m: { unit: 'degC', scale: 1, offset: -273.15 },
  wind_speed_10m: { unit: 'm/s', scale: 1, offset: 0 },
  total_precipitation_1hr: { unit: 'mm', scale: 1000, offset: 0 },
} as const;
export type ForecastVariable = keyof typeof forecastVariables;
export type Distribution = Record<Statistic, number | null>;
export interface ForecastCell {
  longitude: number; latitude: number; initTime: string; validTime: string; leadHours: number;
  values: Record<ForecastVariable, Distribution>;
}
export const boundsSchema = z.object({
  west: z.number().finite().min(-180).max(180), east: z.number().finite().min(-180).max(180),
  south: z.number().finite().min(-90).max(90), north: z.number().finite().min(-90).max(90),
}).strict().refine(b => b.south < b.north && b.west !== b.east && !(b.west === 180 && b.east === -180), 'Bounds must enclose a nonempty area');
export type Bounds = z.infer<typeof boundsSchema>;

export function boundsWkt(input: Bounds): string {
  const b = boundsSchema.parse(input);
  const ring = (w: number, e: number) => `((${w} ${b.south},${e} ${b.south},${e} ${b.north},${w} ${b.north},${w} ${b.south}))`;
  return b.west < b.east ? 'POLYGON' + ring(b.west, b.east) :
    b.west === 180 ? 'POLYGON' + ring(-180, b.east) : b.east === -180 ? 'POLYGON' + ring(b.west, 180) :
    'MULTIPOLYGON(' + ring(b.west, 180) + ',' + ring(-180, b.east) + ')';
}
export function withinBounds(longitude: number, latitude: number, b: Bounds) {
  return latitude >= b.south && latitude <= b.north &&
    (b.west < b.east ? longitude >= b.west && longitude <= b.east : longitude >= b.west || longitude <= b.east);
}
/** SQL selects intersecting grid polygons; preserve their centres even at region edges. */
export function gridCellIntersectsBounds(longitude:number,latitude:number,b:Bounds,resolution:0|0.05|0.1=0){
 if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude < -180||longitude > 180||latitude < -90||latitude > 90)return false;
 const half=resolution/2+1e-9;
 if(latitude+half<b.south||latitude-half>b.north)return false;
 const east=b.west<b.east?b.east:b.east+360;
 return [-360,0,360].some(shift=>longitude+shift+half>=b.west&&longitude+shift-half<=east);
}
export function forecastHorizon(initTime: string) {
  const date = new Date(z.string().datetime().parse(initTime));
  if (date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds()) throw new Error('INIT_MUST_BE_ON_HOUR');
  return date.getUTCHours() % 6 === 0 ? 360 : 48;
}
function timestamp(value: unknown) {
  const raw = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
  if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) throw new Error('INVALID_FORECAST_TIME');
  return new Date(raw).toISOString();
}
function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('INVALID_FORECAST_NUMBER');
  if (typeof value === 'string' && !value.trim()) throw new Error('INVALID_FORECAST_NUMBER');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('INVALID_FORECAST_NUMBER');
  return number;
}
export function normalizeForecastRow(row: Record<string, unknown>, expectedInit: string, bounds: Bounds, resolution:0|0.1=0): ForecastCell {
  const longitude = numeric(row.longitude), latitude = numeric(row.latitude);
  if (longitude === null || latitude === null || !gridCellIntersectsBounds(longitude, latitude, bounds, resolution)) throw new Error('FORECAST_OUTSIDE_REGION');
  const initTime = timestamp(row.init_time), validTime = timestamp(row.valid_time);
  const leadHours = numeric(row.lead_hours);
  if (initTime !== new Date(expectedInit).toISOString() || leadHours === null || !Number.isInteger(leadHours) ||
      leadHours < 1 || leadHours > forecastHorizon(initTime) || Date.parse(validTime) - Date.parse(initTime) !== leadHours * 3600000) {
    throw new Error('FORECAST_TIME_MISMATCH');
  }
  const values = {} as ForecastCell['values'];
  for (const [variable, conversion] of Object.entries(forecastVariables)) {
    const distribution = {} as Distribution;
    for (const stat of statistics) {
      const raw = numeric(row[variable + '_' + stat]);
      if (raw !== null && ((variable === 'temperature_2m' && (raw < 150 || raw > 350)) ||
          (variable === 'wind_speed_10m' && (raw < 0 || raw > 200)) ||
          (variable === 'total_precipitation_1hr' && (raw < 0 || raw > 3)))) throw new Error('FORECAST_VALUE_OUT_OF_RANGE');
      distribution[stat] = raw === null ? null : raw * conversion.scale + conversion.offset;
    }
    let prior: number | null = null;
    for (const stat of statistics.slice(1)) {
      const current = distribution[stat];
      if (prior !== null && current !== null && current < prior) throw new Error('FORECAST_PERCENTILES_UNORDERED');
      if (current !== null) prior = current;
    }
    values[variable as ForecastVariable] = distribution;
  }
  return { longitude, latitude, initTime, validTime, leadHours, values };
}
