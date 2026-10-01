import { createHash } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../core/config.js';
import { ApiError } from '../../core/errors.js';
import { DOWNLOAD_URL_SECONDS, MAX_OBJECT_BYTES, UPLOAD_URL_SECONDS } from './scoped-storage.schema.js';

export interface ObjectAddress { bucket: string; objectKey: string }
export interface ObjectUpload extends ObjectAddress { contentType: string; byteSize: number; checksumSha256: string }
export interface ObjectDownload extends ObjectAddress { fileName: string; etag: string; versionId: string | null }
export interface ObjectFacts { byteSize: number; contentType: string; checksumSha256: string; etag: string; versionId: string | null }
export interface PrivateObjectStore {
  bucket: string;
  upload(object: ObjectUpload): Promise<{ url: string; headers: Record<string, string> }>;
  inspect(object: ObjectUpload): Promise<ObjectFacts>;
  download(object: ObjectDownload): Promise<{ url: string; headers: Record<string, string> }>;
}

/** Bound every fallback stream independently of the provider's declared length. */
export async function hashBoundedBody(body: AsyncIterable<Uint8Array>, expectedBytes: number) {
  let size = 0; const hash = createHash('sha256');
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > expectedBytes || size > MAX_OBJECT_BYTES) throw ApiError.conflict('Uploaded object exceeds its declared size', 'OBJECT_MISMATCH');
    hash.update(chunk);
  }
  if (size !== expectedBytes) throw ApiError.conflict('Uploaded object is incomplete', 'OBJECT_MISMATCH');
  return hash.digest('base64');
}

export class S3PrivateObjectStore implements PrivateObjectStore {
  constructor(readonly bucket: string, private readonly client: S3Client) {}
  async upload(object: ObjectUpload) {
    const command = new PutObjectCommand({ Bucket: object.bucket, Key: object.objectKey,
      ContentLength: object.byteSize, ContentType: object.contentType, ChecksumSHA256: object.checksumSha256,
      IfNoneMatch: '*' });
    const headers = { 'Content-Type': object.contentType, 'x-amz-checksum-sha256': object.checksumSha256, 'If-None-Match': '*' };
    const url = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']) });
    return { url, headers };
  }
  async inspect(object: ObjectUpload): Promise<ObjectFacts> {
    try {
      // Some S3-compatible services do not return stored SHA-256 in HEAD. Verify a
      // bounded GET pinned to the observed ETag/version when that field is absent.
      const head = await this.client.send(new HeadObjectCommand({ Bucket: object.bucket, Key: object.objectKey }),
        { abortSignal: AbortSignal.timeout(5000) });
      if (head.ContentLength !== object.byteSize || head.ContentType !== object.contentType || !head.ETag) {
        throw ApiError.conflict('Uploaded size or content type does not match the upload intent', 'OBJECT_MISMATCH');
      }
      let checksum = head.ChecksumSHA256;
      if (!checksum) {
        const downloaded = await this.client.send(new GetObjectCommand({ Bucket: object.bucket, Key: object.objectKey,
          IfMatch: head.ETag, ...(head.VersionId ? { VersionId: head.VersionId } : {}) }),
        { abortSignal: AbortSignal.timeout(8000) });
        if (!downloaded.Body || !(Symbol.asyncIterator in downloaded.Body)) throw new Error('Missing object stream');
        checksum = await hashBoundedBody(downloaded.Body as AsyncIterable<Uint8Array>, object.byteSize);
      }
      if (checksum !== object.checksumSha256) throw ApiError.conflict('Uploaded checksum does not match the upload intent', 'OBJECT_MISMATCH');
      return { byteSize: head.ContentLength, contentType: head.ContentType, checksumSha256: checksum,
        etag: head.ETag, versionId: head.VersionId ?? null };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) throw ApiError.conflict('Upload has not reached object storage', 'UPLOAD_NOT_FOUND');
      throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'Object storage verification is temporarily unavailable');
    }
  }
  async readForScan(object: ObjectUpload & ObjectDownload): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: object.bucket, Key: object.objectKey,
      IfMatch: object.etag, ...(object.versionId ? { VersionId: object.versionId } : {}) }), { abortSignal: AbortSignal.timeout(8000) });
    if (!result.Body || !(Symbol.asyncIterator in result.Body)) throw new Error('SCAN_OBJECT_UNAVAILABLE');
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > object.byteSize || size > MAX_OBJECT_BYTES) throw new Error('SCAN_SIZE_EXCEEDED');
      chunks.push(Buffer.from(chunk));
    }
    if (size !== object.byteSize) throw new Error('SCAN_OBJECT_INCOMPLETE');
    return Buffer.concat(chunks);
  }
  async remove(object: ObjectAddress) {
    await this.client.send(new DeleteObjectCommand({ Bucket: object.bucket, Key: object.objectKey }), { abortSignal: AbortSignal.timeout(8000) });
  }
  async download(object: ObjectDownload) {
    const command = new GetObjectCommand({ Bucket: object.bucket, Key: object.objectKey,
      IfMatch: object.etag, ...(object.versionId ? { VersionId: object.versionId } : {}),
      ResponseContentDisposition: 'attachment; filename="' + object.fileName + '"',
      ResponseContentType: 'application/octet-stream', ResponseCacheControl: 'private, no-store' });
    const url = await getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_URL_SECONDS,
      signableHeaders: new Set(['if-match']) });
    return { url, headers: { 'If-Match': object.etag } };
  }
}

let configuredStore: S3PrivateObjectStore | undefined;
export function configuredObjectStore(): S3PrivateObjectStore {
  if (configuredStore) return configuredStore;
  if (!config.S3_ENDPOINT || !config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Private object storage is not configured');
  }
  const endpoint = new URL(config.S3_ENDPOINT);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Object storage requires a clean HTTPS endpoint');
  }
  configuredStore = new S3PrivateObjectStore(config.S3_BUCKET, new S3Client({ endpoint: endpoint.toString(), region: config.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', maxAttempts: 2,
    requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 },
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY } }));
  return configuredStore;
}
