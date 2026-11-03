// Explicit operator diagnostic. Never runs as part of normal API startup.
import {runMetaAgent,metaModels} from '../dist/modules/sentinel/meta-agent.js';
import {missionReply,missionFields} from '../dist/modules/sentinel/mission-planner-contract.js';
import {z} from 'zod';
const safe=value=>String(value||'').replace(/https?:\/\/\S+/g,'[URL]').replace(/Bearer\s+\S+/gi,'[REDACTED]').replaceAll(process.env.META_MODEL_API_KEY||'NOT_A_KEY','[REDACTED]').slice(0,250);
console.log(JSON.stringify({event:'MISSION_PROVIDER_CHECK',configured:!!process.env.META_MODEL_API_KEY?.trim()}));
try {
 const r=await runMetaAgent({model:metaModels.planning,signal:AbortSignal.timeout(60000),output:missionReply,question:'Help plan a community preparedness visit in Nairobi. This is a synthetic integration test; no mission will be created.',instruction:'Read the mission requirements and ask one question about the missing mission details. Use null for unknown fields. Do not create or dispatch anything.',requiredTools:['read_mission_requirements'],tools:[{name:'read_mission_requirements',description:'Read synthetic requirements for a non-operational diagnostic.',arguments:z.object({}).strict(),execute:async()=>({fields:missionFields,maximum_duration_hours:24,capacity:{minimum:1,maximum:1000}})}],fetcher:async(url,init)=>{const response=await fetch(url,init);console.log(JSON.stringify({event:'MISSION_PROVIDER_HTTP',status:response.status}));if(!response.ok){const data=await response.clone().json().catch(()=>({}));console.log(JSON.stringify({event:'MISSION_PROVIDER_REJECTED',code:safe(data.error?.code),type:safe(data.error?.type),message:safe(data.error?.message)}));}return response;}});
 console.log(JSON.stringify({event:'MISSION_PROVIDER_SUCCESS',model:r.model,tools:r.tool_calls}));
}catch(error){console.log(JSON.stringify({event:'MISSION_PROVIDER_FAILURE',code:safe(error.code||error.message),cause:safe(error.cause?.code)}));}
