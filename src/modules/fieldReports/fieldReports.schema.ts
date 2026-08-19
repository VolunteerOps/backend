import { z } from 'zod';

export const createFieldReportSchema = z.object({
  deployment_id: z.coerce.number().int().positive(),
  report_type: z.enum(['DAMAGE_ASSESSMENT', 'MEDICAL_TRIAGE', 'SUPPLY_REQUEST', 'HAZARD_ALERT', 'GENERAL_UPDATE', 'general', 'medical', 'incident', 'status_update']).default('GENERAL_UPDATE'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  text_response: z.string().min(5, 'Report text response is required'),
  media_url: z.string().url().optional().nullable(),
  file_upload_url: z.string().url().optional().nullable(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  submitted_via: z.string().default('mobile_app'),
});

export const updateFieldReportSchema = createFieldReportSchema.partial().extend({
  status: z.enum(['submitted', 'verified', 'actioned', 'dismissed']).optional(),
  verified_by: z.string().optional(),
});
