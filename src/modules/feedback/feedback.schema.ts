import { z } from 'zod';

export const createFeedbackSchema = z.object({
  volunteer_id: z.coerce.number().int().positive(),
  deployment_id: z.coerce.number().int().positive().optional(),
  event_id: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comments: z.string().min(2, 'Comments are required'),
  submitted_via: z.string().default('mobile_app'),
});

export const updateFeedbackSchema = createFeedbackSchema.partial();
