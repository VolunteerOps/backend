// Decrypt only into the private operator workspace. This never connects to or overwrites a database.
import {readFileSync,writeFileSync} from 'node:fs';import {resolve,sep} from 'node:path';import {createDecipheriv,createHash} from 'node:crypto';
const [manifestPath,encryptedPath,output]=process.argv.slice(2),target=resolve(output??'');
if(!target.startsWith(resolve('.sentinel-deploy')+sep))throw Error('PRIVATE_OUTPUT_REQUIRED');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY_B64??'','base64');
if(manifest.version!==1||manifest.cipher!=='aes-256-gcm'||key.length!==32)throw Error('INVALID_BACKUP_FORMAT');
const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(manifest.iv,'base64'));decipher.setAuthTag(Buffer.from(manifest.tag,'base64'));
const bytes=Buffer.concat([decipher.update(readFileSync(encryptedPath)),decipher.final()]);
if(bytes.length!==manifest.bytes||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('BACKUP_INTEGRITY_FAILED');
writeFileSync(target,bytes,{mode:0o600,flag:'wx'});console.log('BACKUP_DECRYPTED_AND_VERIFIED');
