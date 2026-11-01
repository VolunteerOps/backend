import {ApiError} from '../../../core/errors.js';
import {createHash} from 'node:crypto';
import type {BigQuery,Query,Job} from '@google-cloud/bigquery';

export function weatherQueryError(error:unknown):unknown {
 const reasons=(error as {errors?:Array<{reason?:string}>}|null)?.errors;
 if(reasons?.some(item=>item.reason==='bytesBilledLimitExceeded'))return new ApiError(422,'FORECAST_QUERY_BUDGET_EXCEEDED','This forecast query exceeds the configured billing limit. An operator must review query cost before trying again.');
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
  return client.job(jobId,{location:query.location});
 }
}
