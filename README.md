# VolunteerOps Enterprise Backend
> **Enterprise Real-Time Disaster Response and Operational Field Management Platform Backend**

[![Node.js Version](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma)](https://www.prisma.io)
[![Prisma Accelerate](https://img.shields.io/badge/Prisma-Accelerate%20Edge%20Cache-5A67D8)](https://www.prisma.io/accelerate)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2017%20%2F%2018-4169E1?logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-Private%20%2F%20Proprietary-red)](#)

---

## 📖 Overview

**VolunteerOps** is a mission-critical backend engine designed to coordinate emergency response personnel, disaster relief deployments, live GPS telemetry, incident field reports, tactical communications, and crisis operational analytics with sub-second latency and high availability.

Built with a modular, **NestJS-inspired clean architecture** on top of **Node.js, Express, and TypeScript**, the platform leverages **Prisma ORM**, the caching and pooling included with **Prisma Postgres**, and authenticated access to **Prisma Object Store** for operational files.

---

## 🏛️ System Architecture

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
│                               VOLUNTEEROPS BACKEND (Express + TS)                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Security & Core Gateway                                                             │  │
│  │ • Dual Auth: httpOnly Cookies (Web) + Bearer JWT Header (Mobile & Desktop Apps)     │  │
│  │ • Role-Based Access Control (SUPER_ADMIN, COORDINATOR, TEAM_LEAD, VOLUNTEER)         │  │
│  │ • Argon2id Cryptographic Password Hashing • Rate Limiting & DoS Mitigation           │  │
│  │ • Helmet Security Headers • Zod Request Body Validation                             │  │
│  └──────────────────────────────────────────┬──────────────────────────────────────────┘  │
│                                             │                                             │
│  ┌──────────────────────────────────────────▼──────────────────────────────────────────┐  │
│  │ Modular Domain Engine (14 Micro-Domain Services & Controllers)                      │  │
│  │ ├─ Auth & IAM                  ├─ Events & Crisis Missions   ├─ Notifications       │  │
│  │ ├─ Volunteer Dossiers          ├─ Deployments & Dispatch     ├─ After-Action Review │  │
│  │ ├─ Skill Catalog & Certs       ├─ Field Incident SITREPs     ├─ Landing Lead Triage │  │
│  │ ├─ Locations & Geo-Hazards     ├─ Tactical Communications    ├─ Operational Analytics│ │
│  │ └─ Responder GPS Telemetry     └─ Super Admin Operations     └─ Audit Logging       │  │
│  └──────────────────────────────────────────┬──────────────────────────────────────────┘  │
│                                             │                                             │
│  ┌──────────────────────────────────────────▼──────────────────────────────────────────┐  │
│  │ Prisma Client Extension Layer ($extends)                                            │  │
│  │ • Prisma Accelerate Edge Caching (withAccelerate())                                 │  │
│  │ • Application Computed Fields (geoCoordinates, durationHours)                      │  │
│  │ • Query Optimization Profiler (EXPLAIN ANALYZE, BUFFERS)                            │  │
│  │ • Atomic Audit Log Engine (updateWithAudit)                                         │  │
│  └──────────────────────────────────────────┬──────────────────────────────────────────┘  │
└─────────────────────────────────────────────┼─────────────────────────────────────────────┘
                                              │ TLS Socket / Global Edge Cache
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           PRISMA POSTGRES / ACCELERATE EDGE                               │
│  • Edge Connection Pooling & Global Query Cache (ttl: 60s, swr: 30s)                      │
│  • High-Performance Indexing: GIN (JSONB), Spatial Lat/Lng Coordinates, Foreign Keys      │
│  • Direct TCP Migration Pipeline (directUrl) for DDL operations                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features & Domain Modules

| Module | Route Prefix | Description |
| :--- | :--- | :--- |
| **Auth & IAM** | `/api/auth` | User registration, login, profile management, password changes, and session logout. Supports dual-mode authentication via `httpOnly` secure cookies and `Authorization: Bearer <token>` headers. |
| **Volunteers** | `/api/volunteers` | Volunteer roster, status tracking (`ACTIVE`, `DEPLOYED`, `AVAILABLE`, `RESTRICTED`, `INACTIVE`), bio, availability schedules, and geocoded coordinates. |
| **Skills & Certs** | `/api/skills` | Categorized emergency qualifications, demand level tracking (`critical`, `high`, `medium`, `low`), and volunteer certification mapping. Edge-cached via Prisma Accelerate. |
| **Locations & GIS** | `/api/locations` | Disaster locations, incident hazard levels (`low`, `moderate`, `high`, `critical`), operational radius (meters), and OpenStreetMap integration. |
| **Events & Missions** | `/api/events` | Incident command dispatch, multi-stage mission lifecycles (`STAGED`, `ACTIVE`, `CONTAINED`, `COMPLETED`, `CANCELLED`), priority levels, and required skill matching. |
| **Deployments** | `/api/deployments` | Field dispatch assignments, responder deployment statuses (`ASSIGNED`, `EN_ROUTE`, `ON_SITE`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`), and GPS check-ins. |
| **Field Reports** | `/api/field-reports` | On-scene SITREPs, casualty/supply counts, disaster damage assessments, photo attachments, and triage reviews. |
| **Communications** | `/api/communications` | Incident broadcast channels (`alerts`, `teams`, `general`, `coordination`, `medical_alpha`, `logistics_bravo`) and emergency broadcasts. |
| **Telemetry** | `/api/telemetry` | High-frequency GPS responder tracking, battery levels, speed, altitude, accuracy, and network connectivity pings. |
| **Contact Ingestion** | `/api/contact` | Public emergency lead and community inquiry pipeline with triage workflows (`NEW`, `IN_REVIEW`, `RESPONDED`, `RESOLVED`, `ARCHIVED`). |
| **Notifications** | `/api/notifications` | Real-time targeted user dispatch notifications and urgent broadcast alerts. |
| **Feedback** | `/api/feedback` | Post-mission after-action debriefs, operational ratings, and responder evaluations. |
| **Analytics Engine** | `/api/analytics` | Real-time executive KPIs, mission success rates, active responder breakdowns, event type distribution, and monthly trend aggregations. |
| **Admin Operations** | `/api/admin` | Comprehensive database statistics, user role elevation, and system audit trail inspection. |

---

## 🛠️ Technology Stack

- **Runtime:** Node.js `>=20.19.0` (ES Modules)
- **Language:** TypeScript 5.7+
- **Web Framework:** Express 4.21+
- **ORM & Data Layer:** Prisma ORM 7.10 & `@prisma/extension-accelerate`
- **Database:** Prisma Postgres (managed PostgreSQL 17); Prisma ORM also supports externally hosted PostgreSQL 18
- **Object Storage:** Prisma Object Store through short-lived, backend-issued S3 URLs
- **Security & Crypto:** Argon2id (`argon2`), JSON Web Tokens (`jsonwebtoken`), Helmet, Cookie-Parser
- **Validation:** Zod 3.24+
- **Rate Limiting:** `express-rate-limit`
- **Development Tooling:** `tsx` (TypeScript Execute & Watch), `tsc` (TypeScript Compiler)

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher (`node -v`)
- **npm**: `v10.x` or higher (`npm -v`)
- **PostgreSQL Database** or **Prisma Console (Prisma Postgres)** instance

### 2. Installation

Clone the repository and install dependencies:

```bash
# Navigate to backend directory
cd backend

# Install project dependencies
npm install
```

### 3. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Open `.env` and configure your environment variables:

```env
# Database Connection (Prisma Accelerate URL or standard PostgreSQL URI)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=your-api-key"

# Direct TCP Connection (Required for running migrations through Accelerate)
DIRECT_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"

# JWT Authentication Secret (Generate with: openssl rand -hex 64)
JWT_SECRET="dev-only-jwt-secret-please-replace-in-production-with-64-random-bytes"
JWT_EXPIRES_IN="7d"

# Cookie Security (false for local HTTP, true for production HTTPS)
COOKIE_SECURE="false"
COOKIE_DOMAIN=""

# Server Port & CORS Whitelist
PORT=3001
CORS_ORIGIN="http://localhost:5173,http://localhost:3000,http://localhost:8080"

# Runtime Environment
NODE_ENV="development"
LOG_LEVEL="debug"
```

### 4. Database Setup & Migrations

Deploy the initial database schema migrations:

```bash
# Generate Prisma Client
npm run prisma:generate

# Deploy migrations to the database
npm run prisma:deploy
```

### 5. Seed Initial Data

Populate the database with foundational administrative users, skills, disaster locations, active crisis missions, field deployments, and sample telemetry:

```bash
npm run db:seed
```

### 6. Run the Server

#### Development Mode (with hot-reload):
```bash
npm run dev
```

#### Production Build & Start:
```bash
npm run build
npm start
```

The server will start listening at:
- **API Base:** `http://localhost:3001`
- **Healthcheck:** `http://localhost:3001/api/health`

---

## 🔐 Seed Accounts & Authentication

Once seeded, the following accounts are pre-configured for development and operational testing:

| Email | Role | Default Password | Permissions |
| :--- | :--- | :--- | :--- |
| `admin@volunteerops.org` | `SUPER_ADMIN` | `AdminPass@2026!` | Full administrative access across all domains & audit logs |
| `sarah.chen@fema.gov` | `COORDINATOR` | `changeme123` | Incident command, mission dispatch, event management |
| `m.rodriguez@redcross.org` | `COORDINATOR` | `changeme123` | Logistics coordination and supply chain oversight |
| `emma.johnson@teamrubicon.org` | `TEAM_LEAD` | `changeme123` | Search & rescue field team deployment management |
| `tech@volunteerops.org` | `SUPER_ADMIN` | `changeme123` | Systems architecture, audit trail, API telemetry |
| `volunteer@volunteerops.org` | `VOLUNTEER` | `changeme123` | Field medic responder access |

---

## 📡 Core API Reference

### Base & Health Diagnostics
- `GET /` & `GET /api` - Public API discovery index and module routing map.
- `GET /api/health` - Server uptime, memory utilization, and operational status.

### Authentication & Identity (`/api/auth`)
- `POST /api/auth/signup` - Register a new responder account; receives dual tokens (`access_token` [15m], `refresh_token` [7d]) and sets secure httpOnly cookies.
- `POST /api/auth/login` - Authenticate with email/password; returns dual tokens and sets `vops_access_token` and `vops_refresh_token` cookies.
- `POST /api/auth/refresh` - Silently rotate expired access token and issue fresh token pair (supports cookies or JSON body).
- `GET /api/auth/me` - Retrieve authenticated user profile (Requires Auth).
- `PATCH /api/auth/profile` - Update profile information (Requires Auth).
- `POST /api/auth/change-password` - Change password and invalidate active refresh tokens (Requires Auth).
- `POST /api/auth/logout` - Revoke refresh token and clear authentication cookies.

### Users & System Accounts (`/api/users`)
- `GET /api/users` - Paginated system user directory with search and role filtering (Coordinator/Admin).
- `GET /api/users/:id` - Detailed user dossier with linked volunteer profile (Coordinator/Admin).
- `PATCH /api/users/:id/role` - Elevate or modify user permission role (`SUPER_ADMIN`, `COORDINATOR`, `TEAM_LEAD`, `VOLUNTEER`) (Admin only).
- `PATCH /api/users/:id/status` - Activate or deactivate user account and invalidate active sessions (Admin only).

### Volunteer Management (`/api/volunteers`)
- `GET /api/volunteers` - Paginated volunteer roster with filtering by status and search.
- `GET /api/volunteers/:id` - Detailed volunteer dossier including skills and deployments.
- `POST /api/volunteers` - Create a new volunteer record (Coordinator/Admin).
- `PATCH /api/volunteers/:id` - Update volunteer profile and status.
- `DELETE /api/volunteers/:id` - Remove a volunteer (Admin only).

### Crisis Events & Missions (`/api/events`)
- `GET /api/events` - Active disaster missions and scheduled events.
- `GET /api/events/:id` - Event details with assigned deployments and field reports.
- `POST /api/events` - Create a new disaster mission event (Coordinator/Admin).
- `PATCH /api/events/:id` - Update event status, priority, and timeline.
- `DELETE /api/events/:id` - Cancel or remove an event.

### Deployments & Field Dispatch (`/api/deployments`)
- `GET /api/deployments` - List active deployments with responder and event mappings.
- `POST /api/deployments` - Dispatch responder to an event (Coordinator/Admin).
- `PATCH /api/deployments/:id/status` - Update deployment status (`EN_ROUTE`, `ON_SITE`, `CHECKED_IN`, `COMPLETED`).
- `POST /api/deployments/:id/checkin` - GPS-verified check-in with coordinates.

### Field Reports (`/api/field-reports`)
- `GET /api/field-reports` - List incident field SITREPs.
- `POST /api/field-reports` - Submit a new on-scene field report.
- `GET /api/field-reports/:id` - Detailed field report with media attachments.

### Object Storage (`/api/storage`)
- `POST /api/storage/upload-url` - Issue a short-lived authenticated upload URL.
- `GET /api/storage/download-url?key=...` - Issue an authorized short-lived download URL.

### Tactical Communications (`/api/communications`)
- `GET /api/communications/channels` - List communication channels with unread counts.
- `GET /api/communications/channels/:channelId/messages` - Retrieve channel message history.
- `POST /api/communications/messages` - Broadcast message to a tactical channel.

### Analytics & AI Insights (`/api/analytics`)
- `GET /api/analytics/overview` - Executive KPI summary, active missions, volunteer breakdowns.
- `GET /api/analytics/volunteers` - Status distribution and readiness metrics.
- `GET /api/analytics/events` - Mission priority and phase breakdown.
- `GET /api/analytics/deployments` - Deployment fulfillment and check-in ratios.
- `GET /api/analytics/skills` - Skill supply vs critical disaster demand.
- `GET /api/analytics/monthly?year=2026` - Historical monthly deployment volumes.

---

## ⚡ Prisma Accelerate Edge Caching

The backend is pre-configured with **Prisma Accelerate** for pooled connections and globally cached reads:

```typescript
// Example: Accelerated query with Stale-While-Revalidate caching
const skills = await prisma.skill.findMany({
  include: {
    _count: { select: { volunteerSkills: true } },
  },
  orderBy: { category: 'asc' },
  cacheStrategy: { ttl: 60, swr: 30 }, // 60s TTL, 30s SWR
});
```

To run a live Accelerate edge cache benchmark locally:
```bash
npm run accelerate:test
```

---

## 📦 NPM Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server with live reload via `tsx`. |
| `npm run build` | Compiles TypeScript into JavaScript in `dist/`. |
| `npm start` | Runs the compiled production server from `dist/index.js`. |
| `npm run prisma:generate` | Generates the Prisma Client with Accelerate extensions. |
| `npm run prisma:deploy` | Applies all pending migrations to the database. |
| `npm run prisma:studio` | Opens local Prisma Studio GUI on port 5555. |
| `npm run db:seed` | Seeds the database with production test data. |
| `npm run db:reset` | Resets the database and re-runs all migrations (destructive). |

---

## 🚢 Production Deployment

Use the **[Prisma Compute production deployment runbook](DEPLOYMENT_RUNBOOK.md)**. `docs/RENDER_DEPLOY.md` is retained only as a historical migration reference; the active Render blueprint has been removed.

---

## 🔒 Security & Best Practices

- **Zero Plaintext Secrets**: Secrets are never hardcoded or committed to version control.
- **Secure Password Hashing**: Utilizes **Argon2id** (memory-hard, resistant to GPU/ASIC cracking).
- **Dual Authentication**: Seamlessly authenticates browser web clients (via `httpOnly`, `SameSite=None/Lax`, `Secure` cookies) and mobile/desktop clients (via `Authorization: Bearer <token>`).
- **DoS & Brute-Force Protection**: Global rate limiter (100 req/min) and strict authentication rate limiter (15 req/15min).
- **Data Validation**: Strict runtime schema validation on all incoming request payloads via **Zod**.
- **Audit Logging**: Sensitive administrative updates automatically record `oldState` and `newState` diffs in `audit_logs`.

---

## 📄 License & Maintainers

**VolunteerOps Enterprise Architecture Team**  
*Mission-Critical Disaster Response & Operational Management Platform*  
Proprietary — All rights reserved.
