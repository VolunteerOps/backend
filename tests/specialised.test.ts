import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gaugeCrossings,applyScenario,planDiff,shortageOptions,expiryFindings} from '../src/modules/sentinel/specialised-contract.js';
import {validateResourcePlan,type PlanningSnapshot} from '../src/modules/sentinel/planning-contract.js';

test('gauge crossings use the latest reading per gauge',()=>{
 const rows=gaugeCrossings([
  {gauge_id:'g1',level_m:2.1,watch_level_m:2.5,observed_at:'2026-10-30T01:00:00Z'},
  {gauge_id:'g1',level_m:2.6,watch_level_m:2.5,observed_at:'2026-10-30T02:00:00Z'},
  {gauge_id:'g2',level_m:1,watch_level_m:3,observed_at:'2026-10-30T02:00:00Z'},
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows.find(r=>r.gauge_id==='g1')!.at_or_above_watch,true);
 assert.equal(rows.find(r=>r.gauge_id==='g1')!.margin_m,0.1);
 assert.equal(rows.find(r=>r.gauge_id==='g2')!.at_or_above_watch,false);
});
const snapshot:PlanningSnapshot={mission:{id:'m',version:1,title:'Relief',status:'STAGED',capacity:2,assigned_count:0,required_skills:['first-aid'],starts_at:'',ends_at:'',meeting_point:'Hall'},
 candidates:[
  {user_id:1,application_id:'a',application_version:1,eligible:true,missing_skills:[],skills:['first-aid'],visible_commitments:0,scope_active:true,recent_shift_hours_7d:0,rest_hours_before_mission:null,fatigue_eligible:true},
  {user_id:2,application_id:'b',application_version:1,eligible:false,missing_skills:['first-aid'],skills:[],visible_commitments:0,scope_active:true,recent_shift_hours_7d:0,rest_hours_before_mission:null,fatigue_eligible:true},
  {user_id:3,application_id:'c',application_version:1,eligible:true,missing_skills:[],skills:['first-aid'],visible_commitments:0,scope_active:true,recent_shift_hours_7d:58,rest_hours_before_mission:2,fatigue_eligible:false},
 ],
 resources:[{id:'r1',version:1,title:'Water',location:'Depot A',unit:'pack',available:2},{id:'r2',version:1,title:'Water',location:'Depot B',unit:'pack',available:5},{id:'r3',version:1,title:'Purifier',location:'Depot A',unit:'unit',available:1}],limitations:[]};
test('fatigued responders are rejected even when otherwise eligible',()=>{
 const plan={summary:'P',allocations:[{user_id:3,reason:'x',supplies:[]}],shortages:[],decisions:[]};
 assert.throws(()=>validateResourcePlan(plan,snapshot),/FATIGUED/);
});
test('what-if scenario recomputes eligibility and stock',()=>{
 const scenario=applyScenario(snapshot,{mission_id:'m',question:'What if skills change?',capacity_override:1,required_skills_override:[],stock_adjustments:[{resource_id:'r1',delta:3}]});
 assert.equal(scenario.mission.capacity,1);
 assert.equal(scenario.candidates.find(c=>c.user_id===2)!.eligible,true);
 assert.equal(scenario.candidates.find(c=>c.user_id===3)!.eligible,false);
 assert.equal(scenario.resources.find(r=>r.id==='r1')!.available,5);
});
test('plan diff reports added, removed and quantity changes',()=>{
 const diff=planDiff({allocations:[{user_id:1,supplies:[{resource_id:'r1',quantity:1}]},{user_id:2,supplies:[]}]},
  {allocations:[{user_id:1,supplies:[{resource_id:'r1',quantity:3}]},{user_id:3,supplies:[]}]});
 assert.deepEqual(diff.added_user_ids,[3]);assert.deepEqual(diff.removed_user_ids,[2]);
 assert.deepEqual(diff.quantity_changes,[{user_id:1,resource_id:'r1',from:1,to:3}]);
});
test('shortage options split across locations and list substitutes',()=>{
 const options=shortageOptions(snapshot,[{resource_id:'r1',quantity:6}],[{resource_id:'r1',substitute_id:'r3'}]);
 assert.equal(options[0]!.shortfall,4);
 assert.deepEqual(options[0]!.split_options,[{resource_id:'r2',location:'Depot B',available:5,take:4}]);
 assert.equal(options[0]!.unmet_after_splits,0);
 assert.equal(options[0]!.substitute_options[0]!.resource_id,'r3');
});
test('credential foresight groups expiring skills with affected missions',()=>{
 const now=Date.parse('2026-10-30T00:00:00Z');
 const findings=expiryFindings([
  {skill:'first-aid',valid_until:'2026-11-15T00:00:00Z'},{skill:'first-aid',valid_until:'2026-12-20T00:00:00Z'},{skill:'driving',valid_until:'2027-06-01T00:00:00Z'},
 ],[{id:'m1',required_skills:['first-aid'],starts_at:'2026-11-20T00:00:00Z'}],60,now);
 assert.equal(findings.length,1);
 assert.equal(findings[0]!.expiring_count,2);
 assert.deepEqual(findings[0]!.missions_affected,['m1']);
});
