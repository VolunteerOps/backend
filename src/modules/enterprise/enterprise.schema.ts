import { z } from 'zod';
import { domainToASCII } from 'node:url';
import { idSchema,reasonSchema,provisionSchema } from '../organizations/organizations.schema.js';
export const domainSchema=z.string().trim().toLowerCase().transform(domainToASCII).refine(v=>v.length<=253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v) && !v.endsWith('.local') && !v.endsWith('.internal'),'Exact public DNS domain required');
export const partnerSchema=z.object({name:z.string().trim().min(2).max(160),domain:domainSchema,message:reasonSchema}).strict();
export const domainClaimSchema=z.object({domain:domainSchema,reason:reasonSchema}).strict();
export const supportSchema=z.object({user_id:z.number().int().positive(),expires_in_minutes:z.number().int().min(5).max(60),reason:reasonSchema}).strict();
export const coordinationSchema=z.object({partner_organization_id:idSchema,lead_organization_id:idSchema,resource_reference:z.string().trim().min(3).max(200),expires_in_hours:z.number().int().min(1).max(168),reason:reasonSchema}).strict();
export const policySchema=z.object({allowed_providers:provisionSchema.shape.allowed_providers,require_mfa:z.boolean(),expected_version:z.number().int().positive(),reason:reasonSchema}).strict();
