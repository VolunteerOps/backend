import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
// Schema imports instantiate adapters lazily; never require a deployment secret to generate contracts.
process.env.DATABASE_URL ??= 'postgresql://contract_reader@127.0.0.1:1/contracts?sslmode=verify-full';
const routes=[
 ['safety','/api/organizations/:orgId/regions/:regionId/safety'],['billing','/api'],['operations','/api/organizations/:orgId/regions/:regionId/operations'],['personal','/api'],['enterprise','/api'],['auth','/api/auth'],['organizations','/api'],['platform','/api/platform'],['sentinel','/api/organizations/:orgId/sentinel'],['scoped-storage','/api/organizations/:orgId/regions/:regionId/storage'],['contact','/api/contact']
];
const paths={};
function add(method,path,status='implemented') {
 path=path.replace(/:([A-Za-z]+)/g,'{$1}');
 const parameters=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>({in:'path',name:m[1],required:true,schema:{type:'string',format:'uuid'}}));
 const secured=path!='/api/profile-shares/preview'&&path!='/api/auth/config'&&path!='/api/billing/catalog'&&path!='/api/health'&&path!='/api/ready'&&path!='/api/features'&&!path.startsWith('/api/contact');
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
   const schema=z.toJSONSchema(module[schemaName],{target:'openapi-3.0',io:'input',reused:'inline',cycles:'throw'});
   delete schema.$schema;op.requestBody={required:true,content:{'application/json':{schema}}};
  }
  if((name==='safety'&&match[1]==='post')||(name==='operations'&&match[2]==='/commands')||(name==='sentinel'&&match[1]==='post'&&match[2].includes('/planning/'))){
   op.parameters.push({in:'header',name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}});
   op.responses['409']={description:'Version, capacity, transition or idempotency conflict; refresh before retrying with a new command'};
  }
  if(name==='sentinel'&&match[2].endsWith('/planning/:kind')){
   op.parameters.find(p=>p.name==='kind').schema={type:'string',enum:['resources','weather']};
   op.parameters.push({in:'query',name:'after',schema:{type:'integer',minimum:0},description:'Newest first. Use returned next_cursor to load older records.'});
  }
  if(name==='operations'&&match[2]==='/records'){
   op.parameters.push({in:'query',name:'status',schema:{type:'string',pattern:'^[A-Z_]{2,40}$'}});
   op.parameters.push({in:'query',name:'kind',schema:{type:'string'},description:'Authorized operational record kind; defaults to MISSION'},
    {in:'query',name:'after',schema:{type:'integer',minimum:0},description:'Exclusive record sequence; use next_cursor, not inferred page numbers'},
    {in:'query',name:'parent_id',schema:{type:'string',format:'uuid'}},
    {in:'query',name:'q',schema:{type:'string',minLength:2,maxLength:100},description:'Case-insensitive text match in title, body, brief, mission title or qualification; authorization is unchanged'});
  }
  if(name==='operations'&&match[2].startsWith('/metrics')){
   for(const name of ['from','to'])op.parameters.push({in:'query',name,required:true,schema:{type:'string',format:'date-time'},description:'UTC creation-time interval, inclusive from/exclusive to; maximum 31 days'});
   op.responses['422']={description:'More than 1,000 records; narrow the date interval. No silently truncated totals.'};
   if(match[2].endsWith('/export'))op.responses['200']={description:'Audited Pro coordinator summary export',content:{'text/csv':{schema:{type:'string'}}}};
  }
  if(name==='operations'&&match[2]==='/snapshot')op.responses['200']={description:'Capture before loading record pages; merge replay by record ID/version',content:{'application/json':{schema:{type:'object',required:['cursor','expires_in_seconds'],properties:{cursor:{type:'string',maxLength:512},expires_in_seconds:{type:'integer',const:86400}}}}}};
  if(name==='operations'&&match[2]==='/events'){
   op.parameters.push({in:'header',name:'Last-Event-ID',schema:{type:'string',maxLength:512},description:'Opaque snapshot/checkpoint cursor; alternatively use query after'}, {in:'query',name:'after',schema:{type:'string',maxLength:512}});
   op.responses['409']={description:'STREAM_RESNAPSHOT_REQUIRED: missing, invalid, expired or unavailable cursor'};
  }
  if(name==='operations'&&match[2]==='/events')op.responses['200']={description:'Capture /snapshot cursor before loading record pages. Replay with opaque Last-Event-ID; checkpoint events advance hidden pages. Resnapshot on HTTP 409 or resnapshot event; reauthenticate on revocation. Cursors expire after 24 hours.',content:{'text/event-stream':{schema:{type:'string'}}}};
  if(section.includes('z.object({}).strict()'))op.requestBody={required:true,content:{'application/json':{schema:{type:'object',additionalProperties:false}}}};
 }
}
for(const path of ['activate','suspend','offboard'])add('post','/api/platform/organizations/:orgId/'+path);
for(const path of ['login','refresh','change-password'])add('post','/api/auth/'+path,'retired');
add('get','/api/health');add('get','/api/ready');add('get','/api/features');
const document={openapi:'3.1.0',info:{title:'ResQ foundation API',version:'1.0.0',description:'Implemented route inventory. Personal enrollment, recruitment and enterprise admission routes are implemented. Scoped mission commands and subscription verification are implemented; remaining operational and safety work is tracked in Stage 3. No automatic retries for mutations; idempotency applies only where explicitly implemented. IDs preserve numeric legacy IDs or UUID strings; decimal values are strings; timestamps are UTC ISO-8601. Browser Firebase bearer adapter is supported; cookie mutations require an allowed Origin and X-Requested-With: VolunteerOps.'},servers:[{url:'https://resq-api-staging.up.railway.app',description:'Staging foundations; operational release gated'},{url:'https://api.resq-app.co.ke',description:'Planned production origin; deployment is gated'}],paths,components:{securitySchemes:{firebaseBearer:{type:'http',scheme:'bearer',bearerFormat:'Firebase ID token'},firebaseSession:{type:'apiKey',in:'cookie',name:'vops_firebase_session'}},schemas:{ApiError:{type:'object',required:['error','message'],properties:{error:{type:'string'},message:{type:'string'},details:{},request_id:{type:'string',format:'uuid'}}},UploadState:{type:'string',enum:['PENDING','QUARANTINED','CLEAN','REJECTED','DELETED','READY']},JobState:{type:'string',enum:['PENDING','RUNNING','COMPLETED','DEAD','EXPIRED']}}},'x-planned-contracts':['scoped operational replacements and replay cursors (Stage 3)','billing and entitlements (Stage 4)','sensing and safety (Stage 6)']};
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
