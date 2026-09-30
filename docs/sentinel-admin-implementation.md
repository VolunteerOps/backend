> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Admin Sentinel implementation checkpoint

Updated 30 September 2026. See [current status](sentinel-continuation-status.md) and [setup/activation](sentinel-setup-and-activation.md) for tested behavior and remaining work.

Implemented in the admin workspace: a Sentinel destination in the existing Compose navigation; a web portal adapter with a full-page option; runtime configuration of the portal URL; and replacement of the drawn deployment-map mockup with the geographic adapter/list fallback. The portal uses the landing site's ResQ Mapbox style and Overlock/Oswald fonts, hourly forecast layers, source revisions, region policy forms and a scoped evidence assistant.

Both JavaScript/Wasm compilations and common JVM tests passed. The browser explorer has separate desktop/mobile tests. Positive live Firebase, WeatherNext and Gemini verification remains pending; Mapbox rendered successfully against the configured public token.

The existing practice repository remains explicitly local. Native map SDKs and live native repositories, the complete platform/organization console, safety, mobilization and the remaining command screen matrix are **unfinished**. A navigable web forecast slice does not complete Steps 2 or 7. The matrix below is the retained full-scope design.


## Shared design, context and state contract

Preserve the existing navy command header, light readable surfaces, Oswald/Overlock, vector icons and Overview/People/Missions/Messages/More bottom navigation with wide rail. Inspect/reuse actual shared tokens/navigation/state components, not invented APIs. Keep labeled practice mode separate from live data.

Every sensitive screen persistently distinguishes Platform versus Organization and active institution/unit/region. Successful Firebase login is not admission. Organization admins never gain platform grants or cross-organization private data. New code is released normally; feature controls are not SQL/source editors or model-certification overrides.

Every matrix row inherits window-based compact `<600 dp` stacked/card/list-detail and map-list toggle; medium `600â€“839 dp` rail/one-two columns or compact if cramped; expanded `>=840 dp` bounded rail/list-map-detail/table panes. Prefer existing inspected breakpoints. Filters in bounded sheets on compact; dense tables become labeled cards. Preserve drafts/filter/selection/camera/scroll on resize; safe keyboard/insets/back/history/focus, â‰¥48 dp targets, labels/text+icons/contrast, 200% text/zoom/reduced motion. No squeezed columns/status-bar overlap/page overflow or focus-stealing streams. Map and list share selection and essential information.

All routes need loading/empty/retry/error/offline/stale/denied/not-configured/unsupported/conflict states, UTC-backed localized time/freshness, honest cache/practice labels and online revalidation of sensitive mutations. Notification deep links reauthorize and open current revision, never automatically approve. No offline deployment approval queue.

## Planned screen matrix

Journey labels are not verified route IDs. The existing destination to reuse is named below; actual reusable components await workspace inspection **for every row**. Verification status for all rows: **not run**. Operational screens target Android/iOS/JVM/JS/Wasm with the map/push fallbacks below, not sensor parity.

| Entry / destination | Backend contract and permitted action | Compact â†’ medium â†’ expanded behavior | Specific states / platform gates |
| --- | --- | --- | --- |
| Sign-in â†’ access/onboarding | Firebase corporate email/selected social, safe domain/slug discovery, enterprise SSO, session/me/invite; database-approved membership and assurance | Bounded forms â†’ form/status â†’ form/help panes | MFA/recovery/not provisioned/pending/denied/suspended; unsupported secure flow blocks admission |
| Platform â†’ partners/onboarding | Owner partnership/provision/activate/suspend/offboard, nominated admins, domains/SSO/quotas/entitlements | Partner cards â†’ list/detail â†’ lifecycle/detail panes | Owner only, expected-version/impact and incomplete external provisioning; no public automatic activation |
| Platform â†’ users/features/security | Global account/grants, step-up/destructive preview, versioned config/rollback/audit and support sessions | Review cards â†’ list/detail â†’ bounded table/preview | Last-owner protection, time-bound visible support access, no silent impersonation/SQL/editor/certification |
| More â†’ organization administration | Activated domains/SSO test, units/regions/members/invites/import preview/join requests/coordination grants | Forms/cards â†’ roster/detail â†’ table/import-review panes | Scoped roles only; per-row outcomes, DNS pending/conflicts, no global user deletion or domain-derived admin |
| Header â†’ organization switcher | `/api/auth/me`, memberships and assurance context | Context menu â†’ menu/detail â†’ persistent context indicator | All targets isolate caches/outbox/drafts; require new org SSO/MFA, reject revoked offline actions |
| Overview â†’ Sentinel summary | Scoped hazards/assistance/readiness/proposals | Priority cards â†’ adaptive cards â†’ bounded summary/detail | Staged versus approved/active, missing coverage, urgent next authorized action |
| Overview/More â†’ Disaster Radar | Hazards/zones/evidence/coverage/connectivity/assets/staging | Map/list toggle â†’ optional split â†’ list/map/detail | Android/iOS native Mapbox, JS/Wasm GL JS; JVM reviewed host or list. Distinct coverage/candidate/validated zone layers; token/offline fallback |
| Radar â†’ hazard/evidence detail | Revisions/provenance/exposure/verification/weather and warning/staging actions | Drawer/detail â†’ list/detail â†’ evidence/map/timeline | Independent reporter count/clock/model/version/conflicts/authority, no invented confidence; licensed weather only, unavailable exposure explicit |
| People/Overview â†’ safety/assistance | Scoped check/case detail, follow-up/escalation | Summary/cards â†’ queue/detail â†’ queue/timeline | Safe/can respond/needs help/no response distinct; silence not injury, receipt not dispatched help |
| Missions â†’ mobilization review | Proposal/eligibility/exclusions/reservations/rendezvous/route; scoped versioned approval | Review cards â†’ list/review â†’ roster/current-vs-proposed panes | Capacity/credential/hazard changes, stale/conflict; movement only after approval, unavailable route requires review |
| Messages â†’ warning/delivery | Reason/policy/recipient preview, queued/provider accepted/device/human/expired states, authorized retry/supersede | Message cards â†’ list/detail â†’ list/timeline | No duplicate safety events; expiry/cancel/history, best-effort push rather than guaranteed receipt |
| More â†’ readiness/resources/field intelligence | Skill/equipment/shelter shortages, inventory age, crowd evidence/roads/facilities | Shortage/cards â†’ dossier/detail â†’ table/evidence panes | Coverage/completeness, authorized resource updates, stale/blocked roads not safe routes |
| More â†’ operations/audit | Source/worker/provider health, model/weather gates, policies, drills/kill switches/audit | Status/cards â†’ list/detail â†’ dashboards/history | Scoped control, immutable automatic/manual reasons, unconfigured/blocked/shadow/live labels; owner cannot bypass scientific gate |
| Overview â†’ seasonal campaign | Preparedness campaigns/milestones/bulletins/readiness/grants | County/basin cards â†’ campaign/detail â†’ milestone/resource-gap panes | Outlook vs forecast/gauge/incident/dispatch separate; second-reviewed manual bulletin, English/Kiswahili, validity/revision/insufficient coverage, no seasonal countdown |

## Exact unfinished integration work

1. Obtain/inspect editable admin sources and actual dependencies/tasks; identify reusable theme, focused drilldowns, two-pane communications, bounded forms and real routes. Fill component/evidence columns only after inspection; no client edit or new inspection was performed here.
2. Add authenticated Ktor/live repositories and shared Firebase session/assurance/current permissions state, email/password and all four social providers, enterprise browser/platform flows, recovery/linking and org-isolated persistence. Web uses Firebase cookie/CSRF; unsupported native flows cannot fall back to insecure local auth.
3. Build Platform/Organization admission and management screens with backend scope enforcement, guarded owner bootstrap handoff, activation/domain/SSO/MFA flow, invitations/import previews, account versus membership semantics and explicit support-access audit. See [enterprise](enterprise-identity-setup.md), [owner](platform-owner-bootstrap.md), [onboarding](organization-onboarding.md).
4. Add geographic Mapbox/list adapters and layers, scoped viewport fetching, lifecycle/selection, server-validated lasso/recipient preview, provenance/uncertainty and all detail workflows. No private data in Studio, prohibited Google overlays or invented routing exclusion. Review [Mapbox setup](mapbox-setup.md).
5. Implement all matrix workflows against versioned contracts: assistance, reviewed mobilization, warning delivery, readiness/field reports, operations/source/model controls and Kenya/global campaigns. Show what happened automatically, why, actual delivery/approval state and next permitted action; never present automatic staging as approved dispatch.

## Acceptance evidence â€” pending

Test public/unassigned admission denial, invite across install/login, domain/SSO/MFA/linked-provider bypass rejection, context switching/cache isolation, roster import preview, owner lifecycle/grants/last-owner, org suspension/active-response handover, permission-hidden navigation plus server denial. End-to-end: automatic warning â†’ detail â†’ volunteer response; draft staging â†’ admin stale/conflict review â†’ atomic approval â†’ volunteer brief; assistance; readiness; sources; manual bulletin review/cancellation.

Check all matrix routes with deterministic authorized API fixtures and theme-preserving visual evidence: 360/390, 600/768, 1067/1440 dp, boundary/resize/rotation/insets/keyboard, 130%/200% text/zoom, focus/semantics/reduced motion and map-list equivalence. Compile actual documented common/Android/JVM/JS/Wasm tasks; iOS build/runtime requires macOS. Real SSO/MFA/FCM, Mapbox token/offline/device checks and store acceptance remain separate from mocked UI/build success. **Verified: none. Blocked:** workspace access/inspection, all live implementation, provider values/devices and validated regional activation. No production cutover authorized.