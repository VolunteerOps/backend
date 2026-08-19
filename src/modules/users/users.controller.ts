import { Router } from 'express';
import { UsersService } from './users.service.js';
import { listUsersSchema, updateUserRoleSchema, updateUserStatusSchema } from './users.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAdmin, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateQuery, validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireCoordinator,
  validateQuery(listUsersSchema),
  ah(async (req, res) => {
    const result = await UsersService.findAll(req.query as any);
    res.json(serialize(result));
  })
);

router.get(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await UsersService.findById(id);
    res.json(serialize(result));
  })
);

router.patch(
  '/:id/role',
  requireAdmin,
  validateBody(updateUserRoleSchema),
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await UsersService.updateRole(id, req.body.role, req.user?.userId);
    res.json(serialize(result));
  })
);

router.patch(
  '/:id/status',
  requireAdmin,
  validateBody(updateUserStatusSchema),
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await UsersService.updateStatus(id, req.body.is_active, req.user?.userId);
    res.json(serialize(result));
  })
);

export default router;
