import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Pool} from 'pg';
import {boundsWkt} from '../src/modules/sentinel/providers/weathernext3.contract.js';
const connection=process.env.SENTINEL_TEST_DATABASE_URL;
test('PostgreSQL 18/PostGIS validates region geometry, dateline coverage and metre distances',{skip:!connection},async()=>{
 const target=new URL(connection!);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname));
 assert.match(target.pathname,/test/i);
 const pool=new Pool({connectionString:connection,max:1});
 try{
  const facts=(await pool.query("SELECT current_setting('server_version_num')::int AS version, postgis_version() AS postgis")).rows[0];
  assert.equal(Math.floor(facts.version/10000),18);assert.match(facts.postgis,/^3\./);
  const wkt=boundsWkt({west:179,east:-179,south:-1,north:1});
  const geometry=(await pool.query("SELECT ST_IsValid(ST_GeomFromText($1,4326)) AS valid, ST_Covers(ST_GeomFromText($1,4326),ST_SetSRID(ST_Point(-179.5,0),4326)) AS west, ST_Covers(ST_GeomFromText($1,4326),ST_SetSRID(ST_Point(179.5,0),4326)) AS east, ST_Covers(ST_GeomFromText($1,4326),ST_SetSRID(ST_Point(0,0),4326)) AS centre",[wkt])).rows[0];
  assert.deepEqual(geometry,{valid:true,west:true,east:true,centre:false});
  const distance=(await pool.query("SELECT ST_Distance(ST_SetSRID(ST_Point(0,0),4326)::geography,ST_SetSRID(ST_Point(0,1),4326)::geography) AS metres")).rows[0].metres;
  assert.ok(distance>110000 && distance<112000);
 }finally{await pool.end();}
});
