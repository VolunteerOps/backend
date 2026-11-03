import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export const project='73690bd6-2d68-4ac7-9330-b5da3ebed8f0';
export const environment='9de4cdd7-abad-4a36-ae1e-7577c06dc2d7';
const pending=new Set(['QUEUED','INITIALIZING','WAITING','BUILDING','DEPLOYING']);
export function deploymentState(rows,id,migration=false,messages=[]){
  const deployment=rows.find(row=>row.id===id);
  if(!deployment)return 'pending';
  if(messages.includes('MIGRATION_FAILED'))throw Error('Database migration failed; runtime services will not be released.');
  if(deployment.status==='SUCCESS')return !migration||messages.includes('MIGRATION_VERIFIED')?'ready':'pending';
  if(pending.has(deployment.status))return 'pending';
  throw Error(`Deployment ${id} ended in ${deployment.status}; release stopped.`);
}
export function uploadId(output){
  const parsed=JSON.parse(output);
  if(!/^[0-9a-f-]{36}$/i.test(parsed.deploymentId??''))throw Error('Railway did not return a deployment ID; refusing to infer success.');
  return parsed.deploymentId;
}
function cli(args){
  return execFileSync('railway',args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
}
export async function deploy(service,{migration=false,healthUrl}={}){
  const sha=process.env.GITHUB_SHA;
  if(!process.env.RAILWAY_TOKEN)throw Error('RAILWAY_TOKEN is missing from the railway-staging GitHub environment.');
  if(process.env.GITHUB_REF!=='refs/heads/main'||!['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))throw Error('Only main pushes or manual main releases may deploy.');
  if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('A full GitHub commit SHA is required.');
  if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha)throw Error('Checkout does not match the verified GitHub commit.');
  const scope=['--project',project,'--environment',environment,'--service',service];
  const id=uploadId(cli(['up',...scope,'--detach','--json','--message',`GitHub ${process.env.GITHUB_REPOSITORY}@${sha} run ${process.env.GITHUB_RUN_ID}`]));
  const url=`https://railway.com/project/${project}/service/${service}?environmentId=${environment}&id=${id}`;
  console.log(`Uploaded ${sha}: ${url}`);
  const deadline=Date.now()+25*60*1000;
  let failures=0,lastStatus;
  while(Date.now()<deadline){
    let rows,messages=[];
    try{
      rows=JSON.parse(cli(['deployment','list',...scope,'--limit','30','--json']));
      if(migration&&rows.find(row=>row.id===id)?.status==='SUCCESS'){
        const logs=cli(['logs',id,...scope,'--lines','50','--filter','MIGRATION_VERIFIED OR MIGRATION_FAILED','--json']);
        messages=logs.split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line).message?.trim());
      }
      failures=0;
    }catch{
      if(++failures>=3)throw Error(`Could not verify deployment ${id}. Inspect ${url} before retrying.`);
      await delay(15000);continue;
    }
    const status=rows.find(row=>row.id===id)?.status??'REGISTERING';
    if(status!==lastStatus){console.log(`${service}: ${status}`);lastStatus=status;}
    if(deploymentState(rows,id,migration,messages)==='ready'){
      if(healthUrl){
        const response=await fetch(healthUrl,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw Error(`Deployment succeeded, but ${healthUrl} returned HTTP ${response.status}.`);
      }
      const summary=`- ${service}: **verified** [${id}](${url}), commit \`${sha}\`\n`;
      console.log(summary.trim());
      if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
      return id;
    }
    await delay(15000);
  }
  throw Error(`Deployment verification timed out. Inspect ${url}; no success was assumed.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const targets={
    admin:{id:'926250e7-bb4e-4570-99f5-41611d93ede3',healthUrl:'https://www.admin.resq-app.co.ke/'},
    migrate:{id:'16e84c9b-9e0f-4729-973c-bc5393ad75c7',migration:true},
    api:{id:'fb8c493f-bcdd-4883-acb3-9b0990b935ea',healthUrl:'https://resq-api-staging.up.railway.app/api/ready'},
    forecast:{id:'16009e4e-0edc-4d88-9625-225528fbb57f'},
  };
  try{
    const target=targets[process.argv[2]];
    if(!target)throw Error('Choose an explicit release target: admin, migrate, api, or forecast.');
    await deploy(target.id,target);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
