import {ApiError} from '../../core/errors.js';
import {forecastPolicySchema} from './forecast-assessment.js';
import {boundsSchema} from './providers/weathernext3.contract.js';

/** A linked assessment is evidence for human review, never deployment authority. */
export function assessmentEvidence(row:{id:string;version:number;payload:unknown},region:{forecastPolicy:unknown;forecastBounds:unknown},now=Date.now()) {
 const p=row.payload as Record<string,any>;
 const policy=forecastPolicySchema.parse(region.forecastPolicy);
 const bounds=boundsSchema.parse(region.forecastBounds);
 const source=p.source as Record<string,any>|undefined;
 if(p.status!=='DRAFT'||!source||!p.evidence?.points?.length)throw ApiError.conflict('Choose a completed assessment with forecast evidence','ASSESSMENT_UNAVAILABLE');
 const issued=Date.parse(source.init_time);
 if(!Number.isFinite(issued)||issued>now||now-issued>=policy.maximum_run_age_hours*3600000)throw ApiError.conflict('The linked forecast is stale. Run a new assessment','ASSESSMENT_STALE');
 if(p.evidence.policy_version!==policy.version||!source.bounds||Object.entries(bounds).some(([key,value])=>source.bounds[key]!==value))throw ApiError.conflict('Regional policy or boundaries changed. Run a new assessment','ASSESSMENT_POLICY_CHANGED');
 return {assessment_id:row.id,assessment_version:row.version,source,policy_version:policy.version,
  summary:p.narrative?.summary??'',preparedness:p.narrative?.preparedness??[],missing_inputs:p.narrative?.missing_inputs??[],
  window:{from:p.evidence.from,to:p.evidence.to},validation:p.validation,flood_impact_estimate:null};
}
