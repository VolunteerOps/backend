# VolunteerOps Enterprise Production Deployment Runbook
## Comprehensive Guide: Database Deployment on Prisma Console & Backend Deployment on Render Cloud

**Version:** 2.0.0  
**Target Backend:** Node.js (v20+) / Express / TypeScript / Prisma ORM  
**Target Database:** PostgreSQL 17.2 / 18-Compatible (Prisma Postgres / Prisma Console)  
**Target Hosting:** Render Cloud Web Service (Native Node / Docker Container)  
**Last Updated:** August 2026  

---

## Table of Contents

1. [System Architecture & Deployment Topology](#1-system-architecture--deployment-topology)
2. [Pre-Deployment Checklist & Prerequisites](#2-pre-deployment-checklist--prerequisites)
3. [Phase 1: Database Deployment on Prisma Console](#3-phase-1-database-deployment-on-prisma-console)
   - [3.1 Setting Up Prisma Console Workspace](#31-setting-up-prisma-console-workspace)
   - [3.2 Provisioning Prisma Postgres Instance](#32-provisioning-prisma-postgres-instance)
   - [3.3 Region Matching & Latency Optimization](#33-region-matching--latency-optimization)
   - [3.4 Obtaining Database Connection Strings](#34-obtaining-database-connection-strings)
   - [3.5 Applying Schema Migrations](#35-applying-schema-migrations)
   - [3.6 Seeding Initial Production Data](#36-seeding-initial-production-data)
   - [3.7 Verifying Data via Prisma Studio & Data Browser](#37-verifying-data-via-prisma-studio--data-browser)
4. [Phase 2: Backend Deployment on Render Cloud](#4-phase-2-backend-deployment-on-render-cloud)
   - [4.1 Deployment Strategy Selection (Blueprint vs Manual)](#41-deployment-strategy-selection-blueprint-vs-manual)
   - [4.2 Option A: Automated Blueprint Deployment (`render.yaml`)](#42-option-a-automated-blueprint-deployment-renderyaml)
   - [4.3 Option B: Manual Web Service Setup via Dashboard](#43-option-b-manual-web-service-setup-via-dashboard)
   - [4.4 Complete Environment Variables Matrix](#44-complete-environment-variables-matrix)
   - [4.5 Setting Up & Generating Secure JWT Secret (`JWT_SECRET`)](#45-setting-up--generating-secure-jwt-secret-jwt_secret)
   - [4.6 Health Check & Zero-Downtime Deployment Configuration](#46-health-check--zero-downtime-deployment-configuration)
   - [4.7 Scaling & Resource Allocation Recommendations](#47-scaling--resource-allocation-recommendations)
5. [Phase 3: Client & Frontend Integration](#5-phase-3-client--frontend-integration)
   - [5.1 Web Frontend / Netlify Reverse Proxy Configuration](#51-web-frontend--netlify-reverse-proxy-configuration)
   - [5.2 Vite / React Direct API Integration](#52-vite--react-direct-api-integration)
   - [5.3 Kotlin Multiplatform (Mobile/Desktop) Bearer Integration](#53-kotlin-multiplatform-mobiledesktop-bearer-integration)
6. [Phase 4: Post-Deployment Smoke Testing & Verification](#6-phase-4-post-deployment-smoke-testing--verification)
   - [6.1 Automated Verification Script (Curl / Bash)](#61-automated-verification-script-curl--bash)
   - [6.2 Authentication & Cookie Flow Testing](#62-authentication--cookie-flow-testing)
   - [6.3 CORS & Preflight Testing](#63-cors--preflight-testing)
7. [Phase 5: Day-2 Operations, Migrations & Maintenance](#7-phase-5-day-2-operations-migrations--maintenance)
   - [7.1 Executing Future Schema Migrations](#71-executing-future-schema-migrations)
   - [7.2 Rolling Back Failed Migrations](#72-rolling-back-failed-migrations)
   - [7.3 Live Log Streaming & Performance Diagnostics](#73-live-log-streaming--performance-diagnostics)
   - [7.4 Disaster Recovery & Database Backups](#74-disaster-recovery--database-backups)
8. [Phase 6: Incident Troubleshooting & Resolution Matrix](#8-phase-6-incident-troubleshooting--resolution-matrix)

---

## 1. System Architecture & Deployment Topology

VolunteerOps is architected as an enterprise real-time disaster response and operational field management platform. The production topology decouples the data layer, application runtime, and multi-platform clients:

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │                     CLIENT LAYER                        │
                                  │  ┌───────────────────┐  ┌────────────────────────────┐  │
                                  │  │ Web Client (React)│  │ Mobile / Desktop App (KMP) │  │
                                  │  │ Netlify / Vite    │  │ Android, iOS, JVM Desktop  │  │
                                  │  └─────────┬─────────┘  └─────────────┬──────────────┘  │
                                  └────────────┼──────────────────────────┼─────────────────┘
                                               │ HTTPS (Cookies/Proxy)    │ HTTPS (Bearer JWT)
                                               ▼                          ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                    RENDER CLOUD                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Web Service: volunteerops-backend                                                   │  │
│  │ Node.js 20+ Runtime (Native / Docker Container)                                     │  │
│  │                                                                                     │  │
│  │ • Port: Dynamic $PORT (Internal: 3001)                                              │  │
│  │ • Build: npm install && npm run prisma:generate && npm run build && prisma:deploy   │  │
│  │ • Start: npm start (node dist/index.js)                                             │  │
│  │ • Healthcheck Endpoint: /api/health                                                 │  │
│  │ • Security: Helmet, Argon2id, Express Rate Limit, Dual Cookie/Bearer Auth           │  │
│  └──────────────────────────────────────────┬──────────────────────────────────────────┘  │
└─────────────────────────────────────────────┼─────────────────────────────────────────────┘
                                              │ TLS / SSL (Port 5432)
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRISMA CONSOLE                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Database Instance: Prisma Postgres (PostgreSQL 17.2 / 18 Compatibility Layer)       │  │
│  │                                                                                     │  │
│  │ • Connection Pooling / Direct TCP Socket with SSL (?sslmode=require)                │  │
│  │ • Extensions: JSONB, GIN Indexes, PostGIS Geo-coordinates, SKIP LOCKED Queuing      │  │
│  │ • Migrations: Managed via Prisma Migrate engine (backend/prisma/migrations)         │  │
│  │ • Data Management: Prisma Studio & Console Data Browser                             │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pre-Deployment Checklist & Prerequisites

Ensure the following accounts, tools, and credentials are in place before starting deployment:

| Requirement | Purpose | Status / Link |
| :--- | :--- | :--- |
| **Prisma Data Platform Account** | Provisioning and hosting the managed PostgreSQL database | [console.prisma.io](https://console.prisma.io) |
| **Render Cloud Account** | Hosting the Node.js / Express backend service | [render.com](https://render.com) |
| **Git Repository** | Hosted on GitHub, GitLab, or Bitbucket containing `backend/` | Target repo |
| **Node.js 20.x or higher** | Local testing, compiling TypeScript, and running migrations | Local environment |
| **OpenSSL CLI** | Generating cryptographically secure JWT secrets | `openssl rand -hex 64` |
| **Curl or Postman** | Executing API health checks and smoke tests | Verification tooling |

---

## 3. Phase 1: Database Deployment on Prisma Console

Prisma Console provides serverless managed PostgreSQL (Prisma Postgres) with built-in connection pooling, zero cold-starts, global edge caching, and a web-based Data Browser.

### 3.1 Setting Up Prisma Console Workspace

1. Navigate to **[console.prisma.io](https://console.prisma.io)** and log in (via GitHub, Google, or Email).
2. If this is your first time, create a new Workspace (e.g., `VolunteerOps-Production`).

### 3.2 Provisioning Prisma Postgres Instance

1. In your Workspace dashboard, click **New Project** or **Create Database**.
2. Select **Prisma Postgres** as the database engine.
3. Configure the database parameters:
   - **Project Name:** `volunteerops-db-prod`
   - **Environment:** `Production`
   - **Database Engine:** `PostgreSQL 17+`

### 3.3 Region Matching & Latency Optimization

> [!IMPORTANT]
> **Cloud Region Placement:** To minimize network round-trip latency between Render and Prisma Postgres, select the cloud region geographically closest to your Render service:
> - If Render Web Service is in **US West (Oregon)** $\rightarrow$ Select Prisma Region **`us-west-2` (Oregon)**.
> - If Render Web Service is in **US East (Ohio / Virginia)** $\rightarrow$ Select Prisma Region **`us-east-1` (N. Virginia)**.
> - If Render Web Service is in **Europe (Frankfurt)** $\rightarrow$ Select Prisma Region **`eu-central-1` (Frankfurt)**.

### 3.4 Obtaining Database Connection Strings

Once provisioned, Prisma Console provides two connection URIs:

1. **Direct Connection String (Standard TCP PostgreSQL):**
   ```text
   postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require
   ```
2. **Accelerate / Pooled Connection String (Optional for Edge runtimes):**
   ```text
   prisma+postgres://accelerate.prisma-data.net/?api_key=...
   ```

> [!TIP]
> For the VolunteerOps backend (which runs a persistent Express server on Render with `@prisma/client`), use the **Direct Connection String** with `?sslmode=require`. Save this URI securely — this will become your `DATABASE_URL` environment variable.

---

### 3.5 Applying Schema Migrations

The VolunteerOps backend contains a migration history in [`backend/prisma/migrations/20260818000000_enterprise_v2/migration.sql`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/prisma/migrations/20260818000000_enterprise_v2/migration.sql).

You can apply migrations to the remote Prisma Postgres instance using either **Method A (Local CLI)** or **Method B (Render Build Command)**.

#### Method A: Apply Migrations from Local Terminal

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Set the production DATABASE_URL temporarily (replace with your Prisma Console URL)
export DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"

# On Windows PowerShell:
# $env:DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"

# 3. Deploy pending migrations
npx prisma migrate deploy
```

Expected output:
```text
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "db.prisma.io:5432"

1 migration found in prisma/migrations

Applying migration `20260818000000_enterprise_v2`

The following migration has been applied:
  - 20260818000000_enterprise_v2

All migrations have been successfully applied.
```

---

### 3.6 Seeding Initial Production Data

The database seed ([`backend/prisma/seed.ts`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/prisma/seed.ts)) populates foundational administrative users, skills, locations, mission categories, sample responders, and initial triage dispatches.

#### Seeding Execution

```bash
# From the backend directory with DATABASE_URL set to your Prisma Postgres database:
npm run db:seed
```

#### Pre-Configured Seed Accounts

Once seeded, the following credentials are ready for operational testing:

| Email | Role | Default Password | Access Level |
| :--- | :--- | :--- | :--- |
| `admin@volunteerops.org` | `SUPER_ADMIN` | `AdminPass@2026!` | Complete administrative and system access |
| `sarah.chen@fema.gov` | `COORDINATOR` | `changeme123` | Mission dispatch, event and team leadership |
| `m.rodriguez@redcross.org` | `COORDINATOR` | `changeme123` | Logistics and supply chain coordination |
| `emma.johnson@teamrubicon.org` | `TEAM_LEAD` | `changeme123` | Search & rescue field team deployment |
| `tech@volunteerops.org` | `SUPER_ADMIN` | `changeme123` | System architecture, audit logs, API telemetry |
| `volunteer@volunteerops.org` | `VOLUNTEER` | `changeme123` | Field medic responder access |

> [!WARNING]
> **Data Reset Warning:** The seed script executes `deleteMany()` on relational tables before inserting seed records. Do not run `npm run db:seed` on an active database containing real operational incident data.

---

### 3.7 Verifying Data via Prisma Studio & Data Browser

1. **Prisma Console Web Data Browser:**
   - Open your project in [console.prisma.io](https://console.prisma.io).
   - Click **Data Browser** in the left sidebar.
   - Inspect tables: `users`, `volunteers`, `skills`, `locations`, `events`, `deployments`, `field_reports`.

2. **Local Prisma Studio:**
   ```bash
   DATABASE_URL="postgres://..." npx prisma studio
   ```
   - Opens local GUI at `http://localhost:5555` connected to the remote database.

---

## 4. Phase 2: Backend Deployment on Render Cloud

Render provides fully managed hosting for Node.js web services with automated SSL certificates, zero-downtime rolling deploys, Git integration, and health check monitoring.

### 4.1 Deployment Strategy Selection (Blueprint vs Manual)

| Strategy | When to Choose | Advantages |
| :--- | :--- | :--- |
| **Option A: Blueprint (`render.yaml`)** | Preferred for GitOps, version-controlled infrastructure, and repeatable multi-environment setups | Infrastructure as Code, zero manual UI configuration errors |
| **Option B: Manual Dashboard Setup** | Preferred if you want granular UI control without committing root `render.yaml` | Quick setup, step-by-step visibility |

---

### 4.2 Option A: Automated Blueprint Deployment (`render.yaml`)

The repository includes a production blueprint at [`backend/render.yaml`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/render.yaml).

```yaml
services:
  - type: web
    name: volunteerops-backend
    runtime: node
    plan: starter
    region: oregon
    buildCommand: npm install && npm run prisma:generate && npm run build && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: COOKIE_SECURE
        value: "true"
      - key: CORS_ORIGIN
        value: "https://volunteerops.org,https://volunteerops.netlify.app"
      - key: LOG_LEVEL
        value: "info"
```

#### Blueprint Deployment Steps:

1. Copy `backend/render.yaml` to the root directory of your repository if deploying from repository root, or reference the repo directly.
2. Sign in to **[dashboard.render.com](https://dashboard.render.com)**.
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your connected Git repository.
5. Render detects `render.yaml` and presents the service configuration.
6. When prompted for unsynced variables:
   - **`DATABASE_URL`**: Paste your Prisma Console PostgreSQL connection URI.
   - **`CORS_ORIGIN`**: Enter your production frontend domain(s) (comma-separated).
7. Click **Apply**. Render will automatically provision the service, install dependencies, run migrations, compile TypeScript, and boot the server.

---

### 4.3 Option B: Manual Web Service Setup via Dashboard

Follow these step-by-step instructions in the Render Web Console:

#### Step 1: Create New Web Service
1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub / GitLab repository containing VolunteerOps.

#### Step 2: Configure Service Parameters

| Configuration Field | Exact Value | Explanation |
| :--- | :--- | :--- |
| **Name** | `volunteerops-backend` | Unique identifier for your service on `*.onrender.com` |
| **Region** | `Oregon (US West)` *(or closest to DB)* | Match the Prisma Postgres cloud region |
| **Branch** | `main` | Production deployment branch |
| **Root Directory** | `backend` | **CRITICAL:** Tells Render to build from within `backend/` |
| **Runtime** | `Node` | Native Node.js execution environment |
| **Build Command** | `npm install && npm run prisma:generate && npm run build && npx prisma migrate deploy` | Installs deps, generates Prisma client, compiles TS, runs migrations |
| **Start Command** | `npm start` | Executes `node dist/index.js` |
| **Instance Type / Plan** | `Starter ($7/mo)` or `Free` | *Starter recommended to avoid 15-min idle sleep* |

---

### 4.4 Complete Environment Variables Matrix

Under the **Environment** section of your Render Web Service, configure the following variables:

```env
# ==============================================================================
# VOLUNTEEROPS BACKEND PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# Database Connection (from Prisma Console)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"

# Dual-Token JWT Authentication Security (Generate 64-byte hex: openssl rand -hex 64)
JWT_SECRET="76766f064424f01dc76f8dac64245980bce8315547724f91806b8f9eaf942aad3012cf33774a423ec4b6ddb9674bfdc3bb2f22bdbcac4e7352976a62adfe2a01"
JWT_REFRESH_SECRET="34ad6477ecf691a08292496075881c492cc096f7e749ff3692368d561986c2a4c2b1f6b59341fbf5532be3e1a440babc78d8af6e211c9b229d052f64c1489380"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
JWT_EXPIRES_IN="15m"

# Cookie Security Settings
COOKIE_SECURE="true"
COOKIE_DOMAIN=""

# Cross-Origin Resource Sharing (Comma-separated allowed origins)
CORS_ORIGIN="https://volunteerops.org,https://volunteerops.netlify.app,https://volunteerops-admin.netlify.app"

# Application Runtime Configuration
NODE_ENV="production"
LOG_LEVEL="info"
```

#### Detailed Variable Reference

| Variable | Type / Default | Required | Description & Security Best Practices |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `string` | **YES** | Prisma Accelerate or pooled connection URI with `?sslmode=require`. |
| `DIRECT_URL` | `string` | **YES** | Direct TCP PostgreSQL URI for migrations (`npx prisma migrate deploy`). |
| `JWT_SECRET` | `string` (min 16 chars) | **YES** | Signing secret for short-lived access tokens (15m). Generate via `openssl rand -hex 64`. |
| `JWT_REFRESH_SECRET` | `string` (min 16 chars) | **YES** | Cryptographic key for signing long-lived refresh tokens (7d). |
| `JWT_ACCESS_EXPIRES_IN` | `string` (`15m`) | NO | Access token lifespan. Short lifespan limits exposure from compromised tokens. |
| `JWT_REFRESH_EXPIRES_IN` | `string` (`7d`) | NO | Refresh token lifespan. Used to silently re-authenticate without user disruption. |
| `COOKIE_SECURE` | `boolean` (`true`) | **YES** | When `true`, auth cookies (`vops_access_token`, `vops_refresh_token`) transmit exclusively over HTTPS with `SameSite=None` or `SameSite=Lax`. |
| `COOKIE_DOMAIN` | `string` (`""`) | NO | Optional root domain (e.g. `.volunteerops.org`) for cross-subdomain auth. |
| `CORS_ORIGIN` | `string` | **YES** | Comma-separated list of whitelisted frontend origins. In production, never use `*`. |
| `NODE_ENV` | `production` | **YES** | Optimizes Express routing, disables verbose query logs, and activates production error formatting. |
| `PORT` | Auto-injected by Render | NO | **Do not manually hardcode.** Render injects `$PORT` (e.g. 10000), and [`backend/src/core/config.ts`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/src/core/config.ts) binds to `process.env.PORT`. |

---

### 4.5 Setting Up Dual-Token Security & Cryptographic Secrets

The backend implements the **Dual-Token Flow (Short-Lived Access Token + Revocable Refresh Token with Refresh Token Rotation)**:
- **Access Tokens (`15m`):** Signed with `JWT_SECRET`. Transmitted in API headers or `vops_access_token` cookie. If intercepted, valid for at most 15 minutes.
- **Refresh Tokens (`7d`):** Signed with `JWT_REFRESH_SECRET`. Stored as SHA-256 digests in PostgreSQL (`refresh_tokens` table) and transmitted via scoped `vops_refresh_token` httpOnly cookie (path: `/api/auth`) or JSON body.
- **Refresh Token Rotation (RTR):** Every time a refresh token is used, it is revoked and replaced with a brand new token pair in the same token family.
- **Replay Attack Detection:** If an attacker attempts to reuse an old revoked refresh token, the backend detects the compromise and immediately revokes the **entire token family**, forcing full re-authentication.

#### How to Generate Cryptographic Secrets (64-byte Hex)

```bash
# Option 1: OpenSSL (Linux / macOS / Git Bash)
openssl rand -hex 64

# Option 2: Node.js (Any OS)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 3: PowerShell (Windows)
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)).Replace("-","").ToLower()
```

---

### 4.6 Health Check & Zero-Downtime Deployment Configuration

Render uses active HTTP polling to ensure the new container is operational before terminating the old container.

1. In Render Dashboard, go to **Settings** $\rightarrow$ **Health Check Path**.
2. Enter: `/api/health`.
3. The server responds with `200 OK`:
   ```json
   {
     "ok": true,
     "status": "OPERATIONAL",
     "service": "VolunteerOps-Enterprise-Backend",
     "version": "2.0.0",
     "timestamp": "2026-08-19T14:00:00.000Z",
     "uptime_seconds": 128.45
   }
   ```

---

### 4.7 Scaling & Resource Allocation Recommendations

| Traffic Level | Monthly Active Users | Recommended Render Plan | Prisma Postgres Tier | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Development / Staging** | < 100 | **Free Tier** | Free Serverless | Spins down after 15 min inactivity (~30s cold start). |
| **Small Production (Active Drills)** | 100 – 2,500 | **Starter ($7/mo)** | Starter | Always-on, 512 MB RAM, 0.5 CPU, 100 concurrent connections. |
| **Enterprise / Crisis Operations** | 2,500 – 50,000+ | **Standard ($25/mo) / Pro ($85/mo)** | Pro / Dedicated | 2GB–8GB RAM, auto-scaling enabled (2–5 instances), high connection pooling. |

---

## 5. Phase 3: Client & Frontend Integration (Silent Background Reauthentication)

### 5.1 Web Frontend / Netlify Reverse Proxy Configuration

If your web frontend is deployed on Netlify, configure a reverse proxy in `netlify.toml` at the frontend root to avoid CORS and third-party cookie restrictions:

```toml
# netlify.toml (Frontend Root)
[[redirects]]
  from = "/api/*"
  to = "https://volunteerops-backend.onrender.com/api/:splat"
  status = 200
  force = true
  headers = {X-From = "Netlify-Proxy"}
```

---

### 5.2 React / Vite Automatic Silent Refresh Interceptor (Fetch / Axios)

When an access token expires (15 minutes), the backend returns `401 Unauthorized` with error code `TOKEN_EXPIRED`. The client interceptor catches this error, calls `POST /api/auth/refresh` silently in the background, and retries the original request seamlessly without kicking the user out.

```typescript
// frontend/src/lib/apiClient.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://volunteerops-backend.onrender.com/api';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (val?: any) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const config: RequestInit = {
    ...options,
    credentials: 'include', // Automatically sends vops_access_token and vops_refresh_token
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let response = await fetch(url, config);

  // If access token expired, trigger silent background reauthentication
  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    const data = await response.clone().json().catch(() => ({}));
    
    if (data.code === 'TOKEN_EXPIRED' || data.error === 'TOKEN_EXPIRED' || !isRefreshing) {
      if (isRefreshing) {
        // Queue parallel requests while refresh is in flight
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiRequest<T>(endpoint, options));
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!refreshRes.ok) {
          throw new Error('Session expired');
        }

        processQueue(null);
        // Retry original request with freshly rotated cookies
        response = await fetch(url, config);
      } catch (refreshErr) {
        processQueue(refreshErr);
        window.location.href = '/login?expired=true';
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `HTTP ${response.status}`);
  }

  return response.json();
}
```

---

### 5.3 Kotlin Multiplatform (Mobile/Desktop) Dual-Token Refresh Integration

For Android, iOS, and JVM desktop clients using Ktor HTTP client:

```kotlin
// Ktor HTTP Client with Automatic Token Refresh
val client = HttpClient(CIO) {
    install(ContentNegotiation) { json() }
    install(Auth) {
        bearer {
            loadTokens {
                BearerTokens(
                    accessToken = secureStorage.getAccessToken() ?: "",
                    refreshToken = secureStorage.getRefreshToken() ?: ""
                )
            }
            refreshTokens {
                val refreshResponse = client.post("https://volunteerops-backend.onrender.com/api/auth/refresh") {
                    setBody(mapOf("refreshToken" to oldTokens?.refreshToken))
                    contentType(ContentType.Application.Json)
                }.body<TokenResponse>()

                secureStorage.saveTokens(refreshResponse.accessToken, refreshResponse.refreshToken)

                BearerTokens(
                    accessToken = refreshResponse.accessToken,
                    refreshToken = refreshResponse.refreshToken
                )
            }
        }
    }
}
```

---

## 6. Phase 4: Post-Deployment Smoke Testing & Verification

Execute the following verification script against your deployed Render service URL (`https://<your-service>.onrender.com`).

### 6.1 Automated Verification Script (Bash / Curl)

Save as `test_deploy.sh` and execute:

```bash
#!/usr/bin/env bash
set -e

BASE_URL="https://volunteerops-backend.onrender.com"

echo "=========================================================="
echo "  VolunteerOps Production API Verification Suite"
echo "  Target: $BASE_URL"
echo "=========================================================="

# 1. Healthcheck Test
echo -n "1. Checking System Health (/api/health)... "
HEALTH_RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/api/health")
STATUS_CODE=$(echo "$HEALTH_RESP" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "✅ PASSED (200 OK)"
else
  echo "❌ FAILED (Status: $STATUS_CODE)"
  echo "$HEALTH_RESP"
  exit 1
fi

# 2. Super Admin Authentication Test
echo -n "2. Authenticating as Super Admin (/api/auth/login)... "
LOGIN_RESP=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@volunteerops.org","password":"AdminPass@2026!"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ PASSED (JWT Token Issued)"
else
  echo "❌ FAILED"
  echo "$LOGIN_RESP"
  exit 1
fi

# 3. Authenticated Profile Test (/api/auth/me)
echo -n "3. Verifying Authenticated Session (/api/auth/me)... "
ME_RESP=$(curl -s -b cookies.txt -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth/me")

if echo "$ME_RESP" | grep -q "admin@volunteerops.org"; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  echo "$ME_RESP"
  exit 1
fi

# 4. Fetch Volunteers Roster
echo -n "4. Querying Volunteers Module (/api/volunteers)... "
VOL_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/volunteers?page=1&limit=5")

if echo "$VOL_RESP" | grep -q '"success":true'; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  echo "$VOL_RESP"
  exit 1
fi

# 5. Fetch Active Events
echo -n "5. Querying Events & Missions Module (/api/events)... "
EVENT_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/events?page=1&limit=5")

if echo "$EVENT_RESP" | grep -q '"success":true'; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  echo "$EVENT_RESP"
  exit 1
fi

# 6. Public Contact Ingestion Test
echo -n "6. Testing Public Contact Form Ingestion (/api/contact)... "
CONTACT_RESP=$(curl -s -X POST "$BASE_URL/api/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Verification Bot",
    "email": "smoke-test@volunteerops.org",
    "message": "Automated verification ping post-deployment."
  }')

if echo "$CONTACT_RESP" | grep -q '"success":true'; then
  echo "✅ PASSED"
else
  echo "❌ FAILED"
  echo "$CONTACT_RESP"
  exit 1
fi

rm -f cookies.txt
echo "=========================================================="
echo "🎉 ALL PRODUCTION DEPLOYMENT TESTS PASSED SUCCESSFULLY!"
echo "=========================================================="
```

---

### 6.2 Authentication & Cookie Flow Testing

To verify cross-origin cookie behavior (`vops_session`):

```bash
curl -i -X POST "https://volunteerops-backend.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://volunteerops.org" \
  -d '{"email":"admin@volunteerops.org","password":"AdminPass@2026!"}'
```

Verify that the response includes:
1. `Set-Cookie: vops_session=eyJhbGci...; Path=/; HttpOnly; Secure; SameSite=None`
2. `Access-Control-Allow-Origin: https://volunteerops.org`
3. `Access-Control-Allow-Credentials: true`

---

### 6.3 CORS & Preflight Testing

Verify `OPTIONS` preflight handling:

```bash
curl -i -X OPTIONS "https://volunteerops-backend.onrender.com/api/volunteers" \
  -H "Origin: https://volunteerops.org" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type"
```

Expected HTTP Status: `204 No Content` or `200 OK` with allowed origin headers.

---

## 7. Phase 5: Day-2 Operations, Migrations & Maintenance

### 7.1 Executing Future Schema Migrations

When models in [`backend/prisma/schema.prisma`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/prisma/schema.prisma) change:

1. **Develop and test locally:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_responder_telemetry_fields
   ```
2. **Commit the new migration folder:**
   ```bash
   git add prisma/schema.prisma prisma/migrations/
   git commit -m "feat(db): add responder telemetry fields"
   git push origin main
   ```
3. **Automated Deployment:**
   Render triggers a new build. Because the build command includes `npx prisma migrate deploy`, the migration runs automatically before the new application process spins up.

---

### 7.2 Rolling Back Failed Migrations

If a migration fails due to a locked table or constraint violation:

1. Open Render Dashboard $\rightarrow$ Web Service $\rightarrow$ **Shell**.
2. Check migration status:
   ```bash
   npx prisma migrate status
   ```
3. Mark rolled back if manually reverted:
   ```bash
   npx prisma migrate resolve --rolled-back "20260818000000_enterprise_v2"
   ```
4. Or mark as applied if resolved manually in SQL:
   ```bash
   npx prisma migrate resolve --applied "20260818000000_enterprise_v2"
   ```

---

### 7.3 Live Log Streaming & Performance Diagnostics

1. **Log Streaming:** View real-time output in the Render **Logs** tab. Structured JSON and formatted logs from [`backend/src/core/logger.ts`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/src/core/logger.ts) are streamed instantly.
2. **Explain Analyze Optimization:**
   The backend includes built-in PostgreSQL 18 explain plan profiling ([`backend/src/core/prisma.ts`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/src/core/prisma.ts)):
   ```typescript
   import { explainAnalyzeQuery } from './core/prisma.js';
   const plan = await explainAnalyzeQuery('SELECT * FROM deployments WHERE status = \'ASSIGNED\'');
   ```

---

### 7.4 Disaster Recovery & Database Backups

- **Prisma Postgres Backups:** Automated continuous backups with Point-in-Time Recovery (PITR) are managed through the Prisma Console dashboard under **Settings** $\rightarrow$ **Backups**.
- **Manual Logical Export (pg_dump):**
  ```bash
  pg_dump "postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
    --format=custom --file=volunteerops_backup_$(date +%Y%m%d).dump
  ```
- **Logical Restore (pg_restore):**
  ```bash
  pg_restore --clean --no-owner --dbname="postgres://..." volunteerops_backup_20260819.dump
  ```

---

## 8. Phase 6: Incident Troubleshooting & Resolution Matrix

| Symptom / Error Message | Root Cause | Exact Resolution |
| :--- | :--- | :--- |
| **`P1001: Can't reach database server at db.prisma.io:5432`** | Network timeout, incorrect connection string, or missing `?sslmode=require`. | 1. Verify `DATABASE_URL` in Render environment settings.<br>2. Ensure `?sslmode=require` is appended to the URI.<br>3. Check Prisma Console status to ensure the instance is active. |
| **`P3009: migrate found failed migrations in the target database`** | A prior migration threw an error midway and left a lock in `_prisma_migrations`. | Run `npx prisma migrate resolve --rolled-back <migration_name>` in the Render Shell, fix the schema conflict, and redeploy. |
| **`Invalid environment variables configuration (ZodError)`** | Missing or malformed required environment variables (e.g. `JWT_SECRET` < 16 chars). | Check Render build/runtime logs. Ensure `JWT_SECRET` has $\ge 16$ characters and `DATABASE_URL` is populated. |
| **`Cannot find module '@prisma/client'`** | `prisma generate` was omitted during the build phase. | Update Render **Build Command** to include `npm run prisma:generate` before `npm run build`. |
| **`Login works but /api/auth/me returns 401 Unauthorized`** | Cookie security mismatch (`COOKIE_SECURE=true` accessed over plain HTTP, or missing CORS credentials). | 1. Ensure `COOKIE_SECURE=true` in production (HTTPS).<br>2. Verify frontend sends `credentials: 'include'`.<br>3. Verify `CORS_ORIGIN` includes the exact frontend origin protocol and port. |
| **`First API request takes 30-50 seconds to respond`** | Render Free Tier service or Prisma Postgres free tier spinning up from idle sleep. | Upgrade Render Web Service to the **Starter Plan ($7/mo)** to keep the runtime warm 24/7. |
| **`502 Bad Gateway / Exited with code 1 on Render`** | The application failed to bind to `$PORT` or threw an uncaught startup exception. | 1. Ensure `PORT` is not hardcoded in `.env` files committed to Git.<br>2. Confirm [`src/core/config.ts`](file:///c:/Users/admin/IdeaProjects/VolunteerOPS/backend/src/core/config.ts) resolves `process.env.PORT`. |
| **`argon2 native compilation error during npm install`** | Missing build tools (`node-gyp` / Python) in custom base images. | Use standard Render `Node` native runtime (Node 20+), which contains prebuilt binary compatibility for argon2. |

---

## 9. Runbook Sign-Off & Verification Checklist

Before opening the platform to field responders and emergency operations staff, check off the following milestones:

- [ ] Prisma Postgres instance provisioned in matching cloud region.
- [ ] Direct connection URI with SSL (`?sslmode=require`) configured.
- [ ] Database schema migrations deployed (`20260818000000_enterprise_v2`).
- [ ] Seed data populated and admin credentials confirmed.
- [ ] Render Web Service created with `Root Directory: backend`.
- [ ] Environment variables configured (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`).
- [ ] Healthcheck endpoint `/api/health` returning 200 OK.
- [ ] Automated smoke test script (`test_deploy.sh`) executed with 100% pass rate.
- [ ] Netlify/Web proxy or KMP client endpoint updated to production URL.
- [ ] Super Admin password rotated from default seed value.

---
*VolunteerOps Architecture & Operations Team — Mission-Critical Field Management Platform*
