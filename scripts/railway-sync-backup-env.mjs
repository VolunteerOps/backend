// Run with node --env-file=.env. Values travel over stdin, never command arguments or stdout.
import {execFileSync} from 'node:child_process';
const service='resq-backup',project='73690bd6-2d68-4ac7-9330-b5da3ebed8f0';
const keys=['BACKUP_DATABASE_URL','BACKUP_ENCRYPTION_KEY_B64','BACKUP_S3_ENDPOINT','BACKUP_S3_REGION','BACKUP_S3_BUCKET','BACKUP_S3_ACCESS_KEY_ID','BACKUP_S3_SECRET_ACCESS_KEY','DATABASE_TLS_CA','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_FORCE_PATH_STYLE'];
for(const key of keys){let value=process.env[key];if(!value)throw Error('MISSING_'+key);
 if(key==='BACKUP_DATABASE_URL'){const url=new URL(value);if(url.username!=='sentinel_backup'||url.searchParams.get('sslmode')!=='verify-full')throw Error('BACKUP_IDENTITY_REQUIRED');url.hostname='resq-postgres.railway.internal';url.port='5432';value=url.toString();}
 execFileSync(process.platform==='win32'?'railway.exe':'railway',['variable','set',key,'--stdin','--project',project,'--environment','staging','--service',service,'--skip-deploys'],{input:value,stdio:['pipe','pipe','pipe'],env:{...process.env,RAILWAY_CALLER:'skill:use-railway@1.6.1',RAILWAY_AGENT_SESSION:'resq-stage1-20261001'}});
}console.log('Backup variables synchronized; deploy resq-backup to apply them.');
