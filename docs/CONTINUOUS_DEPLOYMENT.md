# Main-branch releases

The `Docker build` workflow runs its existing build, PostgreSQL/PostGIS migration rehearsal, tests, API-contract checks, production dependency audit and Docker smoke checks. After they pass, a push to `main` (or a manual run on `main`) releases that exact commit to Railway staging. Other branches and pull requests never deploy.

Project: `73690bd6-2d68-4ac7-9330-b5da3ebed8f0` (ResQ / Volunteer Ops).
Environment: `9de4cdd7-abad-4a36-ae1e-7577c06dc2d7` (staging).

Release order:

1. `resq-migrate` (`16e84c9b-9e0f-4729-973c-bc5393ad75c7`), using its dedicated migration Dockerfile and existing restricted database-owner credentials. The workflow waits for `MIGRATION_VERIFIED` from this exact deployment before proceeding; container startup alone is insufficient.
2. `resq-api` (`fb8c493f-bcdd-4883-acb3-9b0990b935ea`), retaining its current start command, region, runtime identity and `/api/ready` health check. The public readiness endpoint must also return success.
3. `resq-forecast` (`16009e4e-0edc-4d88-9625-225528fbb57f`), the existing active forecast worker, retaining its configured `/health` check and credentials.

The GitHub `railway-staging` environment permits only `main`. Its encrypted `RAILWAY_TOKEN` secret must contain a Railway project token scoped to this staging environment. Set it before the first release; rotate the Railway token and GitHub secret together. Runtime database credentials and Google/Meta keys remain in Railway, never in Actions.

Railway CLI is pinned to `5.62.1`. The deployment helper includes the GitHub commit SHA in each release message, polls the exact ID returned by the upload, and writes verified deployment links to the Actions summary. Failed, skipped, crashed, approval-pending or unverified deployments stop the release. Failed migrations prevent any new API or worker release. No automatic database rollback is attempted.

Runs for the same Git ref are serialized; new pushes do not interrupt active migrations or deployments. GitHub may replace an older pending run with the newest pending run. Rerun a failed job after resolving its cause, or manually dispatch the workflow on `main`.

Services that have not yet been commissioned (identity, devices, mail, retention, scanner, monitor and backup), PostgreSQL itself, ClamAV, and other repositories are not activated or redeployed by this pipeline. Add a service explicitly only after its runtime configuration and credentials are ready. Production remains separate.
