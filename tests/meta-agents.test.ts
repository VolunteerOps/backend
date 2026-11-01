import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {runMetaAgent} from '../src/modules/sentinel/meta-agent.js';
import {analyzeWeather} from '../src/modules/sentinel/weather-analysis.js';
import {resourcePlanOutput,validateResourcePlan,type PlanningSnapshot} from '../src/modules/sentinel/planning-contract.js';
import type {ForecastCell,Distribution} from '../src/modules/sentinel/providers/weathernext3.contract.js';
const policy={version:1,heat_c:35,wind_mps:12,hourly_rain_mm:10,maximum_run_age_hours:8};
const distribution=(value:number|null):Distribution=>({mean:value,p10:value,p25:value,p50:value,p75:value,p90:value});
function cell(hour:number,rain:number|null=4):ForecastCell{return{longitude:36,latitude:-1,initTime:'2026-10-30T00:00:00Z',validTime:new Date(Date.parse('2026-10-30T00:00:00Z')+hour*3600000).toISOString(),leadHours:hour,values:{temperature_2m:distribution(36),wind_speed_10m:distribution(13),total_precipitation_1hr:distribution(rain)}};}
test('weather calculations use contiguous complete windows and break duration at gaps',()=>{
 const full=analyzeWeather([cell(1),cell(2),cell(3)],policy,'2026-10-30T00:00:00Z','2026-10-30T03:00:00Z');
 assert.equal(full.points[0]!.expected_rainfall_mm,12);assert.equal(full.points[0]!.longest_median_heat_exceedance_hours,3);assert.equal(full.flood_impact_estimate,null);
 const gap=analyzeWeather([cell(1),cell(3)],policy,'2026-10-30T00:00:00Z','2026-10-30T03:00:00Z');
 assert.equal(gap.points[0]!.expected_rainfall_mm,null);assert.equal(gap.points[0]!.longest_median_wind_exceedance_hours,1);
 const missing=analyzeWeather([cell(1,null),cell(2)],policy,'2026-10-30T00:00:00Z','2026-10-30T02:00:00Z');
 assert.equal(missing.points[0]!.expected_rainfall_mm,null);
 assert.throws(()=>analyzeWeather([cell(1),cell(1)],policy,'2026-10-30T00:00:00Z','2026-10-30T02:00:00Z'),/DUPLICATE/);
});
const snapshot:PlanningSnapshot={mission:{id:'mission',version:1,title:'Relief',status:'STAGED',capacity:2,assigned_count:0,required_skills:[],starts_at:'',ends_at:'',meeting_point:'Hall'},candidates:[{user_id:1,application_id:'a',application_version:1,eligible:true,missing_skills:[],visible_commitments:0,scope_active:true},{user_id:2,application_id:'b',application_version:1,eligible:false,missing_skills:['first-aid'],visible_commitments:0,scope_active:true}],resources:[{id:'stock',version:1,title:'Water',location:'Depot',unit:'pack',available:2}],limitations:[]};
test('resource proposals reject invented or ineligible responders, stock excess and duplicate assignments',()=>{
 const row={user_id:1,reason:'Eligible',supplies:[{resource_id:'stock',quantity:2,reason:'Supplies'}]};
 const plan={summary:'Proposal',allocations:[row],shortages:[],decisions:[]};
 assert.equal(validateResourcePlan(plan,snapshot),plan);
 for(const allocations of [[{...row,user_id:2}],[{...row,user_id:99}],[row,row],[{...row,supplies:[{resource_id:'stock',quantity:3,reason:'Too many'}]}]])assert.throws(()=>validateResourcePlan({...plan,allocations},snapshot));
});
const answer=z.object({summary:z.string()}).strict();
const tool={name:'read_evidence',description:'Scoped evidence',arguments:z.object({}).strict(),execute:async()=>({source_id:'run-1'})};
const response=(message:unknown)=>new Response(JSON.stringify({choices:[{message}]}),{status:200,headers:{'content-type':'application/json'}});
test('Meta agent rejects answers without evidence and unregistered tools',async()=>{
 const base={model:'muse-wonder-1.0' as const,instruction:'Analyze evidence',question:'What changed?',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),key:'fixture'};
 await assert.rejects(runMetaAgent({...base,fetcher:(async()=>response({role:'assistant',content:'{"summary":"invented"}'})) as typeof fetch}),/EVIDENCE_REQUIRED/);
 await assert.rejects(runMetaAgent({...base,fetcher:(async()=>response({role:'assistant',tool_calls:[{id:'a',type:'function',function:{name:'execute_sql',arguments:'{}'}}]})) as typeof fetch}),/TOOL_NOT_ALLOWED/);
});
test('Meta agent uses exact provider model and binds tool results to the matching call',async()=>{
 let calls=0;const requests:Record<string,any>[]=[];
 const fetcher=(async(url:unknown,init:RequestInit)=>{
  assert.equal(url,'https://api.meta.ai/v1/chat/completions');requests.push(JSON.parse(String(init.body)));
  return calls++===0?response({role:'assistant',tool_calls:[{id:'evidence-1',type:'function',function:{name:'read_evidence',arguments:'{}'}}]}):response({role:'assistant',content:'{"summary":"Evidence reviewed"}'});
 }) as typeof fetch;
 const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Plan',question:'Review this',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),fetcher,key:'fixture'});
 assert.equal(result.result.summary,'Evidence reviewed');assert.equal(requests[0]!.model,'muse-spark-1.3');
 assert.equal(requests[1]!.messages[3].tool_call_id,'evidence-1');
 assert.equal(requests[0]!.tool_choice,'auto');
});

test('Meta production proposal schema uses numeric JSON Schema bounds',async()=>{
 const plan={summary:'No allocation',allocations:[],shortages:[],decisions:[]};
 await runMetaAgent({model:'muse-spark-1.3',instruction:'Review',question:'Review',tools:[],requiredTools:[],output:resourcePlanOutput,signal:AbortSignal.timeout(5000),key:'fixture',fetcher:(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));
  const id=body.response_format.json_schema.schema.properties.allocations.items.properties.user_id;
  assert.equal(id.exclusiveMinimum,0);
  assert.equal(typeof id.exclusiveMinimum,'number');
  return response({role:'assistant',content:JSON.stringify(plan)});
 }) as typeof fetch});
});

test('linked weather planning can consume all five required tools in one bounded provider turn',async()=>{
 const names=['read_mission','read_candidates','read_stock','read_commitments','read_weather_assessment'];
 const executed:string[]=[];let calls=0;
 const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Plan',question:'Review',requiredTools:names,
  tools:names.map(name=>({...tool,name,execute:async()=>{executed.push(name);return {source:'fixture'};}})),
  output:answer,signal:AbortSignal.timeout(5000),key:'fixture',fetcher:(async(_url,init)=>{
   const request=JSON.parse(String(init?.body));
   for(const name of names)assert.ok(request.messages[0].content.includes(name));
   return calls++===0?response({role:'assistant',tool_calls:names.map((name,i)=>({id:'call-'+i,type:'function',function:{name,arguments:'{}'}}))}):response({role:'assistant',content:'{"summary":"All evidence reviewed"}'});
  }) as typeof fetch});
 assert.deepEqual(executed,names);assert.deepEqual(result.tool_calls,names);
});
