import { z } from 'zod';

export const pingSchema = z.object({
  volunteer_id: z.coerce.number().int().positive(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  altitude: z.coerce.number().optional(),
  battery_level: z.coerce.number().int().min(0).max(100).optional(),
  speed: z.coerce.number().optional(),
  heading: z.coerce.number().optional(),
});

export const sosBeaconSchema = z.object({
  volunteer_id: z.coerce.number().int().positive(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  distress_message: z.string().default('EMERGENCY DISTRESS SOS BEACON ACTIVATED'),
});
