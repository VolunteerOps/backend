import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { serialize } from '../../lib/serialize.js';

const router = Router();

router.get(
  '/overview',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getOverview();
    res.json(serialize(data));
  })
);

router.get(
  '/volunteer-stats',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getVolunteerStats();
    res.json(serialize(data));
  })
);

router.get(
  '/event-stats',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getEventStats();
    res.json(serialize(data));
  })
);

router.get(
  '/deployment-stats',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getDeploymentStats();
    res.json(serialize(data));
  })
);

router.get(
  '/skill-distribution',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getSkillDistribution();
    res.json(serialize(data));
  })
);

router.get(
  '/event-type-distribution',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getEventTypeDistribution();
    res.json(serialize(data));
  })
);

router.get(
  '/monthly-deployments',
  requireAuth,
  ah(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const data = await AnalyticsService.getMonthlyDeployments(year);
    res.json(serialize(data));
  })
);

router.get(
  '/top-volunteers',
  requireAuth,
  ah(async (req, res) => {
    const limit = Number(req.query.limit) || 10;
    const data = await AnalyticsService.getTopVolunteers(limit);
    res.json(serialize(data));
  })
);

router.get(
  '/response-time-stats',
  requireAuth,
  ah(async (_req, res) => {
    const data = await AnalyticsService.getResponseTimeStats();
    res.json(serialize(data));
  })
);

router.post(
  '/ai-query',
  requireAuth,
  ah(async (req, res) => {
    const Q = z.object({ prompt: z.string().min(2) });
    const { prompt } = Q.parse(req.body);
    const response = await AnalyticsService.handleAIQuery(prompt);
    res.json(serialize(response));
  })
);

export default router;
