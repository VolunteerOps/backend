import { createServer, request } from 'node:http';
import { createHash, createHmac } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

export function readConfig(env) {
  const required = (name) => {
    const value = env[name];
    if (!value) throw new Error(name + ' is required');
    return value;
  };
  const bucket = required('S3_BUCKET');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('S3_BUCKET must be a DNS-safe bucket name');
  const rootKey = required('S3_ROOT_ACCESS_KEY_ID');
  const rootSecret = required('S3_ROOT_SECRET_ACCESS_KEY');
  const accessKey = required('S3_ACCESS_KEY_ID');
  const secretKey = required('S3_SECRET_ACCESS_KEY');
  for (const value of [rootKey, accessKey]) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new Error('Storage access keys must contain 16-128 safe characters');
  }
  for (const value of [rootSecret, secretKey]) {
    if (value.length < 32 || value.length > 256 || /[\x00-\x20]/.test(value)) throw new Error('Storage secrets must contain 32-256 non-whitespace characters');
  }
  if (rootKey === accessKey || rootSecret === secretKey) throw new Error('Root and runtime storage credentials must be distinct');
  const endpoint = new URL(required('S3_ENDPOINT'));
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw new Error('S3_ENDPOINT must be an HTTPS origin without credentials or a path');
  }
  const port = Number(env.PORT || '10000');
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8333,8888,9333,9340,18333,18888,19333,19340,23646,33646].includes(port)) throw new Error('PORT must be an available unprivileged port');
  const origins = (env.S3_CORS_ORIGINS || '').split(',').filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('S3_CORS_ORIGINS must contain HTTPS origins');
  }
  return { bucket, rootKey, rootSecret, accessKey, secretKey, endpoint, port, origins, region: env.S3_REGION || 'us-east-1' };
}

export function credentialDocument(config) {
  return { identities: [
    { name: 'resq-storage-owner', credentials: [{ accessKey: config.rootKey, secretKey: config.rootSecret }], actions: ['Admin'] },
    { name: 'resq-backend', credentials: [{ accessKey: config.accessKey, secretKey: config.secretKey }], actions: ['Read:' + config.bucket, 'Write:' + config.bucket, 'List:' + config.bucket] }
  ] };
}

// A signed bucket HEAD checks the runtime credential and bucket, not just a live process.
export async function bucketReady(config, targetPort = 8333) {
  const host = config.endpoint.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const scope = day + '/' + config.region + '/s3/aws4_request';
  const payloadHash = hash('');
  const path = '/' + config.bucket;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = ['HEAD', path, '', 'host:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + amzDate + '\n', signedHeaders, payloadHash].join('\n');
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + config.secretKey, day), config.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update('AWS4-HMAC-SHA256\n' + amzDate + '\n' + scope + '\n' + hash(canonical)).digest('hex');
  return new Promise((resolve) => {
    const probe = request({ hostname: '127.0.0.1', port: targetPort, path, method: 'HEAD', headers: {
      host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash,
      authorization: 'AWS4-HMAC-SHA256 Credential=' + config.accessKey + '/' + scope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature
    } }, (response) => { response.resume(); resolve(response.statusCode === 200); });
    probe.setTimeout(4000, () => probe.destroy());
    probe.on('error', () => resolve(false));
    probe.end();
  });
}

function withoutHopHeaders(headers) {
  const result = { ...headers };
  const connectionHeaders = String(headers.connection || '').split(',').map((x) => x.trim().toLowerCase());
  for (const name of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', ...connectionHeaders]) delete result[name];
  return result;
}

export function createGateway(config, { targetPort = 8333, checkReady = () => bucketReady(config, targetPort) } = {}) {
  let health = { expires: 0, ready: false };
  let pendingProbe;
  const server = createServer(async (req, res) => {
    // Do not log request URLs: S3 query strings can contain signed credentials.
    if (req.url === '/_resq/ready' && (req.method === 'GET' || req.method === 'HEAD')) {
      if (Date.now() >= health.expires) {
        pendingProbe ||= Promise.resolve().then(checkReady).catch(() => false).then((ready) => {
          health = { ready, expires: Date.now() + 3000 };
          pendingProbe = undefined;
        });
        await pendingProbe;
      }
      res.writeHead(health.ready ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ status: health.ready ? 'ready' : 'unavailable' }));
      return;
    }
    if (req.headers.host !== config.endpoint.host || !req.url?.startsWith('/')) {
      res.writeHead(400, { connection: 'close' }); res.end(); return;
    }
    const rawPath = req.url.split('?')[0];
    // Expose only this bucket. Auxiliary APIs, IAM, and other buckets stay private.
    if (rawPath !== '/' + config.bucket && !rawPath.startsWith('/' + config.bucket + '/')) {
      res.writeHead(403, { connection: 'close' }); res.end(); return;
    }
    const contentLength = req.headers['content-length'];
    const maxBodyBytes = 12 * 1024 * 1024; // Backend uploads are limited to 10 MiB.
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBodyBytes)) {
      res.writeHead(413, { connection: 'close' }); res.end(); return;
    }
    const headers = withoutHopHeaders(req.headers);
    headers.host = req.headers.host;
    headers['x-forwarded-proto'] = 'https';
    headers['x-forwarded-host'] = req.headers.host;
    delete headers['x-forwarded-for'];
    const upstream = request({ hostname: '127.0.0.1', port: targetPort, path: req.url, method: req.method, headers }, (response) => {
      res.writeHead(response.statusCode || 502, withoutHopHeaders(response.headers));
      response.pipe(res);
      response.on('error', () => res.destroy());
    });
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        upstream.destroy();
        if (!res.headersSent) { res.writeHead(413, { connection: 'close' }); res.end(); } else res.destroy();
      }
    });
    req.on('aborted', () => upstream.destroy());
    req.on('error', () => upstream.destroy());
    res.on('error', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(502); res.end(); } else res.destroy();
    });
    upstream.setTimeout(120000, () => upstream.destroy());
    req.pipe(upstream);
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 120000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  return server;
}

export function seaweedArguments(config, dataDir, secretFile) {
  return ['mini', '-dir=' + dataDir, '-ip=127.0.0.1', '-ip.bind=127.0.0.1',
  '-s3.port=8333', '-s3.config=' + secretFile, '-s3.externalUrl=' + config.endpoint.origin,
  '-bucket=' + config.bucket, '-s3.autoCreateBucket=false', '-s3.allowDeleteBucketNotEmpty=false',
  '-s3.iam=false', '-s3.port.iceberg=0', '-s3.port.lance=0', '-webdav=false', '-admin.ui=false',
  '-master.telemetry=false', '-s3.allowedOrigins=' + config.origins.join(','),
  '-s3.concurrentUploadLimitMB=64', '-s3.concurrentFileUploadLimit=8', '-s3.readerCacheSizeMB=64',
  '-filer.disableDirListing=true', '-filer.exposeDirectoryData=false', '-volume.index=leveldb'];
}
