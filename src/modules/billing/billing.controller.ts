import {usageStatus} from './usage.service.js';
import { z } from 'zod';
import { validateBody } from '../../middleware/validator.js';
import { manageSponsorship,listSponsorships,sponsorshipSchema } from './sponsorship.service.js';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requestActor, withActor } from '../organizations/context.js';
import { proCatalog, subscriptionStatus } from './billing.service.js';
const router=Router();
router.get('/billing/catalog',(_req,res)=>res.json(proCatalog));
router.get('/me/usage',requireAuth,ah(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json(await usageStatus(requestActor(req)));}));
router.get('/me/subscription',requireAuth,ah(async(req,res)=>{
 const actor=requestActor(req);await withActor(actor,async()=>{});
 res.setHeader('Cache-Control','no-store');res.json(await subscriptionStatus(actor));
}));
router.get('/organizations/:orgId/pro/sponsorships',requireAuth,ah(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.json(await listSponsorships(requestActor(req),z.string().uuid().parse(req.params.orgId)));}));
router.put('/organizations/:orgId/pro/sponsorships',requireAuth,validateBody(sponsorshipSchema),ah(async(req,res)=>res.json(await manageSponsorship(requestActor(req),z.string().uuid().parse(req.params.orgId),req.body))));
export default router;
