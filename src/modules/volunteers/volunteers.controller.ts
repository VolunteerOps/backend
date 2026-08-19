import { Router } from 'express';
import { VolunteersService } from './volunteers.service.js';
import { createVolunteerSchema, updateVolunteerSchema, addSkillSchema, updateSkillLinkSchema, proximityQuerySchema } from './volunteers.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const list = await VolunteersService.findAll(req.query as any);
    res.json(serialize(list));
  })
);

router.get(
  '/available',
  requireAuth,
  ah(async (_req, res) => {
    const list = await VolunteersService.findAvailable();
    res.json(serialize(list));
  })
);

router.get(
  '/nearby',
  requireAuth,
  validateQuery(proximityQuerySchema),
  ah(async (req, res) => {
    const { lat, lng, radius_km } = req.query as any;
    const list = await VolunteersService.findNearby(lat, lng, radius_km);
    res.json(serialize(list));
  })
);

router.get(
  '/by-skill/:skillId',
  requireAuth,
  ah(async (req, res) => {
    const list = await VolunteersService.findBySkill(Number(req.params.skillId));
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const volunteer = await VolunteersService.findById(Number(req.params.id));
    res.json(serialize(volunteer));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createVolunteerSchema),
  ah(async (req, res) => {
    const created = await VolunteersService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireAuth,
  validateBody(updateVolunteerSchema),
  ah(async (req, res) => {
    const updated = await VolunteersService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await VolunteersService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

router.post(
  '/:id/skills',
  requireAuth,
  validateBody(addSkillSchema),
  ah(async (req, res) => {
    const created = await VolunteersService.addSkill(Number(req.params.id), req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/skills/:linkId',
  requireAuth,
  validateBody(updateSkillLinkSchema),
  ah(async (req, res) => {
    const updated = await VolunteersService.updateSkillLink(Number(req.params.linkId), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/skills/:linkId',
  requireAuth,
  ah(async (req, res) => {
    await VolunteersService.removeSkillLink(Number(req.params.linkId));
    res.status(204).send();
  })
);

export default router;
