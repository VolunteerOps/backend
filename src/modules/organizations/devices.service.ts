import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, type Actor, type TenantTransaction } from './context.js';

export const registerDeviceSchema = z.object({
  installation_id: z.string().uuid(), platform: z.enum(['ANDROID', 'IOS', 'WEB', 'DESKTOP']),
}).strict();
export const deviceConsentSchema = z.object({
  expected_version: z.number().int().positive(), location: z.boolean(), sensing: z.boolean(), relay: z.boolean(),
}).strict().refine(value => !value.sensing || value.location, { message: 'Sensing requires location consent' });
// This foundation accepts bounded device heartbeats; hazard feature ingestion belongs to Step 4.
export const heartbeatSchema = z.object({
  message_id: z.string().uuid(), consent_version: z.number().int().positive(),
  recorded_at: z.string().datetime(), battery_percent: z.number().int().min(0).max(100),
}).strict();

async function audit(tx: TenantTransaction, actor: Actor, organizationId: string, action: string, deviceId: string) {
  await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
    action, reason: 'Device owner request', metadata: { device_id: deviceId } } });
}

export const DevicesService = {
  async list(actor: Actor, organizationId: string) {
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'organization.read');
      return tx.memberDevice.findMany({ where: { organizationId }, orderBy: { id: 'asc' }, take: 100 });
    });
  },
  async register(actor: Actor, organizationId: string, input: z.infer<typeof registerDeviceSchema>) {
    const data = registerDeviceSchema.parse(input);
    return withActor(actor, async tx => {
      const { member } = await requireOrganization(tx, actor, organizationId, 'organization.read');
      const key = { organizationId, membershipId: member.id, installationId: data.installation_id };
      const existing = await tx.memberDevice.findUnique({ where: { organizationId_membershipId_installationId: key } });
      if (existing) {
        if (existing.revokedAt) throw ApiError.conflict('Use a new installation identifier after revocation', 'DEVICE_REVOKED');
        if (existing.platform !== data.platform) throw ApiError.conflict('Installation platform cannot change', 'DEVICE_CONFLICT');
        return existing;
      }
      if (await tx.memberDevice.count({ where: { organizationId, membershipId: member.id, revokedAt: null } }) >= 10) {
        throw new ApiError(429, 'DEVICE_LIMIT', 'Revoke an unused device before registering another');
      }
      const device = await tx.memberDevice.create({ data: { ...key, id: randomUUID(), platform: data.platform } });
      await audit(tx, actor, organizationId, 'DEVICE_REGISTERED', device.id);
      return device;
    });
  },
  async consent(actor: Actor, organizationId: string, deviceId: string, input: z.infer<typeof deviceConsentSchema>) {
    const data = deviceConsentSchema.parse(input);
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'organization.read');
      const device = await tx.memberDevice.findFirst({ where: { id: deviceId, organizationId, revokedAt: null } });
      if (!device) throw ApiError.notFound('Device');
      if (device.consentVersion !== data.expected_version) throw ApiError.conflict('Consent changed; reload before retrying', 'STALE_VERSION');
      const updated = await tx.memberDevice.update({ where: { id: deviceId }, data: {
        consentVersion: { increment: 1 }, locationConsent: data.location,
        sensingConsent: data.sensing, relayConsent: data.relay, updatedAt: new Date(),
      } });
      await audit(tx, actor, organizationId, 'DEVICE_CONSENT_CHANGED', deviceId);
      return updated;
    });
  },
  async revoke(actor: Actor, organizationId: string, deviceId: string) {
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'organization.read');
      const device = await tx.memberDevice.findFirst({ where: { id: deviceId, organizationId } });
      if (!device) throw ApiError.notFound('Device');
      if (device.revokedAt) return { revoked: true };
      await tx.memberDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date(),
        consentVersion: { increment: 1 }, locationConsent: false, sensingConsent: false, relayConsent: false, updatedAt: new Date() } });
      await audit(tx, actor, organizationId, 'DEVICE_REVOKED', deviceId);
      return { revoked: true };
    });
  },
  async heartbeat(actor: Actor, organizationId: string, deviceId: string, input: z.infer<typeof heartbeatSchema>) {
    const data = heartbeatSchema.parse(input);
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'organization.read');
      const device = await tx.memberDevice.findFirst({ where: { id: deviceId, organizationId, revokedAt: null } });
      if (!device) throw ApiError.notFound('Device');
      if (!device.sensingConsent || device.consentVersion !== data.consent_version) {
        throw ApiError.forbidden('Current sensing consent is required', 'CONSENT_REQUIRED');
      }
      const key = { organizationId, deviceId, messageId: data.message_id };
      const existing = await tx.ingressReceipt.findUnique({ where: { organizationId_deviceId_messageId: key } });
      if (existing) {
        if (existing.payloadHash !== hash) throw ApiError.conflict('Message identifier already used for different content', 'REPLAY_CONFLICT');
        return { receipt_id: existing.id, accepted_at: existing.acceptedAt, duplicate: true };
      }
      const age = Date.now() - Date.parse(data.recorded_at);
      if (age < -30_000 || age > 300_000) throw ApiError.badRequest('Heartbeat timestamp is outside the acceptance window');
      const minuteAgo = new Date(Date.now() - 60_000);
      if (await tx.ingressReceipt.count({ where: { organizationId, deviceId, acceptedAt: { gte: minuteAgo } } }) >= 60) {
        throw new ApiError(429, 'INGRESS_LIMIT', 'Device heartbeat budget exhausted');
      }
      const receipt = await tx.ingressReceipt.create({ data: { ...key, id: randomUUID(), payloadHash: hash,
        consentVersion: device.consentVersion, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      await tx.durableJob.create({ data: { id: randomUUID(), organizationId, priority: 1, queue: 'device', kind: 'DEVICE_HEARTBEAT',
        businessKey: JSON.stringify(['device', organizationId, deviceId, data.message_id]),
        payload: { organizationId, deviceId, membershipId: device.membershipId, receiptId: receipt.id,
          actor: JSON.parse(JSON.stringify(actor)),
          consentVersion: device.consentVersion, batteryPercent: data.battery_percent, recordedAt: data.recorded_at },
        deadline: new Date(Date.parse(data.recorded_at) + 300_000) } });
      return { receipt_id: receipt.id, accepted_at: receipt.acceptedAt, duplicate: false };
    });
  },
};
