# Private object storage setup skeleton

Step 1 documentation; trace S02/S04/S09/S10 in the [specification](sentinel-implementation-plan.md). **Existing object storage remains the media target; no public bucket or provider change authorized.**

| State | Current evidence |
| --- | --- |
| Implemented | Existing `src/modules/storage/storage.service.ts` uses S3 client/presigned operations and rejects missing configuration; existing storage keys were inspected. This is not evidence of organization-scoped Sentinel media security. |
| Owner action | Supply approved existing object-store account/endpoint/bucket/region and least-privilege credentials, private policies, CORS, lifecycle/backup and malware handling. |
| Blocked | Tenant-owned storage metadata/access rules, upload/download/scan contracts, owner configuration and isolation/restore evidence. |
| Verified | No object upload/download, ACL/CORS, malware handling, cross-org access or restore check ran here. |

## Required configuration and placement

Owner supplies `REQUIRED` values for current accepted `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in backend runtime secrets/environment consumed by `src/core/config.ts`; never put credentials into app bundles, signed URL logs or source. Record provider/account/project, data region/residency, private bucket policy, runtime/service identity, allowed app origins, signed URL TTL, upload size/type limits, scan/quarantine rules, lifecycle/backup/legal holds, key rotation and support owner. URL TTL/limits are required policy inputs, not newly implemented config keys.

Use the existing Prisma Object Store/S3-compatible integration; do not silently provision another service or make media public. Apply least-privilege bucket/prefix operations, HTTPS and restricted CORS. PostgreSQL stores scoped metadata/key, not large media. Server authorization must validate org/user/resource on upload, completion, download/export and background processing; a guessed object key is not permission. Composite ownership and metadata policies must replace any unscoped shortcut.

## Planned verification and recovery

Select documented provider tooling only after actual account/endpoint is known; no provider-specific CLI is assumed installed or implemented. Future exact storage API/CLI commands must use secured credentials and isolated test objects, not private media in logs. Owner console/manual evidence: private ACL/public-access restrictions, runtime privilege limits, allowed/denied CORS, expiring signed URL behavior, size/type allowlists, scan/quarantine/release and orphan/partial-upload cleanup.

Required tests: A user/org cannot upload/link/read another org's object, revoked membership loses new URL issuance, expiry bounds previously issued URL access, storage exports/jobs reauthorize, malformed media/oversize rejected and deletion/legal holds consistent. Existing signed URLs are bearer capabilities until expiry; do not claim instantaneous recall without verified provider support. Field reports support offline pending/partial retry with provenance; no raw audio uploaded/retained by default.

Rotate credentials through secret manager with least-privilege replacement; validate before retirement, review leaked URL/key impact and audit access. Rehearse bucket/media metadata restore together and enforce consent/hold/license expiry, including backup implications. No Google Weather copies in media/backup caches without explicit permitted retention. All runtime/security/provider verification is pending; no production cutover authorized.