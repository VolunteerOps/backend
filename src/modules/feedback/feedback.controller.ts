import { Router } from 'express';
import { FeedbackService } from './feedback.service.js';
import { createFeedbackSchema, updateFeedbackSchema } from './feedback.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await FeedbackService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/by-volunteer/:vid',
  requireAuth,
  ah(async (req, res) => {
    const list = await FeedbackService.findByVolunteer(Number(req.params.vid));
    res.json(serialize(list));
  })
);

router.get(
  '/by-deployment/:did',
  requireAuth,
  ah(async (req, res) => {
    const list = await FeedbackService.findByDeployment(Number(req.params.did));
    res.json(serialize(list));
  })
);

router.get(
  '/average-rating/:vid',
  requireAuth,
  ah(async (req, res) => {
    const result = await FeedbackService.getAverageRating(Number(req.params.vid));
    res.json(serialize(result));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const fb = await FeedbackService.findById(Number(req.params.id));
    res.json(serialize(fb));
  })
);

router.post(
  '/',
  requireAuth,
  validateBody(createFeedbackSchema),
  ah(async (req, res) => {
    const created = await FeedbackService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateFeedbackSchema),
  ah(async (req, res) => {
    const updated = await FeedbackService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await FeedbackService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
