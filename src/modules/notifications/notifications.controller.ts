import { Router } from 'express';
import { NotificationsService } from './notifications.service.js';
import { createNotificationSchema, bulkNotificationSchema } from './notifications.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await NotificationsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/by-volunteer/:vid',
  requireAuth,
  ah(async (req, res) => {
    const list = await NotificationsService.findByVolunteer(Number(req.params.vid));
    res.json(serialize(list));
  })
);

router.get(
  '/by-event/:eid',
  requireAuth,
  ah(async (req, res) => {
    const list = await NotificationsService.findByEvent(Number(req.params.eid));
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const item = await NotificationsService.findById(Number(req.params.id));
    res.json(serialize(item));
  })
);

router.post(
  '/',
  requireCoordinator,
  validateBody(createNotificationSchema),
  ah(async (req, res) => {
    const created = await NotificationsService.create(req.body, req.user?.userId);
    res.status(201).json(serialize(created));
  })
);

router.post(
  '/bulk',
  requireCoordinator,
  validateBody(bulkNotificationSchema),
  ah(async (req, res) => {
    const result = await NotificationsService.createBulk(
      req.body.volunteer_ids,
      req.body.notification,
      req.user?.userId
    );
    res.status(201).json(serialize(result));
  })
);

router.patch(
  '/:id/read',
  requireAuth,
  ah(async (req, res) => {
    const updated = await NotificationsService.markAsRead(Number(req.params.id));
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await NotificationsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
