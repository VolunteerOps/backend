# ResQ private S3 service — Railway fallback

This is an authenticated SeaweedFS 4.48 S3 service, with a persistent volume. It is a single-node deployment, not a managed multi-zone object-storage product. The database stores object metadata; the backend mediates access to private object bytes in this service.

Railway native buckets are the preferred candidate after the full signed-upload/integrity contract passes. If required behavior is unavailable, deploy this reviewed fallback as a Railway service with Dockerfile `deploy/object-store/Dockerfile`, persistent volume `/data`, explicit credentials and an HTTPS gateway. Follow [the Railway runbook](../../docs/railway-production-deployment-runbook.md) for service selection, capacity, region, backup and verification. This document does not provision it.

Required service environment variables:

- `S3_BUCKET`: the private bucket name, for example `resq-production`.
- `S3_ENDPOINT`: this service's public HTTPS origin, with no path.
- `S3_REGION`: `us-east-1` for the S3 signing region, independent of the chosen Railway region.
- `S3_ROOT_ACCESS_KEY_ID` and `S3_ROOT_SECRET_ACCESS_KEY`: distinct owner credentials, stored only on this service.
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: runtime credentials for the backend, restricted to read/write/list within this bucket.
- `S3_CORS_ORIGINS`: comma-separated HTTPS origins of the admin, volunteer, and Sentinel portals if browsers upload directly.
- `PORT`: use the Railway-assigned port; `10000` is the existing local default.

Generate independent random credentials; access keys must be 16-128 alphanumeric/underscore/hyphen characters, and secrets 32-256 non-whitespace characters. Do not reuse the owner credentials in the backend. Configure the backend with the same bucket/endpoint/region/runtime pair plus `S3_FORCE_PATH_STYLE=true`. Client apps receive signed object URLs through authorized backend requests; they never receive storage keys.

All SeaweedFS HTTP and gRPC listeners bind to loopback. WebDAV, IAM mutation, Iceberg, Lance, and the admin UI are disabled. The public Node gateway forwards only requests within the configured bucket and preserves the original Host, encoded path, query string, checksum and conditional headers required by AWS Signature V4. It never logs request URLs. Readiness performs an authenticated HEAD on the bucket with the runtime credentials. The temporary credential file is mode 0600 and is removed on orderly shutdown. Both Node and SeaweedFS run as uid/gid 1000 after initial ownership of the disk mount is established.

Configure Railway volume durability and an independently verified backup policy; no scheduled snapshot or recovery guarantee is assumed by this image. Disk snapshots are not a substitute for an independently tested object backup. A single disk prevents horizontal scaling and zero-downtime deploys. Establish an off-service backup and restore test before storing irreplaceable uploads. Database and bucket retention must be coordinated; no direct PostgreSQL-to-bucket network connection is required.

Local gateway verification: `node --test deploy/object-store/gateway.test.mjs`. This verifies configuration rejection, restricted identities, signed-request preservation, public-route isolation, upload limits, and readiness failure propagation. A local real SeaweedFS 4.48 integration smoke also passed: all 10 SeaweedFS listeners bound only to loopback; signed checksum-bound PUT, corrupt-content rejection, duplicate PUT rejection, HEAD, SHA-256 download verification, conditional attachment download and anonymous denial passed. The official Windows release was SHA-256 verified. Linux container and cloud deployment verification remain separate acceptance checks. After configuring the backend environment, run `node deploy/object-store/smoke.mjs --confirm-write` to repeat the provider check; it deletes only its fresh random probe object.

Verified primary references:

- [SeaweedFS 4.48 release](https://github.com/seaweedfs/seaweedfs/releases/tag/4.48)
- [Single-node deployment and proxy configuration](https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini)
- [Bucket-scoped credentials](https://github.com/seaweedfs/seaweedfs/wiki/S3-Credentials)
- [Railway volumes](https://docs.railway.com/volumes)
- [Railway buckets](https://docs.railway.com/storage-buckets)

The pinned existing SeaweedFS integration is an implementation artifact, not proof of a current cloud deployment. Revalidate image maintenance, Linux startup, integrity/CORS and restore behavior before using it for production.
