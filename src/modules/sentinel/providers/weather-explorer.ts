import {BigQuery} from '@google-cloud/bigquery';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {ApiError} from '../../../core/errors.js';
import {configuredForecastSettings} from '../sentinel.service.js';
import {WeatherNext3BigQuery,type ForecastBatch} from './weathernext3.bigquery.js';
import {normalizeForecastRow,boundsWkt,type Bounds} from './weathernext3.contract.js';
import {createOrResumeWeatherQuery} from './weather-query-job.js';
const stamped=(v:any)=>new Date(v?.value||v).toISOString();
export function sourceFailure(e:any){
 const text=String(e?.message||e);const reasons=e?.errors?.map((r:any)=>r.reason)||[];
 const code=e?.code==='FORECAST_QUERY_BUDGET_EXCEEDED'||reasons.includes('bytesBilledLimitExceeded')?'FORECAST_QUERY_BUDGET_EXCEEDED':reasons.includes('quotaExceeded')?'WEATHER_BILLING_REQUIRED':e?.code===403||/403|forbidden|permission|access[ _]denied/i.test(text)?'WEATHER_ACCESS_DENIED':/BUDGET/.test(text)?'WEATHER_READ_BUDGET':e?.code||(/NOT_CONFIGURED/.test(text)?'WEATHERNEXT_NOT_CONFIGURED':'WEATHER_SOURCE_UNAVAILABLE');
 return {status:'UNAVAILABLE',code,limitation:'No evidence was retrieved from this source; do not infer safe conditions.'};
}
export async function exploreBigQuery(from:string,to:string,bounds:Bounds,signal:AbortSignal,share=1):Promise<ForecastBatch>{
 const cfg=configuredForecastSettings();// Per-query ceiling is configured by the workspace operator; each turn still has a finite query count.
 const client=new BigQuery({projectId:cfg.billingProjectId||cfg.projectId,maxRetries:1});
 const anchor=new Date(Math.floor(Math.min(Date.parse(from),Date.now())/(6*3600000))*6*3600000);
 const query={query:`SELECT MAX(t.init_time) AS init_time FROM \`${cfg.projectId}.${cfg.datasetId}.weathernext_3_0_0_0p1deg\` t WHERE t.init_time BETWEEN @oldest AND @latest AND MOD(EXTRACT(HOUR FROM t.init_time),6)=0 AND ST_INTERSECTS(t.geography_polygon,ST_GEOGFROMTEXT(@region))`,params:{oldest:new Date(anchor.getTime()-30*3600000),latest:anchor,region:boundsWkt(bounds)},maximumBytesBilled:String(cfg.maximumBytesBilled),location:cfg.location,useLegacySql:false,jobTimeoutMs:30000};
 const job=await createOrResumeWeatherQuery(client,query,cfg.billingProjectId||cfg.projectId);
 const cancel=()=>{void job.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{signal.throwIfAborted();const [rows]=await job.getQueryResults({maxResults:1,autoPaginate:false,timeoutMs:20000});signal.throwIfAborted();if(!rows[0]?.init_time)throw Error('FORECAST_RUN_UNAVAILABLE');
 const initTime=stamped(rows[0].init_time);return new WeatherNext3BigQuery(cfg).fetch({initTime,fromHour:(Date.parse(from)-Date.parse(initTime))/3600000+1,toHour:(Date.parse(to)-Date.parse(initTime))/3600000,bounds},signal);
 }finally{signal.removeEventListener('abort',cancel);}
}
let gcsRunning=0;
export async function exploreGcs(from:string,to:string,bounds:Bounds,signal:AbortSignal,share=1):Promise<ForecastBatch & {bytes_read:number}>{
 if(process.env.WEATHERNEXT_GCS_ACCESS_ENABLED!=='true')throw new ApiError(503,'GCS_NOT_CONFIGURED','Cloud Storage weather access has not been enabled for this service.');
 if(gcsRunning>=2)throw new ApiError(429,'WEATHER_BUSY','Weather analysis is busy. Try again shortly.');
 const maxBytes=Math.min(1000000000,Number(process.env.WEATHERNEXT_GCS_MAX_BYTES||1000000000));if(!Number.isFinite(maxBytes)||maxBytes<1)throw Error('GCS_NOT_CONFIGURED');
 gcsRunning++;
 try{return await new Promise((resolvePromise,reject)=>{
 const child=spawn(process.env.WEATHERNEXT_PYTHON||'python3',[resolve('scripts/weather-zarr.py')],{stdio:['pipe','pipe','pipe'],windowsHide:true,signal});let output='';let stderr='';
 child.stdout.on('data',v=>{output+=v;if(output.length>12000000){child.kill();reject(Error('WEATHER_RESULT_BUDGET'));}});
 child.stderr.on('data',v=>{if(stderr.length<4000)stderr+=v;});child.on('error',reject);
 child.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)throw Error(result.error||'GCS_READ_FAILED');
 const cells=result.rows.map((row:any)=>normalizeForecastRow(row,result.init_time,bounds,0.1));
 resolvePromise({source:'WEATHERNEXT_3',model:'weathernext_3_0_0',surface:'GCS' as any,resolutionDegrees:0.1,initTime:result.init_time,retrievedAt:new Date().toISOString(),cells,jobId:result.source_id,bytes_read:result.bytes_read});
 }catch(e){reject(e);}});
 child.stdin.end(JSON.stringify({from,to,bounds,max_bytes:Math.floor(maxBytes/share),max_rows:10000}));
 });}finally{gcsRunning--;}
}
