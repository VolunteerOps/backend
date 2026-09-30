> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Kenya seasonal readiness — Step 1 skeleton

Step 1 documentation; trace S03/S07/S09/S10 in the [specification](sentinel-implementation-plan.md). **No live source verification, preparedness campaign, partner activation or deployment authorization performed here.** Keep region-independent architecture; Kenya is prioritized configuration, not the only supported region.

| State | Current evidence |
| --- | --- |
| Implemented | Source caveat, regional requirements and readiness/drill checklist documented only. |
| Owner action | Partner coordinators/authorities verify current bulletins, geographic coverage/licenses/local guidance/resources/escalation and approve relevant SOPs. |
| Blocked | Campaign/source/manual-review/API/client implementation, verified official access/datasets, inventories/calibration, partner readiness and deployment approval. |
| Verified | No source fetched afresh or county/basin/feed/translation/physical drill checked in this documentation task. |

## Dated planning context — not a live forecast

The primary plan records a **KMD outlook issued 31 August 2026 for October–December 2026** describing above-average rain over much of Kenya with county-dependent conditions/heavy-rain risk, and a **WMO update dated 3 September 2026** describing established/strengthening El Niño with regional/seasonal variation. These are **attributed planning notes, not independently reverified facts here**. Recheck latest originals and issue/validity/expiry before use:

- [KMD OND 2026 outlook cited by primary plan](https://meteo.go.ke/documents/4790/OND_2026__Seasonal_Forecast.pdf)
- [KMD seasonal forecasts](https://meteo.go.ke/our-products/seasonal-forecast)
- [WMO update cited by primary plan](https://wmo.int/news/media-centre/el-nino-set-become-very-strong-raising-risks-of-extreme-weather-2027)

If unavailable/changed, mark source unverified/stale and obtain current authorized evidence; do not invent content or public real-time APIs. Seasonal outlook/ENSO cannot establish a local flood date, universal disaster onset in two to three weeks or “biggest ever” outcome. Google Weather's ten-day forecast maximum is not a two-to-three-week seasonal outlook. Global ENSO impacts may include drought/heat/fire, not only floods.

## Required regional configuration and owner actions

All values `REQUIRED`: approved organization/county/ward/basin IDs and licensed official geometries; partner/authority/source contacts; latest KMD/ICPAC/WRA/local gauge bulletin URLs or authorized access/credentials; feed schema/timeliness/license/coverage; issue/validity/expiry/revision/language fields; versioned basin thresholds/soil/antecedent rainfall/slope/susceptibility; vulnerable communities/facilities/roads/shelters/capacity; boats/vehicles/medical/SAR/communications assets and verified credentials; English/Kiswahili reviewed guidance; evacuation authority/local SOPs; route exclusion/staging reviewers; human escalation/on-call; campaign/milestone owners; explicit bilateral sharing/lead org where needed.

Store nonsecret versioned campaign/region/playbook configuration and provenance in scoped PostgreSQL once implemented; source credentials in runtime secret manager, not client code/bulletins. Exact source/API/config keys await access/adapter selection. Store UTC, display `Africa/Nairobi` and explicit local timezone elsewhere. National agencies/languages/units/seasons/hazard profiles are configurable; never copy Kenya thresholds worldwide. Residency/retention/transfer agreements are partner-specific, not proved by choosing Kenyan hosting; separate residency deployment is an explicit governed boundary, no automatic private global replication.

Planned records/APIs: versioned `PreparednessCampaign`, organization/region milestones/readiness evidence, `/api/organizations/:orgId/preparedness-campaigns` and `/api/organizations/:orgId/bulletins` with submit/review/supersede/cancel. Climate outlook, short forecast, gauge observation, verified incident and dispatch decision remain distinct. Where no machine feed is licensed/available, authorized manual bulletin entry includes original URL/document, issue/validity/expiry/geography and audit; **second authorized reviewer required before driving automatic outward warnings**.

Milestones request availability/propose resources with revision/cancellation, never autonomous movement. Missing gauges/inventories/thresholds appear as coverage blockers, not zero risk. Evacuation guidance requires proper authority; assignment/staging movement requires administrator approval. Shared scarce responders/resources use safe reservations and bilateral grants with a lead org, not unrestricted rosters.

## Per-organization/region readiness record — all pending

| Gate | Responsible owner to name | Required evidence |
| --- | --- | --- |
| Partner activation/domain/SSO/admin assurance | Platform owner + institution IT | Scoped grants, real MFA/SSO and tested revocation, not merely a login screen |
| Volunteer admission/consent/training | Partner coordinator | Verified membership/qualification expiry, consent and offline/safety training |
| Current warnings/outlooks/gauges/geometries | Source/authority liaison | Licensed coverage, dates/revisions, freshness and reviewed fallback bulletins |
| Local SOP/guidance/evacuation | Authorized local response lead | Reviewed English/Kiswahili instructions, approval authority and clearance procedure |
| Safe staging/resources/routes | Logistics/dispatch lead | Capacity/inventory age, reviewed access/road restrictions, equipment/credentials and shortages |
| Push/offline maps/reports/relay limits | Client/communications lead | Signed-device receipt/action evidence, predownloaded maps, pending/delivered distinction and outage fallback |
| Assistance/escalation/on-call | Human response lead | Contact coverage, case handover and manual phone/radio/local-authority fallback; no assumed funded SMS gateway |
| Scientific and live release | Domain expert + operational approver | Region/model/source/device validation, kill switch, approved policy and separate activation decision |

For each gate record status, named owner, evidence link/date, blockers and next review. Nothing in this table is verified or a scientific readiness guarantee.

## Planned drill and verification procedure

No implemented campaign/adapter diagnostic command exists in this skeleton. After implementation, record exact isolated scenario/API commands and sanitized actual results. Exercise heavy-rain warning revision → affected zones → safety checks → resource shortage → reviewed staging/administrator-approved deployment → blocked road → assistance escalation → cancellation/handover. Include source staleness, communications outage, insufficient gauges, manual second review and cross-org contention/sharing expiry. Verify no seasonal-to-local-countdown conversion, duplicate scarce assignments or premature delivered/dispatched states.

Recheck bulletin supersession/expiry before each decision, cancel/reschedule milestones on changed forecast and preserve reviewed audit. Maintain phone/radio/local-authority fallback and named human escalation when automation is unavailable. Full-scope-first implementation, scientific approval, owner configuration, signed devices/store acceptance and operational authorization remain independent blockers. **No production cutover, autonomous movement or two-to-three-week launch commitment.**