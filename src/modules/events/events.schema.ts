import { z } from 'zod';

export const createEventSchema = z.object({
  event_name: z.string().min(2, 'Event name is required'),
  event_type: z.string().min(2, 'Event type is required'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'critical', 'high', 'medium', 'low']).default('MEDIUM'),
  description: z.string().min(5, 'Description is required'),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
  location_id: z.coerce.number().int().positive(),
  status: z.enum(['STAGED', 'ACTIVE', 'CONTAINED', 'COMPLETED', 'CANCELLED', 'active', 'planned', 'completed', 'cancelled']).default('ACTIVE'),
  required_volunteers: z.coerce.number().int().positive().default(10),
  coordinator_name: z.string().optional(),
  required_skills: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
});

export const updateEventSchema = createEventSchema.partial();
