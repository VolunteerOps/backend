import { z } from 'zod';
import {trainingCommands} from './training.schema.js';
export const scopeId = z.string().uuid();
export const missionSchema = z.object({
 title:z.string().trim().min(3).max(160), brief:z.string().trim().min(10).max(5000),
 starts_at:z.string().datetime(), ends_at:z.string().datetime(), capacity:z.number().int().min(1).max(1000),
 longitude:z.number().min(-180).max(180), latitude:z.number().min(-90).max(90),
 meeting_point:z.string().trim().min(3).max(500), required_skills:z.array(z.string().min(2).max(60)).max(30).default([]),
}).strict().refine(x=>Date.parse(x.ends_at)>Date.parse(x.starts_at),'Mission duration must be positive; use the length the coordinator stipulates');
export const kinds = ['MISSION','APPLICATION','ASSIGNMENT','REPORT','MESSAGE','HOURS','SUPPORT','EVENT','INVENTORY','STOCK_LEDGER','RESOURCE_RESERVATION','COURSE','ENROLLMENT','CREDENTIAL','DISPATCH_CONTROL','BULLETIN','CAMPAIGN'] as const;
export const listSchema = z.object({kind:z.enum(kinds).default('MISSION'),after:z.coerce.number().int().nonnegative().default(0),parent_id:scopeId.optional(),status:z.string().regex(/^[A-Z_]{2,40}$/).optional(),q:z.string().trim().min(2).max(100).optional()}).strict();
const version=z.number().int().positive();
export const commandSchema=z.discriminatedUnion('action',[
 ...trainingCommands,
 z.object({action:z.literal('CREATE_CAMPAIGN'),title:z.string().trim().min(3).max(160),description:z.string().trim().min(10).max(3000),owner:z.string().trim().min(2).max(120),due_at:z.string().datetime(),tasks:z.array(z.string().trim().min(3).max(300)).min(1).max(30),bulletin_id:scopeId.optional()}).strict(),
 z.object({action:z.literal('UPDATE_CAMPAIGN_TASK'),id:scopeId,expected_version:version,task_id:scopeId,completed:z.boolean()}).strict(),
 z.object({action:z.literal('ARCHIVE_CAMPAIGN'),id:scopeId,expected_version:version,reason:z.string().trim().min(10).max(1000)}).strict(),
 z.object({action:z.literal('SET_DISPATCH'),paused:z.boolean(),expected_version:z.number().int().nonnegative(),reason:z.string().trim().min(10).max(1000)}).strict(),
 z.object({action:z.literal('PUBLISH_BULLETIN'),title:z.string().trim().min(3).max(160),body:z.string().trim().min(10).max(4000),priority:z.enum(['NOTICE','URGENT'])}).strict(),
 z.object({action:z.literal('WITHDRAW_BULLETIN'),id:scopeId,expected_version:version,reason:z.string().trim().min(10).max(1000)}).strict(),
 z.object({action:z.literal('CREATE_MISSION'),mission:missionSchema}).strict(),
 z.object({action:z.literal('TRANSITION_MISSION'),id:scopeId,expected_version:version,status:z.enum(['STAGED','ACTIVE','PAUSED','COMPLETED','CANCELLED'])}).strict(),
 z.object({action:z.literal('APPLY'),id:scopeId,note:z.string().max(1500).default('')}).strict(),
 z.object({action:z.literal('SAVE_MISSION'),id:scopeId,saved:z.boolean()}).strict(),
 z.object({action:z.literal('WITHDRAW_APPLICATION'),id:scopeId,expected_version:version}).strict(),
 z.object({action:z.literal('ASSIGN'),id:scopeId,expected_version:version,user_id:z.number().int().positive(),supplies:z.array(z.object({resource_id:scopeId,quantity:z.number().int().min(1).max(1000000)}).strict()).max(20).default([])}).strict(),
 z.object({action:z.literal('CHECK_IN'),id:scopeId,expected_version:version}).strict(),
 z.object({action:z.literal('COMPLETE_ASSIGNMENT'),id:scopeId,expected_version:version,hours:z.number().min(0).max(24),note:z.string().max(1500).default('')}).strict(),
 z.object({action:z.literal('APPROVE_HOURS'),id:scopeId,expected_version:version,hours:z.number().min(0).max(24),reason:z.string().trim().min(10).max(1500)}).strict(),
 z.object({action:z.literal('REPORT'),id:scopeId,title:z.string().trim().min(3).max(160),body:z.string().trim().min(3).max(5000)}).strict(),
 z.object({action:z.literal('MESSAGE'),id:scopeId,body:z.string().trim().min(1).max(4000),reply_to:scopeId.optional()}).strict(),
 z.object({action:z.literal('MODERATE_MESSAGE'),id:scopeId,expected_version:version,reason:z.string().trim().min(10).max(1500)}).strict(),
 z.object({action:z.literal('TRIAGE_REPORT'),id:scopeId,expected_version:version,status:z.enum(['REVIEWING','ACTION_REQUIRED','RESOLVED']),reason:z.string().trim().min(10).max(1500),related_report_id:scopeId.optional()}).strict(),
 z.object({action:z.literal('CREATE_RESOURCE'),vehicle_model:z.string().trim().min(1).max(120).optional(),plate_number:z.string().trim().min(1).max(40).optional(),title:z.string().trim().min(3).max(160),unit:z.string().trim().min(1).max(40),location:z.string().trim().min(3).max(300),quantity:z.number().int().nonnegative().max(1000000)}).strict(),
 z.object({action:z.literal('ADJUST_STOCK'),id:scopeId,expected_version:version,delta:z.number().int().min(-1000000).max(1000000).refine(x=>x!==0),reason:z.string().trim().min(10).max(1500)}).strict(),
 z.object({action:z.literal('TRANSFER_STOCK'),id:scopeId,expected_version:version,target_id:scopeId,target_version:version,quantity:z.number().int().positive().max(1000000),reason:z.string().trim().min(10).max(1500)}).strict(),
 z.object({action:z.literal('REPLY_SUPPORT'),id:scopeId,expected_version:version,body:z.string().trim().min(1).max(4000)}).strict(),
 z.object({action:z.literal('TRIAGE_SUPPORT'),id:scopeId,expected_version:version,status:z.enum(['OPEN','IN_PROGRESS','RESOLVED']),reason:z.string().trim().min(10).max(1500)}).strict(),
 z.object({action:z.literal('SUPPORT'),title:z.string().trim().min(3).max(160),body:z.string().trim().min(10).max(5000)}).strict(),
]);
export type Command=z.infer<typeof commandSchema>;
export type CommandInput=z.input<typeof commandSchema>;
export const transitions:Record<string,readonly string[]>={DRAFT:['STAGED','CANCELLED'],STAGED:['ACTIVE','CANCELLED'],ACTIVE:['PAUSED','COMPLETED','CANCELLED'],PAUSED:['ACTIVE','CANCELLED'],COMPLETED:[],CANCELLED:[]};
export function validTransition(from:string,to:string){return transitions[from]?.includes(to)===true;}
