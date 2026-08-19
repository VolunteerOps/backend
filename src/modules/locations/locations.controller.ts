import { Router } from 'express';
import { LocationsService } from './locations.service.js';
import { createLocationSchema, updateLocationSchema } from './locations.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await LocationsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const loc = await LocationsService.findById(Number(req.params.id));
    res.json(serialize(loc));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createLocationSchema),
  ah(async (req, res) => {
    const created = await LocationsService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateLocationSchema),
  ah(async (req, res) => {
    const updated = await LocationsService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await LocationsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
