import {z} from 'zod';
import type {ForecastCell} from './providers/weathernext3.contract.js';
import type {ForecastPolicy} from './forecast-assessment.js';

export const weatherAnalysisRequest=z.object({
  question:z.string().trim().min(3).max(2000),
  from:z.string().datetime(),to:z.string().datetime(),
}).strict().refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=48*3600000,'Select a window of at most 48 hours');
export const weatherNarrative=z.object({
  summary:z.string().min(1).max(3000),preparedness:z.array(z.string().max(600)).max(8),
  assumptions:z.array(z.string().max(600)).max(8),missing_inputs:z.array(z.string().max(600)).max(12),
  source_ids:z.array(z.string().max(160)).min(1).max(20),
}).strict();

/** Numerical work is deterministic. A sum of hourly means is not a quantile of accumulated rainfall. */
export function analyzeWeather(cells:ForecastCell[],policy:ForecastPolicy,from:string,to:string) {
  const start=Date.parse(from),end=Date.parse(to);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>48*3600000)throw new Error('INVALID_ANALYSIS_WINDOW');
  const grouped=new Map<string,ForecastCell[]>();
  for(const cell of cells){
    const t=Date.parse(cell.validTime);
    if(t<=start||t>end)continue;
    const key=cell.longitude+','+cell.latitude;
    const rows=grouped.get(key)??[];rows.push(cell);grouped.set(key,rows);
  }
  if(grouped.size>1000)throw new Error('ANALYSIS_REQUIRES_SMALLER_REGION');
  const points=[...grouped.values()].map(rows=>{
    rows.sort((a,b)=>a.leadHours-b.leadHours);
    let rain=0,rainMissing=0,heatRun=0,windRun=0,maxHeat=0,maxWind=0,prior=NaN;
    let maxRain:number|null=null,maxTemperature:number|null=null,maxWindSpeed:number|null=null;
    const unique=new Set<number>();
    for(const row of rows){
      if(unique.has(row.leadHours))throw new Error('DUPLICATE_FORECAST_CELL');unique.add(row.leadHours);
      if(row.leadHours!==prior+1){heatRun=0;windRun=0;}prior=row.leadHours;
      const p=row.values.total_precipitation_1hr.mean;
      const heat=row.values.temperature_2m.p50,wind=row.values.wind_speed_10m.p50;
      if(p===null)rainMissing++;else{rain+=p;maxRain=Math.max(maxRain??p,p);}
      heatRun=heat!==null&&heat>=policy.heat_c?heatRun+1:0;
      windRun=wind!==null&&wind>=policy.wind_mps?windRun+1:0;
      maxHeat=Math.max(maxHeat,heatRun);maxWind=Math.max(maxWind,windRun);
      if(heat!==null)maxTemperature=Math.max(maxTemperature??heat,heat);
      if(wind!==null)maxWindSpeed=Math.max(maxWindSpeed??wind,wind);
    }
    const expected=Math.floor((end-start)/3600000);
    const complete=rows.length===expected&&rainMissing===0&&rows.length>0&&Date.parse(rows[0]!.validTime)===start+3600000&&Date.parse(rows.at(-1)!.validTime)===end;
    return {longitude:rows[0]!.longitude,latitude:rows[0]!.latitude,hours_present:rows.length,expected_hours:expected,
      expected_rainfall_mm:complete?Math.round(rain*100)/100:null,rainfall_coverage_complete:complete,
      maximum_hourly_mean_rain_mm:maxRain,maximum_median_temperature_c:maxTemperature,maximum_median_wind_mps:maxWindSpeed,
      longest_median_heat_exceedance_hours:maxHeat,longest_median_wind_exceedance_hours:maxWind};
  });
  return {from,to,policy_version:policy.version,points,method:'Hourly ensemble mean rainfall is summed only for complete contiguous windows. Heat and wind durations use median threshold exceedance; gaps break runs.',
    validation:'WEATHER_INDICATORS_ONLY',flood_impact_estimate:null,
    missing_inputs:['Local gauge and river levels','Catchment response, drainage and soil saturation','Validated exposure and flood-impact model'],
    limitation:'Adverse weather is not a calibrated local flood prediction. Spatial averaging and percentile accumulation are not inferred.'};
}
