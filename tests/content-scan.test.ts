import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesContentType, matchesDigest, scanWithClamd } from '../src/modules/scoped-storage/content-scan.js';
import { createHash } from 'node:crypto';
test('scan sniffing rejects forged MIME and active content', async () => {
 const body=Buffer.from('private evidence');
 assert.equal(matchesContentType(body,'text/plain'),true);
 for(const type of ['image/png','image/jpeg','image/webp','application/pdf']) assert.equal(matchesContentType(body,type),false);
 assert.equal(matchesContentType(Buffer.from('<script>alert(1)</script>'),'text/plain'),false);
 assert.equal(matchesContentType(Buffer.from([0xff,0xff]),'text/plain'),false);
 assert.equal(matchesDigest(body,createHash('sha256').update(body).digest('base64')),true);
 delete process.env.CLAMD_HOST;
 await assert.rejects(scanWithClamd(body,new AbortController().signal),/SCANNER_NOT_CONFIGURED/);
});
