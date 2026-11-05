# Sentinel disaster-engine QA — 5 November 2026

## Outcome

Reviewed the new multi-source engine, provider adapters, prediction API, radar, assistant connections and portal presentation. Fixed the defects below locally. This is an experimental preparedness indicator engine, not a trained or region-validated disaster forecasting system. No claim of meteorological certification is made.

## Experimental probabilities

The portal now separates:

- **Experimental weather probability ranges:** estimated threshold-exceedance ranges from WeatherNext's published p10/p25/p50/p75/p90 values, for one variable, grid cell and forecast time. For example, a heat threshold lying between p50 and p75 gives an estimated exceedance range of 25–50%. Equal quantiles and tails retain broad bounds; no fitted distribution or false precision is introduced.
- **Risk scores:** heuristic ranking of hazard indicators, shown out of 100. These are not converted to disaster probabilities.
- **Observed events, official alerts and reports:** existing source evidence, not newly predicted events.

An experiment can report uncalibrated probability estimates, but a threshold score alone does not estimate event frequency. Weather exceedance also does not establish the probability of flooding, damage, deaths or a region-wide disaster. Calibration needs labelled outcomes, a defined location/time/event target, held-out evaluation and reliability checks. Summed hourly percentile values do not establish a multi-day accumulation probability.

Only the 24 largest eligible weather probability ranges are displayed; the selection and truncation are disclosed. Missing or invalid percentile data produces no estimate. Ask Sentinel receives the method, source, scope and limitations along with the numbers.

## Fixed defects

| Area | Finding and correction |
| --- | --- |
| Authorization | Cached predictions could bypass fresh permissions. Every request now rechecks account, membership, coordinator role and region access; changes while providers run are checked again. |
| Cache | Added bounded caching, shared in-flight computations, region/policy fingerprints and forecast/official-alert expiry bounds. Persistence rejects a changed region configuration. |
| Identity and revision | Hazard IDs previously collided across locations. IDs now include hazard, cell and time window; newer source revisions replace old copies. |
| Evidence fusion | Zero-valued contradictory evidence was discarded. Actual zero readings now count, while missing values remain missing. Source families are counted once and source weights are configuration preferences, not measured accuracy. |
| Freshness | Old model issuance could appear fresh because the forecast time was in the future. Issuance age now affects eligibility and evidence confidence. Invalid/future observed timestamps are rejected. |
| Rainfall | Partial data windows could be labelled 24/72-hour totals; empty maxima produced invalid numbers and zero became missing. Totals require complete consecutive hours, preserve zero, and retain the actual accumulation end time. |
| Fire weather | Independent daily temperature/humidity/wind extrema could create a false combined condition. The detector now requires coincident hot, dry and windy hourly samples. Fuel/ignition/local validation remain missing. |
| Flood | Removed a fabricated discharge percentile derived from peak/median discharge. Discharge without basin thresholds is context, not a flood probability. |
| Alerts | Unrelated official alerts could become wind hazards. Alerts are mapped by event type; cancelled, expired, test and unrelated alerts are excluded. |
| Open-Meteo | Bounded point requests run concurrently and disclose partial failures; fewer than 24 hours cannot produce a daily total. |
| ReliefWeb | Live API rejected `country.location`. Requests now use supported country/type fields and the default `com.resqops.app`. Country-level reports have no invented event coordinates; access denial is distinct from an empty feed. |
| Stored evidence | Corrected the stored incident kind to `INCIDENT`; gauge review uses the latest observation per gauge and excludes old/future readings. Local-record truncation is disclosed. |
| Radar | Observed earthquakes, GDACS incidents and gauges no longer get duplicate engine prediction pins. Official reports remain distinct from model indicators; source gaps propagate. |
| Assistants | Weather conversation, resource planning and legacy Ask Sentinel now consume controlled engine evidence. Citation IDs and snapshots are retained; weather queries and local reports retain their separate meanings. Legacy Ask Sentinel uses the weather model. |
| Large results | API/cache snapshots retain at most 200 ranked indicators with count/truncation disclosure. Model context selects 12 indicators, six weather estimates and eight country reports, explicitly identifying the selection rather than silently overwhelming the model. |
| Portal | Corrected camelCase assumptions against the real snake_case API contract. Uses one outlook request, exposes time/location/missing inputs, separates probabilities from scores and avoids an all-clear empty state after failed retrieval. |
| Assistance | Serialized regional intake/decisions before reading receipts and case state; concurrent requests merge into one open case and conflicting coordinator updates cannot both succeed. |

## Capability coverage and remaining work

| Requested capability | Current implementation / limit |
| --- | --- |
| Earthquake Sentinel / arrival time | USGS awareness and scoped GDACS reports. No validated Android cross-device seismic estimator or arrival countdown. |
| Weather-informed risk | Stored WeatherNext plus bounded Open-Meteo samples, source reports and gauge records. Experimental thresholds; Google Weather and region calibration are not connected here. |
| Flood early warning | Rain/discharge/gauge context. No validated basin impact model, inundation map or operational evacuation countdown. |
| Wildfire | Coincident fire-weather screening; FIRMS, fuels and exposure layers are not connected. |
| Storm/cyclone / tsunami | Typed NWS alerts for a sampled contiguous-US point and reported events. No global CAP corridor/coastal-zone warning integration. |
| Landslide | Rainfall screening capped below high severity; slope/susceptibility calibration is absent. |
| Community sensing | Existing device/consent infrastructure; no validated multimodal sensor-correlation engine in this implementation. |
| Safety Guardian | Assistance intake, ownership, decisions and timeline. Automatic fall detection/local cancellation prompts are separate missing capabilities. |
| Connectivity map | No eligible baseline/outage-disambiguation detector connected to the engine. |
| Crowd verification | Existing scoped incident verification and provenance; no claim of complete independent-report correlation or reversible clustering. |
| Impact zones | No validated versioned impact polygons; point indicators are not damage boundaries. |
| Disaster Radar | Live scoped map/list evidence with source gaps and distinct observed/reported/predicted categories. |
| Mobilization | Existing qualification, stock and commitment checks plus human approval; engine evidence is advisory, not safe-route authorization. |
| Readiness/learning | Source/capability status and existing review workflows. Source weights are not learned calibration; no automatic model promotion. |
| Offline relays | No authenticated, bounded multi-hop ingestion pipeline connected here. |

## Verification

- Complete backend suite: **234 passed, none skipped** on the isolated PostgreSQL 18/PostGIS QA database. After the final ReliefWeb repair: **16 targeted engine/provider tests passed**, including the additional ReliefWeb test.
- Database-backed HTTP integration: unauthenticated 401, authorized 200, cache reuse, revocation denial, persisted refresh and policy-change invalidation. Firebase credential verification uses a test fixture; database identity, permissions and RLS are real test records. Concurrent assistance intake/decisions are covered.
- Browser checks: **9 passed** across engine presentation and portal QA; the final two engine display tests passed again after readability improvements. Screenshot inspected.
- Backend and frontend TypeScript checks passed; frontend test types also passed. No Android build was performed for this QA increment.
- Final integration pass after bounding model context: **18 engine/provider, assistant-harness and database tests passed**; backend TypeScript passed again.
- Bounded live Open-Meteo Nairobi check: **OK**, three daily sample records. No paid BigQuery or model inference was run.
- Live ReliefWeb: original request returned 400 for unsupported `country.location`; corrected supported-field request returned **403 — app name not approved** for `com.resqops.app`. Reconfirm the read-API approval with ReliefWeb; do not treat this as no disasters.
- Railway was inspected read-only. Changes have **not been deployed**. A real deployed Firebase-session test remains outstanding; local fixture authentication is not claimed as live Railway verification. WeatherNext GCS remains dependent on bucket access.

After deployment, complete the live check while signed in as an authorized coordinator: open Sentinel → Sources & coverage → Refresh outlook, confirm the predictions request returns HTTP 200 and `engine_version: disaster-engine/1.1.0`, and verify the returned region, timestamps and source statuses. Keep the Firebase token and password private. The local automated checks do not substitute for this step.

## Source references

ReliefWeb's [disaster field catalogue](https://apidoc.reliefweb.int/read/resources/disasters/) lists country references but no `country.location` field. USGS distinguishes [earthquake prediction](https://www.usgs.gov/faqs/can-you-predict-earthquakes) from detection and early warning. Open-Meteo's [flood API specification](https://github.com/open-meteo/open-meteo/blob/main/openapi/flood.yml) describes discharge forecasts; it does not turn a peak/median ratio into a flood probability.
