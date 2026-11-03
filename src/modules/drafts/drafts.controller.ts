import {Router, type Request, type Response} from 'express';
import {ah} from '../../middleware/asyncHandler.js';
import {validateBody} from '../../middleware/validator.js';
import {authRateLimiter} from '../../middleware/rateLimiter.js';
import {requestActor} from '../organizations/context.js';
import {serialize} from '../../lib/serialize.js';
import {DraftsService,draftPut} from './drafts.service.js';

const router=Router();
const key=(req:Request)=>decodeURIComponent(String(req.params.key));
router.get('/me/drafts',ah(async(req:Request,res:Response)=>{res.json(await DraftsService.list(requestActor(req)));}));
router.get('/me/drafts/:key',ah(async(req:Request,res:Response)=>{const draft=await DraftsService.get(requestActor(req),key(req));res.json(draft??{key:key(req),payload:null,version:0});}));
router.put('/me/drafts/:key',authRateLimiter,validateBody(draftPut),ah(async(req:Request,res:Response)=>{res.json(serialize(await DraftsService.put(requestActor(req),key(req),req.body)));}));
router.delete('/me/drafts/:key',ah(async(req:Request,res:Response)=>{res.json(await DraftsService.remove(requestActor(req),key(req)));}));
export default router;
