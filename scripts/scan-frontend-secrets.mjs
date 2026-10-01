import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';import {resolve,join} from 'node:path';import dotenv from 'dotenv';
const secretFiles=['.env','.sentinel-deploy/railway/source.env'].filter(existsSync);
const secrets=secretFiles.flatMap(file=>Object.entries(dotenv.parse(readFileSync(file))).filter(([key,value])=>/SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|ENCRYPTION_KEY|S3_ACCESS_KEY|SERVICE_TOKEN/.test(key)&&value.length>=16));
const roots=process.argv.slice(2);if(!roots.length)throw Error('FRONTEND_BUILD_DIRECTORIES_REQUIRED');let count=0;
function scan(path){for(const entry of readdirSync(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED');if(entry.isDirectory()){scan(file);continue;}if(!/\.(js|mjs|html|json|css|wasm)$/.test(file))continue;if(statSync(file).size>128*1024*1024)throw Error('SCAN_SIZE_LIMIT');const bytes=readFileSync(file);count++;for(const[key,value]of secrets)if(bytes.includes(Buffer.from(value)))throw Error('PRIVATE_VALUE_IN_FRONTEND_'+key);}}
for(const root of roots)scan(resolve(root));console.log(JSON.stringify({files:count,privateValuesChecked:secrets.length,leaks:0}));
