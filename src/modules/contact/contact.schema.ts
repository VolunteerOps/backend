import { z } from 'zod';

export const submitContactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email address is required'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  organization: z.string().optional(),
  inquiry_type: z.enum(['general', 'partnership', 'press', 'volunteer_inquiry', 'tech_support']).default('general'),
});

export const updateContactStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESPONDED', 'RESOLVED', 'ARCHIVED']),
  response_notes: z.string().optional(),
});
