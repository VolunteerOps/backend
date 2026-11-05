import {AsyncLocalStorage} from 'node:async_hooks';
import {ApiError} from '../../core/errors.js';
// Per-request context, including nested specialised assistants. Persisted status is
// checked at each model/tool boundary so cancellation works across replicas too.
const active=new AsyncLocalStorage<()=>Promise<void>>();
export const withRunCheck=<T>(check:()=>Promise<void>,work:()=>Promise<T>)=>active.run(check,work);
export async function checkRunActive(){await active.getStore()?.();}
export function assertRunning(status:unknown){if(status!=='RUNNING')throw ApiError.conflict('This run was stopped. Start a new request when you are ready.','CANCELLED_BY_COORDINATOR');}

const parentRun=new AsyncLocalStorage<string>();
export const withParentRun=<T>(id:string,work:()=>Promise<T>)=>parentRun.run(id,work);
export const currentParentRun=()=>parentRun.getStore();
export function followUpContext(id:string,question:string,original:string,summary:string){
 const prefix=('Earlier run '+id+': '+original+'\nEarlier summary: '+summary).slice(0,Math.max(0,1988-question.length));
 return prefix?prefix+'\nFollow-up: '+question:question;
}
