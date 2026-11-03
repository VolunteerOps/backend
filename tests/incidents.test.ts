import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseIncidentFeed,classifyIncident,configuredFeeds} from '../src/modules/sentinel/providers/incident-feeds.js';

const xml=`<?xml version="1.0"?><rss><channel>
<item><title>Apartment building collapses in Nairobi</title><link>https://example.org/collapse</link>
<pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate><description>Rescuers at the scene.</description>
<geo:Point><geo:lat>-1.28</geo:lat><geo:long>36.82</geo:long></geo:Point></item>
<item><title>GDACS flood alert</title><link>https://example.org/flood</link>
<pubDate>Mon, 03 Nov 2026 07:00:00 GMT</pubDate><description>River flooding reported.</description>
<gdacs:eventtype>FL</gdacs:eventtype><gdacs:alertlevel>Orange</gdacs:alertlevel>
<georss:point>-1.3 36.9</georss:point></item>
<item><title>Item without coordinates</title><link>https://example.org/none</link>
<pubDate>Mon, 03 Nov 2026 06:00:00 GMT</pubDate><description>Drought conditions worsen.</description></item>
</channel></rss>`;
test('incident feed parsing extracts geoRSS coordinates, GDACS types and severity',()=>{
 const items=parseIncidentFeed(xml,'GDACS');
 assert.equal(items.length,3);
 assert.equal(items[0]!.type,'BUILDING_COLLAPSE');
 assert.equal(items[0]!.category,'ARTIFICIAL');
 assert.equal(items[0]!.latitude,-1.28);
 assert.equal(items[1]!.type,'FLOOD');
 assert.equal(items[1]!.severity,'HIGH');
 assert.equal(items[2]!.latitude,null);
 assert.equal(items[2]!.type,'DROUGHT');
});
test('artificial disaster classification covers collapse, explosion, industrial and transport reports',()=>{
 assert.equal(classifyIncident('Factory explosion injures workers','').type,'EXPLOSION');
 assert.equal(classifyIncident('Chemical plant accident under investigation','').type,'INDUSTRIAL_ACCIDENT');
 assert.equal(classifyIncident('Ferry capsizes near the port','').type,'TRANSPORT_ACCIDENT');
 assert.equal(classifyIncident('Mudslide blocks the highway','').type,'LANDSLIDE');
 assert.equal(classifyIncident('El Nino rains expected this season','').type,'EL_NINO');
});
test('configured feeds always include GDACS and only accept https additions',()=>{
 const feeds=configuredFeeds({INCIDENT_RSS_FEEDS:'Agency=https://news.example/rss,Bad=http://insecure.example/rss'} as NodeJS.ProcessEnv);
 assert.equal(feeds[0]!.name,'GDACS');
 assert.equal(feeds.length,2);
 assert.equal(feeds[1]!.name,'Agency');
});
