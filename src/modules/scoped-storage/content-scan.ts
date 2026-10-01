import { createConnection } from 'node:net';
import { createHash } from 'node:crypto';
import { MAX_OBJECT_BYTES } from './scoped-storage.schema.js';

export function matchesContentType(bytes: Buffer, type: string): boolean {
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/webp') return bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (type === 'application/pdf') return bytes.toString('ascii',0,5) === '%PDF-';
  if (type === 'text/plain') { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return !bytes.includes(0) && !/<(?:html|script|svg|iframe)\b/i.test(bytes.toString('utf8')); } catch { return false; } }
  return false;
}

export async function scanWithClamd(bytes: Buffer, signal: AbortSignal): Promise<'CLEAN' | 'MALWARE'> {
  if (bytes.length > MAX_OBJECT_BYTES) throw new Error('SCAN_SIZE_EXCEEDED');
  const host = process.env.CLAMD_HOST;
  const port = Number(process.env.CLAMD_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SCANNER_NOT_CONFIGURED');
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let response = '';
    const abort = () => socket.destroy(new Error('SCAN_ABORTED'));
    const done = (error?: Error, verdict?: 'CLEAN' | 'MALWARE') => { signal.removeEventListener('abort', abort); socket.destroy(); error ? reject(error) : resolve(verdict!); };
    if (signal.aborted) { done(new Error('SCAN_ABORTED')); return; }
    signal.addEventListener('abort', abort, { once: true });
    socket.setTimeout(12000, () => done(new Error('SCAN_TIMEOUT')));
    socket.once('error', error => done(error));
    socket.once('end', () => { if (!response.includes('\0')) done(new Error('SCAN_INCOMPLETE')); });
    socket.on('data', chunk => {
      response += chunk.toString('utf8');
      if (response.length > 1024) return done(new Error('SCAN_RESPONSE_TOO_LARGE'));
      if (!response.includes('\0')) return;
      if (response.trim().replace(/\0$/, '') === 'stream: OK') done(undefined, 'CLEAN');
      else if (/^stream: .+ FOUND\0$/.test(response)) done(undefined, 'MALWARE');
      else done(new Error('SCAN_UNAVAILABLE'));
    });
    socket.once('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const part = bytes.subarray(offset, offset + 65536), length = Buffer.alloc(4); length.writeUInt32BE(part.length);
        socket.write(length); socket.write(part);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
export function matchesDigest(bytes: Buffer, expected: string) { return createHash('sha256').update(bytes).digest('base64') === expected; }
