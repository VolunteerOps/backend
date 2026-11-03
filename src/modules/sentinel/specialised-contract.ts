import {z} from 'zod';

export const evidenceKinds=['GAUGE_READING','ROAD_STATUS','VULNERABILITY_PROFILE','FIELD_OBSERVATION','SUBSTITUTE_LINK'] as const;
export type EvidenceKind=typeof evidenceKinds[number];
const observedAt=z.string().datetime();
export const evidenceCreate=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('GAUGE_READING'),gauge_id:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(160),river:z.string().trim().max(160).default(''),level_m:z.number().min(-10).max(1000),watch_level_m:z.number().min(-10).max(1000),latitude:z.number().min(-90).max(90).nullable().default(null),longitude:z.number().min(-180).max(180).nullable().default(null),observed_at:observedAt}).strict(),
 z.object({kind:z.literal('ROAD_STATUS'),name:z.string().trim().min(1).max(160),access_type:z.enum(['ROAD','BRIDGE','FERRY','OTHER']),status:z.enum(['OPEN','RESTRICTED','CLOSED']),note:z.string().trim().max(600).default(''),observed_at:observedAt}).strict(),
 z.object({kind:z.literal('VULNERABILITY_PROFILE'),group:z.string().trim().min(1).max(160),count:z.number().int().min(0).max(10_000_000),needs:z.array(z.string().trim().min(1).max(120)).max(12).default([]),note:z.string().trim().max(600).default(''),observed_at:observedAt}).strict(),
 z.object({kind:z.literal('FIELD_OBSERVATION'),variable:z.enum(['RAINFALL_MM','TEMPERATURE_C','WIND_MPS','RIVER_LEVEL_M']),value:z.number().min(-100).max(100000),unit:z.string().trim().min(1).max(24),note:z.string().trim().max(600).default(''),observed_at:observedAt}).strict(),
 z.object({kind:z.literal('SUBSTITUTE_LINK'),resource_id:z.string().uuid(),substitute_id:z.string().uuid(),note:z.string().trim().max(600).default(''),observed_at:observedAt}).strict(),
]);
export const question=z.string().trim().min(3).max(2000);
const assessmentRef=z.object({assessment_id:z.string().uuid().optional(),question}).strict();
export const floodRequest=assessmentRef;
export const watchRequest=z.object({question:z.string().trim().max(2000).default('Prepare a rising-water watch brief for this region.')}).strict();
export const heatRequest=assessmentRef;
export const windRequest=z.object({mission_id:z.string().uuid(),question}).strict();
export const multiRegionRequest=z.object({question}).strict();
export const outcomeRequest=z.object({assessment_id:z.string().uuid(),question}).strict();
export const foresightRequest=z.object({horizon_days:z.number().int().min(7).max(180).default(60),question:z.string().trim().max(2000).default('Review upcoming credential expiries against planned missions.')}).strict();
export const whatIfRequest=z.object({mission_id:z.string().uuid(),base_proposal_id:z.string().uuid().optional(),
 capacity_override:z.number().int().min(0).max(1000).optional(),required_skills_override:z.array(z.string().trim().min(1).max(60)).max(20).optional(),
 stock_adjustments:z.array(z.object({resource_id:z.string().uuid(),delta:z.number().int().min(-1000000).max(1000000)}).strict()).max(50).default([]),question}).strict();
export const shortageRequest=z.object({mission_id:z.string().uuid(),requirements:z.array(z.object({resource_id:z.string().uuid(),quantity:z.number().int().min(1).max(1000000)}).strict()).min(1).max(50),question}).strict();
export const briefingRequest=z.object({source_kind:z.enum(['ASSESSMENT','PROPOSAL','ANALYSIS']),source_id:z.string().uuid(),
 audience:z.enum(['COORDINATOR','VOLUNTEER','PUBLIC']),language:z.string().trim().min(2).max(12).default('en')}).strict();
export const translateRequest=z.object({language:z.string().trim().min(2).max(12)}).strict();
export const reviewRequest=z.object({reason:z.string().trim().min(10).max(1500),expected_version:z.number().int().positive()}).strict();
export const afterActionRequest=z.object({mission_id:z.string().uuid(),question:z.string().trim().max(2000).default('Draft an after-action summary for this mission.')}).strict();
export const gapWorklistRequest=z.object({assessment_id:z.string().uuid()}).strict();
export const gapTaskUpdate=z.object({status:z.enum(['OPEN','DONE']),assignee_user_id:z.number().int().positive().nullable().default(null)}).strict();

export const specialisedOutput=z.object({
 summary:z.string().min(1).max(4000),
 findings:z.array(z.string().max(900)).max(20),
 recommendations:z.array(z.string().max(900)).max(20),
 missing_inputs:z.array(z.string().max(600)).max(16),
 source_ids:z.array(z.string().max(500)).max(30),
}).strict();
export type SpecialisedOutput=z.infer<typeof specialisedOutput>;
export const briefingOutput=z.object({
 headline:z.string().min(1).max(300),body:z.string().min(1).max(6000),
 key_points:z.array(z.string().max(600)).max(12),limitations:z.array(z.string().max(600)).max(12),
 source_ids:z.array(z.string().max(500)).max(30),
}).strict();
export const afterActionOutput=z.object({
 summary:z.string().min(1).max(4000),what_worked:z.array(z.string().max(800)).max(12),
 issues:z.array(z.string().max(800)).max(12),lessons:z.array(z.string().max(800)).max(12),
 follow_ups:z.array(z.string().max(800)).max(12),source_ids:z.array(z.string().max(500)).max(30),
}).strict();

/** Latest reading per gauge, with watch-level crossings flagged. Pure and deterministic. */
export function gaugeCrossings(readings:Array<Record<string,any>>) {
 const latest=new Map<string,Record<string,any>>();
 for(const row of readings){const key=String(row.gauge_id);const prior=latest.get(key);
  if(!prior||Date.parse(row.observed_at)>Date.parse(prior.observed_at))latest.set(key,row);}
 return [...latest.values()].map(row=>({...row,at_or_above_watch:Number(row.level_m)>=Number(row.watch_level_m),
  margin_m:Math.round((Number(row.level_m)-Number(row.watch_level_m))*100)/100}) as Record<string,any>&{at_or_above_watch:boolean;margin_m:number});
}
/** Apply coordinator scenario overrides to a trusted snapshot copy. Pure. */
export function applyScenario<T extends {mission:{capacity:number;required_skills:string[]};candidates:Array<any>;resources:Array<any>}>(snapshot:T,input:z.infer<typeof whatIfRequest>):T {
 const copy=JSON.parse(JSON.stringify(snapshot)) as T;
 if(input.capacity_override!==undefined)copy.mission.capacity=input.capacity_override;
 if(input.required_skills_override)copy.mission.required_skills=input.required_skills_override;
 for(const candidate of copy.candidates){
  candidate.missing_skills=copy.mission.required_skills.filter((skill:string)=>!candidate.skills.includes(skill));
  candidate.eligible=candidate.scope_active&&!candidate.missing_skills.length&&!candidate.visible_commitments&&candidate.fatigue_eligible!==false;
 }
 for(const adjustment of input.stock_adjustments){const stock=copy.resources.find((r:any)=>r.id===adjustment.resource_id);if(stock)stock.available=Math.max(0,stock.available+adjustment.delta);}
 return copy;
}
/** Allocation-level diff between a base plan and a scenario plan. Pure. */
export function planDiff(base:{allocations:Array<any>},scenario:{allocations:Array<any>}) {
 const baseByUser=new Map<number,any>(base.allocations.map(a=>[a.user_id,a])),scenarioByUser=new Map<number,any>(scenario.allocations.map(a=>[a.user_id,a]));
 const added=[...scenarioByUser.keys()].filter(id=>!baseByUser.has(id)),removed=[...baseByUser.keys()].filter(id=>!scenarioByUser.has(id));
 const quantity_changes:Array<{user_id:number;resource_id:string;from:number;to:number}>= [];
 for(const [userId,allocation] of scenarioByUser){const prior=baseByUser.get(userId);if(!prior)continue;
  const priorSupplies=new Map<string,number>(prior.supplies.map((s:any)=>[s.resource_id,s.quantity] as [string,number]));
  for(const supply of allocation.supplies as Array<any>){const from:number=priorSupplies.get(supply.resource_id)??0;if(from!==supply.quantity)quantity_changes.push({user_id:userId,resource_id:supply.resource_id,from,to:supply.quantity});}}
 return {added_user_ids:added,removed_user_ids:removed,quantity_changes};
}
/** Deterministic supply options: splits across same-title stock, then recorded substitutes. Pure. */
export function shortageOptions(snapshot:{resources:Array<any>},requirements:Array<{resource_id:string;quantity:number}>,substitutes:Array<Record<string,any>>) {
 return requirements.map(requirement=>{
  const primary=snapshot.resources.find(r=>r.id===requirement.resource_id);
  const shortfall=primary?Math.max(0,requirement.quantity-primary.available):requirement.quantity;
  const splits=primary?snapshot.resources.filter(r=>r.id!==primary.id&&r.title===primary.title&&r.available>0)
   .map(r=>({resource_id:r.id,location:r.location,available:r.available,take:0})).sort((a,b)=>b.available-a.available):[];
  let remaining=shortfall;for(const split of splits){split.take=Math.min(split.available,remaining);remaining-=split.take;}
  const substituteIds=substitutes.filter(s=>s.resource_id===requirement.resource_id).map(s=>String(s.substitute_id));
  const substituteOptions=snapshot.resources.filter(r=>substituteIds.includes(r.id)).map(r=>({resource_id:r.id,title:r.title,location:r.location,available:r.available}));
  return {resource_id:requirement.resource_id,title:primary?.title??null,requested:requirement.quantity,available:primary?.available??0,
   shortfall,split_options:splits.filter(s=>s.take>0),substitute_options:substituteOptions,unmet_after_splits:remaining};
 });
}
/** Credentials expiring within the horizon, grouped by skill with affected upcoming missions. Pure. */
export function expiryFindings(credentials:Array<Record<string,any>>,missions:Array<Record<string,any>>,horizonDays:number,now=Date.now()) {
 const horizon=now+horizonDays*86400000;
 const expiring=credentials.filter(c=>{const until=Date.parse(c.valid_until);return Number.isFinite(until)&&until>now&&until<=horizon;});
 const bySkill=new Map<string,{skill:string;expiring_count:number;earliest_expiry:string;missions_affected:string[]}>();
 for(const credential of expiring){const skill=String(credential.skill);
  const missionsAffected=missions.filter(m=>Array.isArray(m.required_skills)&&m.required_skills.includes(skill)&&Date.parse(m.starts_at)>now).map(m=>String(m.id));
  const entry=bySkill.get(skill)??{skill,expiring_count:0,earliest_expiry:String(credential.valid_until),missions_affected:[]};
  entry.expiring_count++;if(String(credential.valid_until)<entry.earliest_expiry)entry.earliest_expiry=String(credential.valid_until);
  entry.missions_affected=[...new Set([...entry.missions_affected,...missionsAffected])];bySkill.set(skill,entry);}
 return [...bySkill.values()].sort((a,b)=>a.earliest_expiry.localeCompare(b.earliest_expiry));
}
