import {z} from 'zod';
export const payloadSchema=z.object({
 type:z.literal('resq.evidence'),expires_at:z.number().finite(),scope:z.string().max(100).optional(),selected_id:z.string().max(160).optional(),
 points:z.array(z.object({id:z.string().max(160).optional(),longitude:z.number().finite().min(-180).max(180),latitude:z.number().finite().min(-90).max(90),label:z.string().max(300),kind:z.enum(['forecast','hazard','mission'])}).strict()).max(1500),
}).strict();
