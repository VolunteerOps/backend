import { Router } from 'express';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { requestActor } from '../organizations/context.js';
import { provisionSchema, idSchema, lifecycleSchema, verificationSchema, invitationSchema } from '../organizations/organizations.schema.js';
import { PlatformService } from './platform.service.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();
router.use(requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/organizations', ah(async (req, res) => {
  res.json(serialize(await PlatformService.list(requestActor(req), req.query.after === undefined ? undefined : idSchema.parse(req.query.after))));
}));
router.post('/organizations', validateBody(provisionSchema), ah(async (req, res) => {
  res.status(201).json(serialize(await PlatformService.provision(requestActor(req), req.body)));
}));
for (const [path, state] of [['activate', 'ACTIVE'], ['suspend', 'SUSPENDED'], ['offboard', 'OFFBOARDING']] as const) {
  router.post(`/organizations/:orgId/${path}`, validateBody(lifecycleSchema), ah(async (req, res) => {
    res.json(serialize(await PlatformService.transition(requestActor(req), idSchema.parse(req.params.orgId), state, req.body)));
  }));
}
router.post('/organizations/:orgId/verification', validateBody(verificationSchema), ah(async (req, res) => {
  res.json(serialize(await PlatformService.recordVerification(requestActor(req), idSchema.parse(req.params.orgId), req.body)));
}));
router.post('/organizations/:orgId/invitations', validateBody(invitationSchema), ah(async (req, res) => {
  res.status(201).json(await PlatformService.nominate(requestActor(req), idSchema.parse(req.params.orgId), req.body));
}));
router.post('/organizations/:orgId/complete-offboarding',validateBody(verificationSchema),ah(async(req,res)=>res.json(serialize(await PlatformService.completeOffboarding(requestActor(req),idSchema.parse(req.params.orgId),req.body)))));
export default router;
