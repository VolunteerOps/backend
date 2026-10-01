import { bucket, defineRailway, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const resqPostgresVolume = volume("resq-postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  const resqRecovery = bucket("resq-recovery", { region: "ams" });
  const resqPrivateFiles = bucket("resq-private-files", { region: "ams" });
  const resqPostgres = service("resq-postgres", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "deploy/railway/postgres/Dockerfile" },
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { restartPolicyMaxRetries: 3 },
    volumeMounts: { "/var/lib/postgresql": resqPostgresVolume },
    env: { PGDATA: preserve(), POSTGRES_DB: preserve(), POSTGRES_PASSWORD: preserve(), POSTGRES_USER: preserve(), RESQ_DB_TLS_CERT_B64: preserve(), RESQ_DB_TLS_KEY_B64: preserve() },
  });
  const resqMigrate = service("resq-migrate", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "deploy/railway/Dockerfile.migrate" },
    start: "node scripts/railway-migrate.mjs",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0, restartPolicyType: "NEVER" },
    env: { DATABASE_TLS_CA: preserve(), DIRECT_URL: preserve() },
  });
  const resqRetention = service("resq-retention", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node scripts/start-with-google-credentials.mjs dist/workers/retention.worker.js",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { cronSchedule: "*/5 * * * *", drainingSeconds: 30, overlapSeconds: 0, restartPolicyType: "NEVER" },
    env: { DATABASE_POOL_MAX: preserve(), DATABASE_TLS_CA: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve() },
  });
  const resqStorageScan = service("resq-storage-scan", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node scripts/start-with-google-credentials.mjs dist/workers/storage.worker.js",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0 },
    env: { CLAMD_HOST: preserve(), CLAMD_PORT: preserve(), DATABASE_POOL_MAX: preserve(), DATABASE_TLS_CA: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve(), S3_ACCESS_KEY_ID: preserve(), S3_BUCKET: preserve(), S3_ENDPOINT: preserve(), S3_FORCE_PATH_STYLE: preserve(), S3_REGION: preserve(), S3_SECRET_ACCESS_KEY: preserve(), WORKER_HEALTH_HOST: preserve() },
  });
  const resqVolunteer = service("resq-volunteer", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/",
    healthcheckTimeout: 180,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 3 },
    env: { OPERATIONS_API_URL: preserve(), PORT: preserve(), SENTINEL_PORTAL_URL: preserve() },
  });
  const resqClamav = service("resq-clamav", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "deploy/railway/Dockerfile.clamav" },
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0, restartPolicyMaxRetries: 3 },
  });
  const resqWeb = service("resq-web", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/",
    healthcheckTimeout: 180,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 3 },
    env: { NEXT_PUBLIC_BACKEND_URL: preserve(), PORT: preserve() },
  });
  const resqDevices = service("resq-devices", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node scripts/start-with-google-credentials.mjs dist/workers/device.worker.js",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0 },
    env: { DATABASE_POOL_MAX: preserve(), DATABASE_TLS_CA: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve(), WORKER_HEALTH_HOST: preserve() },
  });
  const resqAdmin = service("resq-admin", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/",
    healthcheckTimeout: 180,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 3 },
    env: { OPERATIONS_API_URL: preserve(), PORT: preserve(), SENTINEL_PORTAL_URL: preserve() },
  });
  const resqBackup = service("resq-backup", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "deploy/railway/Dockerfile.backup" },
    replicas: { "sfo": 1 },
    deploy: { cronSchedule: "0 2 * * *", restartPolicyType: "NEVER" },
    env: { BACKUP_DATABASE_URL: preserve(), BACKUP_ENCRYPTION_KEY_B64: preserve(), BACKUP_S3_ACCESS_KEY_ID: preserve(), BACKUP_S3_BUCKET: preserve(), BACKUP_S3_ENDPOINT: preserve(), BACKUP_S3_REGION: preserve(), BACKUP_S3_SECRET_ACCESS_KEY: preserve(), DATABASE_TLS_CA: preserve(), S3_ACCESS_KEY_ID: preserve(), S3_BUCKET: preserve(), S3_ENDPOINT: preserve(), S3_FORCE_PATH_STYLE: preserve(), S3_REGION: preserve(), S3_SECRET_ACCESS_KEY: preserve() },
  });
  const resqMonitor = service("resq-monitor", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node scripts/start-with-google-credentials.mjs dist/workers/monitor.worker.js",
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { cronSchedule: "*/5 * * * *", drainingSeconds: 30, overlapSeconds: 0, restartPolicyType: "NEVER" },
    env: { DATABASE_POOL_MAX: preserve(), DATABASE_TLS_CA: preserve(), DATABASE_URL: preserve(), NODE_ENV: preserve(), READINESS_URL: preserve(), WORKER_HEALTH_URLS: preserve() },
  });
  const resqApi = service("resq-api", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node scripts/start-with-google-credentials.mjs dist/index.js",
    healthcheck: "/api/ready",
    healthcheckTimeout: 120,
    replicas: { "europe-west4-drams3a": 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0 },
    env: { COOKIE_SECURE: preserve(), CORS_ORIGIN: preserve(), DATABASE_POOL_MAX: preserve(), DATABASE_TLS_CA: preserve(), DATABASE_URL: preserve(), GOOGLE_CREDENTIALS_REQUIRED: preserve(), NODE_ENV: preserve(), PORT: preserve(), S3_ACCESS_KEY_ID: preserve(), S3_BUCKET: preserve(), S3_ENDPOINT: preserve(), S3_FORCE_PATH_STYLE: preserve(), S3_REGION: preserve(), S3_SECRET_ACCESS_KEY: preserve(), SENTINEL_USGS_ENABLED: preserve(), WEATHERNEXT_ACCESS_ENABLED: preserve() },
  });

  return project("ResQ / Volunteer Ops", {
    resources: [resqPostgres, resqMigrate, resqRetention, resqStorageScan, resqVolunteer, resqClamav, resqWeb, resqDevices, resqAdmin, resqBackup, resqMonitor, resqApi, resqPostgresVolume, resqRecovery, resqPrivateFiles],
  });
});
