import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {zodToJsonSchema} from 'zod-to-json-schema';
// Schema imports instantiate adapters lazily; never require a deployment secret to generate contracts.
process.env.DATABASE_URL ??= 'postgresql://contract_reader@127.0.0.1:1/contracts?sslmode=verify-full';
const routes=[
 ['auth','/api/auth'],['organizations','/api'],['platform','/api/platform'],['sentinel','/api/organizations/:orgId/sentinel'],['scoped-storage','/api/organizations/:orgId/regions/:regionId/storage'],['contact','/api/contact']
];
const paths={};
function add(method,path,status='implemented') {
 path=path.replace(/:([A-Za-z]+)/g,'{$1}');
 const parameters=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({in:'path',name:m[1],required:true,schema:{type:'string',format:'uuid'}}));
 const secured=path!='/api/health'&&path!='/api/ready'&&path!='/api/features'&&!path.startsWith('/api/contact');
 (paths[path]??={})[method]={operationId:method+'_'+path.replace(/[^A-Za-z0-9]/g,'_'),'x-implementation-status':status,parameters,security:secured?[{firebaseBearer:[]},{firebaseSession:[]}]:[],responses:{'200':{description:'Successful response; see route-specific schemas and shared fixtures'},'400':{description:'Validation failed',content:{'application/json':{schema:{$ref:'#/components/schemas/ApiError'}}}},'401':{description:'Identity required'},'403':{description:'Scope or assurance denied'},'429':{description:'Rate limit; honor Retry-After'},'503':{description:'Dependency or feature unavailable'}}};
}
for(const [name,prefix] of routes){
 const file='src/modules/'+name+'/'+name+'.controller.ts',source=readFileSync(file,'utf8');
 const matches=[...source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)];
 for(let i=0;i<matches.length;i++){
  const match=matches[i], section=source.slice(match.index,matches[i+1]?.index??source.length);
  add(match[1],prefix+match[2],match[2]==='/signup'?'retired':'implemented');
  const op=paths[(prefix+match[2]).replace(/:([A-Za-z]+)/g,'{$1}')][match[1]];
  const code=section.match(/res\.status\((\d+)\)/)?.[1]??'200';
  if(code!=='200'){op.responses[code]=op.responses['200'];delete op.responses['200'];}
  const schemaName=section.match(/validateBody\(([A-Za-z][A-Za-z0-9]*)\)/)?.[1];
  if(schemaName){
   const imported=[...source.matchAll(/import\s*{([^}]+)}\s*from\s*'([^']+)'/g)].find(x=>x[1].split(',').map(t=>t.trim()).includes(schemaName));
   if(!imported)throw Error('Unresolved request schema '+schemaName);
   const module=await import(pathToFileURL(resolve(dirname(file),imported[2].replace(/\.js$/,'.ts'))));
   const schema=zodToJsonSchema(module[schemaName],{target:'openApi3',effectStrategy:'input',$refStrategy:'none'});
   delete schema.$schema;op.requestBody={required:true,content:{'application/json':{schema}}};
  }
  if(section.includes('z.object({}).strict()'))op.requestBody={required:true,content:{'application/json':{schema:{type:'object',additionalProperties:false}}}};
 }
}
for(const path of ['activate','suspend','offboard'])add('post','/api/platform/organizations/:orgId/'+path);
for(const path of ['login','refresh','change-password'])add('post','/api/auth/'+path,'retired');
add('get','/api/health');add('get','/api/ready');add('get','/api/features');
const document={openapi:'3.1.0',info:{title:'ResQ foundation API',version:'1.0.0',description:'Implemented route inventory. Operational, billing, recruitment and safety contracts remain planned in the seven-stage roadmap. No automatic retries for mutations; idempotency applies only where explicitly implemented. IDs preserve numeric legacy IDs or UUID strings; decimal values are strings; timestamps are UTC ISO-8601. Browser Firebase bearer adapter is supported; cookie mutations require an allowed Origin and X-Requested-With: VolunteerOps.'},servers:[{url:'https://resq-api-staging.up.railway.app',description:'Staging foundations; operational release gated'},{url:'https://api.resq-app.co.ke',description:'Planned production origin; deployment is gated'}],paths,components:{securitySchemes:{firebaseBearer:{type:'http',scheme:'bearer',bearerFormat:'Firebase ID token'},firebaseSession:{type:'apiKey',in:'cookie',name:'vops_firebase_session'}},schemas:{ApiError:{type:'object',required:['error','message'],properties:{error:{type:'string'},message:{type:'string'},details:{},request_id:{type:'string',format:'uuid'}}},UploadState:{type:'string',enum:['PENDING','QUARANTINED','CLEAN','REJECTED','DELETED','READY']},JobState:{type:'string',enum:['PENDING','RUNNING','COMPLETED','DEAD','EXPIRED']}}},'x-planned-contracts':['personal profiles and recruitment (Stage 2)','scoped operational replacements and replay cursors (Stage 3)','billing and entitlements (Stage 4)','sensing and safety (Stage 6)']};
for(const [path,methods] of Object.entries(paths))for(const [method,op] of Object.entries(methods)){
 for(const response of Object.values(op.responses))response.headers={'X-Request-ID':{schema:{type:'string',format:'uuid'}}};
 op.responses['429'].headers['Retry-After']={schema:{type:'integer',minimum:0}};
 if(op['x-implementation-status']==='retired'){op.deprecated=true;delete op.responses['200'];op.responses['410']={description:'Password authentication retired; use Firebase'};}
 if(path.endsWith('/memberships')||path.endsWith('/audit')||path==='/api/platform/organizations')if(method==='get')op.parameters.push({name:'after',in:'query',schema:{type:'string',format:'uuid'},description:'Exclusive cursor; use the returned next cursor, no inferred page numbers'});
}
paths['/api/auth/firebase/bootstrap'].post.requestBody={required:true,content:{'application/json':{schema:{type:'object',required:['full_name'],additionalProperties:false,properties:{full_name:{type:'string',minLength:2,maxLength:120}}}}}};
const output=JSON.stringify(document,null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync('contracts/openapi.v1.json','utf8')!==output)throw Error('OPENAPI_OUT_OF_DATE');}
else writeFileSync('contracts/openapi.v1.json',output);
console.log('OpenAPI routes:',Object.keys(paths).length);
