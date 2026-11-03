import { z } from 'zod';

export const createSkillSchema = z.object({
  skill_name: z.string().min(2, 'Skill name is required'),
  category: z.string().min(2, 'Category is required'),
  demand_level: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  description: z.string().min(5, 'Description is required'),
});

// Defaults apply only when creating records; omitted update fields must remain unchanged.
export const updateSkillSchema = createSkillSchema.extend({
  demand_level: createSkillSchema.shape.demand_level.removeDefault(),
}).partial();

export const semanticMatchSchema = z.object({
  incident_description: z.string().min(5, 'Incident description is required'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
