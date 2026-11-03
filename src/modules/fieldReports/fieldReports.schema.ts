import { z } from 'zod';

const storedObjectReference = z.string().refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return /^(avatars|field-reports|attachments)\/\d+\/[a-zA-Z0-9_.-]+$/.test(value);
    }
  },
  'Expected an HTTPS URL or a VolunteerOps object-storage key'
);

export const createFieldReportSchema = z.object({
  deployment_id: z.coerce.number().int().positive(),
  report_type: z.enum(['DAMAGE_ASSESSMENT', 'MEDICAL_TRIAGE', 'SUPPLY_REQUEST', 'HAZARD_ALERT', 'GENERAL_UPDATE', 'general', 'medical', 'incident', 'status_update']).default('GENERAL_UPDATE'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  text_response: z.string().min(5, 'Report text response is required'),
  media_url: storedObjectReference.optional().nullable(),
  file_upload_url: storedObjectReference.optional().nullable(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  submitted_via: z.string().default('mobile_app'),
});

// Defaults apply only when creating records; omitted update fields must remain unchanged.
export const updateFieldReportSchema = createFieldReportSchema.extend({
  report_type: createFieldReportSchema.shape.report_type.removeDefault(),
  priority: createFieldReportSchema.shape.priority.removeDefault(),
  submitted_via: createFieldReportSchema.shape.submitted_via.removeDefault(),
}).partial().extend({
  status: z.enum(['submitted', 'verified', 'actioned', 'dismissed']).optional(),
  verified_by: z.string().optional(),
});
