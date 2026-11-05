import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {metaTransport} from '../src/modules/sentinel/meta-transport.js';
import {runMetaAgent} from '../src/modules/sentinel/meta-agent.js';
const secret='gateway-test-secret-'.repeat(4);
test('gateway transport signs the exact body with a fresh nonce and does not forward the provider key',()=>{
 const transport=metaTransport({META_GATEWAY_URL:'https://example.com',META_GATEWAY_SECRET:secret,META_MODEL_API_KEY:'private-key'});
 assert.equal(transport.endpoint,'https://example.com/v1/chat/completions');assert.equal(transport.streaming,false);
 const body='{"model":"muse-spark-1.3"}',headers=transport.headers(body);
 assert.equal(headers.Authorization,undefined);assert.ok(!JSON.stringify(headers).includes('private-key'));
 assert.equal(headers['x-resq-signature'],createHmac('sha256',secret).update(`POST\n/v1/chat/completions\n${headers['x-resq-timestamp']}\n${headers['x-resq-nonce']}\n${body}`).digest('hex'));
 assert.notEqual(headers['x-resq-nonce'],transport.headers(body)['x-resq-nonce']);
});
test('incomplete and unsafe gateway configuration fails closed rather than falling back to direct Meta',()=>{
 for(const url of ['', 'http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?secret=a','https://example.com/#x']) {
  assert.throws(()=>metaTransport({META_GATEWAY_URL:url,META_GATEWAY_SECRET:secret,META_MODEL_API_KEY:'private-key'}));
 }
 assert.throws(()=>metaTransport({META_GATEWAY_URL:'https://example.com'}));
 assert.equal(metaTransport({META_MODEL_API_KEY:'private-key'}).streaming,true);
 assert.equal(metaTransport({META_MODEL_API_KEY:'private-key'}).headers('').Authorization,'Bearer private-key');
});
test('streaming UI requests use JSON through the gateway and retain the controlled tool round trip',async()=>{
 const previous={url:process.env.META_GATEWAY_URL,secret:process.env.META_GATEWAY_SECRET};
 process.env.META_GATEWAY_URL='https://example.com';process.env.META_GATEWAY_SECRET=secret;
 try {
  let requests=0,executed=0;
  const result=await runMetaAgent({model:'muse-spark-1.3',instruction:'Test',question:'Test',stream:true,signal:AbortSignal.timeout(1000),output:z.object({reply:z.string()}).strict(),requiredTools:['requirements'],tools:[{name:'requirements',description:'Read requirements',arguments:z.object({}).strict(),execute:async()=>{executed++;return {limit:5};}}],fetcher:(async(url,init)=>{
   assert.equal(url,'https://example.com/v1/chat/completions');
   assert.equal(new Headers(init?.headers).has('Authorization'),false);
   assert.equal(JSON.parse(String(init?.body)).stream,undefined);
   requests++;
   return Response.json({choices:[{message:requests===1?{role:'assistant',tool_calls:[{id:'call1',type:'function',function:{name:'requirements',arguments:'{}'}}]}:{role:'assistant',content:'{"reply":"Ready"}'}}]});
  }) as typeof fetch});
  assert.equal(result.result.reply,'Ready');assert.equal(executed,1);assert.equal(requests,2);
 }finally{
  if(previous.url===undefined)delete process.env.META_GATEWAY_URL;else process.env.META_GATEWAY_URL=previous.url;
  if(previous.secret===undefined)delete process.env.META_GATEWAY_SECRET;else process.env.META_GATEWAY_SECRET=previous.secret;
 }
});
