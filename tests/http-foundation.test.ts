import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { exactOrigins, trustedProxyAddresses, requestTelemetry } from '../src/core/http-foundation.js';
test('credentialed CORS rejects wildcards, paths, userinfo and malformed origins', () => {
  for (const origin of ['*','https://good.test/path','https://user:secret@good.test','null','https://good.test/']) assert.throws(() => exactOrigins(origin));
  assert.deepEqual(exactOrigins('https://good.test,https://good.test'), ['https://good.test']);
  for (const value of ['true','*','1','0.0.0.0/0','::/0']) assert.throws(() => trustedProxyAddresses(value));
});
test('untrusted peers cannot spoof client IP with forwarding headers', async () => {
  const app = express(); app.set('trust proxy',trustedProxyAddresses('192.0.2.0/24')); app.use(requestTelemetry);
  app.get('/probe', (req,res) => res.json({ip:req.ip}));
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(r=>server.once('listening',r));
  try {
    const res=await fetch('http://127.0.0.1:'+(server.address() as AddressInfo).port+'/probe',{headers:{'X-Forwarded-For':'8.8.8.8','X-Request-ID':'secret-token'}});
    assert.equal((await res.json() as {ip:string}).ip,'127.0.0.1'); assert.notEqual(res.headers.get('x-request-id'),'secret-token');
  } finally {server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r()));}
});
