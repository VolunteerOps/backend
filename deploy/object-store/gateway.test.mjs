import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { readConfig, credentialDocument, createGateway, bucketReady } from './gateway.mjs';

const env = { S3_BUCKET:'resq-production', S3_ROOT_ACCESS_KEY_ID:'root000000000000', S3_ROOT_SECRET_ACCESS_KEY:'r'.repeat(48), S3_ACCESS_KEY_ID:'app0000000000000', S3_SECRET_ACCESS_KEY:'s'.repeat(48), S3_ENDPOINT:'https://storage.example.com' };
const config=readConfig(env);
const listen=async(server)=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
const close=(server)=>new Promise(resolve=>server.close(resolve));
const call=(port,path,{method='GET',host=config.endpoint.host,body='',headers={}}={})=>new Promise((resolve,reject)=>{
 const req=request({hostname:'127.0.0.1',port,path,method,headers:{host,...headers}},res=>{let result='';res.on('data',x=>result+=x);res.on('end',()=>resolve({status:res.statusCode,body:result}));});
 req.on('error',e=>{e.message=path+': '+e.message;reject(e)});req.end(body);
});

test('configuration fails closed and runtime credentials cannot administer buckets',()=>{
 assert.throws(()=>readConfig({...env,S3_SECRET_ACCESS_KEY:''}),/required/);
 assert.throws(()=>readConfig({...env,S3_ROOT_SECRET_ACCESS_KEY:env.S3_SECRET_ACCESS_KEY}),/distinct/);
 assert.throws(()=>readConfig({...env,S3_ENDPOINT:'http://storage.example.com'}),/HTTPS/);
 assert.throws(()=>readConfig({...env,S3_BUCKET:'bucket/other'}),/DNS/);
 assert.throws(()=>readConfig({...env,PORT:'8333'}),/available/);
 assert.throws(()=>readConfig({...env,S3_CORS_ORIGINS:'*'}));
 const identities=credentialDocument(config).identities;
 assert.deepEqual(identities[1].actions,['Read:resq-production','Write:resq-production','List:resq-production']);
 assert.equal(identities[0].credentials[0].accessKey,config.rootKey);
});

test('gateway preserves encoded S3 requests and rejects other surfaces, hosts, and oversized bodies',async()=>{
 const requests=[];
 const upstream=createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{requests.push({url:req.url,headers:req.headers,body});res.writeHead(200,{'etag':'"sample"'});res.end('stored');});});
 const targetPort=await listen(upstream);
 const gateway=createGateway(config,{targetPort,checkReady:async()=>true});
 const port=await listen(gateway);
 try {
   const path='/resq-production/org/a%20b%2Fc?X-Amz-Signature=example&partNumber=1';
   const response=await call(port,path,{method:'PUT',body:'hello',headers:{'content-length':'5','x-amz-checksum-sha256':'checksum','if-none-match':'*'}});
   assert.equal(response.status,200);
   assert.equal(requests[0].url,path);
   assert.equal(requests[0].headers.host,config.endpoint.host);
   assert.equal(requests[0].headers['x-amz-checksum-sha256'],'checksum');
   assert.equal(requests[0].headers['if-none-match'],'*');
   assert.equal(requests[0].body,'hello');
   for(const path of ['/','/other-bucket/a','/status','/healthz','/?Action=CreateUser']) assert.equal((await call(port,path)).status,403);
   assert.equal((await call(port,'/resq-production/a',{host:'attacker.example'})).status,400);
   assert.equal((await call(port,'/resq-production/a',{method:'PUT',headers:{'content-length':String(13*1024*1024)}})).status,413);
   assert.equal(requests.length,1);
   assert.equal((await call(port,'/_resq/ready',{host:'127.0.0.1'})).status,200);
 } finally {await close(gateway);await close(upstream);}
});

test('readiness checks issue a signed bucket HEAD and propagate bucket failure',async()=>{
 let requestSeen;
 const upstream=createServer((req,res)=>{requestSeen=req;res.writeHead(403);res.end();});
 const port=await listen(upstream);
 try {
   assert.equal(await bucketReady(config,port),false);
   assert.equal(requestSeen.method,'HEAD');
   assert.equal(requestSeen.url,'/resq-production');
   assert.equal(requestSeen.headers.host,'storage.example.com');
   assert.match(requestSeen.headers.authorization,/Credential=app0000000000000\//);
   assert.ok(!requestSeen.headers.authorization.includes(config.rootKey));
 } finally { await close(upstream); }
 const gateway=createGateway(config,{checkReady:async()=>false});const gatewayPort=await listen(gateway);
 try {assert.equal((await call(gatewayPort,'/_resq/ready')).status,503);}finally{await close(gateway);}
});
