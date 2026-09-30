# ResQ documentation inventory and reconciliation

**Audit date: 1 October 2026. Scope: backend, volunteer, admin and public web.**

This records the source material behind the [seven-stage production roadmap](resq-production-implementation-roadmap.md). It distinguishes requirements, implemented code, historical verification and remaining delivery work. It is not another implementation plan or a certificate that the platform is production ready.

The inventory covers **59 original Markdown documents**: **33 backend, 10 volunteer, 8 admin and 8 web**. Newly written Railway guides, this audit, the consolidated roadmap and temporary agent working reports are not counted as original inputs. Nested screenshots, APK metadata and other binary evidence are addressed separately below.

## Reading and precedence rules

1. The owner's current request selects Railway, independent volunteer accounts, workspace recruitment and Pro access. It supersedes earlier hosting choices and blanket exclusions of a volunteer directory.
2. The [production roadmap](resq-production-implementation-roadmap.md) controls delivery sequence and explicitly reconciled scope. It has exactly seven stages; old step numbers are historical mappings, not additional stages.
3. The [full Sentinel specification](volunteerops-sentinel-disaster-engine.md) retains scientific, sensing, operational, privacy and screen requirements unless the roadmap explicitly supersedes a decision.
4. The [Railway production runbook](railway-production-deployment-runbook.md) controls hosting procedures. The [data migration and recovery guide](railway-data-migration-and-recovery.md) preserves source-data, role, restoration and rollback obligations.
5. Actual source establishes what is implemented. A dated verification record establishes only the checks it names against the named version/environment. Neither a checklist nor a passing compilation establishes a live provider integration.
6. Preserve design and historical evidence. Mark obsolete status statements clearly; do not rewrite an old test result into a current release claim.
7. References to removed documents appear below as inline paths rather than broken links. Kept documents and replacement homes are linked.

## Stage key

| Stage | Current delivery outcome |
| --- | --- |
| 1 | Railway, data integrity, security, contracts and operational foundations. |
| 2 | Independent identity, organizations, invitations, directory and profile sharing. |
| 3 | Scoped operational APIs and synchronized base applications. |
| 4 | RevenueCat, server Pro enforcement, paywalls and public offers. |
| 5 | Multi-source Sentinel, forecast/impact experience and scoped agent. |
| 6 | Native sensing, relay, safety delivery and human-approved mobilization. |
| 7 | Production verification, deployment, distribution and operational handover. |

Rows can map to multiple stages because a provider or screen has prerequisites and release checks. This does not create additional roadmap stages.

## Backend: all 33 original documents

Source directory: [backend docs](.). Status below is the reconciled audit interpretation, not a claim that every retained historical sentence is current.

| Original document | Topic and actual status/conflict | Disposition and current home | Stages |
| --- | --- | --- | --- |
| [app-distribution-setup.md](app-distribution-setup.md) | Store accounts, signing, permissions, disclosures and release verification. Skeleton predates client inspection and actual Android package changes. | Retain setup requirements with precedence note; roadmap distribution gates and actual sibling release guides govern execution. | 1, 6, 7 |
| [BACKEND_MASTER_IMPLEMENTATION_PLAN.md](BACKEND_MASTER_IMPLEMENTATION_PLAN.md) | Old whole-backend blueprint, 15 module families, PostgreSQL consolidation and unscoped endpoints. Contains obsolete hosting/version/auth assumptions and broad rewrite framing. | Replace with a short pointer to the canonical roadmap; preserve useful domain/search/queue/spatial/stream requirements in Stages 1–3 and 5–6. | 1–7 |
| `BACKEND_REWRITE.md` | Historical Supabase-to-Express/Prisma migration; local JWT/password routes, frontend polling and Netlify instructions are obsolete. | Remove. Preserve ID/data continuity and old-record quarantine in the [migration/recovery guide](railway-data-migration-and-recovery.md); live contracts in roadmap. | 1–3, 7 |
| [container-hosting-setup.md](container-hosting-setup.md) | API/worker separation, graceful shutdown, secrets and host placement; earlier implementation-unavailable claims predate worker code. | Retain provider-neutral checklist with precedence note; [Railway runbook](railway-production-deployment-runbook.md) selects the actual host. | 1, 6, 7 |
| [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) | Docs-level pointer described root deployment guidance as Prisma Compute/Postgres/Accelerate hosting. | Keep as a corrected Railway pointer; do not retain a competing hosting procedure. | 1, 7 |
| [dns-email-setup.md](dns-email-setup.md) | Domains, verified app/action links, invitation sender authentication, delivery/rotation checks. Mostly setup requirements. | Retain checklist; exact app hostnames and Railway CNAME/TXT/TLS in new runbook, invitation outbox in roadmap. | 1, 2, 7 |
| [enterprise-identity-setup.md](enterprise-identity-setup.md) | Institutional SAML/OIDC, assurance, credentials, provider rotation. Some server admission foundations now exist; live SSO remains unproven. | Retain detailed provider checklist and explicit owner inputs; Stage 2 governs implementations and bypass tests. | 1, 2, 7 |
| [firebase-setup.md](firebase-setup.md) | Firebase social/password identity, FCM and per-environment app registration. Original skeleton understates later backend and Android work. | Retain setup/secret-placement requirements with current-status precedence; separate implemented adapter from live provider proof. | 1–3, 6, 7 |
| [google-weather-setup.md](google-weather-setup.md) | Google Weather API coverage, retention, licensing and high-risk/derived-use gates. This is a distinct product from WeatherNext. | Retain policy/setup reference. Roadmap makes WeatherNext 3 primary; do not apply Weather API assumptions to WeatherNext or claim permissions without review. | 1, 5, 7 |
| [kenya-seasonal-readiness.md](kenya-seasonal-readiness.md) | County/basin preparedness, seasonal authority inputs, owners and drills. Dated context is not a current forecast. | Retain regional checklist; implement versioned campaigns with expiry/source evidence and licensed regional data. | 5–7 |
| [kubernetes-setup.md](kubernetes-setup.md) | Optional cluster alternative, manifests and cluster operations. No selected/proven cluster. | Retain explicitly optional reference; not a prerequisite or deployment destination for this Railway roadmap. | 1, 7 |
| [mapbox-setup.md](mapbox-setup.md) | Tokens/styles, GL JS/native adapters, privacy, attribution, offline limits and map/list accessibility. Old no-map-render claims are superseded by real web maps. | Retain platform/privacy requirements; use actual code and roadmap for missing native/operational layers and verified Railway origins. | 1, 3, 5–7 |
| [observability-setup.md](observability-setup.md) | Metrics, worker/source lag, traces, on-call, recovery and release evidence. Setup plan is not an installed monitoring system. | Retain required signals/owner inputs; implement and exercise them through Railway runbook and roadmap. | 1, 5–7 |
| [organization-onboarding.md](organization-onboarding.md) | Partner intake, provision/activate/verify lifecycle, nominees and readiness. Must not block independent personal volunteer signup. | Retain institution-specific requirements; separate personal identity from workspace admission under Stage 2. | 2, 7 |
| [platform-owner-bootstrap.md](platform-owner-bootstrap.md) | Initial privileged owner, secret handling, assurance, recovery and audit. Skeleton predates guarded bootstrap implementation. | Retain operator checklist; use actual platform operator code and current TOTP/grant rules, not legacy global roles. | 1, 2, 7 |
| `postgres-replacement-guide-v2.md` | General PostgreSQL consolidation essay, Prisma-hosted PG17.2 bridging and illustrative stack replacement claims. Not production verification. | Remove. Keep verified queue/RLS/spatial/search/data-recovery requirements in roadmap/migration guide; no unsupported PostGIS or PG18 emulation claims. | 1, 3, 5, 7 |
| [postgresql18-setup.md](postgresql18-setup.md) | PG18/PostGIS/TLS, roles, pooling, migrations and recovery. Old unavailable-tooling statements predate isolated PG18 tests. | Retain technical contract with precedence note; Railway image/volume/TLS configuration and measured recovery belong in new runbooks. | 1, 5, 7 |
| `prisma-personal-workspace-runbook.md` | Alternative Prisma Console/Compute/Object Store terminal deployment, managed-database compatibility gates and endpoint handoff. | Remove hosting procedure. Preserve source PG17.2 incompatibility, non-owner role and data-transfer checks in [migration guide](railway-data-migration-and-recovery.md); keep Prisma ORM tooling. | 1, 7 |
| `production-datastore-cutover.md` | Previous provider resource choices and billing failure; source backup, 2,004-row/16-table rehearsal, empty bucket checkpoint, grants and restore evidence. | Remove. Preserve migration evidence and its date/limits in [migration guide](railway-data-migration-and-recovery.md); do not treat old counts as permanent current inventory. | 1, 7 |
| `render-production-deployment-runbook.md` | Former production blueprint, PG/TLS, private S3 service, API/worker/retention, Google/Firebase and endpoint handoff. Blueprint validation did not provision production. | Remove and replace with [Railway production runbook](railway-production-deployment-runbook.md). Preserve provider-neutral security, dependency, migration and recovery requirements. | 1, 5–7 |
| `RENDER_DEPLOY.md` | Short pointer to the former provider/pilot templates and selected workspace. | Remove; [Railway production runbook](railway-production-deployment-runbook.md) is the only active hosting procedure. | 1, 7 |
| [sentinel-admin-implementation.md](sentinel-admin-implementation.md) | Admin forecast/radar, evidence, impact, assistance, approval and activation screen matrix; web portal slice exists, most native/live command integration does not. | Retain detailed screen requirements and checkpoint limitations; map actual app files/contracts through roadmap appendices. | 2–7 |
| [sentinel-android-sensing-and-relay.md](sentinel-android-sensing-and-relay.md) | Sensor capture, consent, Android lifecycle, fusion, Nearby envelopes, trust/dedup/TTL and verification. Predominantly planned. | Retain protocol/privacy/hardware specification; Stage 6 requires actual adapters, device tests and receipts rather than more documentation. | 1, 5–7 |
| [sentinel-api-contracts.md](sentinel-api-contracts.md) | Planned records/endpoints/error/idempotency/stream envelopes. Skeleton differs from currently implemented prefixes and code. | Retain requirements, label implemented versus planned using versioned OpenAPI and current route inventory; no fictional existing API. | 1–6 |
| [sentinel-continuation-status.md](sentinel-continuation-status.md) | 30 September implementation/test ledger; 0/7 old steps complete; PG18 tests, auth/RLS/storage/forecast/portal slices. Old deployment target is superseded. | Retain dated evidence and remaining scope with Railway precedence; roadmap starting point is current planning baseline. | 1–7 |
| [sentinel-implementation-plan.md](sentinel-implementation-plan.md) | Requirement traceability and old seven-step delivery ledger; early 72-test, HTTP-not-cut-over, tooling/client-unavailable statements are stale. | Retain detailed requirements with precedence banner; execution order/status governed by new roadmap and dated continuation evidence. | 1–7 |
| [sentinel-model-validation.md](sentinel-model-validation.md) | Software versus scientific evidence, activation modes, field/relay tests, latency/capacity/recovery targets. Scientific gates remain open. | Retain detailed validation reference; no synthetic/unit-test result substitutes for model calibration or real operational latency. | 1, 5–7 |
| [sentinel-operations-runbook.md](sentinel-operations-runbook.md) | Incident actions, tenant/data/privacy gates, worker/source recovery and activation checklist. Early all-unimplemented status is stale. | Retain operational requirements with precedence; executable Railway procedures and measured evidence must be added during implementation. | 1, 5–7 |
| [sentinel-organization-admission.md](sentinel-organization-admission.md) | Implemented platform grants, memberships/invites, assurance/RLS and 105-test PG15 fixture evidence. Later PG18 evidence supersedes its environment baseline. | Retain exact delivered admission behavior/tests; extend it for personal accounts, directory/share/join workflows rather than invent a weaker parallel acceptance path. | 1, 2, 7 |
| [sentinel-setup-and-activation.md](sentinel-setup-and-activation.md) | More recent setup: BigQuery, Firebase browser portal, Mapbox, read-only assistant, API inventory and seven-step gaps. Contains former-provider deployment sections. | Retain feature/provider activation reference with Railway precedence and links; remove/mark obsolete host-specific instructions instead of treating them as current commands. | 1, 2, 5–7 |
| [sentinel-volunteer-implementation.md](sentinel-volunteer-implementation.md) | Volunteer insights/safety/sensing/privacy/offline/responsive screen matrix; portal bridge exists, native operational workflows largely missing. | Retain detailed role-specific requirements; reconcile newer Android Firebase/mobile RevenueCat work and standalone-user journey in roadmap. | 2–7 |
| [storage-setup.md](storage-setup.md) | Implemented scoped metadata/presigned upload-completion-download contract, checksums/no-overwrite/ETag and authorization. Sharing/scanning/orphan lifecycle remain incomplete. | Retain actual API/integrity boundary; validate Railway storage compatibility and add explicit reviewer/resource sharing, not admin blanket access. | 1, 3, 6, 7 |
| [volunteerops-sentinel-disaster-engine.md](volunteerops-sentinel-disaster-engine.md) | Detailed engine/enterprise/sensing/relay/screens/source/model/safety specification. Hosting, directory ban and account holding-state decisions require explicit reconciliation. | Retain authoritative domain specification under current roadmap precedence; preserve every scientific/operational requirement and original-step mapping. | 1–7 |

## Volunteer: all 10 original documents

Source directory: [volunteer docs](../../volunteer/docs). Current implementation is Kotlin/Compose Multiplatform, with Android Firebase and Android/iOS RevenueCat slices but a local operational repository.

| Original document | Topic and actual status/conflict | Disposition and current home | Stages |
| --- | --- | --- | --- |
| [ANDROID_RELEASE.md](../../volunteer/docs/ANDROID_RELEASE.md) | Current source ID `com.resq.app`, version 1.0/code 1, AAB signing and preservation of runtime resources. Conflicts with earlier installed package/version records. | Retain with reconciliation note; confirm actual store listing/signing and next version before release. | 1, 4, 7 |
| [DEVICE_VERIFICATION.md](../../volunteer/docs/DEVICE_VERIFICATION.md) | 6 September physical Pixel Fold APK/hash/install proof and source-location diagnosis. | Retain immutable historical evidence; it does not test current backend, subscription, push or sensors. | 3, 6, 7 |
| [IMPLEMENTATION_PLAN.md](../../volunteer/docs/IMPLEMENTATION_PLAN.md) | Completed responsive redesign/local-state milestone and outstanding backend contracts. Checkboxes are not production completion. | Retain with historical/roadmap banner; current roadmap covers every useful workflow. | 2–7 |
| [INSTALLATION.md](../../volunteer/docs/INSTALLATION.md) | Non-destructive debug install/source mismatch; old `com.example.volunteer` and 1.1.0/code 2 identity. | Retain diagnosis as history, flag mismatch and refer current release guide; no uninstall/data-loss shortcut. | 7 |
| [MIGRATION.md](../../volunteer/docs/MIGRATION.md) | All local screen/action coverage, design and honest remote-delivery/training limitations. Android auth/Mapbox statements predate later slices. | Retain with current-status note; actual code and roadmap govern adapters/contracts. | 2–7 |
| [ONBOARDING.md](../../volunteer/docs/ONBOARDING.md) | Illustrated introduction, optional setup, Firebase verification/recovery; old all-unconfigured/member-only language is stale. | Update status to Android adapter versus missing gateway/root; add independent signup, invitation and multi-workspace requirements. | 2, 7 |
| [REFINEMENTS.md](../../volunteer/docs/REFINEMENTS.md) | 1.2.0 visual refinement, safe areas, modals, motion and emulator results. Version differs from current source. | Preserve dated visual evidence, add version/status note; repeat accessibility/device checks for actual release. | 3, 6, 7 |
| `volunteer/docs/RENDER_INTEGRATION.md` | Former static-site build, injected origins, iframe/native portal distinction and unsupported browser subscriptions. | Remove and replace with [RAILWAY_INTEGRATION.md](../../volunteer/docs/RAILWAY_INTEGRATION.md), preserving valid build/session constraints. | 1, 3, 4, 7 |
| [REVENUECAT.md](../../volunteer/docs/REVENUECAT.md) | KMP mobile SDK/paywall/restore/Customer Center, `resq_pro`, UID binding, test evidence and backend TODOs. Durations are not separate feature tiers. | Retain/update current shared billing contract; add backend/web/admin authority, webhook reconciliation and real-store gates. | 2, 4, 7 |
| [VERIFICATION.md](../../volunteer/docs/VERIFICATION.md) | Historical repository/build/visual checks; explicit iOS/live-delivery limits. | Retain original results with historical status note; record new checks by version/environment only after execution. | 3, 6, 7 |

## Admin: all 8 original documents

Source directory: [admin docs](../../admin/docs). Operational screens remain practice workflows; Firebase/membership defaults are unconfigured. The web Sentinel bridge is a separate integration surface.

| Original document | Topic and actual status/conflict | Disposition and current home | Stages |
| --- | --- | --- | --- |
| [DEVICE_VERIFICATION.md](../../admin/docs/DEVICE_VERIFICATION.md) | Physical Pixel Fold 1.1.0/code 2 install/hash proof. Not current admin 1.3.0/code 4 verification. | Retain dated evidence and source-match procedure; no claim of current cloud authentication. | 3, 7 |
| [IMPLEMENTATION_PLAN.md](../../admin/docs/IMPLEMENTATION_PLAN.md) | Completed local redesign, all operational UI areas, responsiveness and earlier backend gaps. | Retain with historical banner; use current seven-stage roadmap for actual completion. | 2–7 |
| [INSTALLATION.md](../../admin/docs/INSTALLATION.md) | Staged versus original source diagnosis, safe install and old version identity. | Retain historical troubleshooting; current README/source and future signed release record govern release version. | 7 |
| [MIGRATION.md](../../admin/docs/MIGRATION.md) | People/mission/resource/map/communications/analytics/security/help screen coverage and local boundaries. | Retain with historical status banner; replace all production local mutations through scoped APIs. | 2–7 |
| [ONBOARDING.md](../../admin/docs/ONBOARDING.md) | Corporate identity, optional setup, membership authority, verification/recovery and no sample login masquerade. Legacy backend JWT claim is stale. | Update current backend/hosting wording; preserve institutional admission and actual authenticated-root requirement. | 2, 7 |
| [REFINEMENTS.md](../../admin/docs/REFINEMENTS.md) | 1.2.0 navy header/insets/modals/motion/emulator evidence. Source is now 1.3.0/code 4. | Retain dated design verification; do not promote to current installed/native-iOS proof. | 3, 7 |
| `admin/docs/RENDER_INTEGRATION.md` | Former build/publish settings, injected URLs, same-origin portal constraints and native limitations. | Remove and replace with [RAILWAY_INTEGRATION.md](../../admin/docs/RAILWAY_INTEGRATION.md), including exact `www.admin.resq-app.co.ke`. | 1–4, 7 |
| [VERIFICATION.md](../../admin/docs/VERIFICATION.md) | Historical Gradle/domain/visual evidence and unsupported-platform limits. | Preserve; future release matrix must verify actual live data, paywall and device behavior. | 3, 6, 7 |

## Public web: all 8 original documents

Source directory: [web docs](../../web/docs). This is the Next.js public site, separate from both Compose operational apps. Its real maps and app previews are not operational dispatch functionality.

| Original document | Topic and actual status/conflict | Disposition and current home | Stages |
| --- | --- | --- | --- |
| [DEVICE_VERIFICATION.md](../../web/docs/DEVICE_VERIFICATION.md) | Shared historical mobile package proof; no current website/backend production claim. | Retain dated cross-project evidence. | 7 |
| [IMPLEMENTATION_PLAN.md](../../web/docs/IMPLEMENTATION_PLAN.md) | Cross-app local redesign and public-route migration. Completed design checkboxes predate full-platform requirements. | Retain with historical banner; roadmap governs live account, billing and operation completion. | 2–7 |
| [MIGRATION.md](../../web/docs/MIGRATION.md) | Preserved public routes, demos, contact/release boundaries and artwork. | Retain with current-roadmap precedence; mark historical backend assumptions appropriately. | 3, 4, 7 |
| `web/docs/RENDER-DEPLOYMENT-RUNBOOK.md` | Previously live public-site release, commit, build/start/env, complete Compose bundles, checks and rollback. | Remove; preserve neutral migration-baseline facts in [RAILWAY_DEPLOYMENT.md](../../web/docs/RAILWAY_DEPLOYMENT.md), not a second provider runbook. | 1, 3, 7 |
| `web/docs/RENDER-MANUAL-STEPS.md` | Old provider project-placement and health-check settings. | Remove. Railway guide supplies current domain, health, variable, verification and cutover work. | 1, 7 |
| `web/docs/RENDER-MCP-SETUP.md` | Old MCP OAuth/tool limits and service creation record. Not product behavior. | Remove provider setup instructions; retain only needed deployed artifact/resource identity in new website guide. | 1, 7 |
| [RESQ-DESIGN.md](../../web/docs/RESQ-DESIGN.md) | Implemented ResQ palette/Oswald/Overlock, real Mapbox, 20 public routes, real Compose previews/screenshots, accessibility and Figma-access limits. | Retain as current web-design evidence; reconcile root legacy `DESIGN.md` Inter text during product work. | 3, 4, 7 |
| [VERIFICATION.md](../../web/docs/VERIFICATION.md) | Historical route/mobile/keyboard/website build evidence, not current provider checks. | Retain; add new release evidence without overwriting historical outcomes. | 3, 4, 7 |

## Source-code evidence used to resolve disagreements

These observations were read from source; no runtime tests or store/provider purchases were executed by this documentation audit. Paths link to inspected files or directories, not proposed implementations.

| Evidence | Observed fact and implication | Roadmap home |
| --- | --- | --- |
| [Backend application](../src/app.ts), [auth](../src/modules/auth), [middleware](../src/middleware) | Firebase-based HTTP/session foundations exist; old global operational endpoints remain intentionally gated. A legacy API example does not authorize re-enabling them. | 1–3 |
| [Database readiness](../src/core/database-readiness.ts) | Runtime checks require PG18, PostGIS, verified production TLS and non-owner/non-privileged roles. A generic database provision cannot be called compatible without checks. | 1, 7 |
| [Organizations](../src/modules/organizations), [platform](../src/modules/platform) | Membership/region/assurance and guarded owner operations exist. Independent profile/directory/share workflows require extensions, not privilege shortcuts. | 2 |
| [Jobs](../src/core/jobs.ts), [workers](../src/workers) | Persistent claims, leases, fencing, retries and bounded handler execution exist. Scheduling, external side-effect recovery and urgent-load behavior still need completion. | 1, 5, 6 |
| [Scoped storage](../src/modules/scoped-storage) | PostgreSQL metadata plus S3 bytes is already implemented, with size/checksum/conditional request checks. Malware, orphan lifecycle and report/reviewer sharing remain gaps. | 1, 3 |
| [WeatherNext BigQuery](../src/modules/sentinel/providers/weathernext3.bigquery.ts), [USGS](../src/modules/sentinel/providers/usgs.ts) | Real adapter code exists for bounded WeatherNext queries and USGS observations. No GCS/Zarr implementation or evidence of approved live WeatherNext access. | 5 |
| [Sentinel agent](../src/modules/sentinel/sentinel.agent.ts) | Scoped read-only evidence assistant exists. It is not a completed operational action executor or proof of a configured live AI call. | 4–6 |
| [Volunteer composition root](../../volunteer/shared/src/commonMain/kotlin/com/example/volunteer/App.kt), [volunteer data](../../volunteer/shared/src/commonMain/kotlin/com/example/volunteer/core/data) | Root still chooses the local sample repository. Remote profile/mission/message/report/training functionality cannot be inferred from interactive screens. | 2, 3 |
| [Volunteer Android auth](../../volunteer/androidApp/src/main/kotlin/com/resq/app/auth), [shared auth](../../volunteer/shared/src/commonMain/kotlin/com/example/volunteer/features/auth) | Android Firebase adapter exists, but the shared database gateway/authenticated live root and other target providers are incomplete. | 2 |
| [Volunteer Gradle](../../volunteer/shared/build.gradle.kts), [RevenueCat guide](../../volunteer/docs/REVENUECAT.md) | RevenueCat native core/UI are Android+iOS-specific. Native compilation does not provide browser/JVM purchase adapters or backend entitlement authority. | 4 |
| [Volunteer Android source](../../volunteer/androidApp/src/main), [Android build](../../volunteer/androidApp/build.gradle.kts) | One-shot location permission/use is distinct from absent native sensor/Nearby/push capture pipelines; current package/version differs from old installed evidence. | 6, 7 |
| [Admin root](../../admin/shared/src/commonMain/kotlin/com/example/admin/App.kt), [AdminRepository](../../admin/shared/src/commonMain/kotlin/com/example/admin/core/data/AdminRepository.kt) | Overview/People/Missions/messages/resources/insights/security use sample state and local mutations. A production transport and repository graph are required. | 2, 3 |
| [Admin identity](../../admin/shared/src/commonMain/kotlin/com/example/admin/features/auth/IdentityGateway.kt) | Firebase and database interfaces default to explicit unconfigured adapters. No admin native/web RevenueCat setup was found. | 2, 4 |
| [Admin web entry](../../admin/webApp/src/webMain/kotlin/com/example/admin/main.kt), [native Sentinel](../../admin/shared/src/commonMain/kotlin/com/example/admin/features/sentinel/SentinelScreen.kt) | Web embeds backend portal; native opens browser. Marketing preview also exposes Sentinel navigation, requiring deliberate fixture/isolation or labelled handoff policy. | 3–5 |
| [Admin build](../../admin/settings.gradle.kts), [web target](../../admin/webApp/build.gradle.kts) | `webOnly=true` permits a JS distribution without Android/iOS toolchains. It still needs a verified Railway HTTP/static hosting configuration and complete resources. | 1, 3, 7 |
| [Public package](../../web/package.json), [Next config](../../web/next.config.mjs) | Next/React Node runtime and API rewrites are actual implementation. Old Netlify/Vite `dist` deployment instructions are incompatible. | 1, 3, 7 |
| [Public routes](../../web/src/lib/publicPages.ts), [access page](../../web/src/components/pages/AccessPage.tsx) | Twenty public routes exist; account pages are app gateways. Pricing and actual authenticated portal handoffs remain work. | 2–4 |
| [API examples](../../web/src/lib/apiReference.ts) | Public examples still advertise password login and unscoped event/deployment endpoints; regenerate from implemented contract before launch. | 1, 3, 7 |
| [Contact form](../../web/src/components/ContactSection.tsx), [API transport](../../web/src/lib/apiClient.ts) | Form performs an actual backend request and preserves failures. Intercepted browser success tests do not prove deployed contact delivery. | 3, 7 |
| [Public maps](../../web/src/components/maps), [map configuration](../../web/src/app/api/maps/config/route.ts) | Real Mapbox ResQ terrain, attribution and failure handling exist. Config exposes only public `pk.` tokens; map rendering is not proof of live team tracking. | 3, 5, 7 |
| [Web legal pages](../../web/src/components/pages) | Terms/privacy retain Swiss/Geneva/FDPIC and old contact details. Owner-approved entity/jurisdiction/contact/processor/billing text must replace unsupported facts. | 4, 7 |

## Material conflicts resolved by the roadmap

| Conflicting material | Resolution |
| --- | --- |
| Render versus Prisma Console versus Railway guides | Railway is selected. Remove former hosting documents, retain provider-neutral recovery evidence and Prisma ORM usage. |
| No HTTP Firebase / no client work / only 72 tests | Historical early snapshot. Later code and dated continuation records show implemented slices; live-provider success remains separate. |
| PostgreSQL unavailable or only 15.5 | Historical tooling snapshot. Isolated PG18/PostGIS tests were later recorded; the user's old PG15 installation/data was not thereby upgraded or removed. |
| All seven steps complete versus polished demo screens | No evidence supports full completion. Current roadmap requires all backend/frontend/manual/evidence gates, including native sensing and operational response. |
| Mandatory workspace membership before any volunteer use | Independent personal account is required; organization-private operations still require membership. |
| Blanket no-directory rule versus owner-requested directory | Add a purpose-built discoverable projection with opt-in fields and controlled recruitment; do not expose all private authentication/tenant records. |
| Sharing profile means coordinator can add silently | Share permits viewing allowed fields and inviting; acceptance remains the volunteer's explicit audited action. |
| Purchase means admin or organization-wide access | Entitlements, identity, workspace membership, permissions and data licensing are separate checks. Organization sponsorship requires explicit seats/grants. |
| Monthly/yearly/lifetime equal three implemented tiers | They are existing purchase durations for `resq_pro`. Final tier prices/features/limits remain commercial inputs. |
| Native RevenueCat gate proves protected API | It controls only client presentation today. Backend entitlement checks and direct-endpoint bypass tests are required. |
| Weather API / WeatherNext 2 VMG / WeatherNext 3 are interchangeable | WeatherNext 3 hourly BigQuery/GCS is primary forecast input; other Google products have distinct schema, access and licensing requirements. |
| API/browser portal completes native apps | Native operational repositories, identity, maps, sensing and safety flows remain explicit deliverables. |
| A map baselayer demonstrates disaster prediction | Spatial rendering, forecast data, hazard inference, scientific validation and official warning authority are separate evidence layers. |
| Personal profiles replace workspace dossiers | Global volunteer identity/profile and consented discovery remain separate from private qualifications, mission history and organizational notes. |
| Old version/hash proves current store-ready artifact | Match the actual current package, signing lineage, increasing version, build artifact and release track; retain old hashes only as history. |

## Verification classification and limits

- **Implemented:** an inspected code path exists. It may still need configuration, tests, other targets or provider approval.
- **Historically verified:** a dated source document records a particular check against a particular artifact/environment. This audit did not rerun it.
- **Planned:** a requirement, proposed endpoint/model, screen or procedure remains implementation work. Names in the roadmap do not create code.
- **Manual dependency:** an owner/provider must supply an actual account, project ID, approved dataset, legal/commercial decision, signing identity or DNS record. Do not invent values or mark it done from a template.
- **Production verified:** requires the roadmap's current live-domain, authorization, payment, provider, device, load, restoration and operational sign-off evidence. No such blanket status is asserted here.

Important historical evidence retained through the migration guide includes 2,004 source application rows across 16 tables, fingerprints/sequence preservation, the zero-object bucket checkpoint and PG18 restore/schema rehearsal. These are checkpoints to repeat against fresh source state, not acceptance constants for future databases.

Recorded 72/94/105/122 backend-test counts and 13/19/20/28 client checkpoints describe different revisions/scopes. Preserve their dates and limits rather than adding them together or selecting the largest count as proof of current readiness. Live Firebase, store transactions, authorized WeatherNext calls, native device behavior and scientific validity require separate evidence.

Screenshots under sibling docs, installed APK JSON files and hash records are historical binary assets. Preserve provenance, exact package/version and date. A captured screen is not proof of backend synchronization, remote message delivery, payments, map telemetry or a signed public release. Windows compilation does not establish iOS/macOS runtime validation.

## Files outside the docs inventories

- Root READMEs and backend root `DEPLOYMENT_RUNBOOK.md` should link the canonical roadmap and Railway guides. Their old provider/script names are not new hosting choices.
- `.junie/plans/volunteerops-sentinel-disaster-engine.md` is a duplicate historical plan source. Point it at `docs/volunteerops-sentinel-disaster-engine.md` and the new roadmap rather than maintaining two independently authoritative specifications.
- Preserve app `DESIGN.md` requirements and image provenance. Public web's legacy Inter specification conflicts with implemented Oswald/Overlock direction in `RESQ-DESIGN.md`; resolve the design documentation during frontend completion, not by silently redesigning apps.
- Existing provider-named YAML, package scripts, CI workflows, Compute artifacts and source default origins were not converted by this documentation task. List/replace them during Stage 1/3 implementation, prove Railway equivalents, and rebuild compiled previews to remove stale URLs.
- Admin/volunteer `scripts/render-build.sh`, public URL injection and artifact validation contain reusable behavior. Rename/extract only while preserving toolchains, validations, complete JS/Wasm resources and public/secret boundaries.
- Public `render.yaml`, `netlify.toml`, `build:render`/`start:render` and packaging scripts require deliberate replacement. A Next server cannot be migrated by pointing a static host at nonexistent Vite output.
- Ignore local credential/backups/research caches as deployment inputs. Do not reproduce `.env`, keystore passwords, cloud credentials or saved authenticated connection material in documentation.

## Cleanup accounting and completion criteria

The requested retirement set is **11 provider/obsolete architecture documents**: six backend files listed above, one volunteer integration guide, one admin integration guide and three public-web provider guides. The old backend master plan becomes a pointer rather than a competing blueprint. Remaining detailed setup/specification/design/test files are kept with current-authority notes or corrected links.

Replacement navigation is:

- [ResQ seven-stage roadmap](resq-production-implementation-roadmap.md).
- [Railway production deployment](railway-production-deployment-runbook.md).
- [Railway data migration and recovery](railway-data-migration-and-recovery.md).
- [Volunteer Railway integration](../../volunteer/docs/RAILWAY_INTEGRATION.md).
- [Admin Railway integration](../../admin/docs/RAILWAY_INTEGRATION.md).
- [Public website Railway deployment](../../web/docs/RAILWAY_DEPLOYMENT.md).

Documentation acceptance requires all retained relative links to resolve, no active instructions pointing to deleted hosting guides, a clear historical label on old status claims, and unchanged original test/image evidence. The documentation task does not deploy Railway or remove existing cloud services. Resource retirement happens only after the roadmap's migration, verification and recovery window.

Every newly implemented feature must subsequently record backend route/migration, client destinations/platform support, permission/entitlement policy, tests and manual provider state against its roadmap work package. This keeps the next implementation pass from recreating scattered and contradictory completion claims.
