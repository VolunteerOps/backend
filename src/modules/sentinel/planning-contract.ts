import {z} from 'zod';

export const resourcePlanRequest=z.object({mission_id:z.string().uuid(),source_assessment_id:z.string().uuid().optional(),question:z.string().trim().min(3).max(2000),mode:z.enum(['PLAN_FIRST','EXECUTE']).default('EXECUTE')}).strict();
export const resourcePlanOutput=z.object({
 summary:z.string().min(1).max(3000),
 allocations:z.array(z.object({user_id:z.number().int().positive(),reason:z.string().min(1).max(800),
  supplies:z.array(z.object({resource_id:z.string().uuid(),quantity:z.number().int().min(1).max(1000000),reason:z.string().min(1).max(500)}).strict()).max(20),
 }).strict()).max(20),
 shortages:z.array(z.string().max(800)).max(20),decisions:z.array(z.string().max(800)).max(20),
}).strict();
export const planApproval=z.object({expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(1500),
 route_reviewed:z.literal(true),conditions_reviewed:z.literal(true),
}).strict();
export const planEdit=z.object({expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(1500),recommendation:resourcePlanOutput}).strict();
export const planRejection=z.object({expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(1500)}).strict();
export interface PlanningSnapshot {
 mission:{id:string;version:number;title:string;status:string;capacity:number;assigned_count:number;required_skills:string[];starts_at:string;ends_at:string;meeting_point:string};
 candidates:Array<{user_id:number;application_id:string;application_version:number;eligible:boolean;missing_skills:string[];skills:string[];visible_commitments:number;scope_active:boolean;recent_shift_hours_7d:number;rest_hours_before_mission:number|null;fatigue_eligible:boolean}>;
 resources:Array<{id:string;version:number;title:string;location:string;unit:string;available:number}>;
 limitations:string[];
}
/** Never persist a model-selected allocation that exceeds the trusted tool snapshot. */
export function validateResourcePlan(output:z.infer<typeof resourcePlanOutput>,snapshot:PlanningSnapshot) {
 const users=new Set<number>(),quantities=new Map<string,number>();
 if(output.allocations.length>Math.max(0,snapshot.mission.capacity-snapshot.mission.assigned_count))throw new Error('PLAN_CAPACITY_EXCEEDED');
 for(const row of output.allocations){
  if(users.has(row.user_id))throw new Error('PLAN_DUPLICATE_RESPONDER');users.add(row.user_id);
  const person=snapshot.candidates.find(c=>c.user_id===row.user_id);
  if(!person?.eligible)throw new Error('PLAN_RESPONDER_NOT_ELIGIBLE');
  if(person.fatigue_eligible===false)throw new Error('PLAN_RESPONDER_FATIGUED');
  const ownResources=new Set<string>();
  for(const supply of row.supplies){
   if(ownResources.has(supply.resource_id))throw new Error('PLAN_DUPLICATE_RESOURCE');ownResources.add(supply.resource_id);
   const stock=snapshot.resources.find(r=>r.id===supply.resource_id);
   const amount=(quantities.get(supply.resource_id)??0)+supply.quantity;
   if(!stock||amount>stock.available)throw new Error('PLAN_STOCK_EXCEEDED');quantities.set(supply.resource_id,amount);
  }
 }
 return output;
}
