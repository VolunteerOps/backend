import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './config.js';
import { logger } from './logger.js';
import { databasePoolConfig } from './database-config.js';

const basePrisma = new PrismaClient({
  adapter: new PrismaPg(databasePoolConfig(config)),
  log: [{ emit: 'event', level: 'error' }],
});
// Prisma error messages can include SQL values; log only a stable event, never raw parameters.
(basePrisma as any).$on('error', () => logger.error('DATABASE_QUERY_FAILED'));

// Operational decisions use fresh database reads, without an external cache.
export const prisma = basePrisma
  .$extends({
    name: 'volunteerops-computed-fields',
    result: {
      volunteer: {
        isAvailable: {
          needs: { status: true },
          compute(volunteer) {
            return volunteer.status === 'AVAILABLE' || (volunteer.status as any) === 'ACTIVE' || (volunteer.status as any) === 'active';
          },
        },
        geoCoordinates: {
          needs: { latitude: true, longitude: true },
          compute(volunteer) {
            if (!volunteer.latitude || !volunteer.longitude) return null;
            return {
              type: 'Point',
              coordinates: [parseFloat(volunteer.longitude.toString()), parseFloat(volunteer.latitude.toString())],
            };
          },
        },
      },
      event: {
        durationHours: {
          needs: { startDate: true, endDate: true },
          compute(event) {
            if (!event.endDate || !event.startDate) return null;
            const diffMs = new Date(event.endDate).getTime() - new Date(event.startDate).getTime();
            return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
          },
        },
      },
      location: {
        geoPoint: {
          needs: { latitude: true, longitude: true },
          compute(loc) {
            return {
              type: 'Point',
              coordinates: [parseFloat(loc.longitude.toString()), parseFloat(loc.latitude.toString())],
            };
          },
        },
      },
    },
  });

export type ExtendedPrismaClient = typeof prisma;

// PostgreSQL explain-plan helper (analyzes query plans and buffer usage).
export async function explainAnalyzeQuery(sqlQuery: string): Promise<string> {
  try {
    const plan = await (basePrisma as any).$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${sqlQuery}`);
    return JSON.stringify(plan, null, 2);
  } catch (error) {
    logger.error('Failed to run EXPLAIN (ANALYZE, BUFFERS)', {}, error);
    throw error;
  }
}

// Capture old/new values atomically for the audit log.
export async function updateWithAudit<T>(
  modelName: string,
  id: number,
  userId: number | undefined,
  updateFn: (tx: Prisma.TransactionClient) => Promise<T>,
  action = 'UPDATE'
): Promise<{ oldState: any; newState: T }> {
  return await basePrisma.$transaction(async (tx: any) => {
    const oldState = await tx[modelName].findUnique({ where: { id } });
    const newState = await updateFn(tx);

    await tx.auditLog.create({
      data: {
        userId,
        action,
        entityType: modelName,
        entityId: id,
        oldValues: oldState ? JSON.parse(JSON.stringify(oldState)) : undefined,
        newValues: newState ? JSON.parse(JSON.stringify(newState)) : undefined,
      },
    });

    return { oldState, newState };
  });
}
