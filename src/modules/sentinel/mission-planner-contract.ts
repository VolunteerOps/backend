import {z} from 'zod';
export const missionFields=['title','brief','starts_at','ends_at','capacity','longitude','latitude','meeting_point','required_skills'] as const;
const draftSchema=z.object({title:z.string().nullable(),brief:z.string().nullable(),starts_at:z.string().nullable(),ends_at:z.string().nullable(),capacity:z.number().nullable(),longitude:z.number().nullable(),latitude:z.number().nullable(),meeting_point:z.string().nullable(),required_skills:z.array(z.string()).nullable()}).strict();
export const missionReply=z.object({reply:z.string().min(1).max(3000),draft:draftSchema,next_field:z.enum([...missionFields,'review']),notes:z.array(z.string().max(600)).max(12)}).strict();

/** A filled form is not a confirmed meeting point. Keep the model's clarification turn. */
export function missionReady(valid:boolean,nextField:string){return valid&&nextField==='review';}
export function locationGrounded(draft:Record<string,unknown>,known:Array<Record<string,unknown>>){
 if(draft.latitude==null&&draft.longitude==null)return true;
 return known.some(p=>typeof p.latitude==='number'&&typeof p.longitude==='number'&&p.latitude===draft.latitude&&p.longitude===draft.longitude);
}
