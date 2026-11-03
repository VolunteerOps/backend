import {z} from 'zod';
export const conversationRequest=z.object({question:z.string().trim().min(3).max(4000),mode:z.enum(['CHAT','DAILY_BRIEF']).default('CHAT'),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(5000)}).strict()).max(16).default([])}).strict();
export const missionConversationRequest=z.object({message:z.string().trim().min(1).max(4000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(5000)}).strict()).max(20).default([]),draft:z.record(z.string(), z.unknown()).default({}),timezone:z.string().max(80).default('UTC')}).strict();
export const assistantAnswer=z.object({summary:z.string().min(1).max(4000),preparedness:z.array(z.string().max(800)).max(10),assumptions:z.array(z.string().max(600)).max(10),missing_inputs:z.array(z.string().max(600)).max(16),source_ids:z.array(z.string().max(500)).max(30),follow_up:z.string().max(500)}).strict();
export const windowRequest=z.object({from:z.string().datetime(),to:z.string().datetime(),sources:z.array(z.enum(['BIGQUERY','GCS'])).min(1).max(2)}).strict();
export function validateWindow(from:string,to:string,now=Date.now()) {
 const start=Date.parse(from),end=Date.parse(to),hour=3600000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start%hour||end%hour||end<=start) throw Error('INVALID_ANALYSIS_WINDOW');
 if(start<now-31*86400000||end>now+15*86400000||end-start>14*86400000) throw Error('WEATHER_WINDOW_TOO_WIDE');
 const windows: {from:string;to:string}[]=[];
 const present=Math.floor(now/hour)*hour;
 for(let t=start;t<end;){let next=Math.min(t+48*hour,end);if(t<present&&next>present)next=present;windows.push({from:new Date(t).toISOString(),to:new Date(next).toISOString()});t=next;}
 return windows;
}
export function dailyWindow(now=Date.now()){const today=Math.floor(now/86400000)*86400000;return {from:new Date(today-3*86400000).toISOString(),to:new Date(today+7*86400000).toISOString()};}
