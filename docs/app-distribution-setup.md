> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Public app distribution setup skeleton

Step 1 documentation; trace S06/S07/S08/S09/S10 in the [specification](sentinel-implementation-plan.md). **No client implemented, signed release uploaded, store enrollment completed or publication authorized here.**

| State | Current evidence |
| --- | --- |
| Implemented | Volunteer/admin handoff matrices and this checklist only; actual client package/build/config inspection remains pending. |
| Owner action | Supply real store accounts/app identifiers/signing/entitlements/domains, disclosures/test access, reviewer requirements and release approval. |
| Blocked | Both live clients/secure target flows, signed builds, provider and device checks, privacy/store review and scientific/operational activation gates. |
| Verified | No store, release-signing, install, FCM/SSO/App Link, device or iOS build/runtime check performed. |

## Required inputs and owner console actions

All `REQUIRED` for both apps: Play Console and App Store Connect legal/account owner; approved billing/enrollment; Android application IDs; iOS bundle/team IDs; debug/upload/release/Play signing identities and recovery owner; supported OS/SDK/target matrix; release version/build number/tracks/rollout policy; APNs/notification/associated-domain entitlements; public HTTPS app/auth/invitation/privacy/support/account-deletion origins; review contacts/test credentials under least privilege; screenshots/store descriptions/data-safety/permission disclosures; incident rollback contacts.

Owner enrolls accounts, registers actual apps, configures signing and test tracks/TestFlight where applicable, completes required testing/reviews and approves rollout. Public installation is compatible with restricted org admission; install link/app flavor/invite code confers no admin access. Do not impersonate partnerships or promise store approval timing/two-to-three-week readiness.

Signing keys/passwords, Apple signing/API credentials and CI service identities belong in secured developer/CI secret stores and platform signing services, never committed Gradle/Xcode files or chat. Client Firebase configs/public Mapbox tokens go into actual inspected app target configuration; private Admin/provider/SDK-download secrets never ship. Exact client source paths/build tasks remain blocked on workspace inspection, not invented here.

## Required disclosures and capability review

- Privacy/data-safety/account-deletion disclosures for both apps and required public web deletion entry point: verified recent reauth, retention/legal holds and completion audit, without denying self-service privacy rights.
- Explicit independent motion/pressure/mic/location/relay consents, visible microphone/foreground capture sessions, battery/background limitations, no raw-audio default upload and best-effort offline delivery. Report unsupported target features honestly.
- Current target-SDK permissions/foreground-service justifications and notification full-screen intent eligibility. Do not misclassify as alarm/calling app, bypass OS/user controls or promise DND override/wake-up/push arrival. High-priority push only for eligible visible urgent messages.
- Mapbox attribution/telemetry controls, native offline limits and Google Weather license gates; no unvalidated hazard probability/countdown or implied safe route/help dispatch. Preserve existing role-specific design and practice/live separation.

## Verification and recovery — pending

No release/build command is asserted before source/toolchain inspection. Record actual documented common/Android/JVM/JS/Wasm tasks and per-target results in [volunteer](sentinel-volunteer-implementation.md)/[admin](sentinel-admin-implementation.md); iOS compilation/runtime requires macOS and relevant devices. Build success alone does not validate responsive UI or store acceptance.

Owner real signed-build checks: install/update and session/cache migration, Firebase email/social/SSO/MFA flows with exact release/Play fingerprints and callbacks, APNs/FCM/web push receipt/actions/expiry, verified/deferred links with manual fallback, org admission/switch/revocation and logout isolation. Cover missing Play services, denied permissions/background limits, accessibility/responsive windows, Mapbox/offline and sensor/radio hardware gates. Use isolated test users/events, not emergency broadcasts.

Rehearse phased rollout halt/recovery using store-supported processes, secure signing-key rotation/recovery and revoked provider config. Prior incompatible offline queues/auth state need explicit reconciliation; reinstall or old app does not restore revoked authority. Store publication does not authorize model/region production activation or backend cutover.