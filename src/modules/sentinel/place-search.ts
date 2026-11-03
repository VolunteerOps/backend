import {z} from 'zod';
import {ApiError} from '../../core/errors.js';
import {boundedJson} from './providers/http.js';
import {withActor,requireOrganization,type Actor} from '../organizations/context.js';
const query=z.string().trim().min(2).max(200);
export async function searchPlaces(actor:Actor,org:string,input:unknown){
 await withActor(actor,tx=>requireOrganization(tx,actor,org,'organization.read'));
 const q=query.parse(input),token=process.env.MAPBOX_SECRET_TOKEN||process.env.MAPBOX_ACCESS_TOKEN||process.env.MAPBOX_PUBLIC_TOKEN;
 if(!token)throw new ApiError(503,'PLACE_SEARCH_UNAVAILABLE','Place search is not connected. Contact your administrator.');
 const url=new URL('https://api.mapbox.com/search/geocode/v6/forward');
 url.search=new URLSearchParams({q,access_token:token,types:'country,region,district,place,locality',limit:'6',autocomplete:'false',permanent:'true'}).toString();
 const data=await boundedJson(await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'}),100000) as any;
 return {attribution:data.attribution||'? Mapbox',items:(data.features||[]).map((f:any)=>({...f,bbox:f.properties?.bbox||f.bbox})).filter((f:any)=>Array.isArray(f.bbox)&&f.bbox.length===4).map((f:any)=>({id:f.properties.mapbox_id,name:f.properties.name,label:f.properties.full_address||[f.properties.name,f.properties.place_formatted].filter(Boolean).join(', '),country:f.properties.context?.country?.name,center:f.geometry.coordinates,bounds:{west:f.bbox[0],south:f.bbox[1],east:f.bbox[2],north:f.bbox[3]},policy:{version:1,heat_c:35,wind_mps:15,hourly_rain_mm:20,maximum_run_age_hours:12},policy_basis:'ResQ screening defaults, not locally calibrated warning thresholds. Review with your local authority.'}))};
}
