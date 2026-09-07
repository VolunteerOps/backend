import { z } from 'zod';

export const storageCategorySchema = z.enum(['avatars', 'field-reports', 'attachments']);

export const createUploadUrlSchema = z.object({
  file_name: z
    .string()
    .min(1)
    .max(180)
    .refine((value) => !/[\\/]/.test(value), 'file_name must not contain path separators'),
  content_type: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/octet-stream',
  ]),
  byte_size: z.coerce.number().int().positive().max(10 * 1024 * 1024),
  category: storageCategorySchema.default('attachments'),
});

export const downloadUrlQuerySchema = z.object({
  key: z.string().min(1).max(512),
});
