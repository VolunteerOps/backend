import {ApiError} from '../../../core/errors.js';
import {createHash} from 'node:crypto';
import type {BigQuery,Query,Job} from '@google-cloud/bigquery';

export function weatherQueryError(error:unknown):unknown {
 const reasons=(error as {errors?:Array<{reason?:string}>}|null)?.errors;
 if(reasons?.some(item=>item.reason==='bytesBilledLimitExceeded'))return new ApiError(422,'FORECAST_QUERY_BUDGET_EXCEEDED','This forecast query exceeds the configured billing limit. An operator must review query cost before trying again.');
 if(reasons?.some(item=>['billingNotEnabled','quotaExceeded'].includes(item.reason||'')))return new ApiError(503,'WEATHER_BILLING_REQUIRED','Weather billing or usage needs administrator review.');
 if((error as {code?:number})?.code===403||reasons?.some(item=>item.reason==='accessDenied'))return new ApiError(503,'WEATHER_ACCESS_DENIED','Weather data access needs administrator review.');
 if(error instanceof Error&&['FORECAST_RUN_UNAVAILABLE','FORECAST_RESULT_REQUIRES_TILING','FORECAST_REGION_REQUIRES_TILING'].includes(error.message))return new ApiError(422,error.message,error.message);
 return error;
}

/** Stable provider job identity survives request/worker crashes; retries cannot create a second paid scan. */
export function weatherQueryJobId(query:Query,projectId:string){
 return 'resq_weather_v1_'+createHash('sha256').update(JSON.stringify({projectId,query:query.query,params:query.params,location:query.location,maximumBytesBilled:query.maximumBytesBilled})).digest('hex');
}
export async function createOrResumeWeatherQuery(client:BigQuery,query:Query,projectId:string):Promise<Job>{
 const jobId=weatherQueryJobId(query,projectId);
 try {const [job]=await client.createQueryJob({...query,jobId});return job;}
 catch(error){
  if((error as {code?:number}).code!==409)throw weatherQueryError(error);
  // The ID hashes only server-built SQL, parameters, project and budget. It is never supplied by a caller.
  const existing=client.job(jobId,{location:query.location});
  if(typeof existing.getMetadata!=='function')return existing;
  const [meta]=await existing.getMetadata();
  const recoverable=['accessDenied','quotaExceeded','billingNotEnabled','rateLimitExceeded','backendError','internalError'];
  if(meta.status?.state!=='DONE'||!recoverable.includes(meta.status?.errorResult?.reason||''))return existing;
  // Never repeat a running or successful scan. After provider setup is repaired,
  // a new user request may retry a failed job, at most once per five-minute slot.
  const retryId=jobId+'_recovery_'+Math.floor(Date.now()/300000);
  try{const [retry]=await client.createQueryJob({...query,jobId:retryId});return retry;}
  catch(retryError){if((retryError as {code?:number}).code===409)return client.job(retryId,{location:query.location});throw weatherQueryError(retryError);}
 }
}
