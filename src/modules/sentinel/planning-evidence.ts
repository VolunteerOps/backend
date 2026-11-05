import {ApiError} from '../../core/errors.js';
import {forecastPolicySchema} from './forecast-assessment.js';
import {boundsSchema} from './providers/weathernext3.contract.js';

/** A linked assessment is evidence for human review, never deployment authority. */
export function assessmentEvidence(row:{id:string;version:number;payload:unknown},region:{forecastPolicy:unknown;forecastBounds:unknown},now=Date.now(),historical=false) {
 const p=row.payload as Record<string,any>;
 const policy=forecastPolicySchema.parse(region.forecastPolicy);
 const bounds=boundsSchema.parse(region.forecastBounds);
 const source=p.source as Record<string,any>|undefined;
 if(p.status!=='DRAFT'||!source||!p.evidence?.points?.length)throw ApiError.conflict('Choose a completed assessment with forecast evidence','ASSESSMENT_UNAVAILABLE');
 const issued=Date.parse(source.init_time);
 if(!Number.isFinite(issued)||issued>now||(!historical&&now-issued>=policy.maximum_run_age_hours*3600000))throw ApiError.conflict('The linked forecast is stale. Run a new assessment','ASSESSMENT_STALE');
 if(!historical&&(p.evidence.policy_version!==policy.version||!source.bounds||Object.entries(bounds).some(([key,value])=>source.bounds[key]!==value)))throw ApiError.conflict('Regional policy or boundaries changed. Run a new assessment','ASSESSMENT_POLICY_CHANGED');
 const points=p.evidence.points as Array<Record<string,any>>;
 const peak=(field:string)=>points.reduce<number|null>((best,point)=>typeof point[field]==='number'&&Number.isFinite(point[field])?(best===null?point[field]:Math.max(best,point[field])):best,null);
 return {assessment_id:row.id,assessment_version:row.version,source,policy_version:p.evidence.policy_version,historical,
  thresholds:p.evidence.thresholds??(historical?null:{heat_c:policy.heat_c,wind_mps:policy.wind_mps,hourly_rain_mm:policy.hourly_rain_mm}),
  indicators:{maximum_expected_rainfall_mm:peak('expected_rainfall_mm'),maximum_hourly_mean_rain_mm:peak('maximum_hourly_mean_rain_mm'),
   most_hours_with_mean_rain_at_or_above_threshold:peak('hours_with_mean_rain_at_or_above_threshold'),
   longest_median_heat_exceedance_hours:peak('longest_median_heat_exceedance_hours'),longest_median_wind_exceedance_hours:peak('longest_median_wind_exceedance_hours')},
  summary:p.narrative?.summary??'',preparedness:p.narrative?.preparedness??[],missing_inputs:p.narrative?.missing_inputs??[],
  window:{from:p.evidence.from,to:p.evidence.to},validation:p.validation,flood_impact_estimate:null};
}
