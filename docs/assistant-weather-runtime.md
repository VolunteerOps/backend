# Assisted weather runtime

Updated 1 November 2026. Google billing and WeatherNext bucket authorization remain pending with the project owner. Code and integration flags are enabled in staging so a new user request can execute once those external prerequisites are satisfied.

## Services

- `resq-api`: authenticated weather/mission conversations, Mapbox place search, BigQuery exploration, Python GCS/Zarr analytical subprocess, stored assessment history and existing resource planning.
- `resq-forecast`: consumes the existing `forecast` durable queue for Radar refresh. Start command: `node scripts/start-with-google-credentials.mjs dist/workers/forecast.worker.js`. `WORKER_HEALTH_HOST=0.0.0.0`, `PORT=3002`, health check `/health`. Health requires a successful queue round-trip within 90 seconds, not merely a live process.
- `resq-admin`: Next.js portal with 240-second rewrite proxy timeout, exceeding the weather workflow's 180-second deadline.

The worker uses service references for the API's `DATABASE_URL`, `DATABASE_TLS_CA` and `GOOGLE_SERVICE_ACCOUNT_B64`; it does not receive the Meta model key. The credential bootstrap writes a private temporary ADC file and removes the encoded credential from child process environment. The API's Python subprocess inherits the ADC location. Database connections verify TLS; no ownership or row-security bypass is added.

## Weather configuration

`WEATHERNEXT_PROJECT_ID=resq-25be9`, `WEATHERNEXT_BILLING_PROJECT_ID=resq-25be9`, `WEATHERNEXT_DATASET_ID=weathernext_3`, `WEATHERNEXT_LOCATION=US`, `WEATHERNEXT_ACCESS_ENABLED=true`.

`WEATHERNEXT_MAX_BYTES_BILLED=2000000000000` is a per-query maximum, not an aggregate assessment cap. The API additionally has `WEATHERNEXT_GCS_ACCESS_ENABLED=true` and `WEATHERNEXT_GCS_MAX_BYTES=1000000000`. The latter is divided across the windows in one turn. Provider loops retain finite request, row, time, memory and concurrency bounds.

The runtime Google identity is `resq-auth-staging@resq-25be9.iam.gserviceaccount.com`. It needs BigQuery Job User on the billing project and read access to the linked WeatherNext dataset, plus active billing/quota. GCS exploration needs object get and prefix-list access to `gs://weathernext3_statistics_spatial/weathernext_3_0_0_statistics/zarr/2026_to_present/`. The user's personal Google approval is not equivalent to this runtime identity's access. Listing is bounded by date prefixes.

The Docker image includes Python 3.13, pinned requirements from `scripts/weather-requirements.txt`, Xarray/Zarr/obstore/Google authentication and the reader `scripts/weather-zarr.py`. The subprocess executable is `WEATHERNEXT_PYTHON=/usr/local/bin/python3` with single-thread numerical execution. No runtime package install is required.

## Recovery and verification

After Google provisioning, submit a new daily briefing in Sentinel. Provider access is evaluated on each request, with no deployment needed for an external IAM or billing change. Failed billing/access BigQuery jobs can be recovered on later requests using a bounded recovery job ID. Completed jobs are reused and never reissued merely for recovery. There is no recurring paid weather scheduler.

Check the saved assessment's sources, forecast times, source availability and limitations. Success from both storage paths is not independent evidence: they hold the same WeatherNext model. Archived forecasts are not observations. The supported tool window is recent history (31 days) or short-range forecasts (15 days), with a maximum 14-day span. Seasonal ENSO and local flood-impact claims require additional datasets; do not infer them from short-range forecasts.

Verification: 34 targeted TypeScript tests; four real synthetic-Zarr tests; 91 browser tests. Live Meta Wonder and Spark structured/tool checks and Mapbox geocoding passed. No actual BigQuery/GCS numerical query was submitted in this implementation turn. Live weather results remain to be verified after provisioning.
