import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionSchema} from '../src/modules/operations/operations.schema.js';
const base={title:'Regional relief distribution',brief:'Distribute supplies across the region over several days.',starts_at:'2026-11-02T08:00:00Z',ends_at:'2026-11-09T08:00:00Z',capacity:20,longitude:36.82,latitude:-1.28,meeting_point:'Regional depot',required_skills:[]};
test('missions may run for any positive length the coordinator stipulates',()=>{
 assert.equal(missionSchema.parse(base).title,base.title);
 assert.equal(missionSchema.parse({...base,ends_at:'2027-02-09T08:00:00Z'}).ends_at,'2027-02-09T08:00:00Z');
 assert.throws(()=>missionSchema.parse({...base,ends_at:base.starts_at}));
 assert.throws(()=>missionSchema.parse({...base,ends_at:'2026-11-01T08:00:00Z'}));
});
