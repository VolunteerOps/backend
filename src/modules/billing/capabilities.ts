import {ApiError} from '../../core/errors.js';
import type {Actor} from '../organizations/context.js';
import {withRegion} from '../sentinel/sentinel.context.js';
import {featureCatalog} from './feature-catalog.js';
import {requirePro} from './billing.service.js';
export async function authorizeCapability(actor:Actor,organizationId:string,regionId:string,capability:'agent.chat'|'analytics.export'){
 const readRole=()=>withRegion(actor,organizationId,regionId,false,async tx=>(await tx.organizationMembership.findUniqueOrThrow({where:{organizationId_userId:{organizationId,userId:actor.userId}}})).role);
 const role=await readRole();
 if(!(featureCatalog.capabilities[capability].roles as readonly string[]).includes(role))throw ApiError.forbidden('This capability requires an authorized coordinator','CAPABILITY_REQUIRED');
 await requirePro(actor,role,organizationId);
 // Provider verification yields: do not continue on a membership/role change.
 if(await readRole()!==role)throw ApiError.forbidden('Workspace permissions changed; refresh your session','CAPABILITY_REQUIRED');
 return {role,capability,catalog_version:featureCatalog.version};
}
