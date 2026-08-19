# Deploying the backend to Render

Step-by-step guide for hosting the VolunteerOps backend on [Render](https://render.com). This pairs with the Netlify-hosted frontend; once the backend is live, point the `/api/*` proxy in [netlify.toml](../netlify.toml) at the URL Render gives you.

## Before you start

- Push the repo to GitHub (or GitLab/Bitbucket — Render supports all three).
- Have your **Prisma Postgres `DATABASE_URL`** ready (the production one — should NOT be the dev one in `backend/.env`).
- Have your final **Netlify site URL** ready (e.g. `https://volunteerops.netlify.app`).

There are two ways to deploy: the **Blueprint** (one-click using [backend/render.yaml](../backend/render.yaml)) or the **manual dashboard** flow. Both are documented below — pick one.

---

## Option A — Blueprint (recommended)

The repo already contains [backend/render.yaml](../backend/render.yaml). Render reads this file and provisions everything for you.

> **Caveat:** Render Blueprints look for `render.yaml` at the **repo root** by default. Either:
> - **Copy** `backend/render.yaml` to the repo root before clicking deploy, OR
> - Use Option B (manual) instead.

### Steps

1. **Sign in to Render** → click **New +** → **Blueprint**.
2. **Connect your Git repo**. Authorize Render to read it if prompted.
3. Render scans for `render.yaml`. It will show the service `volunteerops-api` with:
   - Runtime: Node
   - Build command: `npm install && npm run prisma:generate && npm run build && npx prisma migrate deploy`
   - Start command: `npm start`
   - Plan: free
4. Render asks you to fill in the two `sync: false` env vars:
   - **`DATABASE_URL`** → paste your Prisma Postgres connection string
   - **`CORS_ORIGIN`** → paste your Netlify URL, e.g. `https://volunteerops.netlify.app`
   - (`JWT_SECRET` is auto-generated, `NODE_ENV` / `COOKIE_SECURE` / `JWT_EXPIRES_IN` are pre-set)
5. Click **Apply**. Render builds, migrates the DB, and starts the server.
6. When it's live, copy the URL Render gives you (e.g. `https://volunteerops-api.onrender.com`) and skip to **[Wire up the frontend](#wire-up-the-frontend)**.

---

## Option B — Manual dashboard

Use this if you don't want to copy `render.yaml` to the repo root, or you want to click through everything yourself.

### 1. Create a new Web Service

1. Render dashboard → **New +** → **Web Service**.
2. Connect the GitHub repo containing this project.
3. Fill in the form:

   | Field                | Value                                                                                  |
   | -------------------- | -------------------------------------------------------------------------------------- |
   | **Name**             | `volunteerops-api` (or whatever you want)                                              |
   | **Region**           | Pick the closest to you / your users                                                   |
   | **Branch**           | `main`                                                                                 |
   | **Root Directory**   | `backend`  ← **important** — tells Render to operate inside the `backend/` folder      |
   | **Runtime**          | `Node`                                                                                 |
   | **Build Command**    | `npm install && npm run prisma:generate && npm run build && npx prisma migrate deploy` |
   | **Start Command**    | `npm start`                                                                            |
   | **Plan**             | Free is fine for testing (note: free tier sleeps after 15 min idle — first request takes ~30s to wake up) |

4. Don't click **Create** yet — scroll down to add env vars first.

### 2. Set environment variables

Under **Environment** add these (Render lets you set them either before or after creating the service):

| Key              | Value                                                                       | Notes                                          |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`   | `postgres://...@db.prisma.io:5432/postgres?sslmode=require`                 | The production Prisma Postgres URL             |
| `JWT_SECRET`     | A long random string                                                        | Generate with `openssl rand -hex 64` locally   |
| `JWT_EXPIRES_IN` | `7d`                                                                        |                                                |
| `COOKIE_SECURE`  | `true`                                                                      | Required for the auth cookie over HTTPS         |
| `CORS_ORIGIN`    | `https://your-site.netlify.app`                                             | Your real Netlify URL                          |
| `NODE_ENV`       | `production`                                                                |                                                |

> **Don't set `PORT`.** Render injects `$PORT` automatically and the backend already reads it via `env.ts`.

### 3. Add a health check

Under **Settings → Health Check Path** enter `/api/health`. Render will mark the service unhealthy if this stops returning 200.

### 4. Deploy

Click **Create Web Service**. Render will:
1. Clone the repo
2. Run the build command (installs deps → generates Prisma Client → compiles TS → applies any pending migrations to your DB)
3. Run `npm start`

First build takes 3–5 minutes. Watch the **Logs** tab. When you see `API listening on http://...` it's live.

---

## Wire up the frontend

After Render gives you a public URL like `https://volunteerops-api.onrender.com`:

1. Open [netlify.toml](../netlify.toml) and replace the placeholder:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://volunteerops-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```
2. Commit and push. Netlify auto-deploys.
3. Verify the chain end-to-end:
   ```bash
   # Backend direct
   curl https://volunteerops-api.onrender.com/api/health

   # Through the Netlify proxy (this is what the browser does)
   curl https://your-site.netlify.app/api/health
   ```
   Both should return `{"ok":true,...}`.

---

## Seeding the production database

The build command above runs `prisma migrate deploy` automatically (so the schema is created on first deploy), but it does **not** run the seed. To populate with the demo data once:

### Option 1 — one-off Render shell

In the Render dashboard for the service, click **Shell**, then run:
```bash
npx prisma db seed
```

### Option 2 — locally against the prod DB

From your laptop, with `DATABASE_URL` temporarily pointing at the production Prisma Postgres:
```bash
cd backend
DATABASE_URL="postgres://...prod..." npx prisma db seed
```

The seed wipes existing rows first, so don't run it against a DB with real user data.

---

## Day-to-day

- **Auto-deploy** is on by default — every push to `main` triggers a new build.
- **Logs**: Render dashboard → Logs tab. Streams stdout/stderr live.
- **Manual redeploy**: Render dashboard → Manual Deploy → Deploy latest commit.
- **Schema changes**: edit `backend/prisma/schema.prisma` locally → run `npx prisma migrate dev --name <description>` → commit the new migration folder → push. The build command's `prisma migrate deploy` applies it on Render.

---

## Common pitfalls

| Symptom                                                 | Cause / fix                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Build fails with `Could not find Prisma Schema`         | Forgot to set **Root Directory** to `backend`                                                                              |
| Build succeeds but logs show `Missing required env var` | `DATABASE_URL` or `JWT_SECRET` not set in Render env                                                                       |
| Service is "live" but `/api/health` 502s                | The app isn't binding to `$PORT`. Check that `backend/.env` isn't overriding `PORT` in production (Render ignores it, but local stale settings can confuse you) |
| Login works but `/api/auth/me` returns 401              | Either `COOKIE_SECURE` isn't `true`, or the frontend is calling the backend directly instead of through the Netlify proxy   |
| `P1001: Can't reach database server`                    | `DATABASE_URL` wrong, or the Prisma Postgres instance is paused/sleeping (Prisma's free tier sleeps; first request wakes it) |
| Free tier first-request latency                         | Render free web services sleep after 15 min idle. Upgrade to Starter ($7/mo) to keep it warm                              |
| Migrations fail with `P3009`                            | A previous migration is in a "failed" state on the DB. Use `npx prisma migrate resolve --rolled-back <migration_name>` from a Render shell |
| `argon2` build fails on Render                          | The package needs `node-gyp` to build a native module. Render's Node runtime supports this out of the box; if it fails, try the `argon2` alpine wheel by upgrading Render's Node version under Settings → Environment → Node Version |

---

## Cost reality check (as of April 2026)

- **Render Free**: $0/mo. Web service sleeps after 15 minutes idle. Spins back up in ~30s on first request. Fine for staging or low-traffic personal apps.
- **Render Starter**: $7/mo. Always-on, no sleep. Recommended for anything user-facing.
- **Prisma Postgres**: separate billing — see [prisma.io/pricing](https://www.prisma.io/pricing).
- **Netlify**: the frontend stays on whatever plan you already have; the proxy doesn't add billable usage.
