import {execFileSync} from 'node:child_process';
import {runMetaAgent,metaModels} from '../src/modules/sentinel/meta-agent.ts';
import {z} from 'zod';
const args=['variables','-p','73690bd6-2d68-4ac7-9330-b5da3ebed8f0','-s','fb8c493f-bcdd-4883-acb3-9b0990b935ea','-e','9de4cdd7-abad-4a36-ae1e-7577c06dc2d7','--json'];
try{
 const vars=JSON.parse(execFileSync('railway.exe',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const url=new URL('https://api.mapbox.com/search/geocode/v6/forward');url.search=new URLSearchParams({q:'Mombasa, Kenya',access_token:vars.MAPBOX_ACCESS_TOKEN,types:'place,region,district',limit:'3',autocomplete:'false',permanent:'true'}).toString();
 const response=await fetch(url);const places=await response.json();console.log(JSON.stringify({service:'Mapbox permanent geocoding',status:response.status,matches:places.features?.map((f:any)=>({name:f.properties.name,bounds:!!(f.properties.bbox||f.bbox)}))}));
 for(const model of [] as string[]){
  try{const r=await runMetaAgent({model,key:vars.META_MODEL_API_KEY,signal:AbortSignal.timeout(60000),instruction:'This is a non-operational integration test. Read the test context and respond briefly, without predictions or actions.',question:'What information do we need to plan a community readiness mission?',requiredTools:['read_test_context'],tools:[{name:'read_test_context',description:'Read synthetic test context, not real operational data.',arguments:z.object({}).strict(),execute:async()=>({region:'synthetic test region',weather_evidence_available:false,mission_fields:['purpose','meeting point','time','team size','skills']})}],output:z.object({reply:z.string().max(1000)}).strict()});console.log(JSON.stringify({service:model,structured_response:true,tool_calls:r.tool_calls}));}catch(e:any){console.log(JSON.stringify({service:model,error_code:e.code||'MODEL_CHECK_FAILED',message:/^[A-Z_0-9]+$/.test(e.message)?e.message:'Response did not pass the integration check'}));}
 }
}catch{console.log(JSON.stringify({error:'PROVIDER_CHECK_UNAVAILABLE'}));process.exitCode=1;}
