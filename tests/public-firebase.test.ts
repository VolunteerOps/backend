import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicFirebaseConfiguration } from '../src/core/public-firebase.js';
test('separate public apps never inherit another app ID or expose server credentials', () => {
 const env = { FIREBASE_PROJECT_ID: 'resq-project', FIREBASE_WEB_API_KEY: 'a'.repeat(39),
 FIREBASE_WEB_AUTH_DOMAIN: 'resq-project.firebaseapp.com', FIREBASE_WEB_APP_ID: 'volunteer-app',
 FIREBASE_OPS_WEB_API_KEY: 'b'.repeat(39), FIREBASE_OPS_WEB_AUTH_DOMAIN: 'resq-project.firebaseapp.com',
 FIREBASE_OPS_WEB_APP_ID: 'ops-app', GOOGLE_SERVICE_ACCOUNT_B64: 'secret' };
 assert.equal(publicFirebaseConfiguration(env)?.appId, 'volunteer-app');
 assert.equal(publicFirebaseConfiguration(env, 'ops')?.appId, 'ops-app');
 assert.equal(publicFirebaseConfiguration({...env,FIREBASE_OPS_WEB_APP_ID:''}, 'ops'),null);
 assert.equal(JSON.stringify(publicFirebaseConfiguration(env)).includes('secret'),false);
});
