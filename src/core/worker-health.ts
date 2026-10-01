import { createServer } from 'node:http';

/** A successful queue round-trip proves progress, including when the queue is empty. */
export function workerHealth(port: number) {
  let lastProgress = 0;
  let stopping = false;
  const server = createServer((req, res) => {
    const healthy = !stopping && Date.now() - lastProgress < 90_000;
    res.writeHead(req.url === '/health' && healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: healthy ? 'ok' : 'unavailable' }));
  });
  server.listen(port, process.env.WORKER_HEALTH_HOST ?? '127.0.0.1');
  return {
    progress() { lastProgress = Date.now(); },
    close() { stopping = true; server.close(); },
  };
}
