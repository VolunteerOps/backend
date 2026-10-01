# Stage 1 manual setup, credentials and recovery

Use [implementation evidence](stage-1-implementation.md) for what was actually completed. These instructions cover owner/account actions and repeatable maintenance; they do not mean those actions were already performed. Do not paste credentials into chat, Git, screenshots or this file.

## 1. Open the correct environment

1. Open [ResQ / Volunteer Ops](https://railway.com/project/73690bd6-2d68-4ac7-9330-b5da3ebed8f0).
2. Select **staging**. Its ID is 9de4cdd7-abad-4a36-ae1e-7577c06dc2d7. Production is 518a0e08-6417-467e-81ed-119d6d82b73d and has not received an operational cutover.
3. Verify the service/bucket inventory in the evidence document. Assign a primary operator and a backup operator; give each their own account/SSH key. Do not share the generated operator private key through Git.
4. Confirm Europe/Amsterdam placement is acceptable for your partners and future Google dataset. Record the decision before production.
5. Review the active services' actual usage. A successful deployment is billable infrastructure; the initial few cents of measured usage do not predict the eventual monthly bill.

CLI selection from backend:

~~~powershell
railway link --project 73690bd6-2d68-4ac7-9330-b5da3ebed8f0 --environment staging
railway status
railway usage --workspace f4981f6e-b5fe-473e-b56a-df00765687ce
railway usage limit status --workspace f4981f6e-b5fe-473e-b56a-df00765687ce
~~~

## 2. Understand the local .env and database tunnel

The active backend .env contains real staging values:

| Keys | Purpose and scope |
| --- | --- |
| DATABASE_URL | Restricted sentinel_api through localhost:15432 |
| DIRECT_URL | Migration owner through the same tunnel; never give it to API workers |
| DATABASE_TLS_CA | Trusted public CA PEM; keep TLS verification enabled |
| S3_* | Native staging private-file bucket; backend only |
| BACKUP_DATABASE_URL | Separate approved sentinel_backup login through localhost:15432 |
| BACKUP_ENCRYPTION_KEY_B64 | 32-byte AES-256-GCM key; needed to recover old backups |
| BACKUP_S3_* | Independent recovery bucket credentials; API does not receive these |

The original source environment and backups are preserved in ignored, ACL-restricted .sentinel-deploy/railway. Treat that directory as confidential. The active .env is not a complete enterprise secret vault; copy recovery keys into your controlled password manager/offline recovery record and protect the workstation. Do not delete the original source backup or old encryption keys merely because the new deployment works.

Local database URLs intentionally use **localhost**, because it is on the certificate. Start forwarding before running local code against staging:

1. Run railway ssh config --service resq-postgres --environment staging --dry-run to obtain the **current** SSH User value. Deployment-instance usernames may change after a database redeploy.
2. In a separate PowerShell terminal run the following, replacing CURRENT_SSH_USER with that value. The generated dedicated key is already registered; you can instead use your own registered key.

~~~powershell
ssh -N -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o UserKnownHostsFile=.sentinel-deploy/railway/known_hosts -i .sentinel-deploy/railway/operator_ed25519 -L 127.0.0.1:15432:127.0.0.1:5432 CURRENT_SSH_USER@ssh.railway.com
~~~

3. Leave that terminal running. Stop it with Ctrl+C after work. Do not expose a public database TCP proxy or replace verify-full with require/disable to work around a connection failure.
4. Railway service URLs use resq-postgres.railway.internal:5432. A localhost URL must never be copied unchanged into a cloud service.

## 3. Rotate or update backup credentials

The backup login is an explicit exception to tenant RLS for complete backup coverage. It has SELECT only, no table ownership, no superuser and no role/database creation. Never substitute DATABASE_URL with BACKUP_DATABASE_URL in API/worker services.

### Change the database password

1. Pause the backup schedule in Railway's resq-backup service settings while rotating (record the existing schedule: **0 2 * * *** UTC).
2. Generate a fresh random password in your password manager. Avoid reusing runtime or migrator passwords.
3. Open an operator psql session through Railway SSH:

~~~powershell
railway ssh --service resq-postgres --environment staging -i .sentinel-deploy/railway/operator_ed25519 -- gosu postgres psql -X -U resq_operator -d volunteerops
~~~

4. At the psql prompt use **\password sentinel_backup**. Enter the new password twice. This avoids embedding it in SQL history or shell arguments. Exit with **\q**.
5. Edit only the password component of BACKUP_DATABASE_URL in backend/.env. URL-encode special characters. Keep user sentinel_backup, host localhost, port 15432, database volunteerops and sslmode=verify-full. Do not change DATABASE_URL or DIRECT_URL.
6. Synchronize the backup-only allowlist. The script sends values over stdin, maps the local backup URL to the internal Railway host and prints no secrets:

~~~powershell
node --env-file=.env scripts/railway-sync-backup-env.mjs
railway redeploy --service resq-backup --environment staging --yes
railway restart --service resq-backup --environment staging --yes
~~~

7. Confirm BACKUP_COMPLETED in resq-backup logs and perform the recovery test below. Reinstate the daily schedule. A cron build being SUCCESS without a BACKUP_COMPLETED event is not a completed backup.

### Rotate recovery bucket credentials

1. In the staging recovery bucket, create/rotate a credential using the controls your Railway account provides. Keep independent file-bucket and recovery-bucket credentials.
2. Update BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY in .env. Update BACKUP_S3_ENDPOINT/REGION/BUCKET only if the destination itself changed.
3. Run the sync/redeploy/restart commands above and verify a new manifest can be read and restored.
4. Revoke the previous credential only after successful verification. If the provider offers only immediate rotation, pause backups and finish the update in the same maintenance window.

### Rotate the encryption key

1. **Archive the old BACKUP_ENCRYPTION_KEY_B64 securely first**, together with the manifest date range it decrypts. Losing it makes the old encrypted backups unrecoverable.
2. Generate 32 cryptographically random bytes, encode as base64, and replace BACKUP_ENCRYPTION_KEY_B64 in .env. A password/passphrase is not a substitute for the required 32-byte key.
3. Sync/redeploy/restart, then decrypt a new backup with the new key and an older backup with the archived old key.
4. Keep older keys until every backup encrypted with them has passed the approved retention period. Do not put key history into Markdown or Git.

### Update grants after schema changes

Apply deploy/database/backup-role.sql as the bootstrap operator after migrations that create schemas or change owners. Its default grants cover public/prisma_contract objects owned by sentinel_migrator. Recheck any newly introduced schema explicitly. The backup identity must continue to lack write/DDL privileges.

## 4. Recover database and evidence objects

Current backups are encrypted logical snapshots plus referenced completed-object bytes, written to the independent recovery bucket. They run daily at 02:00 UTC (05:00 Nairobi). **This is not WAL/PITR, and does not establish a five-minute RPO.** The 512 MiB dump / 1,000-object / 10 MiB-per-object limits are explicit failure thresholds; raise them only with resource/streaming tests as the product grows.

1. Select a successful manifest in the recovery bucket. Download the JSON manifest and its referenced .dump.enc object into a new folder under .sentinel-deploy. Use a recovery-authorized account, not the API credential.
2. Load the matching encryption key locally. Run:

~~~powershell
node --env-file=.env scripts/decrypt-backup.mjs .sentinel-deploy/RECOVERY/manifest.json .sentinel-deploy/RECOVERY/database.dump.enc .sentinel-deploy/RECOVERY/database.dump
~~~

The output must not already exist. GCM authentication, plaintext hash and length must pass before a dump is written.

3. Create a **new isolated** PostgreSQL 18/PostGIS restore database. Restore with pg_restore --exit-on-error --no-owner --no-acl; do not restore over active staging/production. Apply appropriate operator/runtime grants separately.
4. Run Prisma full schema verification with an explicit restore database URL. Use scripts/legacy-data-transfer.mjs verify against the preserved application-data.json only when comparing the migration checkpoint; later legitimate writes require a newer verification baseline. Check sequence positions and tenant/RLS tests too.
5. For each entry in manifest.objects, download its encrypted key, save that entry as a small JSON manifest, and use decrypt-backup.mjs again. Each entry contains the same cipher/IV/tag/hash/length fields required by the decryptor, plus original object ID/key/bucket metadata.
6. Upload recovered bytes to a **separate recovery file bucket** with conditional creation and checksum validation. Preserve the original object key layout. Verify each SHA-256 and length.
7. In the isolated restored database, deliberately map metadata to the recovery bucket and new ETag/version IDs. Do not assume an old version ID exists in another bucket. Re-scan/re-verify recovered evidence before enabling downloads. Review quarantined/pending metadata independently.
8. Run API authorization, two-organization storage, browser CORS and download tests against the restored environment. Record the time taken and any gaps. Only a separate reviewed cutover should repoint live services.
9. Keep the original database/bucket available until acceptance and retention decisions are complete. Database rollback alone cannot recover deleted object bytes.

Railway volume-backup scheduling returned Not Authorized through the current account/API. In the dashboard, inspect resq-postgres's volume Backup controls and enable supported daily/weekly snapshots if your role/plan allows it. Assign responsibility for testing them. Snapshots supplement the verified encrypted logical backup and do not prove WAL recovery. If five-minute RPO is required, implement and rehearse WAL archiving/restore before promising it.

## 5. Rotate PostgreSQL TLS and operator access

The server certificate is a 90-day staging leaf signed by a private CA with a one-year lifetime. Inspect exact notAfter values in .sentinel-deploy/railway/tls-staging/server.crt and ca.crt; schedule renewal well before expiry.

1. Keep the CA private key offline/private. Issue a replacement leaf containing DNS SANs resq-postgres.railway.internal and localhost. Retain the old material for rollback.
2. Update RESQ_DB_TLS_CERT_B64 and RESQ_DB_TLS_KEY_B64 on **resq-postgres only** using secret stdin or Railway variables. Never send the CA private key to runtime services.
3. If rotating the CA, first deploy a trust bundle containing both old and new public CA certificates to API, migrator, every worker, backup and local .env.
4. Redeploy the single database service in a maintenance window. Confirm the same persistent volume and PGDATA mount; do not add a second database replica against that volume.
5. Prove valid TLS, wrong-CA rejection and wrong-hostname rejection internally and through the operator tunnel. Then retire the old CA from client trust after the overlap period.
6. Register personal SSH keys for the two named operators. After confirming access and replacing the local forwarding setup, revoke the temporary Stage 1 operator key if it is no longer needed. Never remove your only working recovery path first.

## 6. Finish staging identity and secure ingress acceptance

No real FIREBASE_PROJECT_ID or Google/Firebase service-account credential was present in the initial environment. The code fails closed; a healthy database is not a completed sign-in deployment.

1. Create/select separate Firebase staging and production projects. Record real project IDs and register the actual Android IDs above. Decide final iOS/admin store identifiers before registering release apps; do not fabricate signing fingerprints.
2. Enable only approved identity providers. Configure staging authorized domains and action links; do not use the Auth emulator in NODE_ENV=production. Confirm institutional MFA/provider policy with the partner.
3. Create a narrowly permitted Firebase Admin service account. Store its JSON as GOOGLE_SERVICE_ACCOUNT_B64 on resq-api and the future identity worker, plus FIREBASE_PROJECT_ID. Set GOOGLE_CREDENTIALS_REQUIRED=true. The wrapper creates a private temporary ADC file and removes it on exit. Do not add admin credentials to any frontend build.
4. Create/configure resq-identity using deploy/railway/identity.service.json and the already-created sentinel_identity database login, then deploy it. Keep its database identity separate. Configure its private freshness check in the monitor after successful startup.
5. Use two dedicated staging identities/organizations to test bootstrap, allowed-provider/MFA checks, active membership, session creation/CSRF, suspension, revoke-all, and cross-organization HTTP/storage denial. Use the guarded owner bootstrap procedure; do not grant authority by matching a legacy email or global role.
6. Verify Railway's actual ingress trust boundary. Record the directly connected proxy addresses and supported forwarding-header behavior. Set TRUST_PROXY_CIDRS to only that verified boundary, then test forged X-Forwarded-For from the internet and separate real clients against rate limits. Never set trust proxy=true or an arbitrary hop count. Until this passes, IP rate limiting groups by direct peer and Stage 1 ingress acceptance remains open.
7. Recheck /api/health, /api/ready and /api/features. Confirm missing scientific/model providers remain disabled/unvalidated rather than labelled operational.

## 7. Monitoring destinations, budgets and operating ownership

1. Assign an on-call primary and backup, escalation interval, and approved notification destination. Configure Railway deployment/cron failure notifications or your selected log/alert integration. No message destination was invented or contacted by this implementation.
2. Route OPERATIONS_ALERT, STORAGE_ALERT, READINESS_ALERT, WORKER_FRESHNESS_ALERT, BACKUP_FAILED and failed identity revocations. Alert if no BACKUP_COMPLETED occurs within 26 hours, if no five-minute monitor run occurs within 15 minutes, or if worker progress is >90 seconds old.
3. Verify delivery to both operators using a labelled staging drill and record acknowledgement. A log entry alone is not an on-call notification.
4. Choose your monthly warning/hard-stop amounts. Railway workspace usage limits were unset. Set them in Billing/Usage, or use railway usage limit set --target workspace --soft AMOUNT --hard AMOUNT --workspace WORKSPACE_ID. A hard stop may stop services; choose that policy deliberately. Recheck actual per-service memory/CPU/volume/egress usage weekly.
5. Keep WEATHERNEXT_ACCESS_ENABLED=false until access and a per-query maximumBytesBilled budget are approved. Configure Google project budgets and future AI token budgets separately; Railway limits do not cap those providers.
6. Assign owners for retention, certificate renewal, secret rotation, backup restore and rollback. Keep this record in your private operations directory, not a public repository with personal phone numbers.
7. For audit export, create an independently managed TLS login and grant only sentinel_audit_export. Query resq_audit_export; it intentionally excludes narrative reasons, metadata payloads and actor identity. Do not grant it the API/migration/backup role. Store exports with separate access controls.
8. Keep drills inside staging and explicitly labelled. Stop relevant workers or disable provider feature flags to contain an incident; do not delete queued jobs or database volumes. Revert an application image only when its schema is backward compatible. Data rollback requires the isolated recovery procedure.

## 8. Domains and external provider setup

These are prepared requests, not evidence of approved accounts or submissions. Complete them while subsequent stages proceed.

| Dependency | Steps | Owning stage |
| --- | --- | --- |
| DNS/custom hosts | Confirm requested www.admin.resq-app.co.ke, app.resq-app.co.ke, api.resq-app.co.ke and apex/www policy; add each Railway custom domain; copy its exact CNAME/TXT records into your DNS account; verify TLS; then update exact CORS, bucket origins and Firebase action domains together. Keep production cutover gated. | 1/2/7 |
| WeatherNext / Google | Select project/billing owner, request dataset approval, confirm dataset region/license/derived-use terms, create least-privilege service account, set query cap; retain approval evidence. Google Weather API and WeatherNext are distinct products. | 1/5 |
| Mapbox | Create public app tokens restricted to final/staging origins; keep secret scopes backend only; verify attribution/licensing and usage budget. Supply the landing map endpoint's expected public configuration. | 1/3/5 |
| Transactional email | Select sender/provider, verify DNS SPF/DKIM/DMARC, configure staging sender, test bounce/complaint handling, nominate an operator. Firebase action email remains its supported flow. | 1/2/7 |
| RevenueCat/stores | Create separate sandbox/live apps; link actual store accounts and entitlements; decide prices, cancellation, transfer and essential-safety policy; supply real webhook/signing credentials through secret storage. | 1/4/7 |
| Institutional SSO | Obtain nominated admins, written partner approval, allowed domains/providers, MFA policy and SAML/OIDC metadata; test deprovisioning before enrollment. | 1/2 |
| Native delivery | Supply Apple team/APNs/signing identities and macOS build access; register Android release certificates; allocate physical phones for sensors, background limits, relay and push tests. | 1/6/7 |
| Scientific/legal review | Obtain data/model rights and reviewer-defined validation thresholds; record false-alarm/lead-time acceptance and notices. Do not turn unvalidated indicators into movement orders. | 1/5/6/7 |

## 9. Repeatable builds and deployment

1. Keep the four repositories' lockfiles and current changes together. Backend build: npm ci, npm run build, npm run test:types, npm run contracts:check. Tests require an explicitly disposable local database; do not aim SENTINEL_TEST_DATABASE_URL at staging.
2. For a local Docker test database, use the pinned PG18/PostGIS image from .github/workflows/docker-build.yml, bind port 55440 only to 127.0.0.1, choose a disposable password/database named sentinel_test, and set SENTINEL_TEST_DATABASE_URL with sslmode=disable. Run the canonical migrations and full verification before npm test. Tests refuse remote/non-test database URLs. The existing ignored .sentinel-test-pg installation is another local-only option.
3. KMP: run the wrapper with :shared:jsNodeTest :webApp:jsBrowserDistribution -PwebOnly=true; then node scripts/configure-sentinel.mjs and node scripts/verify-web-bundle.mjs. Configure OPERATIONS_API_URL without /api and SENTINEL_PORTAL_URL with /sentinel. Dependency changes may require an explicit reviewed kotlinUpgradeYarnLock.
4. Landing: npm ci, npm run typecheck, npm run build:railway. Keep complete preview assets. Deployment ignores caches/credentials; Docker builds the Next server, not a Vite/static export. If the full upload times out, run npm run railway:package in web; upload the printed artifacts/railway-* directory with --path-as-root --no-gitignore. This explicit safe build context deduplicates identical public assets; Docker restores hash-verified copies before building.
5. Before release, run scripts/scan-frontend-secrets.mjs against each built public asset directory from backend. Review .dockerignore/.railwayignore; do not include local keys, keystore.properties, .env or private backup folders.
6. Run the dedicated resq-migrate artifact first and confirm MIGRATION_VERIFIED. Deploy API/workers only with their own runtime credentials. Do not run migration owner credentials on API boot.
7. Deploy the selected staging service with railway up --service SERVICE --environment staging --detach. Poll deployment status and read logs; upload completion is not health acceptance. For sibling contexts, use the repository as --path-as-root or deploy from that repository with explicit project/environment.
8. Run object-store smoke, real browser storage checks, request/tenant isolation and worker recovery drills. Re-run them after ingress, bucket, credential, schema or image changes.
9. Refresh infrastructure code with railway config pull, then inspect railway config plan. Preserve secret placeholders and database single-replica/volume ownership. Do not copy the staging import directly into production or apply a plan that recreates populated resources.
10. CI definitions were added, but publishing commits, configuring repository secrets and running hosted CI remain your repository workflow. No existing user changes were committed automatically.

## Remaining Stage 1 owner gates

Real staging Firebase/identity-worker credentials and HTTP acceptance; verified ingress/client-IP handling; on-call delivery drill; explicit spending/retention/rotation ownership. Custom production DNS, store/provider/scientific approvals remain tracked later-stage dependencies. The foundation must not be represented as a completed operational or production release before its owning gates pass.
