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
 assert.deepEqual(full.thresholds,{heat_c:35,wind_mps:12,hourly_rain_mm:10});
 assert.equal(full.points[0]!.hours_with_mean_rain_at_or_above_threshold,0);
 const heavy=analyzeWeather([cell(1,12),cell(2,12)],policy,'2026-10-30T00:00:00Z','2026-10-30T02:00:00Z');
 assert.equal(heavy.points[0]!.expected_rainfall_mm,24);assert.equal(heavy.points[0]!.hours_with_mean_rain_at_or_above_threshold,2);
 const gap=analyzeWeather([cell(1),cell(3)],policy,'2026-10-30T00:00:00Z','2026-10-30T03:00:00Z');
 assert.equal(gap.points[0]!.expected_rainfall_mm,null);assert.equal(gap.points[0]!.longest_median_wind_exceedance_hours,1);
 const missing=analyzeWeather([cell(1,null),cell(2)],policy,'2026-10-30T00:00:00Z','2026-10-30T02:00:00Z');
 assert.equal(missing.points[0]!.expected_rainfall_mm,null);
 assert.throws(()=>analyzeWeather([cell(1),cell(1)],policy,'2026-10-30T00:00:00Z','2026-10-30T02:00:00Z'),/DUPLICATE/);
});
const snapshot:PlanningSnapshot={mission:{id:'mission',version:1,title:'Relief',status:'STAGED',capacity:2,assigned_count:0,required_skills:[],starts_at:'',ends_at:'',meeting_point:'Hall'},candidates:[{user_id:1,application_id:'a',application_version:1,eligible:true,missing_skills:[],skills:[],visible_commitments:0,scope_active:true,recent_shift_hours_7d:0,rest_hours_before_mission:null,fatigue_eligible:true},{user_id:2,application_id:'b',application_version:1,eligible:false,missing_skills:['first-aid'],skills:[],visible_commitments:0,scope_active:true,recent_shift_hours_7d:0,rest_hours_before_mission:null,fatigue_eligible:true}],resources:[{id:'stock',version:1,title:'Water',location:'Depot',unit:'pack',available:2}],limitations:[]};
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

test('harness records plan, notes and steps, and repairs a malformed reply',async()=>{
 let calls=0;
 const fetcher=(async()=>{calls++;
  if(calls===1)return response({role:'assistant',tool_calls:[
   {id:'p1',type:'function',function:{name:'update_plan',arguments:JSON.stringify({steps:[{title:'Read evidence',status:'in_progress'}]})}},
   {id:'e1',type:'function',function:{name:'read_evidence',arguments:'{}'}},
   {id:'n1',type:'function',function:{name:'record_note',arguments:JSON.stringify({note:'Source run-1 checked'})}},
  ]});
  if(calls===2)return response({role:'assistant',content:'{"wrong":true}'});
  return response({role:'assistant',content:'{"summary":"Evidence reviewed"}'});
 }) as typeof fetch;
 const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Plan',question:'Review',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),fetcher,key:'fixture',harness:{planFirst:true}});
 assert.equal(result.result.summary,'Evidence reviewed');
 assert.deepEqual(result.tool_calls,['read_evidence']);
 assert.equal(result.harness.plan[0]!.title,'Read evidence');
 assert.deepEqual(result.harness.notes,['Source run-1 checked']);
 assert.deepEqual(result.harness.steps.map(s=>s.tool),['update_plan','record_note','read_evidence']);
 assert.ok(result.harness.steps.every(s=>s.ok));
});
test('harness verifier sends an unsupported draft back for one revision',async()=>{
 let calls=0,verifyCalls=0;
 const fetcher=(async()=>response({role:'assistant',tool_calls:[] ,content:JSON.stringify({summary:calls++===0?'Draft one':'Draft two'})})) as typeof fetch;
 // First turn must call the evidence tool; emulate with a tool round then two drafts.
 let stage=0;
 const staged=(async()=>{stage++;
  if(stage===1)return response({role:'assistant',tool_calls:[{id:'e1',type:'function',function:{name:'read_evidence',arguments:'{}'}}]});
  return response({role:'assistant',content:JSON.stringify({summary:stage===2?'Unsupported draft':'Revised draft'})});
 }) as typeof fetch;
 void fetcher;
 const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Plan',question:'Review',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),fetcher:staged,key:'fixture',
  harness:{verify:(draft)=>{verifyCalls++;return draft.summary==='Unsupported draft'?['Claim is not in the evidence']:[];}}});
 assert.equal(result.result.summary,'Revised draft');
 assert.equal(verifyCalls,2);
});
test('identical evidence calls are deduplicated and tools in one round run in parallel',async()=>{
 let executions=0,active=0,maxConcurrent=0;
 const track=async()=>{executions++;active++;maxConcurrent=Math.max(maxConcurrent,active);await new Promise(r=>setTimeout(r,40));active--;return {source_id:'run-1'};};
 const slow={...tool,execute:track};
 const other={...tool,name:'read_other',execute:track};
 let calls=0;
 const fetcher=(async()=>{calls++;
  if(calls===1)return response({role:'assistant',tool_calls:[{id:'a',type:'function',function:{name:'read_evidence',arguments:'{}'}},{id:'b',type:'function',function:{name:'read_other',arguments:'{}'}}]});
  if(calls===2)return response({role:'assistant',tool_calls:[{id:'c',type:'function',function:{name:'read_evidence',arguments:'{}'}}]});
  return response({role:'assistant',content:'{"summary":"Done"}'});
 }) as typeof fetch;
 const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Plan',question:'Review',tools:[slow,other],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),fetcher,key:'fixture',harness:{}});
 assert.equal(result.result.summary,'Done');
 assert.equal(executions,2); // two distinct tools once each; the repeated read_evidence call was deduplicated
 assert.equal(maxConcurrent,2);
});
test('a timed-out model attempt is retried once instead of failing the turn',async()=>{
 let attempts=0;
 const fetcher=(async()=>{attempts++;
  if(attempts===1)throw new DOMException('timed out','TimeoutError');
  if(attempts===2)return response({role:'assistant',tool_calls:[{id:'e',type:'function',function:{name:'read_evidence',arguments:'{}'}}]});
  return response({role:'assistant',content:'{"summary":"Recovered"}'});
 }) as typeof fetch;
 const result=await runMetaAgent({model:'muse-wonder-1.0',instruction:'Analyze',question:'Review',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(10000),fetcher,key:'fixture'});
 assert.equal(result.result.summary,'Recovered');
 assert.equal(attempts,3);
});
test('streamed runs assemble tool calls and forward answer tokens as events',async()=>{
 const sse=(chunks:object[])=>new Response(new ReadableStream({start(controller){const encoder=new TextEncoder();for(const chunk of chunks)controller.enqueue(encoder.encode('data: '+JSON.stringify(chunk)+'\n\n'));controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}}),{status:200,headers:{'Content-Type':'text/event-stream'}});
 let calls=0;const tokens:string[]=[];const toolsSeen:string[]=[];
 const fetcher=(async()=>{calls++;
  if(calls===1)return sse([{choices:[{delta:{tool_calls:[{index:0,id:'e1',type:'function',function:{name:'read_evi',arguments:''}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{name:'dence',arguments:'{}'}}]}}]}]);
  return sse([{choices:[{delta:{content:'{"summary":"Stream'}}]},{choices:[{delta:{content:'ed answer"}'}}]}]);
 }) as typeof fetch;
 const result=await runMetaAgent({model:'muse-wonder-1.0',instruction:'Analyze',question:'Review',tools:[tool],requiredTools:['read_evidence'],output:answer,signal:AbortSignal.timeout(5000),fetcher,key:'fixture',stream:true,onEvent:event=>{if(event.type==='token')tokens.push(event.text);if(event.type==='tool_start')toolsSeen.push(event.tool);}});
 assert.equal(result.result.summary,'Streamed answer');
 assert.equal(tokens.join(''),'{"summary":"Streamed answer"}');
 assert.deepEqual(toolsSeen,['read_evidence']);
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

test('cancelled runs stop before another provider call or evidence tool',async()=>{
 const {withRunCheck,assertRunning}=await import('../src/modules/sentinel/run-lifecycle.js');let status='RUNNING',tools=0,calls=0;
 const fetcher=(async()=>{calls++;status='FAILED';return response({role:'assistant',tool_calls:[{id:'read',type:'function',function:{name:'read_evidence',arguments:'{}'}}]});}) as typeof fetch;
 await assert.rejects(withRunCheck(async()=>assertRunning(status),()=>runMetaAgent({model:'muse-spark-1.3',instruction:'Review',question:'Review',output:answer,signal:AbortSignal.timeout(5000),key:'fixture',fetcher,requiredTools:['read_evidence'],tools:[{...tool,execute:async()=>{tools++;return {};}}]})),{code:'CANCELLED_BY_COORDINATOR'});
 assert.equal(calls,1);assert.equal(tools,0);
});

test('follow-up lineage stays request-local and long questions remain valid',async()=>{
 const {withParentRun,currentParentRun,followUpContext}=await import('../src/modules/sentinel/run-lifecycle.js');
 const values=await Promise.all(['one','two'].map(id=>withParentRun(id,async()=>{await new Promise(r=>setTimeout(r,2));return currentParentRun();})));
 assert.deepEqual(values,['one','two']);assert.equal(currentParentRun(),undefined);
 const question='q'.repeat(2000);assert.equal(followUpContext('parent',question,'old','summary'),question);
 assert.match(followUpContext('parent','Next question','Earlier question','Earlier answer'),/Earlier answer/);
});

test('all citation-bearing assistant outputs reject invented source IDs',async()=>{
 let calls=0;
 const fetcher=(async()=>++calls===1?response({role:'assistant',tool_calls:[{id:'read',type:'function',function:{name:'read_evidence',arguments:'{}'}}]}):response({role:'assistant',content:JSON.stringify({summary:'Claim',source_ids:['invented']})})) as typeof fetch;
 await assert.rejects(runMetaAgent({model:'muse-spark-1.3',instruction:'Review',question:'Review',output:z.object({summary:z.string(),source_ids:z.array(z.string())}),signal:AbortSignal.timeout(5000),key:'fixture',fetcher,requiredTools:['read_evidence'],tools:[{...tool,execute:async()=>({id:'real-source'})}]}),/AGENT_UNSUPPORTED_ANSWER/);
 assert.equal(calls,3);
});
