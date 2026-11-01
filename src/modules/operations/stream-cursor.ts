import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ApiError } from '../../core/errors.js';
export type StreamScope = { userId:number; organizationId:string; regionId:string };
const lifetime = 24 * 3600_000;
function key() {
 const value=process.env.OPERATIONS_CURSOR_KEY;
 if(!value || !/^[a-f0-9]{64}$/i.test(value)) throw new ApiError(503,'STREAM_NOT_CONFIGURED','Event replay is awaiting cursor-key configuration');
 return Buffer.from(value,'hex');
}
const aad=(scope:StreamScope)=>Buffer.from(JSON.stringify([1,scope.userId,scope.organizationId,scope.regionId]));
export function encodeCursor(sequence:number,scope:StreamScope,now=Date.now()):string {
 if(!Number.isSafeInteger(sequence)||sequence<0)throw new Error('Invalid stream sequence');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(aad(scope));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({sequence,expires:now+lifetime})),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function decodeCursor(token:string,scope:StreamScope,now=Date.now()):number {
 const secret=key();
 try {
  if(token.length>512||! /^[A-Za-z0-9_-]{40,512}$/.test(token))throw Error();
  const bytes=Buffer.from(token,'base64url');
  if(bytes.toString('base64url')!==token)throw Error();
  const decipher=createDecipheriv('aes-256-gcm',secret,bytes.subarray(0,12));
  decipher.setAAD(aad(scope));decipher.setAuthTag(bytes.subarray(12,28));
  const value=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  if(!Number.isSafeInteger(value.sequence)||value.sequence<0||!Number.isSafeInteger(value.expires)||value.expires<=now||value.expires>now+lifetime)throw Error();
  return value.sequence;
 }catch{throw new ApiError(409,'STREAM_RESNAPSHOT_REQUIRED','Refresh the snapshot and start a new event stream');}
}
