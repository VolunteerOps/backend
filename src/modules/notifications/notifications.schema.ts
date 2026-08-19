import { z } from 'zod';

export const createNotificationSchema = z.object({
  volunteer_id: z.coerce.number().int().positive().optional().nullable(),
  event_id: z.coerce.number().int().positive().optional().nullable(),
  notification_type: z.string().default('BROADCAST_ALERT'),
  priority: z.enum(['critical', 'high', 'normal', 'info']).default('normal'),
  title: z.string().default('Operational Alert'),
  message: z.string().min(2, 'Message is required'),
});

export const bulkNotificationSchema = z.object({
  volunteer_ids: z.array(z.number().int().positive()),
  notification: createNotificationSchema,
});
