import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import type { Actor } from '../src/modules/organizations/context.js';
const ownerUrl=process.env.SENTINEL_TEST_DATABASE_URL;
test('proposal atomicity, approval replay, demotion privacy and assistance ownership', {skip:!ownerUrl},async()=>{
 const url=new URL(ownerUrl!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.match(url.pathname,/test/);
 const owner=new Pool({connectionString:ownerUrl});const suffix=randomUUID().replaceAll('-','');const login='ops_test_'+suffix;const password=randomUUID();
 // Run independently on a freshly migrated database, without another test's setup.
 await owner.query(readFileSync('deploy/database/runtime-role.sql','utf8'));
 await owner.query(`CREATE ROLE "${login}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
 await owner.query(`GRANT sentinel_runtime_access TO "${login}"`);
 await owner.query(readFileSync('deploy/database/responder-lock.sql','utf8'));
 await owner.query(readFileSync('deploy/database/operations-role.sql','utf8'));
 await owner.query(readFileSync('deploy/database/billing-usage-role.sql','utf8'));
 url.username=login;url.password=password;process.env.DATABASE_URL=url.toString();process.env.NODE_ENV='test';
 const {prisma}=await import('../src/core/prisma.js');const {OperationsService:service}=await import('../src/modules/operations/operations.service.js');
 const ids:number[]=[];const orgs:string[]=[];const regions:string[]=[];
 async function actor(name:string):Promise<Actor>{const email=name+suffix+'@example.org';const row=await owner.query('INSERT INTO users(email,full_name,updated_at) VALUES($1,$2,now()) RETURNING id',[email,name]);const userId=row.rows[0].id;ids.push(userId);await owner.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES($1,$2,$3)',['demo-sentinel',email,userId]);return{userId,identity:{projectId:'demo-sentinel',uid:email,email,signInProvider:'password',secondFactor:'totp',authTime:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+3600}};}
 async function org(admin:Actor){const id=randomUUID(),region=randomUUID();orgs.push(id);regions.push(region);await owner.query("INSERT INTO organizations(id,slug,display_name,status,enrollment_ready,allowed_providers) VALUES($1,$1,'Operations test','ACTIVE',true,ARRAY['password'])",[id]);await owner.query("INSERT INTO organization_units(id,organization_id,name) VALUES($1,$2,'Region')",[region,id]);await member(admin,id,'ORG_ADMIN');return {id,region};}
 async function member(a:Actor,id:string,role='VOLUNTEER'){await owner.query('INSERT INTO organization_memberships(id,organization_id,user_id,role) VALUES($1,$2,$3,$4)',[randomUUID(),id,a.userId,role]);}
 try {
  const {PlanningService:planning}=await import('../src/modules/sentinel/planning.service.js');
  const {SafetyService:safety}=await import('../src/modules/safety/safety.service.js');
  const {readPlanningContext}=await import('../src/modules/sentinel/planning-context.js');
  const {withRegion}=await import('../src/modules/sentinel/sentinel.context.js');
  const admin=await actor('planner'),one=await actor('applicant-one'),two=await actor('applicant-two'),other=await actor('other-coordinator');
  const a=await org(admin),b=await org(other);await member(one,a.id);await member(two,a.id);await member(other,a.id,'COORDINATOR');
  let mission:any=await service.command(admin,a.id,a.region,randomUUID(),{action:'CREATE_MISSION',mission:{title:'Preparedness team',brief:'Review the community hall before the shift.',starts_at:new Date(Date.now()+60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),capacity:2,longitude:36,latitude:-1,meeting_point:'Community hall',required_skills:[]}});
  mission=await service.command(admin,a.id,a.region,randomUUID(),{action:'TRANSITION_MISSION',id:mission.id,expected_version:mission.version,status:'STAGED'});
  const stock:any=await service.command(admin,a.id,a.region,randomUUID(),{action:'CREATE_RESOURCE',title:'Water',unit:'pack',location:'Depot',quantity:4});
  for(const person of [one,two])await service.command(person,a.id,a.region,randomUUID(),{action:'APPLY',id:mission.id});
  const snapshot=await readPlanningContext(admin,a.id,a.region,mission.id);
  const recommendation={summary:'Allocate the two applicants',allocations:[one,two].map(p=>({user_id:p.userId,reason:'Confirmed applicant',supplies:[{resource_id:stock.id,quantity:2,reason:'Team supply'}]})),shortages:[],decisions:[]};
  const {assessmentEvidence}=await import('../src/modules/sentinel/planning-evidence.js');
  const policy={version:2,heat_c:35,wind_mps:12,hourly_rain_mm:10,maximum_run_age_hours:8},bounds={west:36,east:37,south:-2,north:-1};
  await owner.query('UPDATE organization_units SET forecast_policy=$1,forecast_bounds=$2 WHERE id=$3',[JSON.stringify(policy),JSON.stringify(bounds),a.region]);
  const assessmentId=randomUUID(),assessmentPayload={status:'DRAFT',source:{init_time:new Date(Date.now()-3600000).toISOString(),source_id:'fixture-source',bounds},evidence:{policy_version:2,points:[{}]},narrative:{summary:'Review preparedness'},validation:'UNVALIDATED_WEATHER_INDICATORS'};
  await owner.query('INSERT INTO operation_records(id,organization_id,region_id,kind,owner_id,payload,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[assessmentId,a.id,a.region,'WEATHER_ANALYSIS',admin.userId,JSON.stringify(assessmentPayload)]);
  const weather_evidence=assessmentEvidence({id:assessmentId,version:1,payload:assessmentPayload},{forecastPolicy:policy,forecastBounds:bounds});
  const planId=randomUUID();
  await owner.query('INSERT INTO operation_records(id,organization_id,region_id,kind,owner_id,payload,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[planId,a.id,a.region,'RESOURCE_PLAN',admin.userId,JSON.stringify({title:'Test proposal',status:'DRAFT',expires_at:new Date(Date.now()+1800000).toISOString(),snapshot,recommendation,weather_evidence})]);

  const {DraftsService:drafts}=await import('../src/modules/drafts/drafts.service.js');
  const draftKey='qa:'+randomUUID();
  const initial=await drafts.put(admin,draftKey,{payload:{question:'Original'},base_version:0});
  const edits=await Promise.allSettled(['Device A','Device B'].map(question=>drafts.put(admin,draftKey,{payload:{question},base_version:initial.version})));
  assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(edits.filter(r=>r.status==='rejected'&&r.reason.code==='DRAFT_CONFLICT').length,1);
  assert.equal(await drafts.get(other,draftKey),null);
  await drafts.remove(admin,draftKey);
  const {insertFeedIncidents}=await import('../src/modules/sentinel/incidents.service.js');
  const feed={external_id:'qa-feed',title:'Bridge collapse',type:'BUILDING_COLLAPSE' as const,category:'ARTIFICIAL' as const,severity:'HIGH' as const,description:'Report',source_name:'Test',source_url:'https://example.org',published_at:new Date().toISOString(),latitude:-1.5,longitude:36.5};
  const ingest=()=>withRegion(admin,a.id,a.region,true,async tx=>{await tx.$queryRaw`SELECT set_config('vops.operations','true',true)`;return insertFeedIncidents(tx,a.id,a.region,[feed,feed,{...feed,external_id:'unlocated',latitude:null}],bounds,admin.userId);});
  const imports=await Promise.all([ingest(),ingest()]);assert.equal(imports.reduce((n,v)=>n+v,0),1);
  assert.equal((await owner.query("SELECT count(*)::int n FROM operation_records WHERE organization_id=$1 AND kind='INCIDENT'",[a.id])).rows[0].n,1);
  const {importWorkerIncidents}=await import('../src/modules/sentinel/incidents.service.js');
  const workerResult=await prisma.$transaction(tx=>importWorkerIncidents(tx as never,admin.userId,[{...feed,external_id:'worker-feed'}]));
  assert.equal(workerResult.created,1);assert.equal(workerResult.regions,1);
  await assert.rejects(prisma.$transaction(tx=>importWorkerIncidents(tx as never,one.userId,[feed])),/NO_AUTHORIZED_REGIONS/);
  // Actual HTTP routing + live PostgreSQL/RLS. Firebase verification is a fixture,
  // not a real Railway/Firebase session; database identity and grants are real test rows.
  const {default:express}=await import('express');
  const {default:sentinelRouter}=await import('../src/modules/sentinel/sentinel.controller.js');
  const {createFirebaseAuthenticator}=await import('../src/middleware/firebase-auth.middleware.js');
  const flags=['SENTINEL_OPEN_METEO_ENABLED','SENTINEL_NWS_ENABLED','SENTINEL_RELIEFWEB_ENABLED','SENTINEL_USGS_ENABLED'];
  const savedFlags=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const flag of flags)process.env[flag]='false';
  const app=express();app.use(express.json());
  const testCredential=randomUUID();
  app.use(createFirebaseAuthenticator(()=>({verifyIdToken:async token=>{assert.equal(token,testCredential);return admin.identity;},verifySessionCookie:async()=>{throw new Error('No cookie fixture');}}),async()=>({id:admin.userId,email:admin.identity.email!,fullName:'Test coordinator',role:'VOLUNTEER',isActive:true,revokedBefore:null})));
  app.use('/organizations/:orgId/sentinel',sentinelRouter);
  app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.statusCode??500).json({code:error.code??'UNEXPECTED'}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const endpoint=`http://127.0.0.1:${(server.address() as any).port}/organizations/${a.id}/sentinel/regions/${a.region}/predictions`;
  const headers={authorization:'Bearer '+testCredential,'content-type':'application/json'};
  try{
   assert.equal((await fetch(endpoint)).status,401);
   const response=await fetch(endpoint,{headers});assert.equal(response.status,200,await response.clone().text());
   const initial=await response.json();assert.equal(initial.validation,'UNVALIDATED_INDICATOR');assert.equal(initial.operational_warning,false);
   const cached=await fetch(endpoint,{headers});assert.equal((await cached.json()).source_id,initial.source_id);
   await owner.query("UPDATE organization_memberships SET role='VOLUNTEER' WHERE organization_id=$1 AND user_id=$2",[a.id,admin.userId]);
   assert.equal((await fetch(endpoint,{headers})).status,403,'Cached predictions must recheck a demoted coordinator');
   await owner.query("UPDATE organization_memberships SET role='ORG_ADMIN' WHERE organization_id=$1 AND user_id=$2",[a.id,admin.userId]);
   const persisted=await fetch(endpoint+'/refresh',{method:'POST',headers,body:'{}'});assert.equal(persisted.status,200,await persisted.clone().text());
   assert.equal((await owner.query("SELECT count(*)::int n FROM operation_records WHERE organization_id=$1 AND kind='HAZARD_PREDICTION'",[a.id])).rows[0].n,1);
   await owner.query('UPDATE organization_units SET forecast_policy=$1 WHERE id=$2',[JSON.stringify({...policy,version:3}),a.region]);
   const changed=await (await fetch(endpoint,{headers})).json();assert.equal(changed.policy_version,3);assert.notEqual(changed.source_id,initial.source_id);
   await owner.query('UPDATE organization_units SET forecast_policy=$1 WHERE id=$2',[JSON.stringify(policy),a.region]);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));for(const flag of flags){if(savedFlags[flag]===undefined)delete process.env[flag];else process.env[flag]=savedFlags[flag];}}

  const review={expected_version:1,reason:'Checked access and current local conditions.',route_reviewed:true as const,conditions_reviewed:true as const};
  await assert.rejects(planning.approve(one,a.id,a.region,planId,randomUUID(),review),{code:'CAPABILITY_REQUIRED'});
  await assert.rejects(planning.approve(other,b.id,b.region,planId,randomUUID(),review),{statusCode:404});
  // The second assignee is no longer eligible; the first assignment and stock reservation must roll back.
  await owner.query("UPDATE operation_records SET payload=jsonb_set(payload::jsonb,'{status}','\"WITHDRAWN\"')::json WHERE kind='APPLICATION' AND parent_id=$1 AND owner_id=$2",[mission.id,two.userId]);
  await assert.rejects(planning.approve(admin,a.id,a.region,planId,randomUUID(),review),{code:'APPLICATION_REQUIRED'});
  assert.equal((await owner.query("SELECT count(*)::int n FROM operation_records WHERE parent_id=$1 AND kind='ASSIGNMENT'",[mission.id])).rows[0].n,0);
  assert.equal((await owner.query('SELECT count(*)::int n FROM responder_reservations WHERE organization_id=$1',[a.id])).rows[0].n,0);
  assert.equal(((await service.detail(admin,a.id,a.region,stock.id)).payload as any).reserved,0);
  assert.equal((await owner.query('SELECT version FROM operation_records WHERE id=$1',[mission.id])).rows[0].version,mission.version);
  await service.command(two,a.id,a.region,randomUUID(),{action:'APPLY',id:mission.id});
  const edit={expected_version:1,reason:'Verified team quantities with the depot.',recommendation};
  const editKey=randomUUID();
  const edited:any=await planning.edit(admin,a.id,a.region,planId,editKey,edit);
  assert.equal((await planning.edit(admin,a.id,a.region,planId,editKey,edit) as any).version,edited.version);
  await assert.rejects(planning.approve(admin,a.id,a.region,planId,randomUUID(),review),{code:'VERSION_CONFLICT'});
  await owner.query('UPDATE organization_units SET forecast_policy=$1 WHERE id=$2',[JSON.stringify({...policy,version:3}),a.region]);
  await assert.rejects(planning.approve(admin,a.id,a.region,planId,randomUUID(),{...review,expected_version:edited.version}),{code:'ASSESSMENT_POLICY_CHANGED'});
  await owner.query('UPDATE organization_units SET forecast_policy=$1 WHERE id=$2',[JSON.stringify(policy),a.region]);
  const approvalKey=randomUUID();
  const results=await Promise.all([1,2].map(()=>planning.approve(admin,a.id,a.region,planId,approvalKey,{...review,expected_version:edited.version})));
  assert.equal(results[0].version,results[1].version);
  assert.equal((await owner.query("SELECT count(*)::int n FROM operation_records WHERE parent_id=$1 AND kind='ASSIGNMENT'",[mission.id])).rows[0].n,2);
  assert.equal(((await service.detail(admin,a.id,a.region,stock.id)).payload as any).reserved,4);
  // A demoted author cannot recover the proposal through raw scoped reads.
  await owner.query("UPDATE organization_memberships SET role='VOLUNTEER' WHERE organization_id=$1 AND user_id=$2",[a.id,admin.userId]);
  assert.equal(await withRegion(admin,a.id,a.region,false,tx=>tx.operationRecord.count({where:{id:planId}})),0);
  await owner.query("UPDATE organization_memberships SET role='ORG_ADMIN' WHERE organization_id=$1 AND user_id=$2",[a.id,admin.userId]);
  const abandonedId=randomUUID();
  await owner.query('INSERT INTO operation_records(id,organization_id,region_id,kind,owner_id,payload,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[abandonedId,a.id,a.region,'RESOURCE_PLAN',admin.userId,JSON.stringify({status:'RUNNING',requested_at:new Date(Date.now()-6*60000).toISOString()})]);
  const history=await planning.list(admin,a.id,a.region,'RESOURCE_PLAN');
  assert.equal(history.items[0]!.id,abandonedId);
  assert.equal((history.items[0]!.payload as any).error_code,'ANALYSIS_INTERRUPTED');
  const intake={summary:'I need assistance returning to the community hall.',severity:'HIGH' as const,source:'IN_APP' as const};
  const concurrent=await Promise.all([1,2].map(()=>safety.intake(two,a.id,a.region,randomUUID(),intake)));
  assert.equal((concurrent[0] as any).id,(concurrent[1] as any).id,'Concurrent requests must share one open assistance case');
  const intakeKey=randomUUID();
  let incident:any=await safety.intake(one,a.id,a.region,intakeKey,intake);
  assert.equal((await safety.intake(one,a.id,a.region,intakeKey,intake) as any).id,incident.id);
  await assert.rejects(safety.timeline(two,a.id,a.region,incident.id),{statusCode:404});
  assert.equal(await withRegion(two,a.id,a.region,false,tx=>tx.operationRecord.count({where:{kind:{in:['ASSISTANCE_CASE','ASSISTANCE_EVENT']},ownerId:one.userId}})),0);
  const duplicate:any=await safety.intake(one,a.id,a.region,randomUUID(),{...intake,severity:'URGENT'});
  assert.equal(duplicate.id,incident.id);assert.equal(duplicate.version,incident.version+1);assert.equal(duplicate.payload.severity,'URGENT');
  const decision={expected_version:duplicate.version,action:'ACKNOWLEDGE' as const,reason:'Contact confirmed; I am coordinating the response.'};
  const race=await Promise.allSettled([admin,other].map(person=>safety.decide(person,a.id,a.region,incident.id,randomUUID(),decision)));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.code==='VERSION_CONFLICT').length,1);
  incident=(await safety.timeline(admin,a.id,a.region,incident.id)).case;
  const keeper=(incident.payload as any).coordinator_id===admin.userId?admin:other;
  const nonkeeper=keeper===admin?other:admin;
  await assert.rejects(safety.decide(nonkeeper,a.id,a.region,incident.id,randomUUID(),{expected_version:incident.version,action:'RESOLVE',reason:'Attempting another coordinatorâ€™s case resolution.'}),{code:'CASE_OWNER_REQUIRED'});
  const resolved:any=await safety.decide(keeper,a.id,a.region,incident.id,randomUUID(),{expected_version:incident.version,action:'RESOLVE',reason:'The member confirmed arrival and no further help needed.'});
  assert.equal(resolved.payload.status,'RESOLVED');
  assert.equal((await safety.timeline(one,a.id,a.region,incident.id)).items.length,4);

 }finally{
  await owner.query('DELETE FROM usage_ledger WHERE user_id=ANY($1::int[])',[ids]);
  await owner.query('DELETE FROM organization_audit WHERE organization_id=ANY($1::text[])',[orgs]);
  await prisma.$disconnect();await owner.query('DELETE FROM pro_sponsorships WHERE organization_id=ANY($1)',[orgs]);await owner.query('DELETE FROM operation_receipts WHERE organization_id=ANY($1)',[orgs]);await owner.query('DELETE FROM operation_records WHERE organization_id=ANY($1)',[orgs]);await owner.query('DELETE FROM responder_reservations WHERE organization_id=ANY($1)',[orgs]);await owner.query('DELETE FROM organization_memberships WHERE organization_id=ANY($1)',[orgs]);await owner.query('DELETE FROM organization_units WHERE id=ANY($1)',[regions]);await owner.query('DELETE FROM organizations WHERE id=ANY($1)',[orgs]);await owner.query('DELETE FROM firebase_identities WHERE user_id=ANY($1)',[ids]);await owner.query('DELETE FROM users WHERE id=ANY($1)',[ids]);await owner.query(`DROP OWNED BY "${login}"`);await owner.query(`DROP ROLE "${login}"`);await owner.end();
 }
});
