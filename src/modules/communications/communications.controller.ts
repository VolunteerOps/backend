import { Router } from 'express';
import { CommunicationsService } from './communications.service.js';
import { sendMessageSchema, broadcastAlertSchema } from './communications.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/channels',
  requireAuth,
  ah(async (_req, res) => {
    const channels = await CommunicationsService.getChannels();
    res.json(serialize(channels));
  })
);

router.get(
  '/messages/:channelId',
  requireAuth,
  ah(async (req, res) => {
    const messages = await CommunicationsService.getMessages(req.params.channelId);
    res.json(serialize(messages));
  })
);

router.post(
  '/messages',
  requireAuth,
  validateBody(sendMessageSchema),
  ah(async (req, res) => {
    const sender = {
      id: req.user?.userId,
      name: req.user?.name || 'Field Responder',
      role: req.user?.role || 'volunteer',
    };
    const msg = await CommunicationsService.sendMessage(req.body, sender);
    res.status(201).json(serialize(msg));
  })
);

router.post(
  '/broadcast-alert',
  requireCoordinator,
  validateBody(broadcastAlertSchema),
  ah(async (req, res) => {
    const sender = {
      id: req.user?.userId,
      name: req.user?.name || 'Operations Command',
      role: req.user?.role || 'COORDINATOR',
    };
    const alerts = await CommunicationsService.broadcastAlert(req.body, sender);
    res.status(201).json(serialize(alerts));
  })
);

// Realtime SSE Stream Endpoint
router.get('/stream', (req, res) => {
  CommunicationsService.subscribeToStream(res);
});

export default router;
