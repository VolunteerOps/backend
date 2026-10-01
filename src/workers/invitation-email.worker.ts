import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { invitationMailConfig, sendInvitationEmail } from '../core/invitation-email.js';
import { executeJob, PermanentJobError, PostgresJobStore, type JobHandler } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';
invitationMailConfig();
const pool=new Pool(databasePoolConfig(config));
const role=await pool.query("SELECT current_user = 'sentinel_mail' AS permitted");
if(!role.rows[0]?.permitted) throw Error('UNSAFE_MAIL_ROLE');
const store=new PostgresJobStore(pool,'public.resq_invitation_jobs'),owner=randomUUID(),shutdown=new AbortController(),health=workerHealth(3002);
for(const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>shutdown.abort());
const handlers=new Map<string,JobHandler>([['INVITATION_EMAIL_V1',async(payload,signal,job)=>{
 const parsed=z.object({version:z.literal(1),invitationId:z.string().uuid()}).strict().safeParse(payload);
 if(!parsed.success) throw new PermanentJobError();
 const row=await pool.query('SELECT id,recipient_email,display_name FROM public.resq_pending_invitation_email WHERE id=$1',[parsed.data.invitationId]);
 if(!row.rows[0]) return;
 await sendInvitationEmail({id:row.rows[0].id,recipient:row.rows[0].recipient_email,organization:row.rows[0].display_name},AbortSignal.any([signal,AbortSignal.timeout(10000)]));
 await pool.query('SELECT public.resq_mark_invitation_sent($1,$2,$3,$4)',[parsed.data.invitationId,job.id,job.fence,job.lease_owner]);
}]]);
try{while(!shutdown.signal.aborted){try{const job=await store.claim('invitation-email',owner);if(job) await executeJob(store,job,handlers);health.progress();if(!job) await delay(1000,undefined,{signal:shutdown.signal});}catch{if(shutdown.signal.aborted)break;console.error('INVITATION_EMAIL_RETRY');await delay(2000,undefined,{signal:shutdown.signal}).catch(()=>{});}}}
finally{health.close();await pool.end();}
