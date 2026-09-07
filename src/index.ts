import { app } from './app.js';
import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { prisma } from './core/prisma.js';

const server = app.listen(config.PORT, '0.0.0.0', () => {
  logger.info(`🚀 VolunteerOps Enterprise Backend listening on port ${config.PORT} [${config.NODE_ENV}]`);
  logger.info(`📡 Healthcheck endpoint available at http://localhost:${config.PORT}/api/health`);
});

// Graceful Shutdown Handlers
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown sequence...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await (prisma as any).$disconnect();
    logger.info('Database connection pool disconnected.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
