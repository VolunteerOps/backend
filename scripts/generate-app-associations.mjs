import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const roots=['../volunteer/webApp/src/webMain/resources','../admin/webApp/src/webMain/resources'];
const pkg=process.env.ANDROID_APPLICATION_ID, fingerprints=(process.env.ANDROID_SHA256_FINGERPRINTS??'').split(',').filter(Boolean);
const ios=process.env.IOS_ASSOCIATED_APP_ID;
if(!pkg||!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(pkg)||!fingerprints.length||fingerprints.some(f=>!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)))throw Error('REAL_ANDROID_PACKAGE_AND_SIGNING_SHA256_REQUIRED');
if(!ios||!/^([A-Z0-9]{10})\.[A-Za-z0-9.-]+$/.test(ios))throw Error('REAL_APPLE_TEAM_AND_BUNDLE_ID_REQUIRED');
for(const root of roots){const out=resolve(root,'.well-known');mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'assetlinks.json'),JSON.stringify([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:pkg,sha256_cert_fingerprints:fingerprints}}],null,2));writeFileSync(resolve(out,'apple-app-site-association'),JSON.stringify({applinks:{details:[{appIDs:[ios],components:[{'/':'/','?':{invitation:'*'}},{'/':'/invitations/*'}]}]}},null,2));}
console.log('Association files generated from supplied signing identities; deploy then verify on signed devices.');
