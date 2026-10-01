import { z } from 'zod';
export const profileSchema = z.object({
 expected_version: z.number().int().nonnegative(), display_name: z.string().trim().min(2).max(120),
 biography: z.string().trim().max(1000).default(''), region: z.string().trim().max(80).default(''),
 skills: z.array(z.string().trim().min(2).max(60)).max(30).default([]),
 availability: z.enum(['UNSPECIFIED','WEEKDAYS','WEEKENDS','FLEXIBLE','UNAVAILABLE']).default('UNSPECIFIED'),
 private_details: z.object({ phone: z.string().max(40).optional(), address: z.string().max(500).optional(),
 date_of_birth: z.string().date().optional(), emergency_contact: z.string().max(500).optional() }).strict().default({}),
}).strict();
export const directorySchema = z.object({ expected_version: z.number().int().positive(), discoverable: z.boolean(),
 public_preview: z.boolean(), show_availability: z.boolean() }).strict();
export const consentSchema = z.object({ purpose: z.enum(['DIRECTORY','PUBLIC_PROFILE','UPDATES','SENSING','LOCATION','RELAY']),
 policy_version: z.string().trim().min(1).max(80), granted: z.boolean() }).strict();
export const shareSchema = z.object({ expires_in_hours: z.number().int().min(1).max(720).default(168) }).strict();
export const directoryQuery = z.object({ after: z.string().uuid().optional(), region: z.string().max(80).optional(),
 skill: z.string().max(60).optional(), available: z.enum(['true','false']).optional() }).strict();
