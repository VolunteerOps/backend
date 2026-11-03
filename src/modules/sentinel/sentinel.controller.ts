import {weatherConversation,missionConversation} from './conversation.service.js';
import {conversationRequest,missionConversationRequest} from './assistant-contract.js';
import {searchPlaces} from './place-search.js';
import {regionalReadiness} from './readiness.service.js';
import {PlanningService,weatherRequest} from './planning.service.js';
import {resourcePlanRequest,planApproval,planRejection,planEdit} from './planning-contract.js';
import {SpecialisedService} from './specialised.service.js';
import {evidenceCreate,floodRequest,watchRequest,heatRequest,windRequest,multiRegionRequest,outcomeRequest,foresightRequest,whatIfRequest,shortageRequest,briefingRequest,translateRequest,reviewRequest,afterActionRequest,gapWorklistRequest,gapTaskUpdate} from './specialised-contract.js';
import {AgentRunsService,followUpRequest} from './agent-runs.service.js';
import {IncidentsService,incidentDecision,incidentLocate} from './incidents.service.js';
import { Router } from 'express';
import { z } from 'zod';
import { askSentinel, agentQuestionSchema } from './sentinel.agent.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { ah } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validator.js';
import { requestActor } from '../organizations/context.js';
import { serialize } from '../../lib/serialize.js';
import { SentinelService, regionConfigSchema, refreshSchema, latestRefreshSchema } from './sentinel.service.js';

const router = Router({ mergeParams: true });
const uuid = z.string().uuid();
router.use(requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/places',authRateLimiter,ah(async(req,res)=>{res.json(await searchPlaces(requestActor(req),uuid.parse(req.params.orgId),req.query.q));}));
router.post('/regions/:regionId/conversations/weather',authRateLimiter,validateBody(conversationRequest),ah(async(req,res)=>{res.json(serialize(await weatherConversation(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));}));
router.post('/regions/:regionId/conversations/mission',authRateLimiter,validateBody(missionConversationRequest),ah(async(req,res)=>{res.json(serialize(await missionConversation(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));}));
router.get('/regions', ah(async (req, res) => {
  res.json(serialize(await SentinelService.regions(requestActor(req), uuid.parse(req.params.orgId))));
}));
router.put('/regions/:regionId', validateBody(regionConfigSchema), ah(async (req, res) => {
  res.json(serialize(await SentinelService.configureRegion(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), req.body)));
}));
router.post('/regions/:regionId/forecasts/refresh-latest',authRateLimiter,validateBody(latestRefreshSchema),ah(async(req,res)=>{
 res.status(202).json(await SentinelService.refreshLatest(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),req.body.hours));
}));
router.post('/regions/:regionId/forecasts/refresh', authRateLimiter, validateBody(refreshSchema), ah(async (req, res) => {
  res.status(202).json(await SentinelService.refresh(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), req.body));
}));
router.get('/regions/:regionId/forecasts/latest', ah(async (req, res) => {
  res.json(serialize(await SentinelService.latest(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId))));
}));
router.get('/regions/:regionId/insights', ah(async (req, res) => {
  res.json(serialize(await SentinelService.insights(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId))));
}));
router.get('/regions/:regionId/jobs/:jobId', ah(async (req, res) => {
  res.json(await SentinelService.job(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), uuid.parse(req.params.jobId)));
}));
router.post('/regions/:regionId/jobs/:jobId/retry', authRateLimiter, validateBody(z.object({ reason: z.string().trim().min(10).max(500) }).strict()), ah(async (req, res) => {
  res.status(202).json(await SentinelService.retry(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), uuid.parse(req.params.jobId), req.body.reason));
}));
router.post('/regions/:regionId/agent/chat', authRateLimiter, validateBody(agentQuestionSchema), ah(async (req, res) => {
  res.json(serialize(await askSentinel(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), req.body)));
}));
router.get('/regions/:regionId/hazards', ah(async (req, res) => {
  res.json(serialize(await SentinelService.hazards(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId))));
}));
router.get('/regions/:regionId/planning/:kind', ah(async (req,res)=>{
 const kind=z.enum(['resources','weather']).parse(req.params.kind);
 res.json(serialize(await PlanningService.list(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),kind==='resources'?'RESOURCE_PLAN':'WEATHER_ANALYSIS',z.coerce.number().int().nonnegative().default(0).parse(req.query.after))));
}));
router.post('/regions/:regionId/planning/resources', authRateLimiter, validateBody(resourcePlanRequest), ah(async(req,res)=>{
 res.json(serialize(await PlanningService.resourcePlan(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
}));
router.post('/regions/:regionId/planning/weather', authRateLimiter, validateBody(weatherRequest), ah(async(req,res)=>{
 res.json(serialize(await PlanningService.weather(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
}));
router.post('/regions/:regionId/planning/resources/:proposalId/approve', authRateLimiter, validateBody(planApproval), ah(async(req,res)=>{
 res.json(serialize(await PlanningService.approve(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.proposalId),uuid.parse(req.headers['idempotency-key']),req.body)));
}));
router.post('/regions/:regionId/planning/resources/:proposalId/reject', authRateLimiter, validateBody(planRejection), ah(async(req,res)=>{
 res.json(serialize(await PlanningService.reject(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.proposalId),uuid.parse(req.headers['idempotency-key']),req.body)));
}));
router.get('/regions/:regionId/readiness', ah(async(req,res)=>{res.json(serialize(await regionalReadiness(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));}));
router.post('/regions/:regionId/planning/resources/:proposalId/edit',authRateLimiter,validateBody(planEdit),ah(async(req,res)=>{
 res.json(serialize(await PlanningService.edit(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.proposalId),uuid.parse(req.headers['idempotency-key']),req.body)));
}));
const spec=(handler:(req:any)=>Promise<unknown>)=>ah(async(req,res)=>{res.json(serialize(await handler(req)));});
router.get('/regions/:regionId/specialised',spec(req=>SpecialisedService.list(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),z.coerce.number().int().nonnegative().default(0).parse(req.query.after))));
router.get('/regions/:regionId/specialised/evidence',spec(req=>SpecialisedService.listEvidence(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),typeof req.query.kind==='string'?req.query.kind:undefined)));
router.post('/regions/:regionId/specialised/evidence',authRateLimiter,validateBody(evidenceCreate),spec(req=>SpecialisedService.createEvidence(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),req.body)));
router.post('/regions/:regionId/specialised/flood',authRateLimiter,validateBody(floodRequest),spec(req=>SpecialisedService.flood(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/watch',authRateLimiter,validateBody(watchRequest),spec(req=>SpecialisedService.watch(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/watch/schedule',authRateLimiter,spec(req=>SpecialisedService.scheduleWatch(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));
router.post('/regions/:regionId/specialised/heat',authRateLimiter,validateBody(heatRequest),spec(req=>SpecialisedService.heat(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/wind',authRateLimiter,validateBody(windRequest),spec(req=>SpecialisedService.wind(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/multi-region',authRateLimiter,validateBody(multiRegionRequest),spec(req=>SpecialisedService.multiRegion(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/outcome',authRateLimiter,validateBody(outcomeRequest),spec(req=>SpecialisedService.outcome(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/foresight',authRateLimiter,validateBody(foresightRequest),spec(req=>SpecialisedService.foresight(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/what-if',authRateLimiter,validateBody(whatIfRequest),spec(req=>SpecialisedService.whatIf(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/shortage',authRateLimiter,validateBody(shortageRequest),spec(req=>SpecialisedService.shortage(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/briefings',authRateLimiter,validateBody(briefingRequest),spec(req=>SpecialisedService.briefing(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/briefings/:briefingId/translate',authRateLimiter,validateBody(translateRequest),spec(req=>SpecialisedService.translate(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),uuid.parse(req.params.briefingId),req.body)));
router.post('/regions/:regionId/specialised/:recordId/approve',authRateLimiter,validateBody(reviewRequest),spec(req=>SpecialisedService.review(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.recordId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/after-action',authRateLimiter,validateBody(afterActionRequest),spec(req=>SpecialisedService.afterAction(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/specialised/gap-worklist',authRateLimiter,validateBody(gapWorklistRequest),spec(req=>SpecialisedService.gapWorklist(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),req.body)));
router.get('/regions/:regionId/specialised/gap-tasks',spec(req=>SpecialisedService.listGapTasks(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));
router.post('/regions/:regionId/specialised/gap-tasks/:taskId',authRateLimiter,validateBody(gapTaskUpdate),spec(req=>SpecialisedService.updateGapTask(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.taskId),req.body)));
router.get('/regions/:regionId/agent/runs',spec(req=>AgentRunsService.list(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));
router.get('/regions/:regionId/agent/runs/:runId',spec(req=>AgentRunsService.detail(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.runId))));
router.post('/regions/:regionId/agent/runs/:runId/follow-up',authRateLimiter,validateBody(followUpRequest),spec(req=>AgentRunsService.followUp(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.runId),uuid.parse(req.headers['idempotency-key']),req.body)));
router.post('/regions/:regionId/agent/runs/:runId/cancel',authRateLimiter,spec(req=>AgentRunsService.cancel(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.runId))));
router.get('/regions/:regionId/radar',spec(req=>IncidentsService.radar(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));
router.get('/regions/:regionId/incidents',spec(req=>IncidentsService.list(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),typeof req.query.status==='string'?req.query.status:undefined)));
router.post('/regions/:regionId/incidents/ingest',authRateLimiter,spec(req=>IncidentsService.ingest(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId))));
router.post('/regions/:regionId/incidents/:incidentId/verify',authRateLimiter,validateBody(incidentDecision),spec(req=>IncidentsService.decide(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.incidentId),'VERIFIED',req.body)));
router.post('/regions/:regionId/incidents/:incidentId/dismiss',authRateLimiter,validateBody(incidentDecision),spec(req=>IncidentsService.decide(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.incidentId),'DISMISSED',req.body)));
router.post('/regions/:regionId/incidents/:incidentId/locate',authRateLimiter,validateBody(incidentLocate),spec(req=>IncidentsService.locate(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.params.incidentId),req.body)));
const sse=(run:(req:any,events:(event:import('./meta-agent.js').AgentEvent)=>void)=>Promise<unknown>)=>ah(async(req:any,res:any)=>{
 res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
 const send=(event:string,data:unknown)=>{if(!res.writableEnded)res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');};
 try{const result=await run(req,event=>send(event.type,event));send('result',serialize(result));}
 catch(error:any){send('error',{code:error?.code??'REQUEST_FAILED',message:error?.message??'The assistant could not finish this request.'});}
 finally{if(!res.writableEnded)res.end();}
});
router.post('/regions/:regionId/conversations/weather/stream',authRateLimiter,validateBody(conversationRequest),sse((req,events)=>weatherConversation(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body,events)));
router.post('/regions/:regionId/conversations/mission/stream',authRateLimiter,validateBody(missionConversationRequest),sse((req,events)=>missionConversation(requestActor(req),uuid.parse(req.params.orgId),uuid.parse(req.params.regionId),uuid.parse(req.headers['idempotency-key']),req.body,events)));
export default router;
