import { z } from 'zod';

export const createVolunteerSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone_number: z.string().min(5, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  registration_channel: z.string().default('inbuilt'),
  consent_given: z.boolean().default(true),
  registration_date: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'DEPLOYED', 'AVAILABLE', 'RESTRICTED', 'INACTIVE', 'active', 'inactive', 'banned']).default('AVAILABLE'),
  date_of_birth: z.string().optional(),
  emergency_contact: z.string().optional(),
  bio: z.string().optional(),
  availability_schedule: z.record(z.unknown()).optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const updateVolunteerSchema = createVolunteerSchema.partial();

export const addSkillSchema = z.object({
  skill_id: z.coerce.number().int().positive(),
  proficiency_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
  is_certified: z.boolean().default(false),
  certification_date: z.string().optional(),
  certified_by: z.string().optional(),
});

export const updateSkillLinkSchema = z.object({
  proficiency_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  is_certified: z.boolean().optional(),
});

export const proximityQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius_km: z.coerce.number().default(50),
});
