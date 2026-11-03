import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './core/config.js';
import { authenticate } from './middleware/auth.middleware.js';
import { createCookieMutationGuard } from './middleware/firebase-auth.middleware.js';
import { ApiError } from './core/errors.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { prisma } from './core/prisma.js';
import { databaseReadinessQuery, type DatabaseFacts } from './core/database-readiness.js';
import { createDatabaseReadinessHandler } from './middleware/readiness.middleware.js';

// Domain Module Routers
import enterpriseRouter from './modules/enterprise/enterprise.controller.js';
import billingRouter from './modules/billing/billing.controller.js';
import safetyRouter from './modules/safety/safety.controller.js';
import operationsRouter from './modules/operations/operations.controller.js';
import personalRouter from './modules/personal/personal.controller.js';
import authRouter from './modules/auth/auth.controller.js';
import organizationsRouter from './modules/organizations/organizations.controller.js';
import sentinelRouter from './modules/sentinel/sentinel.controller.js';
import draftsRouter from './modules/drafts/drafts.controller.js';
import portalRouter from './modules/sentinel/portal.controller.js';
import platformRouter from './modules/platform/platform.controller.js';
import usersRouter from './modules/users/users.controller.js';
import volunteersRouter from './modules/volunteers/volunteers.controller.js';
import skillsRouter from './modules/skills/skills.controller.js';
import locationsRouter from './modules/locations/locations.controller.js';
import eventsRouter from './modules/events/events.controller.js';
import deploymentsRouter from './modules/deployments/deployments.controller.js';
import fieldReportsRouter from './modules/fieldReports/fieldReports.controller.js';
import communicationsRouter from './modules/communications/communications.controller.js';
import telemetryRouter from './modules/telemetry/telemetry.controller.js';
import contactRouter from './modules/contact/contact.controller.js';
import notificationsRouter from './modules/notifications/notifications.controller.js';
import feedbackRouter from './modules/feedback/feedback.controller.js';
import analyticsRouter from './modules/analytics/analytics.controller.js';
import adminRouter from './modules/admin/admin.controller.js';
import storageRouter from './modules/storage/storage.controller.js';
import scopedStorageRouter from './modules/scoped-storage/scoped-storage.controller.js';

import { requestTelemetry } from './core/http-foundation.js';
import contract from './generated/prisma8/contract.json' with { type: 'json' };

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_CIDRS);
app.use(requestTelemetry);

// Security Headers & CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      // Keep local iteration convenient, but never reflect an unapproved origin
      // from a production deployment.
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['X-Request-ID', 'Retry-After', 'ETag'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Idempotency-Key', 'If-Match', 'Last-Event-ID'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(generalRateLimiter);
app.use('/sentinel', portalRouter);
app.use(authenticate);
app.use(createCookieMutationGuard(config.CORS_ORIGIN));

// API Root Discovery Handler
const apiDiscoveryHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    message: 'VolunteerOps Backend API',
    service: 'VolunteerOps-Enterprise-Backend',
    version: '2.0.0',
    status: 'AVAILABLE',
    readiness: '/api/ready',
    operational_routes: 'SCOPED_MISSION_WORKFLOW', legacy_operational_routes: 'TENANT_MIGRATION_REQUIRED',
    description: 'RESTful API for the VolunteerOps disaster response and operational field management platform',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      volunteers: '/api/volunteers',
      skills: '/api/skills',
      locations: '/api/locations',
      events: '/api/events',
      deployments: '/api/deployments',
      field_reports: '/api/field-reports',
      communications: '/api/communications',
      telemetry: '/api/telemetry',
      contact: '/api/contact',
      notifications: '/api/notifications',
      feedback: '/api/feedback',
      analytics: '/api/analytics',
      admin: '/api/admin',
      storage: '/api/storage',
    },
  });
};

// Root & API Discovery Endpoints
app.get('/', apiDiscoveryHandler);
app.get('/api', apiDiscoveryHandler);

// System Health & Diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'ALIVE',
    scope: 'process',
    service: 'VolunteerOps-Enterprise-Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', createDatabaseReadinessHandler(async () => {
  const rows = await prisma.$queryRawUnsafe<DatabaseFacts[]>(databaseReadinessQuery);
  if (rows.length !== 1) throw new Error('Database facts unavailable');
  return rows[0];
}, config.NODE_ENV === 'production', async () => {
  const rows = await prisma.$queryRawUnsafe<Array<{ core_hash: string }>>('SELECT core_hash FROM public.resq_schema_readiness');
  return rows.length === 1 && rows[0].core_hash === contract.storage.storageHash;
}));

app.get('/api/features', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ scope: 'configuration', operational_routes: 'SCOPED_MISSION_WORKFLOW', legacy_operational_routes: 'TENANT_MIGRATION_REQUIRED',
    identity: process.env.FIREBASE_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
    storage: config.S3_BUCKET ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
    weather: process.env.WEATHERNEXT_ACCESS_ENABLED === 'true' ? 'CONFIGURED_UNVERIFIED' : 'DISABLED',
    models: 'NOT_VALIDATED' });
});

// REST Domain Routes
app.use('/api/auth', authRouter);
app.use('/api', billingRouter);
app.use('/api', draftsRouter);
app.use('/api/organizations/:orgId/regions/:regionId/operations', operationsRouter);
app.use('/api/organizations/:orgId/regions/:regionId/safety', safetyRouter);
app.use('/api/platform', platformRouter);
app.use('/api', organizationsRouter);
app.use('/api/organizations/:orgId/sentinel', sentinelRouter);
app.use('/api/organizations/:orgId/regions/:regionId/storage', scopedStorageRouter);
// Global roles cannot authorize institution-private legacy tables without ownership.
app.use(['/api/users', '/api/volunteers', '/api/skills', '/api/locations', '/api/events',
  '/api/deployments', '/api/field-reports', '/api/communications', '/api/telemetry',
  '/api/notifications', '/api/feedback', '/api/analytics', '/api/admin', '/api/storage'],
  (_req, _res, next) => next(new ApiError(503, 'TENANT_MIGRATION_REQUIRED',
    'Operational access is unavailable until organization ownership is migrated')));
app.use('/api/users', usersRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/field-reports', fieldReportsRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/contact', contactRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/storage', storageRouter);

app.use('/api', personalRouter);
app.use('/api', enterpriseRouter);

// Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);
