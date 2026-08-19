# Backend Rewrite: Supabase → Prisma Postgres + Express

**Date:** 2026-04-30
**Scope:** Full replacement of the Supabase backend (Auth + Database + Realtime) with a custom Node/Express API backed by **Prisma Postgres** and **Prisma ORM**.

---

## TL;DR

The app was previously a browser-only React/Vite SPA that talked directly to **Supabase** for three things: authentication, database access, and realtime subscriptions. Supabase has been removed entirely. In its place there is now:

- A **Node/Express + TypeScript** backend in `backend/`, using **Prisma ORM** against a hosted **Prisma Postgres** database.
- **Custom auth** built with `argon2` password hashing and JWT issued as `httpOnly` cookies.
- A **`/api/*` REST surface** that mirrors the previous service-layer methods on the frontend.
- A **polling-based replacement** for the previous Supabase Realtime hook.

The frontend service files in `src/services/*` were rewritten to call the new REST API via a small `fetch` wrapper (`src/lib/apiClient.ts`); the rest of the React app is unchanged.

---

## 1. Why this happened

The user wanted to migrate off Supabase to **Prisma Postgres**. Prisma Postgres is *only a database* — it provides no authentication, no realtime layer, and no client-side SDK suitable for a browser. Supabase, by contrast, was acting as a Backend-as-a-Service. So this could not be a one-line driver swap; it required:

1. Standing up a real backend server.
2. Replacing Supabase Auth.
3. Replacing Supabase Realtime.
4. Reimplementing every previously-direct DB call as an HTTP endpoint.

---

## 2. New architecture

```
┌────────────────────────────┐      HTTP /api/*        ┌──────────────────────────────┐
│  Frontend (Vite + React)   │  ───────────────────▶   │  Backend (Express + TS)      │
│  src/                      │   credentials: include  │  backend/src/                │
│   ├── lib/apiClient.ts     │                         │   ├── routes/*.ts            │
│   ├── services/*.ts (REST) │                         │   ├── middleware/auth.ts     │
│   └── contexts/AuthContext │                         │   ├── lib/prisma.ts          │
└────────────────────────────┘                         │   └── lib/serialize.ts       │
                                                       └──────────────┬───────────────┘
                                                                      │ Prisma Client
                                                                      ▼
                                                       ┌──────────────────────────────┐
                                                       │  Prisma Postgres (managed)   │
                                                       │  db.prisma.io:5432           │
                                                       └──────────────────────────────┘
```

Vite serves the frontend on port `5173` and proxies `/api/*` to the backend on port `3001` (see `vite.config.ts`).

---

## 3. Repository layout

```
.
├── backend/                            ← NEW
│   ├── prisma/
│   │   ├── schema.prisma               ← Prisma schema (10 models)
│   │   ├── seed.ts                     ← Seeds DB from database/volunteer_tracking_schema.sql
│   │   └── migrations/                 ← Prisma migration history
│   ├── src/
│   │   ├── index.ts                    ← Express bootstrap
│   │   ├── lib/
│   │   │   ├── env.ts                  ← Typed env loader
│   │   │   ├── prisma.ts               ← Singleton PrismaClient
│   │   │   └── serialize.ts            ← camelCase → snake_case + Decimal/Date
│   │   ├── middleware/
│   │   │   ├── asyncHandler.ts
│   │   │   ├── auth.ts                 ← JWT cookie auth, requireAuth/requireAdmin
│   │   │   └── error.ts                ← Centralised error → JSON
│   │   └── routes/
│   │       ├── auth.ts
│   │       ├── volunteers.ts
│   │       ├── skills.ts
│   │       ├── locations.ts
│   │       ├── events.ts
│   │       ├── deployments.ts
│   │       ├── fieldReports.ts
│   │       ├── notifications.ts
│   │       ├── feedback.ts
│   │       └── analytics.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                            ← gitignored, real DATABASE_URL
│   └── .env.example                    ← committed, placeholders
│
├── src/                                ← CHANGED (frontend)
│   ├── lib/
│   │   ├── apiClient.ts                ← NEW: fetch wrapper
│   │   └── supabase.ts                 ← REMOVED
│   ├── services/                       ← all 10 files rewritten to call /api
│   ├── contexts/AuthContext.tsx        ← rewritten on top of new auth API
│   ├── hooks/
│   │   ├── useSupabaseAuth.ts          ← kept name, now uses /api/auth/me
│   │   └── useRealTimeSubscription.ts  ← polling replacement (10s default)
│   └── types/supabase.ts               ← REMOVED
│
├── supabase/                           ← REMOVED (old migrations + config.toml)
├── supabase.exe                        ← REMOVED
├── supabase_cli.tar.gz                 ← REMOVED
├── vite.config.ts                      ← added `/api` dev proxy
├── netlify.toml                        ← NEW: build + SPA fallback + /api proxy
├── package.json                        ← dropped @supabase/supabase-js, added concurrently + dev:all
└── docs/
    ├── BACKEND_REWRITE.md              ← (this file)
    └── VolunteerOps.postman_collection.json
```

---

## 4. Database

### Connection

**Prisma Postgres**, hosted at `db.prisma.io:5432`. Connection string lives in `backend/.env` as `DATABASE_URL` (gitignored). A placeholder version is committed in `backend/.env.example`.

> **Security note:** During this migration the user pasted the original (pre-rotation) `DATABASE_URL` and Prisma API key into the chat, which they then rotated. The current `backend/.env` uses the rotated values. If a third party gains shell access to the project on the user's machine they can read `backend/.env`; the file is gitignored but **must not be committed**.

### Schema (`backend/prisma/schema.prisma`)

10 models, mirroring the original 9 SQL tables plus a new `users` table for auth:

| Model              | Purpose                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `User`             | NEW — credentials for the rewritten auth system (`email`, `passwordHash`, `role`)        |
| `Skill`            | Skills catalog                                                                           |
| `Location`         | Geocoded sites (`latitude`/`longitude` are `Decimal(10,7)`)                              |
| `AdminUser`        | Existing admin records imported from the dump (separate from `User`)                     |
| `Volunteer`        | Volunteer records                                                                        |
| `VolunteerSkill`   | Join table volunteer ↔ skill with `proficiencyLevel`                                     |
| `Event`            | Events with FK to `Location`                                                             |
| `Deployment`       | Volunteer-on-event with check-in metadata                                                |
| `FieldReport`      | Reports filed against a deployment                                                       |
| `Notification`     | Outbound notifications (volunteer/event optional)                                        |
| `Feedback`         | Post-deployment feedback                                                                 |

### Type cleanup applied during the port

The original SQL dump had several issues that were fixed in the Prisma schema:

- All date columns were `TEXT` in the dump → now `DateTime`.
- `latitude`/`longitude` were `TEXT` → now `Decimal(10,7)`.
- `notifications.volunteer_id`, `notifications.event_id`, and `feedback.deployment_id` were declared as `FLOAT` in the original schema but actually held integer-ish values like `43.0` → now `Int?` (nullable). The seed coerces `43.0` → `43`.
- `id` columns are now `Int @id @default(autoincrement())`. The seed inserts the original IDs and then advances each sequence with `setval(pg_get_serial_sequence(...))` so future inserts don't collide.

### Migrations

Single migration `20260430102307_init` was generated via `prisma migrate dev --name init` and applied to the Prisma Postgres database.

### Seeding

`backend/prisma/seed.ts` parses `database/volunteer_tracking_schema.sql` (the July pg_dump), tokenises each `INSERT INTO ... VALUES (...);` line, and bulk-inserts via `prisma.<model>.createMany`. Run with:

```bash
cd backend
npx prisma db seed
```

Verified seeded counts:

| Table              | Rows |
| ------------------ | ---- |
| `skills`           | 10   |
| `locations`        | 8    |
| `admin_users`      | 5    |
| `volunteers`       | 100  |
| `volunteer_skills` | 188  |
| `events`           | 8    |
| `deployments`      | 120  |
| `field_reports`    | 80   |
| `notifications`    | 150  |
| `feedback`         | 60   |

The seed function wipes existing rows first, so it is idempotent.

---

## 5. Authentication

Supabase Auth is gone. The replacement is a small custom system:

- Passwords hashed with **argon2id** (default `argon2` parameters).
- Sessions issued as **JWTs** signed with `JWT_SECRET` (HS256), placed in an `httpOnly` cookie named `vops_session` (also accepted as a `Bearer` token).
- Cookie config: `SameSite=Lax` in dev, `SameSite=None; Secure` in prod (controlled by `COOKIE_SECURE` env var).
- Two middlewares: `requireAuth` (any logged-in user) and `requireAdmin` (role === 'admin').

### Auth endpoints

| Method | Path              | Public? | Body                                                                |
| ------ | ----------------- | ------- | ------------------------------------------------------------------- |
| POST   | `/api/auth/signup` | ✅       | `{ email, password, full_name, role: 'admin' \| 'volunteer' }`      |
| POST   | `/api/auth/login`  | ✅       | `{ email, password }`                                                |
| POST   | `/api/auth/logout` | ✅       | —                                                                   |
| GET    | `/api/auth/me`     | ❌ auth  | —                                                                   |

All return shape: `{ user: { id, email, name, role } }`.

### Notes on the `admin_users` table

The original dump contains 5 `admin_users` records with `password_hash` values of unknown derivation. These were imported as-is into the `admin_users` table, but **they are not used for login**. Login is against the new `users` table only. To make one of those admins able to sign in, sign them up via `POST /api/auth/signup` with the same email and a fresh password.

A throwaway smoke-test user (`smoke@test.local`) was created during verification — feel free to delete it.

### Authorisation policy (mirrors the previous Supabase RLS intent)

- `GET` endpoints: `requireAuth`
- `POST` / `PATCH` / `DELETE`: `requireAdmin`
- Two exceptions intentionally allowed for any authenticated user (volunteer self-service):
  - `POST /api/deployments/:id/check-in`
  - `POST /api/deployments/:id/complete`
  - `POST /api/field-reports`
  - `POST /api/feedback`

---

## 6. REST API surface

All endpoints are prefixed with `/api`. Response bodies use **snake_case** to match what the frontend already expected from Supabase (a serializer in `backend/src/lib/serialize.ts` converts Prisma's camelCase model fields, ISO-formats `Date` values, and stringifies `Prisma.Decimal`).

### Volunteers
```
GET    /volunteers
GET    /volunteers/available
GET    /volunteers/by-skill/:skillId
GET    /volunteers/:id                 (includes skills array)
POST   /volunteers
PATCH  /volunteers/:id
DELETE /volunteers/:id
POST   /volunteers/:id/skills          { skill_id, proficiency_level }
PATCH  /volunteers/skills/:linkId      { proficiency_level }
DELETE /volunteers/skills/:linkId
```

### Skills
```
GET    /skills
GET    /skills/:id
GET    /skills/:id/volunteer-count     → { count }
POST   /skills
PATCH  /skills/:id
DELETE /skills/:id
```

### Locations
```
GET, GET /:id, POST, PATCH /:id, DELETE /:id
```

### Events
```
GET    /events                         (with location)
GET    /events/active
GET    /events/by-type/:type
GET    /events/:id
POST   /events
PATCH  /events/:id
DELETE /events/:id
```

### Deployments
```
GET    /deployments                    (with volunteer/event/admin)
GET    /deployments/by-volunteer/:vid
GET    /deployments/by-event/:eid
GET    /deployments/:id
POST   /deployments
PATCH  /deployments/:id
DELETE /deployments/:id
POST   /deployments/:id/check-in       { latitude, longitude, method }
POST   /deployments/:id/complete
POST   /deployments/:id/cancel
```

### Field Reports
```
GET    /field-reports                  (with deployment/volunteer/event)
GET    /field-reports/by-deployment/:did
GET    /field-reports/by-event/:eid
GET    /field-reports/by-type/:type
GET    /field-reports/:id
POST   /field-reports
PATCH  /field-reports/:id
DELETE /field-reports/:id
```

### Notifications
```
GET    /notifications                  (with volunteer/event/admin)
GET    /notifications/by-volunteer/:vid
GET    /notifications/by-event/:eid
GET    /notifications/:id
POST   /notifications
POST   /notifications/bulk             { volunteer_ids: number[], notification }
PATCH  /notifications/:id
DELETE /notifications/:id
```

### Feedback
```
GET    /feedback                       (with volunteer/deployment/event)
GET    /feedback/by-volunteer/:vid
GET    /feedback/by-deployment/:did
GET    /feedback/average-rating/:vid   → { average }
GET    /feedback/:id
POST   /feedback
PATCH  /feedback/:id
DELETE /feedback/:id
```

### Analytics
```
GET    /analytics/volunteer-stats        → { total, active, inactive, banned }
GET    /analytics/event-stats            → { total, active, planned, completed }
GET    /analytics/deployment-stats       → { total, assigned, checked_in, completed, cancelled }
GET    /analytics/skill-distribution     → [ { skill_name, count } ]
GET    /analytics/event-type-distribution
GET    /analytics/monthly-deployments?year=YYYY
GET    /analytics/top-volunteers?limit=N
GET    /analytics/response-time-stats    → { average_hours, min_hours, max_hours }
```

### Health
```
GET    /api/health                       → { ok: true, ts }
```

### Error format

```json
{ "error": "string_code", "details"?: ... }
```

Standard codes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `validation_failed` (400), `unique_constraint` (409), `internal_error` (500). All request bodies are validated with **Zod**.

---

## 7. Frontend changes

### What was removed

- `src/lib/supabase.ts`
- `src/types/supabase.ts`
- `@supabase/supabase-js` from `package.json`
- The entire `supabase/` folder (config + old SQL migrations)
- The Supabase CLI binary and tarball at the repo root

### What was rewritten

| File                                  | Change                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/apiClient.ts`                | NEW — `fetch` wrapper with `credentials: 'include'`, JSON helpers, `ApiError` class     |
| `src/services/auth.ts`                | Calls `/api/auth/*` instead of `supabase.auth.*`                                        |
| `src/services/skills.ts`              | Calls `/api/skills`                                                                     |
| `src/services/locations.ts`           | Calls `/api/locations`                                                                  |
| `src/services/volunteers.ts`          | Calls `/api/volunteers`                                                                 |
| `src/services/events.ts`              | Calls `/api/events`                                                                     |
| `src/services/deployments.ts`         | Calls `/api/deployments`                                                                |
| `src/services/reports.ts`             | Calls `/api/field-reports`                                                              |
| `src/services/notifications.ts`       | Calls `/api/notifications`                                                              |
| `src/services/feedback.ts`            | Calls `/api/feedback`                                                                   |
| `src/services/analytics.ts`           | Calls `/api/analytics/*`                                                                |
| `src/contexts/AuthContext.tsx`        | Same external API; backed by the new auth service                                       |
| `src/hooks/useSupabaseAuth.ts`        | Filename kept for compatibility; now hits `/api/auth/me`                                |
| `src/hooks/useRealTimeSubscription.ts`| Replaced Supabase Realtime with polling (default 10 s)                                  |

The **public types** exported by each service file (e.g. `Volunteer`, `Skill`, `Deployment`, `EventWithLocation`, etc.) and the **shape of every method's return value** were preserved deliberately. UI components in `src/components/**` were not modified.

### Realtime → polling

The previous `useRealTimeSubscription(table, callback, filter?)` API is unchanged from a caller's point of view. Internally it now polls the corresponding REST endpoint every 10 seconds (configurable via a 4th `intervalMs` argument). When the JSON snapshot of the response changes, the callback is invoked once per row with a `{ new: row, old: null }` payload (the `old` field is always `null` since the REST API doesn't send change deltas). For tables with filters that the original code used (`deployment.volunteer_id`, etc.), the hook routes to the appropriate `/by-...` endpoint.

If true realtime ever becomes a requirement, this hook is the single replacement point — swap polling for SSE / WebSockets without changing any callers.

---

## 8. Running locally

### One-time setup

```bash
# Frontend deps
npm install

# Backend deps
cd backend
npm install

# Set DATABASE_URL and JWT_SECRET in backend/.env  (use backend/.env.example as template)
cp .env.example .env   # then edit
```

### Database setup (only on a fresh DB)

```bash
cd backend
npx prisma migrate deploy   # apply migrations
npx prisma db seed          # load the July dump (idempotent — wipes first)
```

### Day-to-day

```bash
# From the repo root: starts both servers under one command
npm run dev:all
```

This runs `vite` on `http://localhost:5173` and the API on `http://localhost:3001`. Vite's dev proxy forwards `/api/*` to the API, so the frontend's `apiClient` works against the same origin in development. To run separately:

```bash
npm run dev          # frontend only
npm run dev:api      # backend only
```

Other useful commands:

```bash
cd backend
npx prisma studio       # browse the DB in a UI
npx prisma migrate dev  # create a new migration after editing schema.prisma
npx prisma generate     # regenerate Prisma Client after schema changes
```

---

## 9. Production considerations (not yet wired)

This rewrite is a complete dev setup; before shipping:

1. **Generate a real `JWT_SECRET`** (`openssl rand -hex 64`) and set `COOKIE_SECURE=true` in production.
2. **Pin `CORS_ORIGIN`** to the actual frontend domain.
3. **Build the backend** with `npm --prefix backend run build` and run `node backend/dist/index.js` behind a process supervisor (PM2/systemd/Render/Fly).
4. **Migrations**: run `npx prisma migrate deploy` (not `migrate dev`) on each deploy.
5. **Logging**: replace `console.error` in `error.ts` with a structured logger (pino / winston).
6. **Rate limiting**: add `express-rate-limit` to `/api/auth/*` at minimum.
7. **HTTPS**: required for the JWT cookie to be sent (`Secure` flag).
8. **Bundle size**: `vite build` warns the JS bundle is >500 KB; consider `manualChunks` or route-level `import()` later. Pre-existing.
9. **Pre-existing TS errors** in the frontend (mostly unused-import warnings + a few prop-type mismatches in `AdminDashboard`/`VolunteerDashboard`/`StatCard`) were not touched as they are unrelated to this migration.

---

## 10. Decisions log

| Decision                                                         | Why                                                                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| New backend in same repo (`backend/`), not a separate one        | Simpler workflow; one `git clone`, one `dev:all` command. Easy to extract later if needed.                                   |
| Express (not Fastify/Hono/Next API)                              | Smallest possible learning surface and richest ecosystem; fits a 10-route CRUD API perfectly.                                |
| JWT in `httpOnly` cookie (vs localStorage)                       | XSS-resistant; works through the Vite proxy with no per-request token plumbing on the frontend.                              |
| Argon2id (vs bcrypt)                                             | Modern recommendation; resists GPU/ASIC attack better. The `argon2` package wraps libsodium.                                 |
| Snake_case responses (via serializer)                            | Avoided rewriting every UI component that destructures `full_name`, `event_id`, etc.                                         |
| `useRealTimeSubscription` → polling (10 s default)               | The existing UI doesn't depend on subsecond updates. A real WebSocket layer can be added later without changing call sites.  |
| Original `admin_users` row hashes preserved as-is                | Data is fake from the dump; no productive use. Login is now against the new `users` table.                                   |
| Skipped `prisma bootstrap`                                       | That command scaffolds an opinionated starter project that would conflict with the existing repo. Used `prisma init` style.  |
| Sequence advancement after seed                                  | `createMany` with explicit `id` doesn't bump the autoincrement sequence; without `setval`, the next insert collides.         |

---

## 11. Netlify deployment

The frontend is deployed on Netlify. The backend **cannot** run on Netlify as-is — it's a long-lived Express server, not a serverless function — so it must be hosted separately. The frontend then proxies `/api/*` to that backend through a Netlify redirect, keeping cookies same-origin and avoiding CORS.

### What's already in the repo

- [netlify.toml](../netlify.toml) — build config, SPA fallback, and an `/api/*` proxy with a `YOUR-BACKEND.example.com` placeholder you must replace.
- The `npm run build` command already produces `dist/` from Vite.

### Step-by-step

#### 1. Deploy the backend somewhere with a public HTTPS URL

Recommended hosts (any of them work; pick one):

- **Render** — see the dedicated guide at [docs/RENDER_DEPLOY.md](RENDER_DEPLOY.md). The repo also ships a [backend/render.yaml](../backend/render.yaml) Blueprint.
- **Fly.io** — `fly launch` from `backend/`, set secrets via `fly secrets set`.
- **Railway** — root directory `backend`.
- **A VPS** with PM2/systemd, behind nginx with TLS.

Whatever you pick, the backend needs:

| Env var         | Production value                                                          |
| --------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`  | Your Prisma Postgres connection string                                     |
| `JWT_SECRET`    | A 64-byte random string (`openssl rand -hex 64`) — **do not** reuse the dev one |
| `JWT_EXPIRES_IN`| `7d` (or whatever you want)                                                |
| `COOKIE_SECURE` | `true`                                                                     |
| `CORS_ORIGIN`   | `https://your-site.netlify.app` (your real Netlify URL, comma-separate multiple) |
| `NODE_ENV`      | `production`                                                               |
| `PORT`          | Whatever the host expects (often auto-set; Render injects `$PORT`)         |

Build/run commands:

```bash
# build
npm install
npm run prisma:generate
npm run build

# start (after build)
npm start
```

Don't forget to apply migrations on the production database the first time:

```bash
npx prisma migrate deploy
npx prisma db seed   # only if you want the demo data
```

#### 2. Wire the Netlify redirect to your backend

Edit [netlify.toml](../netlify.toml) and replace `https://YOUR-BACKEND.example.com` with your deployed backend URL (e.g. `https://volunteerops-api.onrender.com`):

```toml
[[redirects]]
  from = "/api/*"
  to = "https://volunteerops-api.onrender.com/api/:splat"
  status = 200
  force = true
```

This means the browser only ever sees `https://your-site.netlify.app/api/...`, so the JWT cookie set on the Netlify domain is sent automatically — no CORS preflight, no third-party cookie issues.

#### 3. Configure Netlify

In Netlify's dashboard:

- **Site settings → Build & deploy → Build settings**
  - Build command: `npm run build`
  - Publish directory: `dist`
- **Environment variables**
  - You generally don't need any. The frontend's `apiClient` defaults to `/api`, which the redirect above points at the backend. Only set `VITE_API_URL` if you want to bypass the redirect and hit the backend directly (not recommended — breaks same-origin cookies).
- **Domain**: connect your custom domain or use the default `*.netlify.app`. Whatever URL you end up with, that's what `CORS_ORIGIN` on the backend should be.

#### 4. Verify

After Netlify finishes a deploy:

```bash
curl -i https://your-site.netlify.app/api/health
# → 200 { "ok": true, ... }   (proxied to your backend)

# Sign up an admin
curl -X POST https://your-site.netlify.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"you@example.com","password":"...","full_name":"You","role":"admin"}'

# Use the cookie
curl -b cookies.txt https://your-site.netlify.app/api/auth/me
```

In the deployed app, opening DevTools → Network when you log in should show the `Set-Cookie: vops_session=...` header on `/api/auth/login` with `Secure; HttpOnly; SameSite=None`.

### Troubleshooting

| Symptom                                                | Likely cause                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `/api/health` returns 404 from Netlify                 | The `[[redirects]]` block in `netlify.toml` wasn't picked up (forgot to commit, or `force` missing) |
| `/api/health` returns 502 from Netlify                 | Backend host is down or unreachable from Netlify's IPs                                              |
| Login succeeds but `/api/auth/me` returns 401          | `COOKIE_SECURE=false` in prod, or the redirect is missing so cookie went to a different origin     |
| Browser blocks the cookie with "third-party" warning   | Backend is being called directly (not via the Netlify proxy). Wire the redirect, set `VITE_API_URL=` empty |
| 500 errors on every request                            | Backend env vars not set; check `DATABASE_URL` and `JWT_SECRET` on the host                        |
| `prisma migrate deploy` fails with `P1001`             | Backend host can't reach Prisma Postgres — check that egress isn't restricted                      |

### Why not Netlify Functions?

You could rewrite the API as Netlify Functions (Lambda under the hood), but it would be a meaningful rewrite: each route becomes its own handler file, you lose the long-lived `PrismaClient`, and cold starts make Prisma+Postgres slower. The proxy-to-a-separate-host pattern above is simpler and standard.

