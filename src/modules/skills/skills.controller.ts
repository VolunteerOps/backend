import { Router } from 'express';
import { SkillsService } from './skills.service.js';
import { createSkillSchema, updateSkillSchema, semanticMatchSchema } from './skills.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await SkillsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/categories',
  requireAuth,
  ah(async (_req, res) => {
    const categories = await SkillsService.findCategories();
    res.json(serialize(categories));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const skill = await SkillsService.findById(Number(req.params.id));
    res.json(serialize(skill));
  })
);

router.get(
  '/:id/volunteer-count',
  requireAuth,
  ah(async (req, res) => {
    const result = await SkillsService.getVolunteerCount(Number(req.params.id));
    res.json(serialize(result));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createSkillSchema),
  ah(async (req, res) => {
    const created = await SkillsService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateSkillSchema),
  ah(async (req, res) => {
    const updated = await SkillsService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await SkillsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

router.post(
  '/semantic-match',
  requireAuth,
  validateBody(semanticMatchSchema),
  ah(async (req, res) => {
    const { incident_description, limit } = req.body;
    const matches = await SkillsService.semanticMatch(incident_description, limit);
    res.json(serialize(matches));
  })
);

export default router;
