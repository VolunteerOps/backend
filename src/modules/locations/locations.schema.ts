import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(2, 'Location name is required'),
  address: z.string().min(2, 'Address is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('USA'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  osm_id: z.coerce.number().int().optional(),
  hazard_level: z.enum(['critical', 'high', 'medium', 'low']).default('low'),
  radius_meters: z.coerce.number().int().default(5000),
});

export const updateLocationSchema = createLocationSchema.partial();
