import assert from 'node:assert/strict';
import {test} from 'node:test';
process.env.NODE_ENV='test';
process.env.DATABASE_URL='postgresql://unused@127.0.0.1:1/test?sslmode=disable';
const {publicPortalConfiguration}=await import('../src/modules/sentinel/portal.controller.js');
test('public configuration cannot expose server credentials or secret Mapbox tokens',()=>{
 const config=publicPortalConfiguration({MAPBOX_ACCESS_TOKEN:'sk.private',SENTINEL_GEMINI_API_KEY:'private',
  DATABASE_URL:'private',FIREBASE_PRIVATE_KEY:'private',FIREBASE_ENTERPRISE_PROVIDERS:'oidc.institution,saml.partner,javascript:bad,not-a-provider'});
 assert.equal(config.mapbox_access_token,null);
 assert.equal(config.firebase,null);
 assert.deepEqual(config.enterprise_providers,['oidc.institution','saml.partner']);
 assert.equal(JSON.stringify(config).includes('private'),false);
 assert.equal(publicPortalConfiguration({MAPBOX_ACCESS_TOKEN:'pk.public'}).mapbox_access_token,'pk.public');
});
