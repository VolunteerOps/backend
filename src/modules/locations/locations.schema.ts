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

// Defaults apply only when creating records; omitted update fields must remain unchanged.
export const updateLocationSchema = createLocationSchema.extend({
  country: createLocationSchema.shape.country.removeDefault(),
  hazard_level: createLocationSchema.shape.hazard_level.removeDefault(),
  radius_meters: createLocationSchema.shape.radius_meters.removeDefault(),
}).partial();
