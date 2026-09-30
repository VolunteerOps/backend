import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';
import { resqMapStyle } from './resqMapStyle.js';
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, SAMLAuthProvider, getMultiFactorResolver,
  createUserWithEmailAndPassword, updateProfile, sendEmailVerification, multiFactor, type TotpSecret,
  TotpMultiFactorGenerator, sendPasswordResetEmail, signOut, type MultiFactorResolver,
  type UserCredential, type Auth, type MultiFactorError } from 'firebase/auth';
import { forecastHours, visibleCells, weatherFeatures, units, type Region, type Membership,
  type Forecast, type ForecastVariable, type Statistic } from './data.js';

interface Configuration {firebase:null|{apiKey:string;authDomain:string;projectId:string;appId:string};
 mapbox_access_token:string|null;enterprise_providers:string[];weather_access:string}
interface Hazard {id:string;title:string;observed_at:string;longitude:number;latitude:number;magnitude:number|null;source_url:string}
const element = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const select = (id:string) => element<HTMLSelectElement>(id);
const input = (id:string) => element<HTMLInputElement>(id);
const text = (id:string,value:string) => { element(id).textContent=value; };
const show = (id:string,visible:boolean) => { element(id).hidden=!visible; };
const mapOnly = new URLSearchParams(location.search).get('view')==='map';
const volunteer = new URLSearchParams(location.search).get('view')==='volunteer';
let pendingCredential:UserCredential|undefined, enrollmentSecret:TotpSecret|undefined, signingIn=false;
let map:mapboxgl.Map|undefined, auth:Auth|undefined, mfa:MultiFactorResolver|undefined;
let memberships:Membership[]=[], regions:Region[]=[], forecast:Forecast|null=null, hazards:Hazard[]=[];
let scope=new AbortController(), generation=0, activeOrganization='', activeRegion='';
let config:Configuration, polling=false, failedRefreshJob:string|null=null;
const message = (error:unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
class RequestError extends Error {constructor(readonly status:number,readonly code:string,message:string){super(message);}}
async function api<T>(path:string, options:RequestInit={}, signal=scope.signal):Promise<T>{
 const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal,
  headers:{'Content-Type':'application/json','X-Requested-With':'VolunteerOps',...options.headers}});
 const body=response.status===204?null:await response.json();
 if(!response.ok)throw new RequestError(response.status,body?.error||'REQUEST_FAILED',body?.message||'The request could not be completed.');
 return body;
}
function clearRegion(){
 scope.abort();scope=new AbortController();generation++;
 forecast=null;hazards=[];failedRefreshJob=null;show('retry-refresh',false);input('retry-reason').value='';show('data',false);show('coordinator',false);
 text('answer','');element<HTMLTextAreaElement>('question').value='';text('refresh-status','');element('citations').replaceChildren();
 text('coverage','Select a region');text('provenance','');select('region').disabled=false;
 text('list-summary','');element('forecast-list').replaceChildren();element('hazards').replaceChildren();
 text('hazard-status','');paint();
}
function reset(){
 clearRegion();memberships=[];regions=[];activeOrganization='';activeRegion='';
 select('organization').replaceChildren();select('region').replaceChildren();
 show('workspace',false);show('logout',false);show('region-settings',false);show('account-tools',false);
 mfa=undefined;show('mfa',false);show('enroll-profile',false);enrollmentSecret=undefined;pendingCredential=undefined;input('invitation-code').value='';input('password').value='';input('otp').value='';text('totp-secret','');input('enroll-otp').value='';show('totp-enroll',false);
}
function report(error:unknown){
 if(error instanceof DOMException && error.name==='AbortError')return;
 if(error instanceof RequestError && [401,403].includes(error.status)){
  reset();show('identity',true);
 }
 text('notice',message(error));
}
function bind(id:string,event:string,handler:()=>Promise<void>|void){
 element(id).addEventListener(event,ev=>{if(event==='submit')ev.preventDefault();Promise.resolve().then(handler).catch(report);});
}
function options(id:string,values:Array<{value:string;label:string}>){
 select(id).replaceChildren(...values.map(v=>{const o=document.createElement('option');o.value=v.value;o.textContent=v.label;return o;}));
}
function endpoint(suffix:string){return '/api/organizations/'+encodeURIComponent(activeOrganization)+'/sentinel/regions/'+encodeURIComponent(activeRegion)+suffix;}
async function loadMemberships(){
 reset();const version=generation;
 const response=await api<{memberships:Membership[]}>('/api/me/memberships');
 if(version!==generation)return;
 show('account-tools',true);
 memberships=response.memberships.filter(m=>m.access==='ALLOWED');
 if(!memberships.length){
  show('identity',true);show('logout',true);
  text('notice',response.memberships.length?'Workspace access requires active membership and current sign-in assurance. Sign in again with your institution account and authenticator.':'Your account has no active workspace membership. Ask your organization administrator for admission.');
  return;
 }
 options('organization',memberships.map(m=>({value:m.organization_id,label:m.organization_name})));
 show('identity',false);show('workspace',true);show('logout',true);text('notice','');
 await changeOrganization();
}
async function changeOrganization(){
 clearRegion();activeOrganization=select('organization').value;activeRegion='';
 regions=[];options('region',[]);options('config-region',[{value:'new',label:'New region'}]);element<HTMLFormElement>('region-config').reset();text('config-status','');
 show('region-settings',!volunteer && !!memberships.find(m=>m.organization_id===activeOrganization)?.capabilities?.includes('sentinel.configure'));
 const version=generation;
 const result=await api<Region[]>('/api/organizations/'+encodeURIComponent(activeOrganization)+'/sentinel/regions');
 if(version!==generation)return;
 regions=result;options('region',regions.map(r=>({value:r.id,label:r.name})));
 options('config-region',[{value:'new',label:'New region'},...regions.map(r=>({value:r.id,label:r.name}))]);
 if(!regions.length){text('coverage','No regions configured');text('notice','Your administrator can configure region coverage.');return;}
 await changeRegion();
}
async function changeRegion(){
 clearRegion();activeRegion=select('region').value;
 const region=regions.find(r=>r.id===activeRegion);
 if(region?.forecastBounds && map){
  const b=region.forecastBounds;
  map.fitBounds([[b.west,b.south],[b.east<b.west?b.east+360:b.east,b.north]],{padding:35,duration:0,maxZoom:10});
 }
 await loadForecast();
}
async function loadForecast(){
 if(!activeRegion)return;
 const version=generation, path=endpoint('');
 const [result,quakes]=await Promise.allSettled([
  api<Forecast>(path+'/forecasts/latest'),api<{observations:Hazard[];truncated:boolean}>(path+'/hazards')]);
 if(version!==generation)return;
 // A scope/authentication failure must clear all old observations immediately.
 if(result.status==='rejected'){forecast=null;hazards=[];paint();throw result.reason;}
 if(quakes.status==='rejected' && quakes.reason instanceof RequestError && [401,403].includes(quakes.reason.status)){
  forecast=null;hazards=[];paint();throw quakes.reason;
 }
 forecast=result.value;hazards=quakes.status==='fulfilled'?quakes.value.observations:[];
 text('hazard-status',quakes.status==='rejected'?'Earthquake source unavailable.':
  hazards.length?'USGS observations from the past 24 hours. Feed freshness is not guaranteed.':'No recent observations are available for this region. This is not an all-clear.');
 if(quakes.status==='fulfilled' && quakes.value.truncated)text('hazard-status','Showing the latest 500 observations. Narrow the region for full coverage.');
 const previousTime=input('time').value;const hours=forecastHours(forecast);
 input('time').max=String(Math.max(0,hours.length-1));
 input('time').value=String(Math.min(Number(previousTime)||0,Math.max(0,hours.length-1)));
 input('time').disabled=hours.length===0;
 text('coverage',forecast.region.name+' · '+({AVAILABLE:'Forecast available',STALE:'Forecast expired',UNAVAILABLE:'Forecast unavailable'}[forecast.status]));
 text('provenance',forecast.run ? forecast.run.model+' · Issued '+new Date(forecast.run.init_time).toUTCString()+' · Retrieved '+new Date(forecast.run.retrieved_at).toUTCString() :
  config.weather_access==='AWAITING_ACCESS'?'Google dataset access is pending. No forecast is being displayed.':'No forecast has been ingested for this region.');
 const role=memberships.find(m=>m.organization_id===activeOrganization)?.role;
 show('data',true);show('coordinator',!volunteer && ['ORG_ADMIN','COORDINATOR'].includes(role||''));
 text('notice','');paint();
}
function paint(){
 const hour=forecastHours(forecast)[Number(input('time').value)||0];
 const variable=select('variable').value as ForecastVariable,statistic=select('statistic').value as Statistic;
 const cells=visibleCells(forecast,hour), features=weatherFeatures(cells,variable,statistic);
 text('time-label',hour?new Date(hour).toUTCString():'Unavailable');
 text('legend',select('variable').selectedOptions[0].textContent+' · '+select('statistic').selectedOptions[0].textContent+'. Darker circles indicate higher values. Coral circles: USGS observations.');
 text('list-summary',cells.length?cells.length+' forecast cells at this hour. Showing the first '+Math.min(200,cells.length)+' in the list. Missing values remain unavailable.':'No current forecast cells are available.');
 element('forecast-list').replaceChildren(...cells.slice(0,200).map(cell=>{
  const row=document.createElement('tr'),value=cell.values[variable][statistic];
  for(const content of [cell.latitude.toFixed(3)+', '+cell.longitude.toFixed(3),new Date(cell.validTime).toUTCString(),value===null?'Unavailable':value.toFixed(2)+' '+units[variable]]){
   const td=document.createElement('td');td.textContent=content;row.append(td);
  }return row;
 }));
 element('hazards').replaceChildren(...hazards.map(h=>{
  const li=document.createElement('li');const a=document.createElement('a');
  try{const url=new URL(h.source_url);if(url.protocol==='https:' && url.hostname==='earthquake.usgs.gov'){a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}}
  catch{/* Keep malformed links as plain text. */}
  a.textContent=h.title+' · '+new Date(h.observed_at).toUTCString();li.append(a);return li;
 }));
 if(!map?.isStyleLoaded())return;
 (map.getSource('forecast') as mapboxgl.GeoJSONSource).setData(features);
 (map.getSource('hazards') as mapboxgl.GeoJSONSource).setData({type:'FeatureCollection',features:hazards.map(h=>({type:'Feature',properties:{title:h.title},geometry:{type:'Point',coordinates:[h.longitude,h.latitude]}}))});
 const ranges={temperature_2m:[0,20,40],wind_speed_10m:[0,15,35],total_precipitation_1hr:[0,10,40]}[variable];
 map.setPaintProperty('forecast-cells','circle-color',['interpolate',['linear'],['get','value'],ranges[0],'#d5e2f5',ranges[1],'#4c86cd',ranges[2],'#043473']);
}
function startMap(){
 if(!config.mapbox_access_token){text('map-status','The geographic map is not configured. Forecasts remain available in the list.');show('terrain',false);return;}
 if(!mapboxgl.supported()){text('map-status','This browser cannot display the geographic map. Use the forecast list below.');show('terrain',false);return;}
 try{
  map=new mapboxgl.Map({container:'map',accessToken:config.mapbox_access_token,style:structuredClone(resqMapStyle),center:[37.8,0.3],zoom:5,pitch:0,attributionControl:true});
  map.addControl(new mapboxgl.NavigationControl(),'top-right');
  map.on('error',()=>text('map-status','Some map tiles could not load. Use the forecast list if coverage is incomplete.'));
  map.on('style.load',()=>{
   map!.addSource('forecast',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   map!.addSource('hazards',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
   map!.addLayer({id:'forecast-cells',type:'circle',source:'forecast',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,3,10,12],'circle-opacity':0.7,'circle-color':'#2563eb'}});
   map!.addLayer({id:'reported-earthquakes',type:'circle',source:'hazards',paint:{'circle-radius':7,'circle-color':'#d7534f','circle-stroke-color':'white','circle-stroke-width':2}});
   paint();
  });
  for(const layer of ['forecast-cells','reported-earthquakes'])map.on('click',layer,event=>{
   const feature=event.features?.[0];if(!feature || feature.geometry.type!=='Point')return;
   const p=feature.properties||{};
   new mapboxgl.Popup().setLngLat(feature.geometry.coordinates as [number,number]).setText(layer==='forecast-cells'?Number(p.value).toFixed(2)+' '+p.unit+' · '+p.time:String(p.title)).addTo(map!);
  });
 }catch{text('map-status','The map could not start. Use the forecast list below.');}
}
async function completeSignIn(credential:UserCredential){
 const token=await credential.user.getIdToken(true);
 try { await api('/api/auth/session',{method:'POST',headers:{Authorization:'Bearer '+token}},new AbortController().signal); }
 catch(error){
  if(!(error instanceof RequestError) || error.code!=='UNAUTHORIZED')throw error;
  pendingCredential=credential;show('enroll-profile',true);input('enroll-name').value=credential.user.displayName||'';
  text('identity-status','Complete your account profile before joining an organization.');return;
 }
 input('password').value='';input('otp').value='';mfa=undefined;show('mfa',false);
 // Firebase credentials stay in SDK memory only, for explicit authenticator setup.
 await loadMemberships();
}
async function authenticate(action:()=>Promise<UserCredential>){
 text('identity-status','Signing in…');
 try{await completeSignIn(await action());if(!pendingCredential)text('identity-status','');}
 catch(error){
  if((error as {code?:string}).code==='auth/multi-factor-auth-required' && auth){
   mfa=getMultiFactorResolver(auth,error as MultiFactorError);
   options('factor',mfa.hints.filter(h=>h.factorId===TotpMultiFactorGenerator.FACTOR_ID).map(h=>({value:h.uid,label:h.displayName||'Authenticator'})));
   if(!select('factor').options.length)throw new Error('An enrolled TOTP authenticator is required for this workspace.');
   show('mfa',true);input('otp').focus();text('identity-status','Enter the code from your authenticator.');
  }else{text('identity-status',error instanceof RequestError?error.message:'Sign-in could not be completed. Check your account details and provider configuration.');}
 }finally{signingIn=false;}
}
async function start(){
 config=await api<Configuration>('/sentinel/config');
 if(mapOnly){document.body.classList.add('map-only');startMap();return;}
 startMap();
 if(config.firebase){
  auth=getAuth(initializeApp(config.firebase));await setPersistence(auth,inMemoryPersistence);
  const providers=[['Google',new GoogleAuthProvider()],['Apple',new OAuthProvider('apple.com')],['Facebook',new FacebookAuthProvider()],['Microsoft',new OAuthProvider('microsoft.com')]] as const;
  const all=[...providers,...config.enterprise_providers.map(id=>[id,id.startsWith('saml.')?new SAMLAuthProvider(id):new OAuthProvider(id)] as const)];
  for(const [label,provider] of all){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.onclick=()=>void authenticate(()=>signInWithPopup(auth!,provider)).catch(report);element('providers').append(button);}
 }else text('identity-status','Account sign-in is awaiting Firebase project configuration.');
 try{await loadMemberships();}
 catch(error){if(error instanceof RequestError && error.status===401){show('identity',true);text('notice','Sign in to view your organization’s forecasts.');}else throw error;}
}
bind('signup','submit',async()=>{
 if(!auth)throw new Error('Firebase sign-in is not configured.');
 const credential=await createUserWithEmailAndPassword(auth,input('signup-email').value,input('signup-password').value);
 await updateProfile(credential.user,{displayName:input('signup-name').value});
 await sendEmailVerification(credential.user);await signOut(auth);input('signup-password').value='';
 text('identity-status','Account created. Follow the verification email, then sign in. Organization access requires a separate invitation.');
});
bind('enroll-profile','submit',async()=>{
 const credential=pendingCredential;if(!credential)return;
 const token=await credential.user.getIdToken(true);
 await api('/api/auth/firebase/bootstrap',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({full_name:input('enroll-name').value})});
 pendingCredential=undefined;show('enroll-profile',false);await completeSignIn(credential);
});
bind('begin-totp','click',async()=>{
 if(!auth?.currentUser)throw new Error('Sign in again before setting up an authenticator.');
 const session=await multiFactor(auth.currentUser).getSession();
 enrollmentSecret=await TotpMultiFactorGenerator.generateSecret(session);
 text('totp-secret',enrollmentSecret.secretKey);show('totp-enroll',true);input('enroll-otp').focus();
});
bind('totp-enroll','submit',async()=>{
 if(!auth?.currentUser || !enrollmentSecret)return;
 const assertion=TotpMultiFactorGenerator.assertionForEnrollment(enrollmentSecret,input('enroll-otp').value);
 await multiFactor(auth.currentUser).enroll(assertion,'ResQ authenticator');
 await api('/api/auth/logout',{method:'POST'});await signOut(auth);reset();show('identity',true);
 text('identity-status','Authenticator added. Sign in again and enter its code to use privileged actions.');
});
bind('accept-invitation','submit',async()=>{
 await api('/api/invitations/accept',{method:'POST',body:JSON.stringify({token:input('invitation-code').value.trim()})});
 input('invitation-code').value='';await loadMemberships();text('notice','Invitation accepted.');
});
bind('config-region','change',()=>{
 const region=regions.find(r=>r.id===select('config-region').value);
 for(const [id,key] of [['west','west'],['east','east'],['south','south'],['north','north']] as const)input(id).value=region?String(region.forecastBounds[key]):'';
 input('region-name').value=region?.name||'';
 for(const [id,key] of [['heat-threshold','heat_c'],['wind-threshold','wind_mps'],['rain-threshold','hourly_rain_mm'],['run-age','maximum_run_age_hours']] as const)input(id).value=region?.forecastPolicy?String(region.forecastPolicy[key]):'';
});
bind('region-config','submit',async()=>{
 const version=generation,organization=activeOrganization,selected=select('config-region').value;
 const existing=regions.find(r=>r.id===selected);const id=existing?.id||crypto.randomUUID();
 await api('/api/organizations/'+encodeURIComponent(organization)+'/sentinel/regions/'+id,{method:'PUT',body:JSON.stringify({name:input('region-name').value,bounds:{west:Number(input('west').value),east:Number(input('east').value),south:Number(input('south').value),north:Number(input('north').value)},policy:{version:(existing?.forecastPolicy?.version||0)+1,heat_c:Number(input('heat-threshold').value),wind_mps:Number(input('wind-threshold').value),hourly_rain_mm:Number(input('rain-threshold').value),maximum_run_age_hours:Number(input('run-age').value)},reason:input('policy-reason').value})});
 if(version!==generation)return;
 await changeOrganization();text('config-status','Region policy saved. Forecast ingestion remains separately controlled.');
});
bind('signin','submit',async()=>{if(!auth)throw new Error('Firebase sign-in is not configured.');await authenticate(()=>signInWithEmailAndPassword(auth!,input('email').value,input('password').value));});
bind('mfa','submit',async()=>{if(!mfa)return;const result=await mfa.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(select('factor').value,input('otp').value));await completeSignIn(result);});
bind('recover','click',async()=>{if(!auth)throw new Error('Firebase sign-in is not configured.');try{await sendPasswordResetEmail(auth,input('email').value);}catch{/* Avoid account enumeration. */}text('identity-status','If this address has a password account, a recovery email will be sent.');});
bind('logout','click',async()=>{reset();show('identity',true);try{await api('/api/auth/logout',{method:'POST'});}finally{if(auth)await signOut(auth);}text('notice','Signed out.');});
bind('organization','change',changeOrganization);bind('region','change',changeRegion);bind('reload','click',loadForecast);
for(const id of ['time','variable','statistic'])bind(id,id==='time'?'input':'change',paint);
bind('terrain','click',()=>{if(!map?.isStyleLoaded())return;const enabled=!!map.getTerrain();map.setTerrain(enabled?null:{source:'elevation',exaggeration:1.5});map.easeTo({pitch:enabled?0:55,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});text('terrain',enabled?'Enable 3D terrain':'Disable 3D terrain');});
bind('refresh','submit',async()=>{
 const version=generation,path=endpoint(''),init=input('init-time').value;
 const result=await api<{job_id:string;state:string}>(path+'/forecasts/refresh',{method:'POST',body:JSON.stringify({init_time:new Date(init+'Z').toISOString(),from_hour:Number(input('from-hour').value),to_hour:Number(input('to-hour').value)})});
 if(version!==generation)return;
 await watchRefresh(path,result.job_id,version);
});
async function watchRefresh(path:string,jobId:string,version:number){
 show('retry-refresh',false);failedRefreshJob=null;
 text('refresh-status','Refresh '+'queued'+'. Waiting for the forecast worker…');
 for(let tries=0;tries<24;tries++){
  await new Promise(resolve=>setTimeout(resolve,5000));if(version!==generation)return;
  const job=await api<{state:string;last_error:string|null}>(path+'/jobs/'+encodeURIComponent(jobId));
  if(version!==generation)return;
  text('refresh-status','Refresh '+job.state.toLowerCase()+'.');
  if(job.state==='COMPLETED'){await loadForecast();return;}
  if(['DEAD','EXPIRED'].includes(job.state)){text('refresh-status','Refresh could not complete. Review source access and worker status.');failedRefreshJob=jobId;show('retry-refresh',true);return;}
 }
 text('refresh-status','Refresh is still queued or processing. Refresh the view later.');
}
bind('retry-refresh','submit',async()=>{
 if(!failedRefreshJob)return;const jobId=failedRefreshJob,version=generation,path=endpoint('');
 await api(path+'/jobs/'+encodeURIComponent(jobId)+'/retry',{method:'POST',body:JSON.stringify({reason:input('retry-reason').value})});
 if(version===generation)await watchRefresh(path,jobId,version);
});
bind('chat','submit',async()=>{
 const version=generation;const button=element<HTMLFormElement>('chat').querySelector('button')!;
 button.disabled=true;text('answer','Reading the current forecast evidence…');element('citations').replaceChildren();
 try{
  const result=await api<{answer:string;sources:Array<{id:string;model:string;init_time:string}>}>(endpoint('/agent/chat'),{method:'POST',body:JSON.stringify({question:element<HTMLTextAreaElement>('question').value})});
  if(version!==generation)return;
  text('answer',result.answer);element('citations').replaceChildren(...result.sources.map(source=>{const li=document.createElement('li');li.textContent=source.model+' · '+new Date(source.init_time).toUTCString()+' · '+source.id;return li;}));
 }finally{button.disabled=false;}
});
setInterval(()=>{
 if(!forecast?.run || Date.parse(forecast.run.expires_at)>Date.now())return;
 forecast={...forecast,status:'STALE',cells:[]};paint();text('coverage',forecast.region.name+' · Forecast expired');
},1000);
setInterval(()=>{
 if(document.hidden||!activeRegion||polling)return;polling=true;
 void loadForecast().catch(report).finally(()=>{polling=false;});
},60000);
window.addEventListener('pagehide',()=>{scope.abort();map?.remove();});
void start().catch(report);
