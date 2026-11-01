import {coordinationOverview} from './workspace.service.js';
import {operationalMetrics,metricsQuery,metricsCsv} from './metrics.service.js';
import {ApiError} from '../../core/errors.js';
import { encodeCursor, decodeCursor } from './stream-cursor.js';
import { validateBody } from '../../middleware/validator.js';
import { setTimeout as delay } from 'node:timers/promises';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requestActor } from '../organizations/context.js';
import { serialize } from '../../lib/serialize.js';
import { commandSchema, listSchema, scopeId } from './operations.schema.js';
import { OperationsService } from './operations.service.js';
const router=Router({mergeParams:true});
router.use(requireAuth,(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
router.get('/overview',ah(async(req,res)=>res.json(serialize(await coordinationOverview(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId))))));
router.get('/dispatch',ah(async(req,res)=>res.json(await OperationsService.dispatch(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId)))));
router.get('/metrics',ah(async(req,res)=>res.json(await operationalMetrics(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId),metricsQuery.parse(req.query)))));
router.get('/metrics/export',ah(async(req,res)=>{
 const value=await operationalMetrics(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId),metricsQuery.parse(req.query),true);
 res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="resq-operational-summary.csv"');res.send(metricsCsv(value));
}));
router.get('/records',ah(async(req,res)=>res.json(serialize(await OperationsService.list(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId),listSchema.parse(req.query))))));
router.get('/records/:recordId',ah(async(req,res)=>res.json(serialize(await OperationsService.detail(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId),scopeId.parse(req.params.recordId))))));
router.post('/commands',validateBody(commandSchema),ah(async(req,res)=>res.json(serialize(await OperationsService.command(requestActor(req),scopeId.parse(req.params.orgId),scopeId.parse(req.params.regionId),z.string().uuid().parse(req.headers['idempotency-key']),commandSchema.parse(req.body))))));
// Capture the replay boundary BEFORE fetching record pages; replay deduplicates by record/version.
router.get('/snapshot',ah(async(req,res)=>{
 const actor=requestActor(req),org=scopeId.parse(req.params.orgId),region=scopeId.parse(req.params.regionId);
 const sequence=await OperationsService.streamBoundary(actor,org,region);
 res.json({cursor:encodeCursor(sequence,{userId:actor.userId,organizationId:org,regionId:region}),expires_in_seconds:86400});
}));
// Short-lived streams re-check database membership and token validity on every batch.
const connections=new Map<number,number>();
router.get('/events',ah(async(req,res)=>{
 const actor=requestActor(req),org=scopeId.parse(req.params.orgId),region=scopeId.parse(req.params.regionId);
 const scope={userId:actor.userId,organizationId:org,regionId:region};
 // Authorize before decoding so a cursor never reveals whether a private scope exists.
 await OperationsService.streamBoundary(actor,org,region);
 const supplied=req.headers['last-event-id']??req.query.after;
 if(typeof supplied!=='string')throw new ApiError(409,'STREAM_RESNAPSHOT_REQUIRED','Fetch a snapshot cursor before subscribing');
 let cursor=decodeCursor(supplied,scope);
 await OperationsService.streamBoundary(actor,org,region,cursor);
 if((connections.get(actor.userId)??0)>=3){res.status(429).json({error:'STREAM_LIMIT'});return;}
 // Do not send SSE headers before initial authorization succeeds.
 let page=await OperationsService.list(actor,org,region,{kind:'EVENT',after:cursor});
 // Authorization yields; enforce the limit again before reserving the slot.
 if((connections.get(actor.userId)??0)>=3){res.status(429).json({error:'STREAM_LIMIT'});return;}
 connections.set(actor.userId,(connections.get(actor.userId)??0)+1);
 const controller=new AbortController();res.on('close',()=>controller.abort());
 res.setHeader('Content-Type','text/event-stream');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
 const end=Date.now()+25000;
 try{
  while(!controller.signal.aborted&&Date.now()<end){
   for(const item of page.items){
    if(res.writableLength>65536){res.end();return;}
    res.write('id: '+encodeCursor(item.sequence,scope)+'\nevent: operation\ndata: '+JSON.stringify(item.payload)+'\n\n');cursor=item.sequence;
   }
   cursor=Math.max(cursor,page.scan_cursor);
   res.write('id: '+encodeCursor(cursor,scope)+'\nevent: checkpoint\ndata: {}\n\n');
   await delay(page.next_cursor?50:2000,undefined,{signal:controller.signal});
   await OperationsService.streamBoundary(actor,org,region,cursor);
   page=await OperationsService.list(actor,org,region,{kind:'EVENT',after:cursor});
  }
 }catch(error){if(!controller.signal.aborted)res.write('event: '+((error as {code?:string}).code==='STREAM_RESNAPSHOT_REQUIRED'?'resnapshot':'reauthenticate')+'\ndata: {}\n\n');}
 finally{connections.set(actor.userId,Math.max(0,(connections.get(actor.userId)??1)-1));if(connections.get(actor.userId)===0)connections.delete(actor.userId);res.end();}
}));
export default router;
