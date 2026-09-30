import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';
import { ah } from '../../middleware/asyncHandler.js';
import { validateBody } from '../../middleware/validator.js';
import { requestActor } from '../organizations/context.js';
import { serialize } from '../../lib/serialize.js';
import { ScopedStorageService } from './scoped-storage.service.js';
import { uploadIntentSchema } from './scoped-storage.schema.js';

const router = Router({ mergeParams: true }), service = new ScopedStorageService(), uuid = z.string().uuid();
const storageRateLimiter = rateLimit({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user!.userId),
  message: { error: 'rate_limited', message: 'Too many storage requests. Try again shortly.' } });
router.use(requireAuth, storageRateLimiter, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.post('/upload-intents', validateBody(uploadIntentSchema), ah(async (req, res) => {
  res.status(201).json(serialize(await service.create(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), req.body)));
}));
router.post('/:objectId/complete', validateBody(z.object({}).strict()), ah(async (req, res) => {
  res.json(await service.complete(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), uuid.parse(req.params.objectId)));
}));
router.post('/:objectId/download', validateBody(z.object({}).strict()), ah(async (req, res) => {
  res.json(await service.download(requestActor(req), uuid.parse(req.params.orgId), uuid.parse(req.params.regionId), uuid.parse(req.params.objectId)));
}));
export default router;
