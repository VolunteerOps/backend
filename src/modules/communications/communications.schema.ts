import { z } from 'zod';

export const sendMessageSchema = z.object({
  event_id: z.coerce.number().int().positive().optional(),
  channel_id: z.string().default('general'),
  message: z.string().min(1, 'Message is required'),
  priority: z.enum(['critical', 'high', 'normal', 'info']).default('normal'),
  message_type: z.enum(['text', 'alert', 'incident_update', 'location_share']).default('text'),
  media_url: z.string().url().optional(),
});

export const broadcastAlertSchema = z.object({
  event_id: z.coerce.number().int().positive().optional(),
  title: z.string().min(2, 'Alert title is required'),
  message: z.string().min(5, 'Alert message is required'),
  priority: z.enum(['critical', 'high', 'normal', 'info']).default('critical'),
  target_channels: z.array(z.string()).default(['alerts']),
});
