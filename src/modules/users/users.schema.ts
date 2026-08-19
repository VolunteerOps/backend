import { z } from 'zod';

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER', 'ADMIN', 'admin', 'volunteer']).optional(),
  is_active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER']),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});
