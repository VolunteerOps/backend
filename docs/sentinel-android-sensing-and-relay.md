# Android sensing and relay — planned implementation handoff

**Step 1 documentation only. No sensors, acoustic model, estimator, relay or live client implemented here. No production activation authorized.** Trace: specification S05/S06/S10; primary plan “Android Sensing and Relay” and “Android and relay tests”. [Status/evidence convention](sentinel-implementation-plan.md).

## Component and platform boundaries

Client source classes must be inspected in the volunteer workspace before selecting final paths/names. Planned shared contracts/state machines belong in `shared/src/commonMain/`; Android adapters in `shared/src/androidMain/`; service/permissions wiring under `androidApp/`. These are proposed responsibilities, not existing classes:

| Component | Required responsibility |
| --- | --- |
| `CapabilityRegistry`, `SensorCapture` | Enumerate hardware, permissions/model/platform states and explicit start/pause/stop sessions. |
| `FeatureExtractor`, `AcousticClassifier` | Bounded windows, quality/timing features, local versioned inference and no raw-audio default upload. |
| `SensorOutbox` | Encrypted durable identity/org/consent-isolated queue, expiry, deletion and bounded batches. |
| `RelayTransport`, `RelayRouter` | Nearby links versus VolunteerOps multi-hop routing, trust, encryption, limits, receipts and backpressure. |
| `AlertPresenter` | Separate awareness/protective channels, expiry/revision gates, accessible local safety prompts and permitted notifications. |

Add shared networking/serialization/persistence plus Android-only Nearby and a supported inference runtime after inspecting Gradle/toolchain versions. No Android imports in common code. Android, iOS, JVM, JS and Wasm retain operational workflows; other targets explicitly report unsupported sensing/relay, not fabricated parity. Google Play services is a Nearby dependency.

## Capture and privacy requirements

- Separate opt-in for motion, pressure, microphone, location and relay. Relay-only participation is allowed. Visible sessions, pause/stop, battery/thermal limits and deployed-user modes are required; enumerate accelerometer, optional gyro/gravity and barometer independently.
- Motion windows include monotonic sample timing and measured wall-clock mapping/uncertainty, rate/calibration/accuracy/clipping, stationarity/orientation and gravity/handling separation. Use compact temporal features, not continuous waveform uploads. Server receipt is not onset time.
- Include observed/expiry times, coarse cell/location accuracy/age, feature/model version and quality/capability flags. Separate precise-location consent is required if necessary for a validated estimator; otherwise return unavailable.
- Pressure must account for bias/elevation/indoor context/reference level and weather; it cannot independently forecast cyclone or flood.
- Microphone requires independent consent and explicit visible sessions. Bounded on-device inference needs licensed version/hash/labels and representative fixtures; discard raw audio promptly and upload only allowed label/score/time/features/model version. Generic sound recognition is not validated landslide/flood detection; missing hazard model stays unavailable.
- Fall/immobility candidates use activity/deployment/device-placement context and a cancellable local prompt before timed human escalation. Phone drops are not proof of injury; NEED ASSISTANCE creates a deduplicated case, not an automatic deployment.
- On consent revocation stop collection and delete eligible queued data. Already-forwarded opaque packets cannot be instantly recalled offline; bound TTL/trust windows and enforce backend revocation/retention. No default raw audio retention; proposed first-party raw feature/location/heartbeat retention is 7 days, aggregates 90 days, subject to approved policy and stricter third-party rules.

## Android permissions and lifecycle backlog

Inspect actual target SDK and current platform/distribution rules before manifest changes. Determine required internet, notification, foreground-service types/declarations, sensor/microphone/location and version-specific Nearby Bluetooth/Wi-Fi permissions. Do not request every permission preemptively or treat foreground services as a background-start bypass. Record per-OS required permissions, rationale, denial/revocation behavior and foreground/background eligibility during implementation; exact manifest entries remain blocked on source/SDK inspection.

Use supported user-started capture/relay sessions; expose Doze, reboot, app termination, denied permissions, missing Play services and thermal/battery restrictions. No guaranteed continuous background capture or zero-connectivity coverage.

Google Earthquake Alerts has no established public third-party subscription API in the primary plan. Provide supported settings navigation where available/manual instructions otherwise; do not claim to inspect enablement or receive its alerts. No notification scraping, Accessibility interception, private broadcasts or privileged mimicry.

## Fusion and estimator requirements

Backend ingress commits/deduplicates before receipt; urgent workers use quality-aware independent enrolled devices, stationarity, spatial/temporal consistency, compact waveform features, clock/location uncertainty, coverage and independent authority evidence. Use overlapping windows and leases/version checks. A 5 km/5 second cluster, relay count or radio peer identity is not earthquake confirmation.

Estimator returns recipient-specific absolute arrival interval or unavailable reason based on source origin/location/depth, propagation/regional validity, target uncertainty, clock and fit residuals. Maintain replayable code even with UI countdown disabled. Validated live source/model and sufficient observations are mandatory. Suppress expired, superseded, poor-fit, uncertain and nonpositive-lead estimates; blind zones show guidance without countdown. Never hard-code 18 seconds or declare shaking ended.

## Nearby protocol backlog

1. Use `P2P_CLUSTER` for small messages. Nearby manages links, not VolunteerOps routing or a guaranteed BLE/Wi-Fi Direct selection/internet gateway. Explicit relay sessions limit discovery, connections, reconnect and backoff.
2. Enroll trusted responder/device credentials online or through approved local ceremony before outage. Verify Nearby connection tokens with user-assisted pairing or reviewed provisioned-credential session-bound challenge; no arbitrary unverified peer trust.
3. Sign immutable origin envelopes using Android Keystore-protected device keys and established cryptographic libraries/formats. Encrypt sensitive payload to backend; rotating opaque IDs/minimal routing metadata. Final encoding/algorithms/key rotation/trust-window values require security review, not custom cryptography.
4. Include protocol version/message ID/origin credential/observation and expiry times/recipient class/hash/signature/bounded hop metadata. Urgent path excludes raw audio, large photos and waveform streams.
5. Encrypted persistent queues enforce per-origin/peer/storage quotas, max hops, TTL, dedup, priority inventories and backpressure. Preserve origin time. Numeric limits are unconfigured required inputs, not disabled safeguards.
6. Online peers forward original signed envelopes in bounded batches. Backend independently verifies origin, consent, revocation and scope. Only signed backend receipts prove acceptance; local queued, peer custody and server-accepted states differ. Retries/multiple gateways do not add evidence votes.
7. Peer-distributed warnings, if enabled, are a separate backend-signed approved target/region-scoped class. Peers cannot create/edit warnings. Uncertain location/time/expiry/signature forbids countdown/current-warning claims; useful historical messages must be labeled.
8. Historical/delayed relays cannot enter the current-warning path. Bounded offline credentials with stale revocation knowledge are conservative and fully rechecked at ingress; instant offline revocation is not promised.
9. No gateway/permission/Play services/peer consent means local retention with **not delivered**, never silently “sent”.

## User interface and verification handoff

Show missing hardware/permissions, coverage/sample quality, model readiness, last upload, clock uncertainty, relay queue age/expiry and receipt type. Restricted cohort heatmaps are separate from physical impact/damage maps. Awareness and protective channels have accessible labels/icons and approved instructions; Android full-screen notification use depends on capability/permission/distribution eligibility, otherwise allowed notification fallback. Never claim DND bypass or misclassify as an alarm/calling app. SAFE, NEED ASSISTANCE and CAN RESPOND are distinct from deployment permission.

Planned tests: seeded synthetic/labeled motion/pressure/acoustic replay; walking/vehicles/construction/elevator/phone drops; missing barometer/mic, permission revocation, thermal limits, FGS restrictions, Doze/reboot/time changes; cancellation and delayed safety escalation; muted/FSI-denied/stale/duplicate alerts; A → B → C → backend with only C online, loops/churn/no gateway, tampering/forged/revoked credentials, storage/hop/TTL exhaustion, receipt loss and repeated gateways. Verify opaque payload and original signatures survive each hop and one origin contributes one observation.

Shared/Android host tests and supported Gradle builds are future work; instrumentation, physical multi-device radio trials, battery/background profiling, model/OS coverage and seismological validation are separate release gates. iOS build/runtime requires macOS/devices. **Verified here: none of these checks. Blocked:** client access/inspection, implementations, models/licenses/calibration, real devices, reviewed protocol limits and permissions. Keep collection disabled until explicitly approved consented pilot readiness; unvalidated public warnings remain prohibited.