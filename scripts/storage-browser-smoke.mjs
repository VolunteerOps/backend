import {randomUUID,createHash} from 'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const origins=(process.env.STORAGE_BROWSER_ORIGINS??'').split(',').filter(Boolean);
if(!origins.length)throw Error('EXACT_BROWSER_ORIGINS_REQUIRED');
const client=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
const browser=await chromium.launch({headless:true,...process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}});
try {for(const origin of origins){
 const context=await browser.newContext();const page=await context.newPage();
 const pageUrl=origin+'/__resq_contract_probe__';await page.route(pageUrl,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>ResQ storage acceptance</title>'}));await page.goto(pageUrl);
 const Bucket=process.env.S3_BUCKET,Key='__resq_probe__/'+randomUUID()+'/browser.txt',body='ResQ browser contract probe',checksum=createHash('sha256').update(body).digest('base64');
 try{
 const url=await getSignedUrl(client,new PutObjectCommand({Bucket,Key,Body:undefined,ContentLength:Buffer.byteLength(body),ContentType:'text/plain',ChecksumSHA256:checksum,IfNoneMatch:'*'}),{expiresIn:60,signableHeaders:new Set(['content-length','content-type','if-none-match']),unhoistableHeaders:new Set(['x-amz-checksum-sha256'])});
 const put=await page.evaluate(async args=>{const r=await fetch(args.url,{method:'PUT',headers:{'Content-Type':'text/plain','If-None-Match':'*','x-amz-checksum-sha256':args.checksum},body:args.body});await r.arrayBuffer();return r.status;},{url,checksum,body});assert.equal(put,200);
 const head=await client.send(new HeadObjectCommand({Bucket,Key}));
 const getUrl=await getSignedUrl(client,new GetObjectCommand({Bucket,Key,IfMatch:head.ETag,ResponseContentDisposition:'attachment; filename="evidence.txt"',ResponseContentType:'application/octet-stream'}),{expiresIn:60,signableHeaders:new Set(['if-match'])});
 const read=await page.evaluate(async args=>{const r=await fetch(args.url,{headers:{'If-Match':args.etag}});return {status:r.status,body:await r.text()};},{url:getUrl,etag:head.ETag});assert.equal(read.status,200);assert.equal(read.body,body);
 console.log(JSON.stringify({origin,upload:true,download:true,preflight:true}));
 }finally{await client.send(new DeleteObjectCommand({Bucket,Key}));await context.close();}
}}finally{await browser.close();client.destroy();}
