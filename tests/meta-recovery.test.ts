import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {runMetaAgent} from '../src/modules/sentinel/meta-agent.js';
const missing=()=>new Response(JSON.stringify({error:{code:'model_not_found',message:'private provider detail'}}),{status:404});
const success=()=>new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'{"reply":"Ready"}'}}]}),{status:200});
const base={model:'muse-spark-1.3' as const,instruction:'Test',question:'Test',tools:[],requiredTools:[],output:z.object({reply:z.string()}).strict(),key:'private-fixture-key'};
test('transient model-not-found retries the identical model and payload on a fresh connection',async()=>{
 const requests:RequestInit[]=[];
 const result=await runMetaAgent({...base,signal:AbortSignal.timeout(5000),fetcher:(async(_url,init)=>{requests.push(init!);return requests.length===1?missing():success();}) as typeof fetch});
 assert.equal(result.result.reply,'Ready');assert.equal(requests.length,2);assert.equal(requests[0]!.body,requests[1]!.body);assert.equal(JSON.parse(String(requests[1]!.body)).model,'muse-spark-1.3');assert.equal((requests[1]!.headers as any).Connection,'close');
});
test('persistent model unavailability stops after three retries without changing provider or model',async()=>{
 let calls=0;
 await assert.rejects(runMetaAgent({...base,signal:AbortSignal.timeout(8000),fetcher:(async()=>{calls++;return missing();}) as typeof fetch}),(error:any)=>error.code==='MODEL_UNAVAILABLE'&&error.statusCode===503&&!error.message.includes('private provider'));
 assert.equal(calls,4);
});
test('credential failures and unrelated 404 errors are not retried or exposed',async()=>{
 for(const status of [401,403,404,400]){
  let calls=0;await assert.rejects(runMetaAgent({...base,signal:AbortSignal.timeout(1000),fetcher:(async()=>{calls++;return new Response(JSON.stringify({error:{code:'other',message:'private key or query'}}),{status});}) as typeof fetch}),(error:any)=>error.code===([401,403].includes(status)?'META_ACCESS_DENIED':'AGENT_UNAVAILABLE')&&!error.message.includes('private key'));
  assert.equal(calls,1);
 }
});
test('abort interrupts retry delay without making another provider call',async()=>{
 let calls=0;await assert.rejects(runMetaAgent({...base,signal:AbortSignal.timeout(30),fetcher:(async()=>{calls++;return missing();}) as typeof fetch}),(error:any)=>error.name==='AbortError');assert.equal(calls,1);
});
test('a retry after a tool result does not execute the evidence tool again',async()=>{
 let calls=0,tools=0;const requests:any[]=[];
 const result=await runMetaAgent({...base,signal:AbortSignal.timeout(5000),requiredTools:['requirements'],tools:[{name:'requirements',description:'Read constraints',arguments:z.object({}).strict(),execute:async()=>{tools++;return {limit:24};}}],fetcher:(async(_url,init)=>{requests.push(JSON.parse(String(init?.body)));calls++;if(calls===1)return new Response(JSON.stringify({choices:[{message:{role:'assistant',tool_calls:[{id:'c1',type:'function',function:{name:'requirements',arguments:'{}'}}]}}]}));return calls===2?missing():success();}) as typeof fetch});
 assert.equal(tools,1);assert.deepEqual(result.tool_calls,['requirements']);assert.deepEqual(requests[1],requests[2]);
});
