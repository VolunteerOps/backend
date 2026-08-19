import { Router } from 'express';
import { DeploymentsService } from './deployments.service.js';
import { createDeploymentSchema, updateDeploymentSchema, checkInSchema, autoDispatchSchema } from './deployments.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await DeploymentsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/by-volunteer/:vid',
  requireAuth,
  ah(async (req, res) => {
    const list = await DeploymentsService.findByVolunteer(Number(req.params.vid));
    res.json(serialize(list));
  })
);

router.get(
  '/by-event/:eid',
  requireAuth,
  ah(async (req, res) => {
    const list = await DeploymentsService.findByEvent(Number(req.params.eid));
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const dep = await DeploymentsService.findById(Number(req.params.id));
    res.json(serialize(dep));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createDeploymentSchema),
  ah(async (req, res) => {
    const created = await DeploymentsService.create(req.body, req.user?.userId);
    res.status(201).json(serialize(created));
  })
);

router.post(
  '/auto-dispatch',
  requireCoordinator,
  validateBody(autoDispatchSchema),
  ah(async (req, res) => {
    const { event_id, count, required_skill_id } = req.body;
    const dispatched = await DeploymentsService.autoDispatch(event_id, count, required_skill_id, req.user?.userId);
    res.status(201).json(serialize(dispatched));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateDeploymentSchema),
  ah(async (req, res) => {
    const updated = await DeploymentsService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.post(
  '/:id/check-in',
  requireAuth,
  validateBody(checkInSchema),
  ah(async (req, res) => {
    const result = await DeploymentsService.checkIn(Number(req.params.id), req.body);
    res.json(serialize(result));
  })
);

router.post(
  '/:id/complete',
  requireAuth,
  ah(async (req, res) => {
    const result = await DeploymentsService.complete(Number(req.params.id));
    res.json(serialize(result));
  })
);

router.post(
  '/:id/cancel',
  requireAuth,
  ah(async (req, res) => {
    const result = await DeploymentsService.cancel(Number(req.params.id));
    res.json(serialize(result));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await DeploymentsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
