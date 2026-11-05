import type { Distribution, ForecastCell, ForecastVariable } from './providers/weathernext3.contract.js';

/** Bounds on P(X > threshold) from published quantiles, without interpolating a
 * distribution or pretending hourly quantiles describe total multi-day rain. */
export function exceedanceRange(distribution: Distribution, threshold: number): {lower:number;upper:number}|null {
  if(!Number.isFinite(threshold))return null;
  const knots=[['p10',0.1],['p25',0.25],['p50',0.5],['p75',0.75],['p90',0.9]] as const;
  let previous=-Infinity,lower=0,upper=1;
  for(const [stat,p] of knots){
    const value=distribution[stat];
    if(value===null||!Number.isFinite(value)||value<previous)return null;
    previous=value;
    if(value>threshold)lower=Math.max(lower,1-p);
    else upper=Math.min(upper,1-p);
  }
  return {lower:Math.round(lower*100)/100,upper:Math.round(upper*100)/100};
}

export function weatherProbabilities(cells:ForecastCell[],policy:{heat_c:number;wind_mps:number;hourly_rain_mm:number},now=Date.now()){
  const events:Array<{variable:ForecastVariable;threshold:number;unit:string;event:string}>=[
    {variable:'temperature_2m',threshold:policy.heat_c,unit:'°C',event:'Temperature above the heat threshold'},
    {variable:'wind_speed_10m',threshold:policy.wind_mps,unit:'m/s',event:'Wind speed above the wind threshold'},
    {variable:'total_precipitation_1hr',threshold:policy.hourly_rain_mm,unit:'mm in one hour',event:'Hourly rainfall above the heavy-rain threshold'},
  ];
  const estimates=cells.flatMap(cell=>{
    if(![cell.longitude,cell.latitude,Date.parse(cell.validTime),Date.parse(cell.initTime)].every(Number.isFinite)||Math.abs(cell.longitude)>180||Math.abs(cell.latitude)>90||Date.parse(cell.initTime)>now||Date.parse(cell.validTime)<=now||Date.parse(cell.validTime)<=Date.parse(cell.initTime))return [];
    return events.flatMap(event=>{
      const range=exceedanceRange(cell.values[event.variable],event.threshold);
      if(!range||range.upper<=0.1)return [];
      return [{...event,...range,longitude:cell.longitude,latitude:cell.latitude,validAt:cell.validTime,forecastInit:cell.initTime,
        source:'WEATHERNEXT3',method:'PUBLISHED_QUANTILE_BOUNDS',validation:'EXPERIMENTAL_UNCALIBRATED',
        interpretation:'Estimated probability range within this forecast model at this grid cell and forecast time. Not the probability of damage, flooding or another disaster.'}];
    });
  }).sort((a,b)=>b.lower-a.lower||b.upper-a.upper||Date.parse(a.validAt)-Date.parse(b.validAt));
  return {estimates:estimates.slice(0,24),total:estimates.length,truncated:estimates.length>24,
    selection:'Up to 24 largest threshold-exceedance ranges at sampled grid cells and forecast times; not a regional or daily probability.',
    unavailableReason:estimates.length?null:'No current, complete percentile data with an exceedance range above 10% is available. This does not establish zero risk.'};
}
