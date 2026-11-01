import {ApiError} from '../../core/errors.js';
/** A regional safety pause blocks dispatch, not reporting or safe completion. */
export function assertDispatchAllowed(paused:boolean,action:string,status?:string){
 if(paused&&(action==='ASSIGN'||(action==='TRANSITION_MISSION'&&status==='ACTIVE')))
  throw ApiError.conflict('Regional dispatch is paused. A coordinator must resume it before dispatching.','DISPATCH_PAUSED');
}
