import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fusePredictions,completeHourlySum,usableObservation,observationsFromForecastCells,observationsFromEarthquakes,type CanonicalObservation} from '../src/modules/sentinel/engine.js';
import {exceedanceRange,weatherProbabilities} from '../src/modules/sentinel/weather-probability.js';
import {normalizeOpenMeteo,normalizeFlood,fetchOpenMeteoPoints} from '../src/modules/sentinel/providers/open-meteo.js';
import {alertHazard,fetchNwsAlerts} from '../src/modules/sentinel/providers/nws-alerts.js';
import type {ForecastCell} from '../src/modules/sentinel/providers/weathernext3.contract.js';
const now=Date.parse('2026-11-05T10:00:00Z'),iso=(offset=0)=>new Date(now+offset*3600000).toISOString();
const obs=(patch:Partial<CanonicalObservation>={}):CanonicalObservation=>({source:'WEATHERNEXT3',upstream:'weathernext3',externalId:'a',longitude:36.8,latitude:-1.3,observedAt:iso(),receivedAt:iso(),validAt:iso(24),validFrom:iso(1),rain24Mm:null,rain72Mm:null,maxHourlyRainMm:null,maxTempC:null,minHumidityPct:null,maxWindMps:null,maxGustMps:null,soilMoisture:null,dischargeM3s:null,dischargePercentile:null,magnitude:null,depthKm:null,alertSeverity:null,title:null,...patch});
const distribution={mean:30,p10:10,p25:20,p50:30,p75:40,p90:50};
test('probability ranges use ordered quantiles and do not convert a risk score into a chance',()=>{
 assert.deepEqual(exceedanceRange(distribution,35),{lower:0.25,upper:0.5});
 assert.deepEqual(exceedanceRange(distribution,50),{lower:0,upper:0.1});
 assert.deepEqual(exceedanceRange({...distribution,p10:30,p25:30,p50:30,p75:30,p90:30},30),{lower:0,upper:0.1});
 assert.equal(exceedanceRange({...distribution,p50:null},35),null);
 assert.equal(exceedanceRange({...distribution,p50:60},35),null);
 assert.equal(exceedanceRange(distribution,NaN),null);
});
test('different places and forecast windows receive distinct prediction identities',()=>{
 const result=fusePredictions([obs({rain24Mm:120}),obs({externalId:'b',longitude:39,rain24Mm:120}),obs({externalId:'c',validFrom:iso(25),validAt:iso(48),rain24Mm:120})],undefined,now);
 assert.equal(result.length,3);assert.equal(new Set(result.map(r=>r.id)).size,3);
 assert.ok(result.every(r=>Date.parse(r.validFrom)>now));
});
test('zero measurements contradict risk and duplicate source revisions are not extra votes',()=>{
 const high=obs({rain24Mm:120});
 const zero=obs({source:'OPEN_METEO',externalId:'zero',rain24Mm:0});
 const result=fusePredictions([high,zero],undefined,now)[0];
 assert.equal(result.independentSources,2);assert.ok(result.severity<1);assert.ok(result.confidence<0.75);
 assert.equal(fusePredictions([high,{...high,rain24Mm:0,receivedAt:iso(0.01)}],undefined,now).length,0);
});
test('missing, stale, invalid and future observed evidence cannot produce confident predictions',()=>{
 assert.equal(usableObservation(obs({issuedAt:'invalid'}),now),false);
 assert.equal(usableObservation(obs({issuedAt:iso(-25)}),now),false);
 assert.equal(usableObservation(obs({evidenceKind:'OBSERVED',observedAt:iso(1)}),now),false);
 assert.equal(usableObservation(obs({rain24Mm:Infinity}),now),false);
 assert.deepEqual(observationsFromEarthquakes([{longitude:0,latitude:0,observed_at:'invalid'}],iso()),[]);
 assert.ok(fusePredictions([obs({rain24Mm:120,issuedAt:iso(-12)})],undefined,now)[0].confidence<fusePredictions([obs({rain24Mm:120,issuedAt:iso()})],undefined,now)[0].confidence);
});
test('rainfall accumulation requires a full consecutive window, not a partial total',()=>{
 const rows=Array.from({length:24},(_,i)=>({time:iso(i),value:1}));
 assert.equal(completeHourlySum(rows,24),24);
 assert.equal(completeHourlySum(rows.slice(0,23),24),null);
 assert.equal(completeHourlySum(rows.map((r,i)=>i===2?{...r,time:iso(1)}:r),24),null);
 assert.equal(completeHourlySum(rows.map((r,i)=>i===2?{...r,value:null}:r),24),null);
});
test('WeatherNext preserves full accumulation windows, zero and missing values',()=>{
 const d=(v:number|null)=>({mean:v,p10:v,p25:v,p50:v,p75:v,p90:v});
 const cells:ForecastCell[]=Array.from({length:72},(_,i)=>({longitude:36.8,latitude:-1.3,initTime:iso(),validTime:iso(i+1),leadHours:i+1,values:{temperature_2m:d(null),wind_speed_10m:d(0),total_precipitation_1hr:d(2)}}));
 const observations=observationsFromForecastCells(cells,'WEATHERNEXT3',iso());
 assert.equal(observations[0].rain24Mm,48);assert.equal(observations[0].rain72Mm,144);
 assert.equal(observations[0].maxWindMps,0);assert.equal(observations[0].maxTempC,null);
 assert.equal(observations[0].rain72ValidTo,iso(72));assert.equal(observations[2].rain72Mm,null);
 const landslide=fusePredictions(observations,undefined,now).find(p=>p.hazard==='LANDSLIDE')!;
 assert.equal(landslide.validTo,iso(72));
 const probability=weatherProbabilities([{...cells[0],values:{...cells[0].values,temperature_2m:distribution}}],{heat_c:35,wind_mps:15,hourly_rain_mm:20},now);
 assert.deepEqual(probability.estimates.map(p=>[p.lower,p.upper,p.validAt]),[[0.25,0.5,iso(1)]]);
});
test('fire weather requires coincident measurements and flood discharge is not a percentile',()=>{
 const normalized=normalizeOpenMeteo({latitude:-1.3,longitude:36.8,hourly:{time:[iso(1),iso(2),iso(3)],temperature_2m:[40,20,20],relative_humidity_2m:[90,10,90],wind_speed_10m:[0,0,60],precipitation:[1,1,1]}},iso());
 assert.equal(normalized.rain24Mm,null);
 assert.equal(fusePredictions([normalized],undefined,now).some(p=>p.hazard==='WILDFIRE_WEATHER'),false);
 const flood=normalizeFlood({latitude:-1.4,longitude:36.9,daily:{time:['2026-11-06','2026-11-07'],river_discharge:[10,100]}},obs());
 assert.equal(flood.dischargePercentile,null);assert.equal(flood.dischargeM3s,100);assert.equal(flood.longitude,36.9);
 assert.equal(fusePredictions([flood],undefined,now).some(p=>p.hazard==='FLOOD'),false);
});
test('official alerts preserve hazard type; expired, cancelled and unrelated alerts are excluded',async()=>{
 assert.equal(alertHazard('Dense Fog Advisory'),null);assert.equal(alertHazard('Tsunami Warning'),'TSUNAMI');
 const future=new Date(Date.now()+3600000).toISOString(),past=new Date(Date.now()-3600000).toISOString();
 const features=[['Flash Flood Warning',future,'Alert'],['High Wind Warning',past,'Alert'],['Tornado Warning',future,'Cancel'],['Dense Fog Advisory',future,'Alert']].map(([event,expires,messageType],i)=>({id:String(i),properties:{event,expires,messageType,effective:past,status:'Actual'}}));
 const result=await fetchNwsAlerts({longitude:-100,latitude:35},AbortSignal.timeout(1000),async()=>new Response(JSON.stringify({features})));
 assert.equal(result.status,'OK');assert.equal(result.observations.length,1);assert.equal(result.observations[0].hazard,'FLOOD');
 const report=fusePredictions(result.observations)[0];assert.equal(report.kind,'OFFICIAL');assert.equal(report.hazard,'FLOOD');
 const country=obs({hazard:'FLOOD',evidenceKind:'REPORTED',spatialPrecision:'COUNTRY'});assert.equal(fusePredictions([country],undefined,now).length,0);
});
test('a failed sample point makes source coverage partial',async()=>{
 const result=await fetchOpenMeteoPoints([{longitude:0,latitude:0},{longitude:1,latitude:1}],AbortSignal.timeout(1000),async url=>{
  if(String(url).includes('latitude=1'))throw new Error('unavailable');
  return new Response(JSON.stringify({latitude:0,longitude:0,hourly:{time:[iso()],temperature_2m:[30]}}));
 });assert.equal(result.status,'PARTIAL');assert.equal(result.observations.length,1);
});

test('ReliefWeb uses approved app configuration and supported fields without fabricating coordinates',async()=>{
 const {fetchReliefWeb}=await import('../src/modules/sentinel/providers/reliefweb.js');
 const result=await fetchReliefWeb(AbortSignal.timeout(1000),async input=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('appname'),'com.resqops.app');assert.equal(url.searchParams.getAll('fields[include][]').includes('country.location'),false);
  return new Response(JSON.stringify({data:[{id:1,fields:{name:'Country flood report',date:{created:new Date().toISOString()},country:[{name:'Kenya',iso3:'ken'}],type:[{name:'Flood'}],url_alias:'https://reliefweb.int/disaster/example'}}]}));
 },'com.resqops.app');
 assert.equal(result.status,'OK');assert.equal(result.observations.length,0);assert.equal(result.reports[0].countries[0],'Kenya');
 const denied=await fetchReliefWeb(AbortSignal.timeout(1000),async()=>new Response('{}',{status:403}),'com.resqops.app');assert.equal(denied.status,'ACCESS_DENIED');
});
