import { z } from 'zod';

export const MAX_OBJECT_BYTES = 10 * 1024 * 1024;
export const UPLOAD_URL_SECONDS = 300;
export const DOWNLOAD_URL_SECONDS = 60;
export const uploadIntentSchema = z.object({
  file_name: z.string().trim().min(1).max(180),
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']),
  byte_size: z.number().int().positive().max(MAX_OBJECT_BYTES),
  checksum_sha256: z.string().regex(/^[A-Za-z0-9+/]{43}=$/).refine(value =>
    Buffer.from(value, 'base64').length === 32 && Buffer.from(value, 'base64').toString('base64') === value,
  'Provide the base64 SHA-256 digest of the complete file'),
}).strict();
export type UploadIntent = z.infer<typeof uploadIntentSchema>;
export function safeFileName(input: string) {
  return input.normalize('NFKC').replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^\.+/, '').slice(0, 120) || 'attachment';
}
