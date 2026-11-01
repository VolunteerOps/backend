import type { Prisma } from '../../generated/prisma/client.js';
import { ApiError } from '../../core/errors.js';
import type { listSchema } from './operations.schema.js';
import type { z } from 'zod';

export const reviewLanes = [
 {key:'assistance',kind:'ASSISTANCE_CASE',statuses:['OPEN'],destination:'Assistance',action:'Acknowledge assistance request'},
 {key:'reports',kind:'REPORT',statuses:['ACTION_REQUIRED','SUBMITTED','REVIEWING'],destination:'Reports',action:'Review field report'},
 {key:'applications',kind:'APPLICATION',statuses:['APPLIED','WAITLISTED'],destination:'Applications',action:'Review application'},
 {key:'hours',kind:'HOURS',statuses:['PENDING'],destination:'Hours',action:'Approve contribution'},
 {key:'training',kind:'ENROLLMENT',statuses:['AWAITING_REVIEW'],destination:'Learning',action:'Verify training'},
 {key:'support',kind:'SUPPORT',statuses:['OPEN','IN_PROGRESS'],destination:'Support',action:'Follow up case'},
] as const;
export function requireCoordinator(role:string) {
 if(!['ORG_ADMIN','COORDINATOR'].includes(role)) throw ApiError.forbidden('Coordinator membership required','CAPABILITY_REQUIRED');
}
export function statusWhere(statuses:readonly string[]):Prisma.OperationRecordWhereInput {
 return {OR:statuses.map(status=>({payload:{path:['status'],equals:status}}))};
}
export function recordWhere(org:string,region:string,userId:number,role:string,input:z.infer<typeof listSchema>):Prisma.OperationRecordWhereInput {
 const personal=['APPLICATION','ASSIGNMENT','HOURS','SUPPORT','ENROLLMENT','CREDENTIAL'].includes(input.kind)&&role==='VOLUNTEER';
 const filters:Prisma.OperationRecordWhereInput[]=[];
 if(input.status)filters.push(statusWhere([input.status]));
 if(input.q)filters.push({OR:['title','body','brief','mission_title','skill','location'].map(field=>({payload:{path:[field],string_contains:input.q,mode:'insensitive'}}))});
 // Keep scope outside OR groups so neither text nor status can broaden access.
 return {organizationId:org,regionId:region,kind:input.kind,sequence:{gt:input.after},...(personal?{ownerId:userId}:{}),...(input.parent_id?{parentId:input.parent_id}:{}),...(filters.length?{AND:filters}:{})};
}
