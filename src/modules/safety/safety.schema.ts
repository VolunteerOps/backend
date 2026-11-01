import {z} from 'zod';
export const caseStatuses=['OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED'] as const;
export const caseIntake=z.object({summary:z.string().trim().min(10).max(3000),severity:z.enum(['URGENT','HIGH','STANDARD']),
 affected_user_id:z.number().int().positive().optional(),source:z.enum(['IN_APP','PHONE','RADIO']).default('IN_APP'),
 location:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),consent:z.literal(true)}).strict().optional(),
}).strict();
export const caseDecision=z.object({expected_version:z.number().int().positive(),action:z.enum(['ACKNOWLEDGE','START_RESPONSE','HANDOVER','RESOLVE','ESCALATE']),reason:z.string().trim().min(10).max(1500),coordinator_id:z.number().int().positive().optional()}).strict().superRefine((v,c)=>{if(v.action==='HANDOVER'&&!v.coordinator_id)c.addIssue({code:'custom',message:'Choose the receiving coordinator'});if(v.action!=='HANDOVER'&&v.coordinator_id)c.addIssue({code:'custom',message:'Coordinator is only accepted for handover'});});
export function nextCaseStatus(status:string,action:z.infer<typeof caseDecision>['action']){
 if(status==='RESOLVED')throw new Error('CASE_RESOLVED');
 if(action==='ACKNOWLEDGE'&&status==='OPEN')return 'ACKNOWLEDGED';
 if(action==='START_RESPONSE'&&status==='ACKNOWLEDGED')return 'IN_PROGRESS';
 if(action==='RESOLVE'&&['ACKNOWLEDGED','IN_PROGRESS'].includes(status))return 'RESOLVED';
 if(action==='HANDOVER'&&['ACKNOWLEDGED','IN_PROGRESS'].includes(status))return status;
 if(action==='ESCALATE'&&caseStatuses.includes(status as typeof caseStatuses[number]))return status;
 throw new Error('INVALID_CASE_TRANSITION');
}
export function responseDue(severity:z.infer<typeof caseIntake>['severity'],now=Date.now()){return new Date(now+({URGENT:5,HIGH:15,STANDARD:60}[severity])*60000).toISOString();}
