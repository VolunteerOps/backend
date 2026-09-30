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
import authRouter from './modules/auth/auth.controller.js';
import organizationsRouter from './modules/organizations/organizations.controller.js';
import sentinelRouter from './modules/sentinel/sentinel.controller.js';
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

export const app = express();

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
      if (config.CORS_ORIGIN.includes('*') || config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      // Keep local iteration convenient, but never reflect an unapproved origin
      // from a production deployment.
      return callback(null, config.NODE_ENV !== 'production');
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Refresh-Token'],
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
    status: 'OPERATIONAL',
    environment: config.NODE_ENV,
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
    status: 'OPERATIONAL',
    service: 'VolunteerOps-Enterprise-Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    memory_usage: process.memoryUsage(),
  });
});

app.get('/api/ready', createDatabaseReadinessHandler(async () => {
  const rows = await prisma.$queryRawUnsafe<DatabaseFacts[]>(databaseReadinessQuery);
  if (rows.length !== 1) throw new Error('Database facts unavailable');
  return rows[0];
}, config.NODE_ENV === 'production'));

// REST Domain Routes
app.use('/api/auth', authRouter);
app.use('/api/platform', platformRouter);
app.use('/api', organizationsRouter);
app.use('/api/organizations/:orgId/sentinel', sentinelRouter);
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

// Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);
