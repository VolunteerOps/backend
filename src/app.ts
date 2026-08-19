import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './core/config.js';
import { authenticate } from './middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';

// Domain Module Routers
import authRouter from './modules/auth/auth.controller.js';
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

export const app = express();

// Security Headers & CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (config.CORS_ORIGIN.includes('*') || config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, pin in production
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(generalRateLimiter);
app.use(authenticate);

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

// REST Domain Routes
app.use('/api/auth', authRouter);
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

// Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);
