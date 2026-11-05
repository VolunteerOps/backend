import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {runMetaAgent} from '../src/modules/sentinel/meta-agent.js';
import {runWeatherExplanation} from '../src/modules/sentinel/weather-explanation.js';
import {describeAgentFailure} from '../src/modules/sentinel/agent-failure.js';
const response=(message:any)=>Response.json({choices:[{message:{role:'assistant',...message}}]});
const call=(name:string,id=name,args={})=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer=(source_ids:string[]=[])=>({summary:'No weather data was retrieved. These are general checks, not a forecast.',preparedness:['Check local reports and drainage.'],assumptions:[],missing_inputs:['WeatherNext access'],source_ids,follow_up:''});
const base={instruction:'Test only',question:'Compare the previous three days with the next week.',signal:AbortSignal.timeout(5000),key:'fixture'};
test('a provider returning JSON to a streaming request is still decoded',async()=>{
 const result=await runWeatherExplanation({...base,stream:true,signal:AbortSignal.timeout(5000),tools:[],requiredTools:[],sourceIds:()=>[],fetcher:(async()=>response({content:JSON.stringify(answer())})) as typeof fetch});
 assert.equal(result.result.summary,answer().summary);
});
test('an empty final answer gets one bounded repair without rerunning evidence',async()=>{
 let turns=0,reads=0;
 const result=await runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),sourceIds:()=>[],requiredTools:['read'],tools:[{name:'read',description:'Read',arguments:z.object({}),execute:async()=>{reads++;return {available:false};}}],fetcher:(async()=>{turns++;return turns===1?response({tool_calls:[call('read')]}):response({content:turns===2?null:JSON.stringify(answer())});}) as typeof fetch});
 assert.equal(reads,1);assert.equal(turns,3);assert.equal(result.result.summary,answer().summary);
});
test('repeated empty answers stop after the bounded repair',async()=>{
 let turns=0;
 await assert.rejects(runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),sourceIds:()=>[],requiredTools:[],tools:[],fetcher:(async()=>{turns++;return response({content:null});}) as typeof fetch}),/AGENT_OUTPUT_REQUIRED/);
 assert.equal(turns,2);
});
test('weather gathers required evidence then removes tools and finishes even when sources are unavailable',async()=>{
 const requests:any[]=[];let executions=0;
 const tools=['analyze_weather_window','read_local_reports'].map(name=>({name,description:'Read evidence',arguments:z.object({}).strict(),execute:async()=>{executions++;return {status:'UNAVAILABLE',code:'WEATHER_ACCESS_DENIED'};}}));
 const result=await runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),tools,requiredTools:tools.map(t=>t.name),sourceIds:()=>[],fetcher:(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));requests.push(body);
  if(requests.length===1){assert.deepEqual(body.tools.map((t:any)=>t.function.name),tools.map(t=>t.name));return response({tool_calls:tools.map(t=>call(t.name))});}
  assert.equal(body.tools,undefined);assert.equal(body.tool_choice,undefined);
  assert.match(body.messages.at(-1).content,/final structured answer/);
  return response({content:JSON.stringify(answer())});
 }) as typeof fetch});
 assert.equal(executions,2);assert.equal(result.harness.rounds,2);assert.equal(result.result.source_ids.length,0);
});
test('weather rejects fabricated citations even when the revised answer repeats them',async()=>{
 let turns=0;
 await assert.rejects(runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),tools:[],requiredTools:[],sourceIds:()=>['real-source'],fetcher:(async()=>{turns++;return response({content:JSON.stringify(answer(['invented-source']))});}) as typeof fetch}), (error:any)=>{
  const failure=describeAgentFailure(error);assert.equal(failure.error_code,'AGENT_UNSUPPORTED_ANSWER');assert.equal(failure.model,'muse-wonder-1.0');assert.equal(failure.diagnostic.rounds,2);return true;
 });assert.equal(turns,2);
});
test('weather can repair malformed output and then repair an unsupported citation without re-querying evidence',async()=>{
 let turn=0,executions=0;
 const result=await runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),tools:[{name:'read',description:'Read',arguments:z.object({}).strict(),execute:async()=>{executions++;return {source_id:'real-source'};}}],requiredTools:['read'],sourceIds:()=>['real-source'],fetcher:(async()=>{
  turn++;return turn===1?response({tool_calls:[call('read')]}):response({content:turn===2?'not json':JSON.stringify(answer(turn===3?['invented-source']:['real-source']))});
 }) as typeof fetch});
 assert.deepEqual(result.result.source_ids,['real-source']);assert.equal(executions,1);assert.equal(turn,4);
});
test('generic harness reserves final answer rounds rather than spending every round on bookkeeping',async()=>{
 let turns=0;const requests:any[]=[];
 const result=await runMetaAgent({...base,signal:AbortSignal.timeout(5000),model:'muse-spark-1.3',tools:[],requiredTools:[],output:z.object({summary:z.string()}),harness:{},fetcher:(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));requests.push(body);turns++;
  return body.tools?response({tool_calls:[call('record_note','note-'+turns,{note:'Preparing response'})]}):response({content:'{"summary":"Finished"}'});
 }) as typeof fetch});
 assert.equal(turns,7);assert.equal(requests.at(-1).tools,undefined);assert.equal(result.result.summary,'Finished');
});
test('parallel tools cannot exceed the budget or repeat the same costly query in one response',async()=>{
 let executions=0,turn=0;const tool={name:'read',description:'Read',arguments:z.object({}).strict(),execute:async()=>{executions++;await new Promise(r=>setTimeout(r,5));return {};}};
 const options={...base,model:'muse-wonder-1.0' as const,tools:[tool],requiredTools:['read'],output:z.object({summary:z.string()}),harness:{maxToolCalls:1}};
 await assert.rejects(runMetaAgent({...options,signal:AbortSignal.timeout(5000),fetcher:(async()=>response({tool_calls:[call('read','one'),call('read','two')]})) as typeof fetch}),/AGENT_TOOL_BUDGET/);assert.equal(executions,0);
 await runMetaAgent({...options,signal:AbortSignal.timeout(5000),harness:{},fetcher:(async()=>++turn===1?response({tool_calls:[call('read','one'),call('read','two')]}):response({content:'{"summary":"Done"}'})) as typeof fetch});assert.equal(executions,1);
});
test('failure diagnostics retain model and progress but exclude raw exception text',async()=>{
 const privateText='database credentials and private provider detail';
 try {await runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),tools:[{name:'read',description:'Read',arguments:z.object({}).strict(),execute:async()=>{throw Error(privateText);}}],requiredTools:['read'],sourceIds:()=>[],fetcher:(async()=>response({tool_calls:[call('read')]})) as typeof fetch});assert.fail('must fail');}
 catch(error){const failure=describeAgentFailure(error);assert.equal(failure.model,'muse-wonder-1.0');assert.equal(failure.harness?.steps[0]?.ok,false);assert.ok(!JSON.stringify(failure).includes(privateText));}
});

test('explicit provider refusals are not retried or mislabeled as a connection failure',async()=>{
 for(const variant of ['http','message','stream']){
  let calls=0;
  await assert.rejects(runWeatherExplanation({...base,signal:AbortSignal.timeout(5000),stream:variant==='stream',tools:[],requiredTools:[],sourceIds:()=>[],fetcher:(async()=>{
   calls++;
   if(variant==='http')return Response.json({error:{code:'content_policy_violation',message:'private input'}},{status:400});
   if(variant==='message')return response({content:null,refusal:'private input'});
   return new Response('data: '+JSON.stringify({choices:[{delta:{refusal:'private input'},finish_reason:'content_filter'}]})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }) as typeof fetch}), (error:any)=>{assert.equal(error.code,'AGENT_REQUEST_DECLINED');assert.ok(!JSON.stringify(describeAgentFailure(error)).includes('private input'));return true;});
  assert.equal(calls,1);
 }
});
