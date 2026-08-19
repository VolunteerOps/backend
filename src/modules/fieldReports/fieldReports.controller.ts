import { Router } from 'express';
import { FieldReportsService } from './fieldReports.service.js';
import { createFieldReportSchema, updateFieldReportSchema } from './fieldReports.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth, requireCoordinator } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (_req, res) => {
    const list = await FieldReportsService.findAll();
    res.json(serialize(list));
  })
);

router.get(
  '/by-deployment/:did',
  requireAuth,
  ah(async (req, res) => {
    const list = await FieldReportsService.findByDeployment(Number(req.params.did));
    res.json(serialize(list));
  })
);

router.get(
  '/by-event/:eid',
  requireAuth,
  ah(async (req, res) => {
    const list = await FieldReportsService.findByEvent(Number(req.params.eid));
    res.json(serialize(list));
  })
);

router.get(
  '/by-type/:type',
  requireAuth,
  ah(async (req, res) => {
    const list = await FieldReportsService.findByType(req.params.type);
    res.json(serialize(list));
  })
);

router.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const report = await FieldReportsService.findById(Number(req.params.id));
    res.json(serialize(report));
  })
);

router.post(
  '/',
  requireAuth,
  validateBody(createFieldReportSchema),
  ah(async (req, res) => {
    const created = await FieldReportsService.create(req.body);
    res.status(201).json(serialize(created));
  })
);

router.patch(
  '/:id',
  requireCoordinator,
  validateBody(updateFieldReportSchema),
  ah(async (req, res) => {
    const updated = await FieldReportsService.update(Number(req.params.id), req.body);
    res.json(serialize(updated));
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  ah(async (req, res) => {
    await FieldReportsService.delete(Number(req.params.id));
    res.status(204).send();
  })
);

export default router;
