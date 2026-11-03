import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandSchema, missionSchema, validTransition } from '../src/modules/operations/operations.schema.js';
test('mission lifecycle requires publishing before activation and terminal states stay closed',()=>{
 assert.equal(validTransition('DRAFT','ACTIVE'),false);
 assert.equal(validTransition('DRAFT','STAGED'),true);
 assert.equal(validTransition('STAGED','ACTIVE'),true);
 assert.equal(validTransition('ACTIVE','PAUSED'),true);
 for(const terminal of ['CANCELLED','COMPLETED'])for(const target of ['DRAFT','STAGED','ACTIVE'])assert.equal(validTransition(terminal,target),false);
});
test('mission validation bounds capacity and coordinates; duration is any positive length',()=>{
 const mission={title:'River cleanup',brief:'Meet the team at the assembly point.',starts_at:'2026-10-02T08:00:00Z',ends_at:'2026-10-02T12:00:00Z',capacity:10,longitude:36,latitude:-1,meeting_point:'Community hall'};
 assert.equal(missionSchema.safeParse(mission).success,true);
 assert.equal(missionSchema.safeParse({...mission,ends_at:'2026-10-09T12:00:00Z'}).success,true);
  for(const invalid of [{capacity:0},{capacity:1001},{latitude:95},{ends_at:mission.starts_at}])assert.equal(missionSchema.safeParse({...mission,...invalid}).success,false);
});
test('hours are explicit and finite; mutation payloads cannot select a role or another owner',()=>{
 const command={action:'COMPLETE_ASSIGNMENT',id:'00000000-0000-4000-8000-000000000001',expected_version:1,hours:2.5};
 assert.equal(commandSchema.safeParse(command).success,true);
 for(const change of [{hours:undefined},{hours:25},{hours:-1},{hours:Infinity},{role:'COORDINATOR'},{owner_id:2},{expected_version:0}])assert.equal(commandSchema.safeParse({...command,...change}).success,false);
});
