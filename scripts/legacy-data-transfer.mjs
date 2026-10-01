// Explicit application-only transfer. No migration ledgers, privilege grants or ownership guesses.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
const mode=process.argv[2], file=resolve(process.argv[3]??'');
const privateRoot=resolve('.sentinel-deploy');
if(!file.startsWith(privateRoot+'\\')&&!file.startsWith(privateRoot+'/'))throw Error('PRIVATE_OUTPUT_REQUIRED');
const mapping=JSON.parse(readFileSync('contracts/legacy-import.v1.json','utf8'));
const quote=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('INVALID_IDENTIFIER');return '"'+value+'"';};
const hash=rows=>createHash('sha256').update(rows.join('\n')).digest('hex');
const raw=mode==='export'?process.env.SOURCE_DATABASE_URL:process.env.TARGET_DATABASE_URL;
const url=new URL(raw??'');
const local=['127.0.0.1','localhost'].includes(url.hostname);
if(mode==='import'&&process.env.RESQ_IMPORT_EMPTY_TARGET!=='railway-staging-rehearsal')throw Error('EMPTY_STAGING_TARGET_CONFIRMATION_REQUIRED');
if(!['export','import','verify'].includes(mode))throw Error('MODE_REQUIRED');
const disable=url.searchParams.get('sslmode')==='disable';
if(disable&&(!local||!url.pathname.includes('test')))throw Error('TLS_REQUIRED');
for(const key of [...url.searchParams.keys()])if(key.startsWith('ssl'))url.searchParams.delete(key);
const db=new Client({connectionString:url.toString(),ssl:disable?false:{rejectUnauthorized:true,...process.env.TRANSFER_TLS_CA?{ca:process.env.TRANSFER_TLS_CA}:{}},connectionTimeoutMillis:10000,statement_timeout:30000});
await db.connect();
try {
 await db.query(mode==='export'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
 await db.query("SET LOCAL timezone='UTC'");
 const manifest=mode==='export'?{version:1,createdAt:new Date().toISOString(),tables:[]}:JSON.parse(readFileSync(file,'utf8'));
 if(mode==='export') {const version=(await db.query("SHOW server_version_num")).rows[0].server_version_num;if(Math.floor(Number(version)/10000)!==mapping.sourceMajor)throw Error('UNREVIEWED_SOURCE_VERSION');}
 else if(manifest.version!==mapping.version||manifest.tables.length!==mapping.tables.length)throw Error('INVALID_MANIFEST');
 let total=0;
 for(const spec of mapping.tables) {
  const table='public.'+quote(spec.name), columns=spec.columns.map(quote).join(',');
  const actual=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[spec.name])).rows.map(r=>r.column_name);
  if(mode==='export'&&JSON.stringify(actual)!==JSON.stringify(spec.columns))throw Error('UNREVIEWED_SOURCE_SCHEMA_'+spec.name);
  if(spec.columns.some(c=>!actual.includes(c)))throw Error('TARGET_MAPPING_MISMATCH_'+spec.name);
  const record=mode==='export'?{name:spec.name,columns:spec.columns}:manifest.tables.find(t=>t.name===spec.name);
  if(!record||JSON.stringify(record.columns)!==JSON.stringify(spec.columns))throw Error('UNREVIEWED_MAPPING');
  if(mode==='import') {
   if((await db.query('SELECT 1 FROM '+table+' LIMIT 1')).rowCount)throw Error('TARGET_NOT_EMPTY_'+spec.name);
   if(hash(record.rows)!==record.sha256)throw Error('MANIFEST_CORRUPT');
   for(let offset=0;offset<record.rows.length;offset+=100)await db.query('INSERT INTO '+table+' ('+columns+') SELECT '+columns+' FROM json_populate_recordset(NULL::'+table+',$1::json)', ['['+record.rows.slice(offset,offset+100).join(',')+']']);
  }
  const rows=(await db.query('SELECT row_to_json(r)::text AS row FROM (SELECT '+columns+' FROM '+table+' ORDER BY id LIMIT 100001) r')).rows.map(r=>r.row);
  if(rows.length>100000)throw Error('TRANSFER_LIMIT_EXCEEDED');total+=rows.length;
  if(mode==='export') {
   const seq=(await db.query("SELECT pg_get_serial_sequence($1,'id') AS name",[table])).rows[0].name;
   record.sequence=seq?(await db.query('SELECT last_value::text,is_called FROM '+seq.split('.').map(quote).join('.'))).rows[0]:null;
   Object.assign(record,{rows,sha256:hash(rows)});manifest.tables.push(record);
  } else {
   if(hash(rows)!==record.sha256)throw Error('FINGERPRINT_MISMATCH_'+spec.name);
   if(mode==='import'&&record.sequence)await db.query("SELECT setval(pg_get_serial_sequence($1,'id'),$2,$3)",[table,record.sequence.last_value,record.sequence.is_called]);
   if(record.sequence){
    const sequence=(await db.query("SELECT pg_get_serial_sequence($1,'id') AS name",[table])).rows[0].name;
    const value=(await db.query('SELECT last_value::text,is_called FROM '+sequence.split('.').map(quote).join('.'))).rows[0];
    if(value.last_value!==record.sequence.last_value||value.is_called!==record.sequence.is_called)throw Error('SEQUENCE_MISMATCH_'+spec.name);
   }
  }
 }
 if(mode==='export') {const encoded=JSON.stringify(manifest);if(Buffer.byteLength(encoded)>100*1024*1024)throw Error('TRANSFER_SIZE_EXCEEDED');writeFileSync(file,encoded,{mode:0o600});}
 await db.query('COMMIT');
 console.log(JSON.stringify({mode,tables:mapping.tables.length,rows:total,fingerprints:true,sequences:true,ownership:'unmapped legacy rows remain quarantined'}));
} catch(error) {await db.query('ROLLBACK').catch(()=>{});console.error('TRANSFER_FAILED',/^[A-Z_]+/.exec(error.message)?.[0]??'DATABASE_ERROR');process.exitCode=1;}
finally {await db.end();}
