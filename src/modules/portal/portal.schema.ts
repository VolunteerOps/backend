import {z} from 'zod';
export const preferencesSchema=z.object({expected_version:z.number().int().nonnegative(),name:z.string().trim().min(2).max(120),role:z.string().trim().max(100),organization:z.string().trim().max(160),coverage:z.string().trim().max(300),briefings:z.boolean(),reminders:z.boolean(),step:z.number().int().min(0).max(4),completed:z.boolean(),pro_tour_completed:z.boolean().default(false)}).strict();
export const promoCode=z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{3,39}$/);
export const promoSchema=z.object({code:promoCode,expected_version:z.number().int().nonnegative(),percent:z.number().int().min(1).max(100),days:z.number().int().min(1).max(366),starts_at:z.string().datetime(),ends_at:z.string().datetime(),limit:z.number().int().min(1).max(100000),enabled:z.boolean(),email:z.string().email().toLowerCase().optional(),reason:z.string().trim().min(10).max(1000)}).strict().refine(v=>Date.parse(v.ends_at)>Date.parse(v.starts_at),'The end date must be after the start date.');
export function eligiblePromo(p:z.infer<typeof promoSchema>,email:string,count:number,now=Date.now()){return p.enabled&&Date.parse(p.starts_at)<=now&&Date.parse(p.ends_at)>now&&count<p.limit&&(!p.email||p.email===email.toLowerCase());}

export const promotionInput=z.object({code:promoCode}).strict();
export const checkoutInput=z.object({code:promoCode.optional()}).strict();
