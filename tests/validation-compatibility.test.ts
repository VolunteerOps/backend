import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {AddressInfo} from 'node:net';
import {z} from 'zod';
import {validateBody} from '../src/middleware/validator.js';
import {errorHandler} from '../src/middleware/error.middleware.js';
import {createVolunteerSchema,updateVolunteerSchema} from '../src/modules/volunteers/volunteers.schema.js';
import {updateLocationSchema} from '../src/modules/locations/locations.schema.js';
import {updateSkillSchema} from '../src/modules/skills/skills.schema.js';
import {updateFieldReportSchema} from '../src/modules/fieldReports/fieldReports.schema.js';
import {updateFeedbackSchema} from '../src/modules/feedback/feedback.schema.js';
import {updateDeploymentSchema} from '../src/modules/deployments/deployments.schema.js';
import {updateEventSchema} from '../src/modules/events/events.schema.js';
import {missionConversationRequest} from '../src/modules/sentinel/assistant-contract.js';

test('partial updates never reapply creation defaults to omitted fields',()=>{
 for(const schema of [updateVolunteerSchema,updateLocationSchema,updateSkillSchema,updateFieldReportSchema,updateFeedbackSchema,updateDeploymentSchema,updateEventSchema]){
  assert.deepEqual(schema.parse({}),{});
 }
 assert.deepEqual(updateVolunteerSchema.parse({bio:'Updated biography'}),{bio:'Updated biography'});
 assert.deepEqual(updateVolunteerSchema.parse({consent_given:false,status:'RESTRICTED'}),{consent_given:false,status:'RESTRICTED'});
 assert.deepEqual(updateDeploymentSchema.parse({notes:'Team arrived'}),{notes:'Team arrived'});
 assert.deepEqual(updateFieldReportSchema.parse({status:'verified'}),{status:'verified'});
 const created=createVolunteerSchema.parse({full_name:'Test volunteer',phone_number:'123456789',email:'test@example.org'});
 assert.equal(created.status,'AVAILABLE');assert.equal(created.consent_given,true);assert.equal(created.registration_channel,'inbuilt');
 assert.deepEqual(missionConversationRequest.parse({message:'Plan a relief mission',draft:{capacity:5,required_skills:['first-aid']}}),{
  message:'Plan a relief mission',draft:{capacity:5,required_skills:['first-aid']},history:[],timezone:'UTC',
 });
});

test('invalid HTTP payloads retain the validation details used by portal friendly errors',async()=>{
 const app=express();app.use(express.json());
 app.post('/validate',validateBody(z.object({reason:z.string().min(10),capacity:z.number().int(),skills:z.array(z.string()).max(2)}).strict()),(_req,res)=>res.sendStatus(204));
 app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 try{
  const response=await fetch('http://127.0.0.1:'+(server.address() as AddressInfo).port+'/validate',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'short',capacity:1.5,skills:['a','b','c']}),
  });
  assert.equal(response.status,400);
  const body=await response.json() as {error:string;details:Array<{path:string;code:string;minimum?:number;maximum?:number;type?:string;expected?:string}>};
  assert.equal(body.error,'validation_failed');
  const reason=body.details.find(issue=>issue.path==='reason')!;
  assert.equal(reason.code,'too_small');assert.equal(reason.minimum,10);assert.equal(reason.type,'string');
  const capacity=body.details.find(issue=>issue.path==='capacity')!;
  assert.equal(capacity.code,'invalid_type');assert.equal(capacity.expected,'integer');
  const skills=body.details.find(issue=>issue.path==='skills')!;
  assert.equal(skills.code,'too_big');assert.equal(skills.maximum,2);assert.equal(skills.type,'array');
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
