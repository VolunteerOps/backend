import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {reconcileStorage} from '../src/modules/scoped-storage/storage-lifecycle.js';
const connection=process.env.SENTINEL_TEST_DATABASE_URL;
test('orphan cleanup preserves clean evidence, waits beyond signed upload expiry and retries failed deletion',{skip:!connection},async()=>{
 const url=new URL(connection!);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.match(url.pathname,/test/);
 const schema='storage_test_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:connection});
 await owner.query('CREATE SCHEMA '+schema);const pool=new Pool({connectionString:connection,options:'-c search_path='+schema});
 try{
 await pool.query(`CREATE TABLE stored_objects(id text PRIMARY KEY,organization_id text,bucket text,object_key text,state text,expires_at timestamp,scanned_at timestamp,completed_at timestamp,created_at timestamp DEFAULT now());
 CREATE TABLE durable_jobs(id text PRIMARY KEY,organization_id text,queue text,kind text,business_key text UNIQUE,payload jsonb,max_attempts integer,deadline timestamp);
 INSERT INTO stored_objects(id,bucket,object_key,state,expires_at) VALUES
 ('old','bucket','old','PENDING',now()-interval '2 days'),('recent','bucket','recent','PENDING',now()-interval '1 hour'),('clean','bucket','clean','CLEAN',now()-interval '30 days');`);
 await assert.rejects(reconcileStorage(pool,{remove:async()=>{throw Error('PROVIDER_UNAVAILABLE');}}));
 assert.equal((await pool.query("SELECT state FROM stored_objects WHERE id='old'")).rows[0].state,'PENDING');
 const removed:string[]=[];await reconcileStorage(pool,{remove:async object=>{removed.push(object.objectKey);}});
 assert.deepEqual(removed,['old']);assert.equal((await pool.query("SELECT state FROM stored_objects WHERE id='old'")).rows[0].state,'DELETED');
 assert.equal((await reconcileStorage(pool,{remove:async()=>{throw Error('Unexpected delete');}})).deleted,0);
 }finally{await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();}
});
