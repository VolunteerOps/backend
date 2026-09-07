import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../core/config.js';
import { ApiError } from '../../core/errors.js';

const URL_TTL_SECONDS = 5 * 60;

function storageConfig(): {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  const values = {
    endpoint: config.S3_ENDPOINT,
    bucket: config.S3_BUCKET,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  };

  if (!values.endpoint || !values.bucket || !values.accessKeyId || !values.secretAccessKey) {
    throw new ApiError(
      503,
      'storage_not_configured',
      'Object storage is not configured for this deployment'
    );
  }

  return {
    endpoint: values.endpoint,
    bucket: values.bucket,
    accessKeyId: values.accessKeyId,
    secretAccessKey: values.secretAccessKey,
  };
}

function client() {
  const storage = storageConfig();
  return new S3Client({
    endpoint: storage.endpoint,
    region: config.S3_REGION,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  });
}

function safeFileName(fileName: string) {
  const normalized = fileName.normalize('NFKC').replace(/[^a-zA-Z0-9_.-]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'upload.bin';
}

function canReadKey(key: string, userId: number, role: string) {
  const segments = key.split('/');
  if (segments.length !== 3 || !['avatars', 'field-reports', 'attachments'].includes(segments[0])) {
    return false;
  }

  const normalizedRole = role.toUpperCase();
  const privileged = ['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'ADMIN'].includes(normalizedRole);
  return privileged || segments[1] === String(userId);
}

export class StorageService {
  static async createUploadUrl(
    userId: number,
    fileName: string,
    contentType: string,
    byteSize: number,
    category: string
  ) {
    const storage = storageConfig();
    const key = `${category}/${userId}/${randomUUID()}-${safeFileName(fileName)}`;
    const command = new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: byteSize,
    });

    return {
      object_key: key,
      upload_url: await getSignedUrl(client(), command, { expiresIn: URL_TTL_SECONDS }),
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      byte_size: byteSize,
      expires_in_seconds: URL_TTL_SECONDS,
    };
  }

  static async createDownloadUrl(key: string, userId: number, role: string) {
    if (!canReadKey(key, userId, role)) {
      throw ApiError.forbidden('You do not have access to this object');
    }

    const storage = storageConfig();
    const command = new GetObjectCommand({ Bucket: storage.bucket, Key: key });

    return {
      object_key: key,
      download_url: await getSignedUrl(client(), command, { expiresIn: URL_TTL_SECONDS }),
      expires_in_seconds: URL_TTL_SECONDS,
    };
  }
}
