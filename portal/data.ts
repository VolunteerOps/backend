import type { ForecastCell, ForecastVariable, Statistic } from '../src/modules/sentinel/providers/weathernext3.contract.js';
export type { ForecastCell, ForecastVariable, Statistic };
export interface Region { forecastPolicy?: {version:number;heat_c:number;wind_mps:number;hourly_rain_mm:number;maximum_run_age_hours:number}; id: string; name: string; forecastBounds: {west:number;east:number;south:number;north:number} }
export interface Membership { organization_id:string;organization_name:string;role:string;access:string;capabilities?:string[] }
export interface Forecast {status:'UNAVAILABLE'|'STALE'|'AVAILABLE';region:{id:string;name:string};
 run:null|{id:string;source:string;model:string;init_time:string;retrieved_at:string;expires_at:string};
 cells:ForecastCell[];assessment:null|{validation:string;indicators:unknown[];missing_values:number}}
export const units:Record<ForecastVariable,string>={temperature_2m:'°C',wind_speed_10m:'m/s',total_precipitation_1hr:'mm'};
export function forecastHours(forecast:Forecast|null){return [...new Set(forecast?.status==='AVAILABLE'?forecast.cells.map(c=>c.validTime):[])].sort();}
export function visibleCells(forecast:Forecast|null,time:string|undefined){return forecast?.status==='AVAILABLE'?forecast.cells.filter(c=>c.validTime===time):[];}
export function weatherFeatures(cells:ForecastCell[],variable:ForecastVariable,statistic:Statistic):GeoJSON.FeatureCollection<GeoJSON.Point>{
 return {type:'FeatureCollection',features:cells.flatMap(cell=>{
  const value=cell.values[variable][statistic];
  return value===null?[]:[{type:'Feature' as const,properties:{value,time:cell.validTime,unit:units[variable]},geometry:{type:'Point' as const,coordinates:[cell.longitude,cell.latitude]}}];
 })};
}
