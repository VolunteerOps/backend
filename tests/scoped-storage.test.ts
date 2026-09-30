import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { S3Client } from '@aws-sdk/client-s3';
import { uploadIntentSchema, safeFileName } from '../src/modules/scoped-storage/scoped-storage.schema.js';
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/storage_unit_test';
process.env.NODE_ENV = 'test';
const { hashBoundedBody, S3PrivateObjectStore } = await import('../src/modules/scoped-storage/object-store.js');

const body = Buffer.from('private incident evidence');
const digest = createHash('sha256').update(body).digest('base64');
const object = { bucket: 'private-test', objectKey: 'organizations/tenant/regions/region/objects/id/report.txt',
  contentType: 'text/plain', byteSize: body.length, checksumSha256: digest };

test('upload envelopes reject active content, raw audio, oversized files and noncanonical digests', () => {
  const input = { file_name: 'report.txt', content_type: 'text/plain', byte_size: body.length, checksum_sha256: digest };
  assert.ok(uploadIntentSchema.safeParse(input).success);
  for (const override of [{ content_type: 'image/svg+xml' }, { content_type: 'text/html' }, { content_type: 'audio/wav' },
    { byte_size: 0 }, { byte_size: 10485761 }, { checksum_sha256: 'a'.repeat(44) }, { object_key: 'someone-elses-key' }]) {
    assert.equal(uploadIntentSchema.safeParse({ ...input, ...override }).success, false);
  }
  assert.doesNotMatch(safeFileName('../../unsafe\r\n"<script>.png'), /[\r\n"<>/\\]/);
});

test('upload signatures bind size, type, digest and no-overwrite condition; downloads pin the inspected object', async () => {
  const client = new S3Client({ endpoint: 'https://objects.example.org', region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' } });
  const store = new S3PrivateObjectStore(object.bucket, client);
  const signed = await store.upload(object), url = new URL(signed.url);
  const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders')!.split(';');
  for (const header of ['content-length', 'content-type', 'if-none-match', 'x-amz-checksum-sha256']) assert.ok(signedHeaders.includes(header), header);
  assert.equal(signed.headers['If-None-Match'], '*'); assert.equal(signed.headers['x-amz-checksum-sha256'], digest);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  const download = await store.download({ ...object, fileName: 'report.txt', etag: '"etag"', versionId: 'version-1' });
  const downloadUrl = new URL(download.url);
  assert.equal(downloadUrl.searchParams.get('X-Amz-Expires'), '60');
  assert.equal(downloadUrl.searchParams.get('versionId'), 'version-1');
  assert.equal(downloadUrl.searchParams.get('response-content-type'), 'application/octet-stream');
  assert.match(downloadUrl.searchParams.get('response-content-disposition')!, /^attachment/);
  assert.equal(download.headers['If-Match'], '"etag"'); client.destroy();
});

test('verification hashes a bounded stream when an S3-compatible provider omits stored SHA-256', async () => {
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  const client = { send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
    calls.push({ name: command.constructor.name, input: command.input });
    return calls.length === 1 ? { ContentLength: body.length, ContentType: 'text/plain', ETag: '"etag"', VersionId: 'v1' } : { Body: Readable.from([body]) };
  } } as unknown as S3Client;
  const facts = await new S3PrivateObjectStore(object.bucket, client).inspect(object);
  assert.equal(facts.checksumSha256, digest); assert.equal(calls.length, 2);
  assert.equal(calls[1].input.IfMatch, '"etag"'); assert.equal(calls[1].input.VersionId, 'v1');
  await assert.rejects(hashBoundedBody(Readable.from([body, body]), body.length), { code: 'OBJECT_MISMATCH' });
  await assert.rejects(hashBoundedBody(Readable.from([body.subarray(1)]), body.length), { code: 'OBJECT_MISMATCH' });
});

test('verification rejects mismatched provider facts and hides provider errors', async () => {
  for (const override of [{ ContentLength: 0 }, { ContentType: 'text/html' }, { ChecksumSHA256: createHash('sha256').update('other').digest('base64') }]) {
    const client = { send: async () => ({ ContentLength: body.length, ContentType: object.contentType, ETag: '"etag"', ChecksumSHA256: digest, ...override }) } as unknown as S3Client;
    await assert.rejects(new S3PrivateObjectStore(object.bucket, client).inspect(object), { code: 'OBJECT_MISMATCH' });
  }
  const missing = { send: async () => { throw { $metadata: { httpStatusCode: 404 } }; } } as unknown as S3Client;
  await assert.rejects(new S3PrivateObjectStore(object.bucket, missing).inspect(object), { code: 'UPLOAD_NOT_FOUND' });
  const broken = { send: async () => { throw new Error('sensitive provider error'); } } as unknown as S3Client;
  await assert.rejects(new S3PrivateObjectStore(object.bucket, broken).inspect(object), { code: 'STORAGE_UNAVAILABLE', message: 'Object storage verification is temporarily unavailable' });
});
