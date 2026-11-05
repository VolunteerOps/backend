# Temporary Muse transport

The staging API supports an optional signed Muse gateway hosted on the operator's computer. It addresses the current difference between Meta accepting requests from that computer and rejecting the Railway server's requests.

Configure both variables together on the **API service only**:

- `META_GATEWAY_URL`: HTTPS origin of the gateway (no path, query, credentials or fragment).
- `META_GATEWAY_SECRET`: at least 43 characters of cryptographically random secret material, matching the local gateway.

When set, `meta-transport.ts` signs each completion request with HMAC-SHA256 over method, path, timestamp, nonce and raw JSON. It does **not** send `META_MODEL_API_KEY` to the gateway. The local gateway has its own protected copy of that key. Incomplete gateway configuration fails closed.

The existing agent tool loops, evidence requirements, schemas, permission checks, billing gates and coordinator approval remain unchanged. Gateway requests use complete JSON responses because the temporary Cloudflare tunnel does not support model SSE. Backend chat progress and final results still use the existing frontend streaming route.

Clear both variables to return to direct Meta requests. `META_MODEL_API_KEY` (or `MODEL_API_KEY`) remains the direct-mode credential. Do not remove it until direct access is no longer needed.

Local lifecycle, credentials, tunnel limits and rollback instructions are in the admin repository: `docs/MUSE_LOCAL_GATEWAY.md`. Start/Connect scripts update only project `73690bd6-2d68-4ac7-9330-b5da3ebed8f0`, environment `9de4cdd7-abad-4a36-ae1e-7577c06dc2d7`, API service `fb8c493f-bcdd-4883-acb3-9b0990b935ea`.

Regression checks:

```
node --import tsx --test --test-concurrency=1 tests/meta-agents.test.ts tests/meta-recovery.test.ts tests/meta-gateway.test.ts
npm run test:types
```

This transport does not grant WeatherNext access, alter query budgets, or substitute fabricated weather results when a data source is unavailable.
