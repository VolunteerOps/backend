import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { requestActor } from './context.js';
import { OrganizationsService } from './organizations.service.js';
import { idSchema, invitationSchema, acceptInvitationSchema, membershipStatusSchema, reasonSchema } from './organizations.schema.js';
import { serialize } from '../../lib/serialize.js';
import { DevicesService, registerDeviceSchema, deviceConsentSchema, heartbeatSchema } from './devices.service.js';

const router = Router();
router.use(['/me', '/invitations', '/organizations'], requireAuth, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/me/memberships', ah(async (req, res) => res.json(serialize(await OrganizationsService.memberships(requestActor(req))))));
router.post('/invitations/accept', authRateLimiter, validateBody(acceptInvitationSchema), ah(async (req, res) => {
  res.json(await OrganizationsService.accept(requestActor(req), req.body.token));
}));
router.get('/organizations/:orgId', ah(async (req, res) => {
  res.json(await OrganizationsService.detail(requestActor(req), idSchema.parse(req.params.orgId)));
}));
router.get('/organizations/:orgId/memberships', ah(async (req, res) => {
  res.json(serialize(await OrganizationsService.roster(requestActor(req), idSchema.parse(req.params.orgId),
    req.query.after === undefined ? undefined : idSchema.parse(req.query.after))));
}));
router.post('/organizations/:orgId/invitations', authRateLimiter, validateBody(invitationSchema), ah(async (req, res) => {
  res.status(201).json(await OrganizationsService.invite(requestActor(req), idSchema.parse(req.params.orgId), req.body));
}));
router.delete('/organizations/:orgId/invitations/:invitationId', validateBody(z.object({ reason: reasonSchema }).strict()), ah(async (req, res) => {
  res.json(await OrganizationsService.revokeInvitation(requestActor(req), idSchema.parse(req.params.orgId), idSchema.parse(req.params.invitationId), req.body.reason));
}));
router.patch('/organizations/:orgId/memberships/:memberId', validateBody(membershipStatusSchema), ah(async (req, res) => {
  res.json(await OrganizationsService.updateMembership(requestActor(req), idSchema.parse(req.params.orgId), idSchema.parse(req.params.memberId), req.body));
}));
router.get('/organizations/:orgId/audit', ah(async (req, res) => {
  res.json(serialize(await OrganizationsService.audit(requestActor(req), idSchema.parse(req.params.orgId),
    req.query.after === undefined ? undefined : idSchema.parse(req.query.after))));
}));
router.get('/organizations/:orgId/me/devices', ah(async (req, res) => {
  res.json(serialize(await DevicesService.list(requestActor(req), idSchema.parse(req.params.orgId))));
}));
router.post('/organizations/:orgId/me/devices', authRateLimiter, validateBody(registerDeviceSchema), ah(async (req, res) => {
  res.status(201).json(serialize(await DevicesService.register(requestActor(req), idSchema.parse(req.params.orgId), req.body)));
}));
router.put('/organizations/:orgId/me/devices/:deviceId/consent', validateBody(deviceConsentSchema), ah(async (req, res) => {
  res.json(serialize(await DevicesService.consent(requestActor(req), idSchema.parse(req.params.orgId), idSchema.parse(req.params.deviceId), req.body)));
}));
router.delete('/organizations/:orgId/me/devices/:deviceId', ah(async (req, res) => {
  res.json(await DevicesService.revoke(requestActor(req), idSchema.parse(req.params.orgId), idSchema.parse(req.params.deviceId)));
}));
router.post('/organizations/:orgId/me/devices/:deviceId/heartbeats', validateBody(heartbeatSchema), ah(async (req, res) => {
  res.status(202).json(serialize(await DevicesService.heartbeat(requestActor(req), idSchema.parse(req.params.orgId), idSchema.parse(req.params.deviceId), req.body)));
}));
export default router;
