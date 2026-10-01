import { AsyncLocalStorage } from 'node:async_hooks';
export const traceContext = new AsyncLocalStorage<{ request_id?: string; job_id?: string }>();
