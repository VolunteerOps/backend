import type {Actor} from '../organizations/context.js';
import {withRegion} from './sentinel.context.js';
import {requireCoordinator} from '../operations/workspace-policy.js';
import {metaModels} from './meta-agent.js';

/** Configuration and observed queue progress are distinct; neither claims scientific validation. */
export async function regionalReadiness(actor:Actor,org:string,region:string){
 return withRegion(actor,org,region,false,async tx=>{
  const member=await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId:org,userId:actor.userId}}});requireCoordinator(member.role);
  const forecastScope={organizationId:org,queue:'forecast',kind:'WEATHERNEXT_REFRESH',payload:{path:['regionId'],equals:region}};
  const [run,jobs,counts,source]=await Promise.all([
   tx.forecastRun.findFirst({where:{organizationId:org,regionId:region},orderBy:[{initTime:'desc'},{retrievedAt:'desc'}],select:{id:true,initTime:true,retrievedAt:true,expiresAt:true,quality:true}}),
   tx.durableJob.findMany({where:forecastScope,orderBy:{createdAt:'desc'},take:10,select:{id:true,state:true,attempts:true,createdAt:true,completedAt:true,deadline:true}}),
   tx.durableJob.groupBy({by:['state'],where:forecastScope,_count:true}),
   tx.hazardRevision.findFirst({where:{source:'USGS'},orderBy:{receivedAt:'desc'},select:{receivedAt:true}}),
  ]);
  const max=Number(process.env.WEATHERNEXT_MAX_BYTES_BILLED);
  const configured=!!process.env.WEATHERNEXT_PROJECT_ID&&!!process.env.WEATHERNEXT_DATASET_ID&&Number.isFinite(max)&&max>0;
  return{as_of:new Date().toISOString(),forecast:{configuration_present:configured,access_enabled:process.env.WEATHERNEXT_ACCESS_ENABLED==='true',maximum_bytes_per_query:Number.isFinite(max)?max:null,latest_run:run,jobs,counts:counts.map(c=>({state:c.state,count:c._count})),validation:'UNVALIDATED_WEATHER_INDICATORS'},
   earthquake_source:{source:'USGS',enabled:process.env.SENTINEL_USGS_ENABLED==='true',last_observation_received_at:source?.receivedAt??null,limitation:'An observation timestamp is not a worker heartbeat. No observation is not evidence of safety.'},
   agents:{configuration_present:!!(process.env.META_MODEL_API_KEY||process.env.MODEL_API_KEY),weather_model:metaModels.weather,resource_model:metaModels.planning,allocation_approval:'HUMAN_REQUIRED'},
   coverage_gaps:['River gauges and catchment impact modelling','Authoritative flood and severe-weather warnings','Road access and exposure estimates','Device sensing and coverage validation']};
 });
}
