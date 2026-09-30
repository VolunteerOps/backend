export async function boundedJson(response: Response, maxBytes = 2_000_000): Promise<unknown> {
  if (!response.ok) throw new Error('PROVIDER_HTTP_' + response.status);
  if (!response.body) throw new Error('PROVIDER_EMPTY_BODY');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) { await response.body.cancel(); throw new Error('PROVIDER_BODY_TOO_LARGE'); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('PROVIDER_BODY_TOO_LARGE'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
