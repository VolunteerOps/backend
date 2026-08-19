import { Router } from 'express';
import { ContactService } from './contact.service.js';
import { submitContactSchema, updateContactStatusSchema } from './contact.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { contactRateLimiter } from '../../middleware/rateLimiter.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

// Public landing site submission endpoint (rate limited)
router.post(
  '/',
  contactRateLimiter,
  validateBody(submitContactSchema),
  ah(async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress;
    const submission = await ContactService.submitInquiry(req.body, ip);
    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out. The VolunteerOps crisis operations team has received your message.',
      submission_id: submission.id,
    });
  })
);

// Protected Admin triage endpoints
router.get(
  '/',
  requireCoordinator,
  ah(async (req, res) => {
    const status = req.query.status as string | undefined;
    const list = await ContactService.findAll(status);
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    const sub = await ContactService.findById(Number(req.params.id));
    res.json(serialize(sub));
  })
);

router.patch(
  '/:id/status',
  requireCoordinator,
  validateBody(updateContactStatusSchema),
  ah(async (req, res) => {
    const updated = await ContactService.updateStatus(
      Number(req.params.id),
      req.body.status,
      req.body.response_notes
    );
    res.json(serialize(updated));
  })
);

export default router;
