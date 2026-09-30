import { z } from 'zod';
import { ApiError } from '../core/errors.js';
import { PermanentJobError, type JobHandler } from '../core/jobs.js';
import { withActor, requireOrganization } from '../modules/organizations/context.js';

const payloadSchema = z.object({
  organizationId: z.string().uuid(), deviceId: z.string().uuid(), membershipId: z.string().uuid(),
  receiptId: z.string().uuid(), consentVersion: z.number().int().positive(),
  batteryPercent: z.number().int().min(0).max(100), recordedAt: z.string().datetime(),
  actor: z.object({ userId: z.number().int().positive(), identity: z.object({
    projectId: z.string(), uid: z.string(), email: z.string().email(), authTime: z.number().int(),
    expiresAt: z.number().int(), signInProvider: z.string(), secondFactor: z.enum(['totp', 'phone']).nullable(),
  }).strict() }).strict(),
}).strict();

export const deviceHeartbeatHandler: JobHandler = async (payload, signal, job) => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new PermanentJobError();
  const data = parsed.data;
  try {
    await withActor(data.actor, async tx => {
      const { member } = await requireOrganization(tx, data.actor, data.organizationId, 'organization.read');
      if (member.id !== data.membershipId || signal.aborted) throw new PermanentJobError();
      // Hold the fenced job row until both the effect and completion commit.
      const lease = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM durable_jobs
        WHERE id = ${job.id} AND fence = ${job.fence} AND lease_owner = ${job.lease_owner}
          AND state = 'RUNNING' AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC')
          AND deadline > (clock_timestamp() AT TIME ZONE 'UTC') FOR UPDATE`;
      if (lease.length !== 1) throw new PermanentJobError();
      const device = await tx.memberDevice.findFirst({ where: { id: data.deviceId,
        organizationId: data.organizationId, membershipId: member.id, revokedAt: null,
        sensingConsent: true, consentVersion: data.consentVersion } });
      const receipt = await tx.ingressReceipt.findFirst({ where: { id: data.receiptId,
        organizationId: data.organizationId, deviceId: data.deviceId, consentVersion: data.consentVersion } });
      if (!device || !receipt) throw new PermanentJobError();
      const recordedAt = new Date(data.recordedAt);
      if (!device.lastHeartbeatAt || device.lastHeartbeatAt < recordedAt) {
        await tx.memberDevice.update({ where: { id: device.id }, data: {
          lastHeartbeatAt: recordedAt, batteryPercent: data.batteryPercent,
        } });
      }
      const completed = await tx.$executeRaw`UPDATE durable_jobs SET state = 'COMPLETED',
        completed_at = (clock_timestamp() AT TIME ZONE 'UTC'), lease_owner = NULL, lease_until = NULL
        WHERE id = ${job.id} AND fence = ${job.fence} AND lease_owner = ${job.lease_owner}
          AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND deadline > (clock_timestamp() AT TIME ZONE 'UTC')`;
      if (completed !== 1 || signal.aborted) throw new Error('LEASE_EXPIRED');
    });
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.statusCode)) throw new PermanentJobError();
    throw error;
  }
};
