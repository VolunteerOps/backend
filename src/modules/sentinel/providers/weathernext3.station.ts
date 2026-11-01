import {createOrResumeWeatherQuery,weatherQueryError} from './weather-query-job.js';
import {BigQuery} from '@google-cloud/bigquery';
import {z} from 'zod';
import {buildForecastQuery,type WeatherNextConfig,type ForecastRequest} from './weathernext3.bigquery.js';
import {statistics,gridCellIntersectsBounds} from './weathernext3.contract.js';

export const stationVariables=['station_head_temperature_2m','station_head_dewpoint_temperature_2m'] as const;
const timestamp=(v:unknown)=>{
 const raw=typeof v==='object'&&v!==null&&'value' in v?(v as {value:unknown}).value:v;
 const value=z.string().datetime({offset:true}).parse(raw);
 return new Date(value).toISOString();
};
const number=z.number().finite();
export function normalizeStationRow(row:Record<string,unknown>,request:ForecastRequest){
 const init=z.string().datetime().parse(timestamp(row.init_time));
 const valid=z.string().datetime().parse(timestamp(row.valid_time));
 const lead=z.number().int().parse(row.lead_hours);
 const latitude=number.min(-90).max(90).parse(row.latitude),longitude=number.min(-180).max(180).parse(row.longitude);
 if(Date.parse(init)!==Date.parse(request.initTime)||Date.parse(valid)-Date.parse(init)!==lead*3600000||lead<request.fromHour||lead>request.toHour)throw new Error('STATION_WINDOW_MISMATCH');
 const b=request.bounds;
 if(!gridCellIntersectsBounds(longitude,latitude,b,0.05))throw new Error('STATION_SCOPE_MISMATCH');
 const values=Object.fromEntries(stationVariables.map(variable=>{
  const values=Object.fromEntries(statistics.map(stat=>{
   const raw=row[variable+'_'+stat];
   return [stat,raw===null?null:number.min(150).max(350).parse(raw)-273.15];
  }));
  const quantiles=statistics.filter(s=>s!=='mean').map(s=>values[s]).filter((v):v is number=>v!==null);
  if(quantiles.some((v,i)=>i>0&&v<quantiles[i-1]!))throw new Error('STATION_QUANTILES_UNORDERED');
  return[variable,values];
 }));
 return{latitude,longitude,valid_time:valid,lead_hours:lead,values};
}
export function buildStationQuery(config:WeatherNextConfig,request:ForecastRequest){
 // The existing builder supplies the same partition, GIS, horizon, cost and row bounds.
 const base=buildForecastQuery(config,request);
 const from=base.query.indexOf('FROM `');
 if(from<0)throw new Error('INVALID_QUERY_TEMPLATE');
 return {...base,query:`SELECT t.init_time, f.time AS valid_time, f.hours AS lead_hours,
 ST_X(t.geography) AS longitude, ST_Y(t.geography) AS latitude,
 ${stationVariables.flatMap(v=>statistics.map(s=>'f.'+v+'_'+s)).join(', ')}
 ${base.query.slice(from).replace('.weathernext_3_0_0_0p1deg`','.weathernext_3_0_0_0p05deg`')}`};
}
export class WeatherNextStationBigQuery {
 private client:BigQuery;
 constructor(private config:WeatherNextConfig,client?:BigQuery){this.client=client??new BigQuery({projectId:config.billingProjectId??config.projectId,maxRetries:2});}
 async fetch(request:ForecastRequest,signal:AbortSignal){
  signal.throwIfAborted();
  const job=await createOrResumeWeatherQuery(this.client,buildStationQuery(this.config,request),this.config.billingProjectId??this.config.projectId);
  const cancel=()=>{void job.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{
   signal.throwIfAborted();
   const [rows,next]=await job.getQueryResults({autoPaginate:false,maxResults:this.config.maxRows+1,timeoutMs:20000});
   signal.throwIfAborted();
   if(next||rows.length>this.config.maxRows)throw new Error('STATION_RESULT_REQUIRES_TILING');
   if(!rows.length)throw new Error('STATION_RUN_UNAVAILABLE');
   const cells=rows.map(row=>normalizeStationRow(row,request));
   if(new Set(cells.map(c=>JSON.stringify([c.longitude,c.latitude,c.valid_time]))).size!==cells.length)throw new Error('DUPLICATE_STATION_CELL');
   return{source:'WEATHERNEXT_3',table:'weathernext_3_0_0_0p05deg',source_id:job.id!,resolution_degrees:0.05,init_time:request.initTime,retrieved_at:new Date().toISOString(),unit:'Celsius',cells,
    limitation:'Station-head temperature and dew point only. This table does not provide rainfall, wind, flood depth or local impact estimates.'};
  }catch(error){cancel();throw weatherQueryError(error); }finally{signal.removeEventListener('abort',cancel);}
 }
}
