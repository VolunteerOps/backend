# Sentinel and planning QA review — 5 November 2026

Scope: the seven areas in the supplied image and the implemented capabilities in
`META_MODELS_FEATURE_DESCRIPTION.md`, across the admin and backend repositories.
This was a code, contract, database, browser and build review. It is not a claim
that external providers are available or that every possible defect is eliminated.

## Corrected defects

| Area | Defect and correction |
|---|---|
| Assistant lifecycle | Completion, cancellation and edits could overwrite a concurrent state change. Writes now require the version read by the transaction. The harness rechecks persisted run status before model rounds and evidence tools. An already-sent external request may finish; its result cannot revive a cancelled run. |
| Follow-ups | Weather branches lost the parent answer and duplicated the new question. Branches now carry the parent question and answer; long questions fit the contract. Parent identity is isolated per request, included in idempotency, and persisted from creation, including failed children. Running/failed parents and unsupported branch kinds are excluded. |
| Evidence citations | Specialised outputs could name sources never retrieved. Every top-level `source_ids` output is checked against evidence-tool identifiers, with one repair attempt. Existing weather and resource verification remains in force. This validates source identity, not every natural-language claim. |
| Provider streams | Stream buffers were unbounded and readers were not reliably released. Responses have a byte ceiling and readers are cancelled/released on exit. Provider refusals retain the prior explicit refusal handling. |
| Mission chat | A schema-valid draft was considered ready even while the assistant was asking for clarification. Readiness now also requires its review stage. New coordinates must match a supplied draft or a retrieved place; invented coordinates trigger repair. Explicit coordinator creation remains required. |
| What-if plans | A baseline proposal could belong to another mission. Baselines must be completed proposals for the selected mission. Allocation/stock/capacity validation remains enforced. |
| Historical outcomes | Old assessments were rejected by current forecast freshness/policy checks, and observations from unrelated dates were combined. Historical review retains original policy/thresholds, filters observations to the assessment window and checks units for numerical maxima. It explicitly disclaims accuracy/bias calculations without station location and rainfall accumulation intervals. Operational allocation approval still rejects stale evidence. |
| Briefings | The web form used the selected specialised-history row as the source even for resource proposals. Source kind now has its own completed-record selector. Failed/running sources are rejected on the backend. Approval replay checks actor and request fingerprint; concurrent approvals use record versions. |
| After-action summaries | Open missions could receive an after-action summary. Both the selector and backend require a completed/cancelled mission. |
| Evidence worklists | Stale assessment evidence could appear as an empty worklist; concurrent creation could duplicate tasks; assignees could be outside the region. Creation now rejects stale evidence and serializes per assessment. Assignment checks active membership and region grants. |
| Incident classification | Regular mentions of buildings, bridges or factories matched disaster regex alternatives. Collapse and industrial patterns now require the event phrase. Feed URLs reject active schemes; feed reading stops at the byte limit. Unknown publication dates remain unknown. |
| Incident ingestion | Repeated items within a batch, concurrent imports and older records could duplicate. Imports serialize per region and check matching external IDs across history. Unlocated reports are not copied into every region. Coordinator authorization precedes fetching. Invalid owner ID `0` is replaced by the actual coordinator/custodian. |
| Scheduled imports | The worker used unscoped region reads, invalid ownership and swallowed failures. It now requires an explicit custodian, checks current active coordinator membership and region grants inside the database transaction, and surfaces failures for job retry. It cannot verify a feed report. |
| Hazard radar | Missing sources were silently converted into empty successful results. Radar validates access first and reports unavailable/truncated sources. Storm/wildfire/other pins have a real legend group; wind is no longer tagged as severe rain. Unsafe links and invalid coordinates are excluded. Refresh preserves the user's map view and updates selected records. Manually entered gauges are labelled recorded, not live sensors. |
| Operations map | Initial data could arrive before map creation without being rendered. Layer/marker work now observes map readiness. Missing coordinates no longer become zero, and valid zero coordinates are retained. The broken country-file lookup is replaced by the actual operating boundary. Fabricated severity-based impact circles are removed. Verification labels, source failures and pagination limits stay visible. |
| Draft persistence | `base_version` was ignored; the web and Kotlin clients always sent zero. The backend now rejects stale versions. Web writes are serialized and deletion waits for pending saves. Conflicts retain local edits and explain recovery. Kotlin loads and advances the version and shows sync failures. |
| Draft restoration/isolation | “Resume” did not populate form fields, unchecked values were lost, and local form/mission drafts could cross accounts or scopes. Forms restore actual values, including cleared/unchecked fields. Local keys include account and scope; assistant sessions remount on scope changes and ignore late answers after unmount. Successful mission creation removes its draft. Explicit shared planning keys remain compatible with Kotlin. Legacy local drafts without account ownership are not automatically imported. |

## Capability coverage

| Capability | Review/checks |
|---|---|
| Natural-language weather, daily briefing, station detail, archived forecasts | Contract/window/calculation, source provenance, partial coverage and failure-recovery tests; browser chat and follow-up checks. No live paid weather job was submitted. |
| Resource planning and scoped evidence questions | Controlled tools, citations, model identity, schema repair, permissions, entitlement metering and proposal validation reviewed. PostgreSQL tests verify approval replay, rollback, changed evidence, demotion and ownership. |
| Flood synthesis and rising-water watch | Controlled-tool requirements and explicit flood-impact limitation reviewed; gauge threshold tests. Live recurring worker execution was not exercised. |
| Heat-health, wind/access and multi-region comparison | Regional context/tool definitions and output/citation contracts reviewed. These are preparation guidance, not medical advice or route clearance. |
| What-if, fatigue, shortages and credential foresight | Deterministic scenario, stock split, fatigue eligibility, plan-diff and credential-expiry tests. No live model quality benchmark was run. |
| Audience and translated briefings | Source selection, completed-source gate, approval/translation boundaries and citation verification reviewed. Translation still needs human language review. |
| After-action, forecast-versus-outcome, gap worklists | Closed-mission/source constraints, historical semantics and task ownership reviewed and corrected as above. Observations lacking comparable units/time/location cannot establish forecast skill. |
| Maps and ingestion | Parser and PostgreSQL deduplication/permission tests; browser controls, provenance and incomplete-source handling. Browser fixtures do not verify live Mapbox tiles. |
| Section navigation | Active-link state, narrow-screen selection and route navigation checked. Existing sculpted tab design retained. |
| Forms and assistant drafts | Browser restore/version/conflict tests and actual PostgreSQL owner-isolation/concurrent-save tests; shared Kotlin compilation. |

## Validation

- Full backend suite: **219 tests passed, zero failed or skipped**, with disposable
  PostgreSQL 18 and PostGIS. It includes real concurrency and row-security checks.
- Browser checks: **29 distinct scenarios passed** across `qa-review` (7),
  `sentinel-recovery` (9), `reference-experience` (7) and `improvements` (6).
  These use authenticated test fixtures, not the user's real account.
  All seven QA scenarios also passed against the final production bundle,
  including conversation visibility after a draft-sync conflict.
- Backend/application and test TypeScript checks passed. Shared Kotlin JS
  compilation passed (`:shared:compileKotlinJs -PwebOnly=true`).
- Production web build passed (`npm run build --prefix web`). QA screenshots
  cover restored form values, narrow-screen tabs and map-source warnings.

## Release and provider limits

- Changes are local working-tree fixes; no Git push or Railway deployment is
  claimed by this report. Existing unrelated work was preserved.
- Configure `INCIDENT_FEED_OWNER_USER_ID` on the source worker before enabling
  `INCIDENT_FEEDS_ENABLED=true`. Use an active designated account with only the
  coordinator memberships/regions the worker should ingest into. A missing or
  unauthorized custodian fails explicitly rather than silently producing no data.
- Release the web and updated Kotlin client alongside draft-version enforcement.
  Older clients that always send zero will get a conflict on existing drafts;
  this prevents data loss rather than silently accepting an overwrite.
- Real Muse weather answers remain dependent on the provider accepting requests.
  The earlier documented provider refusal is not fixed by application tests.
  No live Muse request, paid BigQuery scan or GCS access test was run in this pass.
- Map data lists are bounded. The UI now discloses omitted older records and
  unavailable sources; it does not claim a complete incident census or safe area.
- Recorded gauges, road reports and vulnerability information require coordinator
  review of their dates and local relevance. They are not connected live sensors.
