import { z } from 'zod';
export const idSchema = z.string().uuid();
export const roleSchema = z.enum(['ORG_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER']);
export const reasonSchema = z.string().trim().min(10).max(1000);
export const provisionSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{2,62}$/), display_name: z.string().trim().min(2).max(160),
  allowed_providers: z.array(z.string().regex(/^(password|google\.com|apple\.com|facebook\.com|microsoft\.com|saml\.[a-zA-Z0-9_-]+|oidc\.[a-zA-Z0-9_-]+)$/)).min(1).max(12),
  require_mfa: z.boolean().default(false), reason: reasonSchema,
}).strict();
export const lifecycleSchema = z.object({ expected_version: z.number().int().positive(), reason: reasonSchema }).strict();
export const verificationSchema = lifecycleSchema.extend({ evidence_reference: z.string().trim().min(10).max(500) }).strict();
export const invitationSchema = z.object({
  recipient_email: z.string().email().max(320).transform(value => value.toLowerCase()),
  role: roleSchema, region_ids: z.array(idSchema).max(100).default([]),
  expires_in_hours: z.number().int().min(1).max(168).default(48), reason: reasonSchema,
}).strict();
export const acceptInvitationSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const membershipStatusSchema = lifecycleSchema.extend({ status: z.enum(['SUSPENDED', 'REMOVED']) }).strict();
