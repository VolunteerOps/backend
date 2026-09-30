> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Volunteer Sentinel implementation checkpoint

Updated 30 September 2026. See [current status](sentinel-continuation-status.md) and [setup/activation](sentinel-setup-and-activation.md).

Implemented in the volunteer workspace: a Sentinel entry reachable from the compact header and wide navigation rail, a web portal adapter with a full-page option, public portal URL configuration and an explicit unconnected state on unsupported/unconfigured targets. The volunteer portal exposes regional forecasts, source freshness and reported hazards without coordinator refresh/chat controls.

JavaScript/Wasm compilations and common JVM tests passed. Browser tests verify unavailable/stale data and role-specific visibility. The existing practice repository remains local.

Live native repositories/authentication, FCM, safety/SOS/check-ins, field/media sync, Android sensing/Nearby relay, native Mapbox/offline maps and the remaining screen matrix are **unfinished**. The design below remains the full-scope target; the web insight slice does not complete Step 5.


## Existing design and platform contract to preserve

Per the primary plan: Overlock interface text, restrained Oswald headings, supplied artwork/linear icons, translucent badges, compact stacked cards and five-destination bottom navigation, wide rail. Reuse actual theme/navigation/repository components only after inspecting the client source. Existing component classes are **unverified for every row**, not invented here. Keep practice mode explicitly labeled and isolated; fixtures never upload to live operations.

All rows inherit the following layout and state contract:

- Compact `<600 dp`: bottom navigation, stacked cards, listâ†’detail/map-list toggle, bounded filter sheets and inset/keyboard-safe scrolling forms.
- Medium `600â€“839 dp`: existing rail where readable, one/two columns and optional list/detail; otherwise compact drilldowns.
- Expanded `>=840 dp`: rail, bounded content, list/map/detail panes, readable forms; tables scroll within their container. Prefer existing verified breakpoints if different.
- Base layouts on window width, preserve selection/filter/drafts/scroll/map camera on resize/rotation, respect native/browser back and keyboard focus. Authenticated deep links recheck permission/current revision and never auto-perform actions.
- States on every applicable route: loading, empty, retryable error, offline/stale with timestamp, denied, not configured, unsupported and conflict/expired. Last-known/practice is not live. No map gesture required for essential guidance. At least 48 dp targets, semantic text/icon severity, contrast, keyboard, 200% zoom/text and reduced motion. Streams must not steal focus or announce every countdown tick.

## Planned screen matrix

Entry routes below are journey labels, not verified route identifiers. Reuse destination named in column one; actual component is pending source inspection. Every row's verification status is **not run**; no screen is marked implemented.

| Entry / reused destination | Backend contract / permission and action | Compact â†’ medium â†’ expanded behavior | Platform and special states |
| --- | --- | --- | --- |
| Sign-in/onboarding | Firebase email/password + Google/Apple/Facebook/Microsoft; bootstrap, session, `/api/auth/me`, invitation acceptance; public/unassigned cannot enter operations | Bounded single form â†’ form/overview â†’ bounded form plus help | All targets via supported adapters; verification/recovery/link collision, SSO/MFA, cancellation, pending/denied/suspended; unsupported secure enterprise flow blocks access |
| Profile â†’ organizations | `/api/me/memberships`; explicit switch/leave and invitation state; active context/assurance checked | Membership cards â†’ optional detail â†’ list/detail | All targets; isolate identity/org cache/outbox, drafts retain original owner; show destination org for reports/consent |
| Today â†’ safety/nearby hazards | Scoped hazards, personal checks and assignment; safety/availability replies are not deployment approval | Prioritized guidance/cards â†’ adaptive cards â†’ bounded summary/detail | All operational targets; source/age, missing coverage, offline safety queue; no speculative percentages/raw telemetry as primary content |
| Inbox â†’ alert detail | Current alert/revision/expiry, safety response and acknowledgement; own replies only | Readable guidance/action stack â†’ summary/detail â†’ inbox/detail | FCM Android/iOS/web as supported, desktop stream/poll; Take Action/Be Aware, reason/issuer/cancellation, pending vs confirmed; countdown only validated/unexpired |
| Explore â†’ hazard detail | Scoped hazards/zones/restrictions and licensed regional weather | Map/list toggle â†’ readable optional split â†’ list/map/detail | Android/iOS Mapbox and JS/Wasm GL JS; JVM reviewed host or list; no map/token/weather license means honest fallback |
| Missions â†’ staging invite/brief | Proposal/willingness/reservation/deployment/check-in; only approved assignment permits movement instructions | Brief/cards â†’ list/detail â†’ roster-free personal mission/detail | All targets; role/equipment/deadline/rendezvous/reviewed route; willingness/queued request is not approved travel; unavailable route and stale conflict |
| Missions â†’ safety/assistance | SOS, deadlines, safety response and own assistance case | Prominent safety action/detail â†’ optional split â†’ bounded detail | All manual workflows; Android-only opt-in fall prompt; cancellable prompt, pending escalation, not-dispatched vs actual status |
| Field report composer/history | Observation batch and scoped storage/media references, pre-deployment allowed | Scroll/review/submit â†’ history/detail â†’ history/composer panes | All targets with durable platform persistence; GPS/manual provenance/accuracy/time, pending/partial/retry/corroboration; no invented assignment |
| Profile/settings â†’ sensor/relay | Device/consent/enrollment, sensor and relay batches/receipts | Separate consent/status cards â†’ grouped panels â†’ bounded detailed panels | Android capture/Nearby only; other targets explicit unavailable. Independent consents, model/permission/battery/queue/expiry, peer custody vs backend receipt |
| Settings â†’ downloads/delivery/privacy | Push registration, account controls/deletion and permitted map resources | Storage/download/action list â†’ adaptive cards â†’ bounded management panes | Native supported offline packs only; progress/cancel/quota/eviction and predownload limits, notifications/unsupported push guidance; recent-auth deletion and retention/hold explanation |

## Exact unfinished integration work

1. Obtain editable workspace and inspect actual Gradle/source sets, theme/navigation/state classes, Android manifest and existing documented tasks; replace journey labels with exact routes/components and evidence links. No source inspection or client edits are part of this task.
2. Add Ktor typed repositories, serializers, authenticated HTTPS, scoped stream/snapshot recovery, `AuthRepository`/`SessionState`/`PushRegistration` platform bridges, account/org-bound persistence and logout/revocation cleanup. Native Firebase SDK refresh; secure web session-cookie/CSRF flow; reviewed one-use PKCE/state browser handoff for unsupported native/desktop combinations, no local JWT fallback or embedded credential WebView.
3. Implement all email/social verification/recovery/linking and enterprise admission/switch flows against current database permissions. Register real per-environment app IDs/configs through [Firebase](firebase-setup.md) and [enterprise identity](enterprise-identity-setup.md); UI hiding is not server authorization.
4. Implement FCM registration/expiry/acknowledgements, permitted urgent notifications, APNs/web prerequisites and desktop fallback. Keep sensitive data behind HTTPS, provider acceptance distinct from receipt/response, no DND or full-screen guarantee.
5. Add [Mapbox adapters](mapbox-setup.md), scoped GeoJSON/selection/lifecycle and native offline packs/list fallbacks. No private Studio uploads, tile scraping, unsupported routing or prohibited weather overlays.
6. Implement Android-only [capture/inference/safety/Nearby](sentinel-android-sensing-and-relay.md), independent consent/quality/readiness states, encrypted bounded queues and receipt distinction. No production sensing warning before [validation](sentinel-model-validation.md).
7. Implement every matrix route with live repositories, durable field-report/media retries and conflict handling, assistance state, restrictions and approved personal assignment workflow. Backend endpoints alone do not complete journeys.

## Acceptance evidence â€” pending

Test alert â†’ detail â†’ own safety response; staging invitation â†’ admin approval â†’ brief/check-in; SOS/assistance without false dispatched state; reports across offline retry/partial batch; account/org switches, revoked scope and isolated drafts; all social cancellation/collision/Apple private relay/Microsoft-without-membership cases; deep links after login; missing config cannot open live practice data.

Check 360/390, 600/768, 1067/1440 dp and breakpoint boundaries, 130%/200% text, rotation/resizing, keyboard/insets/back/focus, semantic labels/reduced motion, map-list equivalence, all shared states and no clipped critical actions/page overflow. Use theme-preserving screenshots plus shared state/navigation/UI/browser tests. Run actual documented common/Android/JVM/JS/Wasm tasks when available; iOS requires macOS. Record per-target build, visual, real provider and device evidence separately. **Verified: none. Blocked:** editable client access/inspection, all listed implementation, provider credentials, devices/macOS, calibrated models and release approval. No production cutover authorized.