import {z} from 'zod';
import {ApiError} from '../../core/errors.js';

import {withActor,type Actor} from '../organizations/context.js';

/**
 * Server-synced drafts, private to the signed-in user. The same draft key is
 * used by the web portal and the mobile/desktop app, so a form or assistant
 * conversation started on one device can be resumed on another. Draft
 * payloads are bounded, never shared with other members, and are not
 * operational records.
 */
export const draftKey=z.string().trim().min(1).max(300).regex(/^[\w:./-]+$/,'Draft key has unsupported characters');
function containsCredential(value:unknown):boolean {
 if (!value || typeof value!=='object') return false;
 return Object.entries(value).some(([key,entry])=>/(?:password|secret|access_token|refresh_token|verification_code|^otp$)/i.test(key)||containsCredential(entry));
}
export const draftPut=z.object({
  payload:z.record(z.string(),z.unknown()).refine(v=>JSON.stringify(v).length<=64_000,'Draft is too large').refine(v=>!containsCredential(v),'Do not save sign-in credentials in drafts'),
  base_version:z.number().int().nonnegative().default(0),
}).strict();
export type DraftView={key:string;payload:Record<string,unknown>;version:number;updated_at:string};

const view=(row:{key:string;payload:unknown;version:number;updatedAt:Date}):DraftView=>({key:row.key,payload:row.payload as Record<string,unknown>,version:row.version,updated_at:row.updatedAt.toISOString()});

export const DraftsService={
 async list(actor:Actor):Promise<{items:DraftView[]}> {
  const rows=await withActor(actor,tx=>tx.userDraft.findMany({where:{userId:actor.userId},orderBy:{updatedAt:'desc'},take:100}));
  return {items:rows.map(view)};
 },
 async get(actor:Actor,key:string):Promise<DraftView|null> {
  const row=await withActor(actor,tx=>tx.userDraft.findUnique({where:{userId_key:{userId:actor.userId,key:draftKey.parse(key)}}}));
  return row?view(row):null;
 },
 async put(actor:Actor,key:string,input:z.infer<typeof draftPut>):Promise<DraftView> {
  const parsed=draftPut.parse(input);
  const parsedKey=draftKey.parse(key);
  const row=await withActor(actor,async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.userId+':draft:'+parsedKey},0))::text`;
   const where={userId_key:{userId:actor.userId,key:parsedKey}};
   const current=await tx.userDraft.findUnique({where});
   if((current?.version??0)!==parsed.base_version)throw ApiError.conflict('This draft changed on another device. Reload it before saving again.','DRAFT_CONFLICT');
   return tx.userDraft.upsert({where,
    create:{userId:actor.userId,key:parsedKey,payload:parsed.payload as never,version:1},
    update:{payload:parsed.payload as never,version:{increment:1}},
   });
  });
  return view(row);
 },
 async remove(actor:Actor,key:string):Promise<{deleted:boolean}> {
  const parsedKey=draftKey.parse(key);
  const result=await withActor(actor,async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.userId+':draft:'+parsedKey},0))::text`;
   return tx.userDraft.deleteMany({where:{userId:actor.userId,key:parsedKey}});
  });
  return {deleted:result.count>0};
 },
};
