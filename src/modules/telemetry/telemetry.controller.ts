import { Router } from 'express';
import { TelemetryService } from './telemetry.service.js';
import { pingSchema, sosBeaconSchema } from './telemetry.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.post(
  '/ping',
  requireAuth,
  validateBody(pingSchema),
  ah(async (req, res) => {
    const result = await TelemetryService.recordPing(req.body);
    res.status(201).json(serialize(result));
  })
);

router.post(
  '/sos',
  requireAuth,
  validateBody(sosBeaconSchema),
  ah(async (req, res) => {
    const result = await TelemetryService.triggerSOS(req.body);
    res.status(201).json(result);
  })
);

router.get(
  '/active-fleet',
  requireAuth,
  ah(async (_req, res) => {
    const fleet = await TelemetryService.getActiveFleet();
    res.json(serialize(fleet));
  })
);

router.get('/live-stream', (req, res) => {
  TelemetryService.subscribeToStream(res);
});

export default router;
