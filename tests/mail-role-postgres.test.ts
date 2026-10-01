import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { PostgresJobStore } from '../src/core/jobs.js';
const ownerUrl=process.env.SENTINEL_TEST_DATABASE_URL;
test('mail login can claim only invitation jobs and cannot change recipients or other queues',{skip:!ownerUrl},async()=>{
 const target=new URL(ownerUrl!);assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname));assert.match(target.pathname,/test/i);
 const role='sentinel_mail_test_'+randomUUID().replaceAll('-','');const password=randomUUID();
 const owner=new Pool({connectionString:ownerUrl,max:1});let mail:Pool|undefined;
 const ids=[randomUUID(),randomUUID()];
 try {
  await owner.query('CREATE ROLE "'+role+'" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '+"'"+password+"'");
  await owner.query(readFileSync('deploy/database/mail-role.sql','utf8').replaceAll('sentinel_mail','"'+role+'"'));
  target.username=role;target.password=password;mail=new Pool({connectionString:target.toString(),max:1});
  for(const [index,queue,kind] of [[0,'invitation-email','INVITATION_EMAIL_V1'],[1,'identity','REVOKE']] as const){
   await owner.query("INSERT INTO durable_jobs(id,queue,kind,business_key,payload,deadline) VALUES ($1,$2,$3,$1,'{}',now()+interval '5 minutes')",[ids[index],queue,kind]);
  }
  await assert.rejects(mail.query('SELECT * FROM public.durable_jobs'),{code:'42501'});
  await assert.rejects(mail.query('SELECT * FROM public.users'),{code:'42501'});
  assert.deepEqual((await mail.query('SELECT id FROM public.resq_invitation_jobs WHERE id=ANY($1::text[])',[ids])).rows.map(r=>r.id),[ids[0]]);
  await assert.rejects(mail.query("UPDATE public.resq_invitation_jobs SET payload='{}' WHERE id=$1",[ids[0]]),{code:'42501'});
  await assert.rejects(mail.query('DELETE FROM public.resq_invitation_jobs WHERE id=$1',[ids[0]]),{code:'42501'});
  const store=new PostgresJobStore(mail,'public.resq_invitation_jobs');
  assert.equal(await store.claim('identity','mail-test'),null);
  const claim=await store.claim('invitation-email','mail-test');assert.ok(claim);assert.equal(claim.id,ids[0]);
  assert.equal(await store.complete({...claim,fence:claim.fence-1}),false);
  assert.equal(await store.complete(claim),true);
  assert.equal((await owner.query('SELECT state FROM durable_jobs WHERE id=$1',[ids[1]])).rows[0].state,'PENDING');
 } finally {
  await mail?.end();await owner.query('DELETE FROM durable_jobs WHERE id=ANY($1::text[])',[ids]);
  await owner.query('DROP OWNED BY "'+role+'"');await owner.query('DROP ROLE "'+role+'"');await owner.end();
 }
});
