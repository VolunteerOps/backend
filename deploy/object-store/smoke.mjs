// Writes and removes only a fresh random probe prefix. Never prints credentials or signed URLs.
import { randomUUID, createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import assert from 'node:assert/strict';

export async function storageSmoke(env = process.env) {
  const endpoint = new URL(env.S3_ENDPOINT);
  assert.ok(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpoint.hostname)), 'Probe endpoint must use HTTPS or loopback');
  const client = new S3Client({ endpoint: endpoint.origin, region: env.S3_REGION || 'us-east-1', forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false', maxAttempts: 1,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } });
  const Bucket = env.S3_BUCKET;
  const Key = '__resq_probe__/' + randomUUID() + '/upload with spaces.txt';
  const Body = Buffer.from('ResQ object-store integrity probe\n');
  const ChecksumSHA256 = createHash('sha256').update(Body).digest('base64');
  const command = new PutObjectCommand({ Bucket, Key, ContentType: 'text/plain', ContentLength: Body.length, ChecksumSHA256, IfNoneMatch: '*' });
  const signedHeaders = new Set(['content-length', 'content-type', 'if-none-match', 'x-amz-checksum-sha256']);
  const url = await getSignedUrl(client, command, { expiresIn: 60, unhoistableHeaders: new Set(['x-amz-checksum-sha256']), signableHeaders: signedHeaders });
  const headers = { 'content-type': 'text/plain', 'content-length': String(Body.length), 'if-none-match': '*', 'x-amz-checksum-sha256': ChecksumSHA256 };
  const cleanup = () => client.send(new DeleteObjectCommand({ Bucket, Key }));
  try {
    const badChecksum = await fetch(url, { method: 'PUT', headers: { ...headers, 'x-amz-checksum-sha256': Buffer.alloc(32).toString('base64') }, body: Body, signal: AbortSignal.timeout(15000) });
    assert.ok([400,403].includes(badChecksum.status), 'Changed signed checksum must be rejected');
    await badChecksum.arrayBuffer();
    const corruptBody = Buffer.from(Body); corruptBody[0] ^= 1;
    const corruption = await fetch(url, { method: 'PUT', headers, body: corruptBody, signal: AbortSignal.timeout(15000) });
    assert.equal(corruption.status,400,'Provider must reject content that differs from the signed SHA-256 checksum'); await corruption.arrayBuffer();
    const put = await fetch(url, { method: 'PUT', headers, body: Body, signal: AbortSignal.timeout(15000) });
    assert.ok(put.ok, 'Presigned checksum/conditional upload failed with HTTP ' + put.status); await put.arrayBuffer();
    const repeated = await fetch(url, { method: 'PUT', headers, body: Body, signal: AbortSignal.timeout(15000) });
    assert.equal(repeated.status,412,'If-None-Match must reject overwriting an existing object'); await repeated.arrayBuffer();
    const head = await client.send(new HeadObjectCommand({ Bucket, Key, ChecksumMode: 'ENABLED' }));
    assert.equal(head.ContentLength, Body.length); assert.equal(head.ContentType,'text/plain'); assert.ok(head.ETag);
    const object = await client.send(new GetObjectCommand({ Bucket, Key, IfMatch: head.ETag }));
    assert.equal(createHash('sha256').update(await object.Body.transformToByteArray()).digest('base64'), ChecksumSHA256);
    const download = await getSignedUrl(client, new GetObjectCommand({ Bucket, Key, IfMatch: head.ETag, ResponseContentType:'application/octet-stream', ResponseContentDisposition:'attachment; filename="probe.txt"' }), { expiresIn:60, signableHeaders: new Set(['if-match']) });
    const response = await fetch(download,{ headers:{'if-match':head.ETag}, signal:AbortSignal.timeout(15000) });
    assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'application/octet-stream'); assert.match(response.headers.get('content-disposition'),/^attachment/); await response.arrayBuffer();
    const anonymous = await fetch(new URL(url).origin + new URL(url).pathname, { signal:AbortSignal.timeout(15000) });
    assert.ok([401,403].includes(anonymous.status),'Unsigned object access must be denied'); await anonymous.arrayBuffer();
    console.log(JSON.stringify({ upload:true, checksum_header_bound:true, corrupt_content_rejected:true, duplicate_put_rejected:true, head:true, sha256_download:true, conditional_download:true, attachment_headers:true, anonymous_denied:true, head_has_checksum:!!head.ChecksumSHA256 }));
  } finally {
    await cleanup(); client.destroy();
  }
}

if (process.argv.includes('--confirm-write')) {
  await storageSmoke();
}
