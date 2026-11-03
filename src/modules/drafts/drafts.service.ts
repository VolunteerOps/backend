import {z} from 'zod';
import {prisma} from '../../core/prisma.js';
import type {Actor} from '../organizations/context.js';

/**
 * Server-synced drafts, private to the signed-in user. The same draft key is
 * used by the web portal and the mobile/desktop app, so a form or assistant
 * conversation started on one device can be resumed on another. Draft
 * payloads are bounded, never shared with other members, and are not
 * operational records.
 */
export const draftKey=z.string().trim().min(1).max(300).regex(/^[\w:./-]+$/,'Draft key has unsupported characters');
export const draftPut=z.object({
  payload:z.record(z.string(),z.unknown()).refine(v=>JSON.stringify(v).length<=64_000,'Draft is too large'),
  base_version:z.number().int().nonnegative().default(0),
}).strict();
export type DraftView={key:string;payload:Record<string,unknown>;version:number;updated_at:string};

const view=(row:{key:string;payload:unknown;version:number;updatedAt:Date}):DraftView=>({key:row.key,payload:row.payload as Record<string,unknown>,version:row.version,updated_at:row.updatedAt.toISOString()});

export const DraftsService={
 async list(actor:Actor):Promise<{items:DraftView[]}> {
  const rows=await prisma.userDraft.findMany({where:{userId:actor.userId},orderBy:{updatedAt:'desc'},take:100});
  return {items:rows.map(view)};
 },
 async get(actor:Actor,key:string):Promise<DraftView|null> {
  const row=await prisma.userDraft.findUnique({where:{userId_key:{userId:actor.userId,key:draftKey.parse(key)}}});
  return row?view(row):null;
 },
 async put(actor:Actor,key:string,input:z.infer<typeof draftPut>):Promise<DraftView> {
  const parsed=draftPut.parse(input);
  const parsedKey=draftKey.parse(key);
  const row=await prisma.userDraft.upsert({
   where:{userId_key:{userId:actor.userId,key:parsedKey}},
   create:{userId:actor.userId,key:parsedKey,payload:parsed.payload as never,version:1},
   update:{payload:parsed.payload as never,version:{increment:1}},
  });
  return view(row);
 },
 async remove(actor:Actor,key:string):Promise<{deleted:boolean}> {
  const result=await prisma.userDraft.deleteMany({where:{userId:actor.userId,key:draftKey.parse(key)}});
  return {deleted:result.count>0};
 },
};
