import { randomUUID } from 'node:crypto';
import { ApiError } from '../../core/errors.js';
import type { Actor } from '../organizations/context.js';
import { withRegion } from '../sentinel/sentinel.context.js';
import { configuredObjectStore, type PrivateObjectStore } from './object-store.js';
import { DOWNLOAD_URL_SECONDS, safeFileName, UPLOAD_URL_SECONDS, uploadIntentSchema, type UploadIntent } from './scoped-storage.schema.js';

export class ScopedStorageService {
  constructor(private readonly resolveStore: () => PrivateObjectStore = configuredObjectStore) {}
  async create(actor: Actor, organizationId: string, regionId: string, input: UploadIntent) {
    const data = uploadIntentSchema.parse(input), store = this.resolveStore();
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const now = new Date();
      // The organization advisory lock in withRegion makes these quotas atomic.
      const pending = await tx.storedObject.count({ where: { organizationId, regionId,
        uploaderUserId: actor.userId, state: 'PENDING', expiresAt: { gt: now } } });
      const daily = await tx.storedObject.count({ where: { organizationId, regionId,
        uploaderUserId: actor.userId, createdAt: { gt: new Date(now.getTime() - 86400000) } } });
      // Expired intents still reserve quota until an operator reconciles their
      // possible bucket object. Expiry must not allow unlimited orphan uploads.
      const aggregate = await tx.storedObject.aggregate({ where: { organizationId, regionId, uploaderUserId: actor.userId }, _sum: { byteSize: true } });
      if (pending >= 10 || daily >= 100 || (aggregate._sum.byteSize ?? 0) + data.byte_size > 250 * 1024 * 1024) {
        throw new ApiError(429, 'STORAGE_QUOTA_EXCEEDED', 'Your scoped upload quota is full');
      }
      const id = randomUUID(), fileName = safeFileName(data.file_name);
      const object = await tx.storedObject.create({ data: { id, organizationId, regionId, uploaderUserId: actor.userId,
        bucket: store.bucket, objectKey: 'organizations/' + organizationId + '/regions/' + regionId + '/objects/' + id + '/' + fileName,
        fileName, contentType: data.content_type, byteSize: data.byte_size, checksumSha256: data.checksum_sha256,
        expiresAt: new Date(now.getTime() + 15 * 60000) } });
      const signed = await store.upload(object);
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'OBJECT_UPLOAD_REQUESTED', reason: 'Member requested a private attachment upload',
        metadata: { region_id: regionId, object_id: id, byte_size: object.byteSize, content_type: object.contentType } } });
      return { object_id: id, upload_url: signed.url, method: 'PUT' as const, headers: signed.headers,
        byte_size: object.byteSize, expires_in_seconds: UPLOAD_URL_SECONDS, completion_expires_at: object.expiresAt };
    });
  }
  async complete(actor: Actor, organizationId: string, regionId: string, objectId: string) {
    const object = await this.owned(actor, organizationId, regionId, objectId);
    if (object.state === 'READY') return { object_id: object.id, state: 'READY' as const };
    if (object.expiresAt.getTime() <= Date.now()) throw ApiError.conflict('Upload completion deadline has expired', 'UPLOAD_EXPIRED');
    const facts = await this.resolveStore().inspect(object);
    if (facts.byteSize !== object.byteSize || facts.contentType !== object.contentType || facts.checksumSha256 !== object.checksumSha256 || !facts.etag) {
      throw ApiError.conflict('Uploaded object does not match the upload intent', 'OBJECT_MISMATCH');
    }
    // No network work under a database lock. Reauthorize after storage I/O so a
    // concurrent suspension or scope change cannot complete an upload.
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const current = await tx.storedObject.findFirst({ where: { id: objectId, organizationId, regionId, uploaderUserId: actor.userId } });
      if (!current) throw ApiError.notFound('Object');
      if (current.state === 'READY') return { object_id: objectId, state: 'READY' as const };
      if (current.expiresAt.getTime() <= Date.now()) throw ApiError.conflict('Upload completion deadline has expired', 'UPLOAD_EXPIRED');
      await tx.storedObject.update({ where: { id: objectId }, data: { state: 'READY', completedAt: new Date(), etag: facts.etag, versionId: facts.versionId } });
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'OBJECT_UPLOAD_VERIFIED', reason: 'Object size, type and SHA-256 verified', metadata: { region_id: regionId, object_id: objectId } } });
      return { object_id: objectId, state: 'READY' as const };
    });
  }
  async download(actor: Actor, organizationId: string, regionId: string, objectId: string) {
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const object = await tx.storedObject.findFirst({ where: { id: objectId, organizationId, regionId, uploaderUserId: actor.userId } });
      if (!object) throw ApiError.notFound('Object');
      if (object.state !== 'READY' || !object.etag) throw ApiError.conflict('Object verification has not completed', 'OBJECT_NOT_READY');
      const signed = await this.resolveStore().download({ ...object, etag: object.etag });
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'OBJECT_DOWNLOAD_AUTHORIZED', reason: 'Uploader requested a private attachment', metadata: { region_id: regionId, object_id: objectId } } });
      return { object_id: objectId, download_url: signed.url, method: 'GET' as const, headers: signed.headers,
        file_name: object.fileName, expires_in_seconds: DOWNLOAD_URL_SECONDS };
    });
  }
  private owned(actor: Actor, organizationId: string, regionId: string, objectId: string) {
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const object = await tx.storedObject.findFirst({ where: { id: objectId, organizationId, regionId, uploaderUserId: actor.userId } });
      if (!object) throw ApiError.notFound('Object');
      return object;
    });
  }
}
