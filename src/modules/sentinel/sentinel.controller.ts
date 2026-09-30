import { Router } from 'express';
import { z } from 'zod';
import { askSentinel, agentQuestionSchema } from './sentinel.agent.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { ah } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validator.js';
import { requestActor } from '../organizations/context.js';
import { serialize } from '../../lib/serialize.js';
import { SentinelService, regionConfigSchema, refreshSchema } from './sentinel.service.js';

const router = Router({ mergeParams: true });
const uuid = z.string().uuid();
router.use(requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/regions', ah(async (req, res) => {
  res.json(serialize(await SentinelService.regions(requestActor(req), uuid.parse(req.params.orgId))));
}));
router.put('/regions/:regionId', validateBody(regionConfigSchema), ah(async (req, res) => {
  res.json(serialize(await SentinelService.configureRegion(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), req.body)));
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
export default router;
