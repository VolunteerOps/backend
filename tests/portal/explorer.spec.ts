import {test,expect,type Page} from '@playwright/test';
const orgA='00000000-0000-4000-8000-000000000001',orgB='00000000-0000-4000-8000-000000000002';
const region='00000000-0000-4000-8000-000000000010';
const init=new Date(Date.now()-3600000).toISOString(),valid=new Date(Date.now()+3600000).toISOString();
function forecast(name:string,status='AVAILABLE'){
 const distribution={mean:12,p10:2,p25:7,p50:10,p75:15,p90:20};
 return {status,region:{id:region,name},run:{id:'forecast-'+name,model:'weathernext_3_0_0',source:'WEATHERNEXT_3',init_time:init,retrieved_at:init,expires_at:new Date(Date.now()+3600000).toISOString()},
  assessment:{validation:'UNVALIDATED_INDICATORS',indicators:[],missing_values:0},
  cells:[{longitude:0,latitude:0,initTime:init,validTime:valid,leadHours:2,values:{temperature_2m:distribution,wind_speed_10m:distribution,total_precipitation_1hr:distribution}}]};
}
async function setup(page:Page,role='COORDINATOR'){
 await page.route('**/sentinel/config',route=>route.fulfill({json:{firebase:null,mapbox_access_token:null,enterprise_providers:[],weather_access:'AWAITING_ACCESS'}}));
 await page.route('**/api/me/memberships',route=>route.fulfill({json:{memberships:[{organization_id:orgA,organization_name:'Partner A',role,access:'ALLOWED',capabilities:role==='ORG_ADMIN'?['sentinel.configure']:[]},{organization_id:orgB,organization_name:'Partner B',role,access:'ALLOWED'}]}}));
 await page.route('**/sentinel/regions',route=>route.fulfill({json:[{id:region,name:'County',forecastBounds:{west:-1,east:1,south:-1,north:1}}]}));
 await page.route('**/forecasts/latest',async route=>{
  const partner=route.request().url().includes(orgA)?'Partner A':'Partner B';
  await route.fulfill({json:forecast(partner)});
 });
 await page.route('**/hazards',route=>route.fulfill({json:{observations:[],truncated:false}}));
}
test('hourly statistics, zero coordinates and accessible list remain usable without WebGL',async({page})=>{
 await setup(page);await page.goto('/sentinel/');
 await expect(page.locator('#coverage')).toHaveText('Partner A · Forecast available');
 await expect(page.locator('#forecast-list')).toContainText('0.000, 0.000');
 await expect(page.locator('#forecast-list')).toContainText('10.00 mm');
 await page.locator('#statistic').selectOption('p90');
 await expect(page.locator('#forecast-list')).toContainText('20.00 mm');
 await page.locator('#variable').selectOption('temperature_2m');
 await expect(page.locator('#forecast-list')).toContainText('20.00 °C');
 await expect(page.locator('#map-status')).toContainText('not configured');
 expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});
test('switching organization clears old evidence and scopes assistant requests',async({page})=>{
 await setup(page);
 let asked='';
 await page.route('**/agent/chat',route=>{asked=route.request().url();return route.fulfill({json:{answer:'Review the current regional forecast.',sources:[{id:'source-b',model:'weathernext_3_0_0',init_time:init}],actions_executed:[],requires_human_review:true}});});
 await page.goto('/sentinel/');await expect(page.locator('#coverage')).toContainText('Partner A');
 await page.locator('#organization').selectOption(orgB);
 await expect(page.locator('#coverage')).toContainText('Partner B');
 await page.locator('#question').fill('What should we review?');await page.locator('#chat button').click();
 await expect(page.locator('#answer')).toContainText('current regional forecast');
 expect(asked).toContain(orgB);
 await page.locator('#organization').selectOption(orgA);
 await expect(page.locator('#answer')).toBeEmpty();await expect(page.locator('#citations')).toBeEmpty();
});
test('revocation clears private data and expired forecasts hide values',async({page})=>{
 await setup(page);
 let revoked=false;
 await page.route('**/forecasts/latest',route=>revoked?route.fulfill({status:403,json:{error:'MEMBERSHIP_REQUIRED',message:'Membership revoked'}}):route.fulfill({json:forecast('Partner A','STALE')}));
 await page.goto('/sentinel/');
 await expect(page.locator('#coverage')).toContainText('Forecast expired');
 await expect(page.locator('#forecast-list')).toBeEmpty();
 revoked=true;await page.locator('#reload').click();
 await expect(page.locator('#notice')).toContainText('Membership revoked');
 await expect(page.locator('#workspace')).toBeHidden();
 await expect(page.locator('#data')).toBeHidden();
});
test('volunteer view exposes insights without coordinator tools or invented forecast data',async({page})=>{
 await setup(page,'VOLUNTEER');
 await page.route('**/forecasts/latest',route=>route.fulfill({json:{status:'UNAVAILABLE',region:{id:region,name:'County'},run:null,cells:[],assessment:null}}));
 await page.goto('/sentinel/?view=volunteer');
 await expect(page.locator('#coverage')).toContainText('Forecast unavailable');
 await expect(page.locator('#provenance')).toContainText('access is pending');
 await expect(page.locator('#coordinator')).toBeHidden();await expect(page.locator('#forecast-list')).toBeEmpty();
 await expect(page.locator('#guidance')).toContainText('official emergency guidance');
});

test('only an authorized organization admin can configure region thresholds',async({page})=>{
 await setup(page,'ORG_ADMIN');let saved:Record<string,unknown>|null=null;
 await page.route(new RegExp('/sentinel/regions/[a-f0-9-]+$'),route=>{if(route.request().method()==='PUT'){saved=route.request().postDataJSON();return route.fulfill({json:{id:region}});}return route.fallback();});
 await page.goto('/sentinel/');await expect(page.locator('#coverage')).toContainText('Forecast available');
 await page.locator('#region-settings summary').click();
 for(const [id,value] of Object.entries({'region-name':'Preparedness region',west:'36',east:'37',south:'-2',north:'-1','heat-threshold':'35','wind-threshold':'18','rain-threshold':'30','run-age':'8','policy-reason':'Reviewed local monitoring thresholds'}))await page.locator('#'+id).fill(value);
 await page.locator('#region-config button').click();await expect(page.locator('#config-status')).toContainText('Region policy saved');
 expect(saved).toMatchObject({name:'Preparedness region',bounds:{west:36,east:37,south:-2,north:-1},policy:{version:1,heat_c:35,wind_mps:18,hourly_rain_mm:30,maximum_run_age_hours:8}});
});

test('failed forecast refresh can be retried with an audit reason in its original scope',async({page})=>{
 await setup(page);let retryBody:unknown=null;let retried=false;
 await page.route('**/forecasts/refresh',route=>route.fulfill({json:{job_id:'failed-job',state:'QUEUED'}}));
 await page.route('**/jobs/failed-job',route=>route.fulfill({json:{state:retried?'COMPLETED':'DEAD',last_error:null}}));
 await page.route('**/jobs/failed-job/retry',route=>{retryBody=route.request().postDataJSON();retried=true;return route.fulfill({json:{job_id:'failed-job',state:'QUEUED'}});});
 await page.goto('/sentinel/');await expect(page.locator('#coverage')).toContainText('Forecast available');
 await page.locator('#coordinator summary').filter({hasText:'Request a forecast run'}).click();
 await page.locator('#init-time').fill(init.slice(0,13)+':00');
 await page.locator('#refresh button').click();
 await expect(page.locator('#retry-refresh')).toBeVisible({timeout:10000});
 await page.locator('#retry-reason').fill('Dataset access has been repaired');
 await page.locator('#retry-refresh button').click();
 await expect(page.locator('#refresh-status')).toHaveText('Refresh completed.',{timeout:10000});
 expect(retryBody).toEqual({reason:'Dataset access has been repaired'});
 await expect(page.locator('#retry-refresh')).toBeHidden();
 await page.locator('#organization').selectOption(orgB);
 await expect(page.locator('#refresh-status')).toBeEmpty();
});
