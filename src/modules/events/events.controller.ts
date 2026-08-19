import { Router } from 'express';
import { EventsService } from './events.service.js';
import { createEventSchema, updateEventSchema } from './events.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await EventsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/active',
  requireAuth,
  ah(async (_req, res) => {
    const list = await EventsService.findActive();
    res.json(serialize(list));
  })
);

router.get(
  '/by-type/:type',
  requireAuth,
  ah(async (req, res) => {
    const list = await EventsService.findByType(req.params.type);
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const event = await EventsService.findById(Number(req.params.id));
    res.json(serialize(event));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createEventSchema),
  ah(async (req, res) => {
    const created = await EventsService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateEventSchema),
  ah(async (req, res) => {
    const updated = await EventsService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await EventsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
