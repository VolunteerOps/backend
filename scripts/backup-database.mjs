import {mkdtempSync,writeFileSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {Client} from 'pg';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
let directory,client,source,db;let phase='connect';
try {
 const url=new URL(process.env.BACKUP_DATABASE_URL??'');
 if(url.searchParams.get('sslmode')!=='verify-full'||!process.env.DATABASE_TLS_CA)throw Error('BACKUP_TLS_REQUIRED');
 const dbUrl=new URL(url);dbUrl.searchParams.delete('sslmode');
 db=new Client({connectionString:dbUrl.toString(),ssl:{ca:process.env.DATABASE_TLS_CA,rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:30000});
 await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshot=(await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
 const objects=(await db.query("SELECT id,bucket,object_key,etag,version_id,byte_size,checksum_sha256 FROM public.stored_objects WHERE state IN ('CLEAN','QUARANTINED','READY','REJECTED') ORDER BY id LIMIT 1001")).rows;
 if(objects.length>1000)throw Error('BACKUP_OBJECT_LIMIT');
 const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY_B64??'','base64');if(key.length!==32)throw Error('BACKUP_KEY_REQUIRED');
 directory=mkdtempSync(join(tmpdir(),'resq-backup-'));const ca=join(directory,'ca.pem'),dump=join(directory,'database.dump');
 writeFileSync(ca,process.env.DATABASE_TLS_CA,{mode:0o600});
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGCONNECT_TIMEOUT:'10'};
 phase='dump';
 execFileSync(process.env.PG_DUMP_PATH??'pg_dump',['-Fc','--snapshot',snapshot,'--no-owner','--no-acl','-f',dump],{env,stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:1048576});
 if(statSync(dump).size===0||statSync(dump).size>512*1024*1024)throw Error('BACKUP_SIZE_LIMIT');
 await db.query('COMMIT');await db.end();db=undefined;
 phase='encrypt';
 const bytes=readFileSync(dump);
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
 const prefix='database/'+new Date().toISOString().replaceAll(':','-')+'-'+randomBytes(4).toString('hex');
 client=new S3Client({endpoint:process.env.BACKUP_S3_ENDPOINT,region:process.env.BACKUP_S3_REGION,forcePathStyle:false,credentials:{accessKeyId:process.env.BACKUP_S3_ACCESS_KEY_ID,secretAccessKey:process.env.BACKUP_S3_SECRET_ACCESS_KEY},maxAttempts:2});
 const manifest={objects:[],version:1,cipher:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString(),key:prefix+'.dump.enc'};
 phase='upload';
 await client.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:manifest.key,Body:encrypted,IfNoneMatch:'*',ChecksumSHA256:createHash('sha256').update(encrypted).digest('base64')}));
 if(objects.length){
  source=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY},maxAttempts:2});
  for(const object of objects){
   if(!object.etag||object.byte_size>10485760)throw Error('OBJECT_BACKUP_INTEGRITY');
   const response=await source.send(new GetObjectCommand({Bucket:object.bucket,Key:object.object_key,IfMatch:object.etag,...object.version_id?{VersionId:object.version_id}:{}}),{abortSignal:AbortSignal.timeout(15000)});
   const chunks=[];let size=0;for await(const chunk of response.Body){size+=chunk.length;if(size>object.byte_size)throw Error('OBJECT_BACKUP_SIZE');chunks.push(chunk);}
   const body=Buffer.concat(chunks);if(size!==object.byte_size||createHash('sha256').update(body).digest('base64')!==object.checksum_sha256)throw Error('OBJECT_BACKUP_INTEGRITY');
   const objectIv=randomBytes(12),objectCipher=createCipheriv('aes-256-gcm',key,objectIv),encryptedObject=Buffer.concat([objectCipher.update(body),objectCipher.final()]);
   const address=prefix+'/objects/'+object.id+'.enc';
   await client.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:address,Body:encryptedObject,IfNoneMatch:'*',ChecksumSHA256:createHash('sha256').update(encryptedObject).digest('base64')}));
   manifest.objects.push({...object,key:address,iv:objectIv.toString('base64'),tag:objectCipher.getAuthTag().toString('base64'),sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length,cipher:'aes-256-gcm',version:1});
  }
 }
 await client.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:prefix+'.json',Body:JSON.stringify(manifest),IfNoneMatch:'*',ContentType:'application/json'}));
 console.log(JSON.stringify({event:'BACKUP_COMPLETED',manifest:prefix+'.json',bytes:bytes.length,sha256:manifest.sha256}));
} catch(error) {console.error(JSON.stringify({event:'BACKUP_FAILED',phase,code:/^[A-Z0-9_]{1,64}$/.test(String(error.code))?error.code:undefined}));process.exitCode=1;}
finally {await db?.end().catch(()=>{});source?.destroy();client?.destroy();if(directory)rmSync(directory,{recursive:true,force:true});}
