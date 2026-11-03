import { z } from 'zod';

export const createDeploymentSchema = z.object({
  volunteer_id: z.coerce.number().int().positive(),
  event_id: z.coerce.number().int().positive(),
  assigned_by: z.coerce.number().int().positive().optional(),
  assigned_at: z.string().datetime().optional(),
  status: z.enum(['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'assigned', 'checked_in', 'completed', 'cancelled']).default('ASSIGNED'),
  notes: z.string().optional(),
});

// Defaults apply only when creating records; omitted update fields must remain unchanged.
export const updateDeploymentSchema = createDeploymentSchema.extend({
  status: createDeploymentSchema.shape.status.removeDefault(),
}).partial();

export const checkInSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  method: z.string().default('GPS_GEOFENCE'),
});

export const autoDispatchSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  count: z.coerce.number().int().min(1).max(20).default(5),
  required_skill_id: z.coerce.number().int().optional(),
});
