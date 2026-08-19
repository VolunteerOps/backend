import { Router } from 'express';
import { AdminService } from './admin.service.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAdmin } from '../../middleware/auth.middleware.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/audit-logs',
  requireAdmin,
  ah(async (_req, res) => {
    const logs = await AdminService.getAuditLogs();
    res.json(serialize(logs));
  })
);

router.get(
  '/dispatch-jobs',
  requireAdmin,
  ah(async (_req, res) => {
    const jobs = await AdminService.getDispatchJobs();
    res.json(serialize(jobs));
  })
);

router.post(
  '/db-maintenance',
  requireAdmin,
  ah(async (_req, res) => {
    const result = await AdminService.runDbMaintenance();
    res.json(serialize(result));
  })
);

router.post(
  '/refresh-materialized-views',
  requireAdmin,
  ah(async (_req, res) => {
    const result = await AdminService.refreshMaterializedViews();
    res.json(serialize(result));
  })
);

export default router;
