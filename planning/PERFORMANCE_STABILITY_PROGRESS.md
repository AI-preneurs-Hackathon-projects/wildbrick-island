# Arena performance and stability checkpoint

## Verified local result — fewer Arena movement pauses

Verified runtime commits: timing correction `3e3724e989d6e6be01c1ca9ae7c9155d486e9401`; movement scheduler `01a08f319bbce55833dc9d180ad999417ddeff04`. Baseline `6ae537f61114aefebea7cb653ce7d81dee899f5f`. The combined candidate reduces symmetric1600 ms held-input stop time by26.56% /23.31%, with no added stops at0/100/600 ms, preserved authoritative firing and bounded prediction. Full checks, desktop1440×900 and the30-minute real localhost HTTP soak passed. Asymmetric pose lag can increase; local/hosted and movement/FPS claims remain distinct. Exact tables, limits, commands and rollback are below.

Baseline frozen at `6ae537f61114aefebea7cb653ce7d81dee899f5f`. Fetch confirmed main remains `538e075feb407c9985f1bfc79ee904cfb9948ccf`, already integrated; no new merge was needed. Existing unrelated files, including the new local input-timing follow-up, are preserved. The baseline movement/failure checks pass.

Independent fixed-accepted-input traces distinguish current input from expired history: fire accepted at t=0 followed by release at t=1720 yields zero bow/automatic shots with no intermediate advance, but one bow/four automatic shots with intermediate advances. Moving catch-up to the earliest second restores historical effects but publishes overdue bursts and changes projectile expiry/heat, so that approach is rejected without implementation.

Selected timing-only correction: after a new packet passes sequence/epoch/round checks and its movement is accepted, a **command-free** `fire:true` update may make one ordinary shoot attempt at current room time. Keep the command branch, shared cooldown/heat/protection/health/contact rules and frame credit unchanged. Do not recover expired windows, simulate historical targets or promise request-phase-invariant automatic shot totals. A duplicate/invalid command must not be recast as a held-fire command.

Acceptance defined before implementation: a fresh eligible update cannot vanish solely because no future request advances its input window; event/projectile birth time must equal current authoritative time and contact use the post-movement authoritative pose. No new effect from old sequence/epoch/round, cooldown/heat/protection/death/building, accepted release or an outage; commands remain deduplicated. Existing frame limits and bounded work remain intact. Validate this independently before retrying movement scheduling. Compare baseline/timing-only/combined separately; old movement/shot rejection thresholds are not relaxed to admit a scheduler.

## Historical result — movement candidate rejected, runtime restored

Yerzhan authorized autonomous baseline/implementation/verification in the follow-up, superseding the historical owner-baseline pause. Latest main `538e075feb407c9985f1bfc79ee904cfb9948ccf` was merged separately as `0b17f9ed427522dc98f62fdbb4d7078e5cf181c2`. That frozen baseline retains diagnostics `284503a` and prior integration `e25bfe2`. Full baseline checks pass; neither historical failing test remains an exception.

**No movement-performance improvement is retained.** The attempted bounded overlap reduced pauses but failed sustained-fire preservation. All authored runtime edits were reverted before committing. The retained work is a repeatable rejection test, more accurate existing fixtures and real localhost HTTP cancellation/response-loss coverage. A manual owner baseline or Practice test is not required and would not resolve this failure.

The exact reproduction, rejected source patch, metrics and final validation are recorded at the end of this document. Earlier sections are historical evidence and must not be read as the current authorization or acceptance result.

## Historical working agreement — earlier main merge and owner testing

Yerzhan explicitly authorized merging latest main into this branch after the initial checkpoint. The earlier no-merge constraint below describes that initial session only. Push/deployment remain unauthorized. Before future performance behavior changes, follow `planning/PERFORMANCE_TESTING_WORKFLOW.md`: announce the exact next change and repeatable baseline test, let Yerzhan test before implementation, then provide the same after-test with evidence and limitations. Do not start the next behavioral task automatically.

Latest main fetched: `543b215212ee0fbed04e2892455d34e9a53cea0d` (eight commits after the prior base). The merge has first parent `284503ad85754746ba50e1c70195ecd58ef3b952` and retains main's creator-started Arena rooms, equipment/build changes, snapshot controls and UI/voice refinements. Conflict resolution preserved the snapshot test plus diagnostics, the complete client start/join API and waiting-room restrictions, and module URL validation with missing-file coverage.

Post-merge validation: full `npm run check` and `npm run build` pass; the two historical failing tests below now pass with main's updates. The added lobby/diagnostic integration test also passes (ten focused diagnostic groups total). Upstream-main versus merged diagnostic selected packet/outcome hashes match at all four RTTs. Prediction reason `4` now means any non-active round, including creator waiting, so waiting is not mislabeled as a network stall. An independent read-only review found no dropped upstream behavior or gameplay/authority changes from conflict resolution.

Desktop Chrome 1440×900 Practice and two-client moving/firing synthetic scene were rendered and screenshots inspected. The diagnostic driver captured no page/console/request errors; its retained frame p99 is 16.8 ms with diagnostics both off and on. These software-WebGL samples verify the merge/observer smoke, not a speedup. No new soak or hosted two-player acceptance is claimed for the merge; the six-minute soak below belongs to the earlier checkpoint. See `validation/performance-stability/main-merge/` for the new receipt. All 21 pre-existing dirty/untracked files were verified byte-identical after merging.

**No performance improvement has been implemented or established by our diagnostics.** The proposed next task is a playable local two-client network reproduction that Yerzhan can test before any prediction/recovery fix. It has not started. The merged commit will be the new baseline; do not compare future improvements against pre-merge UI/lobby behavior and attribute all differences to performance work.

## Contract and source receipt — 2026-09-14

Single implementation owner/session; diagnostics first and at most one behavioral improvement. Desktop browser only at 1440×900. No merge, push, deployment, paid requests or database operations.

- Fetched `origin/main` successfully before source edits. HEAD, origin/main and merge-base all equal `3bcfe4a00575135fec94ae94888cfbfcdd23be66`.
- Existing branch: `performance/arena-stability`; zero commits ahead of main and no configured upstream/push destination. This exact parent is the rollback point.
- Existing dirty `progress.md`, three voice planning files and all existing untracked files are unrelated and preserved. This dedicated progress document avoids mixing their authorship.
- Reviewed AGENTS.md, master prompt, prior investigation/local validation and intervening source changes. Client transport/prediction and motion presentation are unchanged from the older investigation; current gameplay/control tests must still be rerun.

## Hypotheses before measurement

| Hypothesis | Evidence now | Next discriminating measurement |
| --- | --- | --- |
| Prediction stops on stale snapshots or full pending queue | Source has separate 1000 ms freshness and 90-frame queue gates | Two actual active clients, RTT 0/100/600/1600 ms; snapshot age, pending frames, ACK and stop reason |
| Remote stepping follows irregular snapshots | Response plus 120 ms polling; easing to latest snapshot | Record actual arrival gaps; defer interpolation until rendered responsiveness comparison |
| A rendering/main-thread stall causes pauses | Previous software WebGL timing is inconclusive | Raw desktop frame gaps and supported long tasks, explicit renderer and visibility |
| Requests/resources accumulate or callbacks survive leave | Not reproduced | Bounded counters and active timers across leave/rejoin and real-time soak |
| Shared storage outage/round transition expires both seats | Unproven; pure core inactivity boundary is known | Correlate both local timelines; simulated room cannot measure D1/CAS or hosted outages |

## Selected slice and criteria

Diagnostics only unless new evidence justifies a separate small fix. No timeout, queue, interpolation, authority, combat, rendering-quality or input changes are selected.

Add opt-in, bounded, sanitized client diagnostics plus a reproducible local fixture. Before/after must preserve identical deterministic input packets, authoritative/display outcomes and status callbacks. Diagnostics must retain no credentials, raw error text, player names, blueprints or request bodies; retained samples must be bounded; throwing/disabled observers must not affect gameplay. No per-frame logging or network telemetry. Quantiles describe retained windows, with lifetime counts/max reported separately.

## Progress

- [x] Verify base and preserve existing work.
- [x] Map source: arena-client transport/prediction; motion-view and arena-view presentation; arena-core simulation; worker/arena-store CAS/session; main frame loop and scene/creation cleanup.
- [x] Capture repeatable baseline with two active actual clients.
- [x] Add diagnostics and focused tests; compare identical scenarios.
- [x] Desktop 1440×900 diagnostic scene, Practice smoke and focused combat/control rendering (partial acceptance, below).
- [x] Attempt full suite and attribute failures; build/package inspection and bounded wall-paced local soak complete.
- [x] Independent read-only review complete; authored files prepared for one local checkpoint commit and portable patch.

## Acceptance boundaries

Local in-memory transport is not HTTP/Worker/D1, hardware GPU or signed-in hosted acceptance. No production stability or universal FPS claim. The next experiment and exact remaining desktop acceptance will be recorded at the checkpoint.

## Implemented diagnostic interface

`createArenaDiagnostics({capacity:2048})` is explicitly passed as `createArenaClient(callbacks,{diagnostics:capture,...runtime})`. Normal `main.js` does not enable collection; no production telemetry, UI, request scheduling or gameplay behavior is changed. A throwing sink is isolated from gameplay. `capture.export()` produces a sanitized JSON-compatible capture; `capture.stop()` removes browser sampling and stops recording. Calling `capture.observeBrowser(window,canvas)` replaces any previous sampler for that capture. The development driver demonstrates this wiring without adding release routes or accessing authenticated APIs.

- Per-metric fixed-size rings, bounded transition history, lifetime counts/max, retained-window p50/p95/p99/max. Counts do not mean the entire lifetime is retained. No raw input, names, session tokens, blueprints, URLs or error messages enter client diagnostic records.
- Raw RAF gap and client tick gap are separate metrics; client tick gaps are not GPU timings. Request duration includes JSON parsing and pools all Arena endpoints, including join/leave/blueprint. `maxInFlight=2` can be an outstanding sync overlapping deliberate leave, not two competing sync polls.
- Snapshot gaps use accepted arrival times. Age is time since accepted arrival, not server-state age. `ackAdvance` omits spawn discontinuities; `correctionM` measures local predicted-state reconciliation after replay, not displayed remote smoothing.
- Prediction reasons: `0` no self, `1` freshness/queue gates eligible, `2` stale, `3` full queue, `4` round finished, `5` no credentials. Eligibility does not imply actual movement (input, health and collision still apply). The gate is sampled before prediction; pending-frame length is sampled after it.
- Status transitions: `0` offline, `1` joining, `2` online, `3` reconnecting, `4` expired. Request outcomes: `0` success, `1` network/other, `2` timeout, `3` canceled, `4` invalid JSON, `5` HTTP error. HTTP status `0` means no HTTP response.
- Transition `at` uses the injected monotonic clock; `startedAt` is a UTC capture label. The virtual fixture clock is synthetic and must not be interpreted as UTC. Real peers need a recorded clock-to-UTC anchor for incident correlation; their monotonic timestamps alone are not comparable.
- Long tasks have limited browser support and cover main-thread work of at least 50 ms; absence of entries is not proof of healthy rendering ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)). Disposal disconnects the observer ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/disconnect)). No DB/CAS instrumentation was added because this checkpoint has no local Worker/storage timing experiment.

## Reproduction and measured baseline

`validation/performance-stability/baseline.json` uses the exact parent client source exported with `git show`; `candidate.json` uses this checkpoint's instrumented source. Node v22.22.0, deterministic seed 452067, two real clients, one in-memory authoritative core, 60 Hz virtual ticks, 12 seconds movement, direction alternating every second, RTT split evenly around server mutation. Static world obstacles/supply drops are disabled only inside the fixture. Neither run measures wall-clock performance or production capacity.

| RTT ms | Accepted gap ms | Zero displayed displacement, peer 0 / peer 1 (of 720 moving ticks) | Peak pending frames | Result with diagnostics |
| --- | --- | --- | --- | --- |
| 0 | 120 | 0 / 0 | 8 | Identical selected packet/outcome hashes |
| 100 | 220 | 0 / 0 | 20 | Identical selected packet/outcome hashes |
| 600 | 720 | 0 / 0 | 80 | Identical selected packet/outcome hashes |
| 1600 | 1720 | 369 / 369 | 90 | Identical selected packet/outcome hashes |

At 1600 ms RTT, peer 0 has 300 stale-gate ticks plus 69 full-queue ticks; peer 1 has 301 plus 68. Both remain online. This refreshes the prior one-client reproduction with two active clients and separates the two stopping mechanisms. It does not prove the hosted incident's cause. There is no before/after behavioral improvement claim. Hash parity covers sanitized selected packet fields and displayed pose/health/kit/revision/round, not every room field or event.

## Validation and known baseline failures

- Nine focused diagnostic groups pass: bounded metrics/timelines, export isolation/privacy, browser cleanup, four RTT parity runs, throwing sink, transient/terminal status handling and separate timeout/cancel/invalid-JSON classification. The fixture does not honor AbortSignal and cannot certify real transport timeout cancellation.
- All 34 check scripts were attempted individually after the chained suite stopped: 32 pass; two fail identically on an untouched archive of the exact parent. This is not a green full-suite claim. Remaining assertions after each failing test are not executed.
- `check-arena.mjs:85`: expected default avatar color `#ffcf55`, actual current default `#f17a48`.
- `check-round-refinements.mjs:23`: expected W/A/S/D/Q/E/R/F in the old practice-actions selector, actual empty after the baseline HUD relocation.
- The earlier `check.mjs` failure also reproduced on untouched main: it treated `avatar-preview.js?v=35` as a filesystem filename. The diagnostic checker now resolves module URLs correctly and retains an explicit missing-module assertion. No expected gameplay/color/HUD result was changed.
- Existing network/movement (29), join-recovery (5), round (6), combat, attachment/old-ACK, camera, controls, saved creation and no-upload voice checks pass. Full-suite failure remains a baseline issue, not a claim that all invariants received rendered acceptance.
- Build succeeds with 66 assets. The opt-in diagnostic module is packaged intentionally; fixture/runners remain outside the release Worker. Three migration SQL files and hosting identity/configuration are unchanged.
- Independent read-only review found no authority/gameplay regressions in the diagnostic hooks; evidence limitations above reflect its review. One implementation session/owner throughout.

## Desktop scope and remaining acceptance

Headless desktop Chrome, 1440×900, ANGLE SwiftShader. The final comparison is sequential with no concurrent soak or benchmark. Two clients move and fire, assemble bows, and render one client's local/remote presentation. Screenshots are inspected. This simplified scene is deliberately not the full Arena map and is not a visual-quality reduction in the product. Initial short samples had variable startup maxima (including 350 ms with diagnostics and 166.7 ms without); retain this uncertainty rather than asserting speedup from one run.

Final isolated capture (`validation/performance-stability/desktop.json`): 480 rendered steps, 479 RAF intervals, final 256 intervals retained. Browser and virtual client captures are separate with explicit clock-domain labels. Each run delivered ten authoritative shot events, two swings and two completed builds to the displayed client; all fixture timers drained on leave, with no captured page/console/request failures.

| Browser metric | Client diagnostics off | Client diagnostics on |
| --- | --- | --- |
| Retained RAF p50 / p95 / p99, ms | 16.7 / 16.8 / 16.8 | 16.7 / 16.7 / 16.8 |
| Retained RAF max / lifetime max, ms | 16.8 / 250.0 | 16.8 / 200.0 |
| Long tasks captured / max, ms | 2 / 828 | 1 / 188 |
| Sampled geometry high-water | 11 | 11 |

This is an observer smoke/comparison, not statistically established overhead or improved frame performance. Setup tasks can begin before the first measured RAF interval; long-task and RAF maxima need not coincide. Cold-start variance and software rendering remain unresolved. No visual quality was changed to obtain these results.

Practice and combat fixture screenshots were also inspected. The skill client was copied to a temporary location only to set Chrome and the required 1440×900 viewport. Practice name validation initially prevented entry; a synthetic local name enabled the subsequent gameplay smoke. The skill's left-arrow action exposed the existing blocked-microphone fallback; no recorded upload or paid request occurred. Separate rendered combat checks passed pulse hits at 2/5/10/20 m, cover/protection, five-hit punch KO at 2130 ms, Down retaining flight kit, and drop returning to foot. These are fixture checks, not hosted play.

Still required before any performance/recovery behavior is accepted:

- [ ] Hardware desktop full Arena with two signed-in active peers; source/deployment identity recorded.
- [ ] Moving/shooting actors with flash/equipment/mount coherence, contact/protection, death/respawn and both fresh/legacy kits throughout a real incident.
- [ ] Full rendered W/A/S/D, Q/E/R/F, Down/G/T, C/1–5, modal isolation and voice-readiness/cancellation acceptance; functional checks cover many of these but this session's rendered smoke is narrower.
- [ ] 30-minute real HTTP/local-server two-client soak with seeded asymmetric jitter, lost post-mutation responses, transient failures, out-of-order/late delivery and deliberate stale-seat expiry. No automatic rejoin/replay policy changes.
- [ ] On reconnect, record UTC and elapsed times, visibility, status/reason, frame gaps and request/snapshot/ACK timeline on both peers. Determine whether the pause is peer-local or shared before naming a room-wide failure.

## Next smallest experiment

Keep behavioral changes deferred. Extend the same two-client fixture to independent one-way seeded delay and post-mutation response loss, then run against an isolated local HTTP/Worker adapter. Begin at 600 ms versus 1600 ms RTT for 60 seconds each, movement/release/fire and one leave while pending. Capture gate duration, ACK advancement, queue occupancy, authoritative/display displacement and per-peer status timelines. Accept a future prediction/recovery candidate only if it reduces reproduced stop duration while preserving authority, bounded queues/requests, release position and attack deduplication. A freshness constant alone is not a coherent candidate. Remote interpolation remains a separate slice.

Reproduce with `npm run check:diagnostics`, `npm run diagnose:stability`, and `node scripts/soak-arena-stability.mjs --duration-ms 1800000 --output /private/tmp/arena-soak.json`. For desktop, start the local Vite preview on port 5194 and run `scripts/diagnose-arena-desktop.mjs` with an existing Playwright installation via `PLAYWRIGHT_MODULE` when not locally resolvable. No mobile/device matrix is launched.

## Final wall-paced soak and checkpoint

The corrected final fixture completed 360,009 ms of wall time at simulated 100 ms RTT, starting 2026-09-14 12:25:51 UTC. It kept two active clients through three deliberate peer-1 leave/rejoin cycles, one round-end and the next round-start. The displayed peer received 321 authoritative shots, 67 swings, 22 completed builds, 19 dismounts and one hit. This is a six-minute first-session diagnostic soak, not the deferred 30-minute HTTP/server or full rendered combat soak.

Both clients avoided reconnecting/expired status. Their explicit final leaves drained all timers, in-flight requests and room seats. Regular minute checkpoints held four timers (two at startup); the lifetime high-water of eight includes overlapping final leaves and pending syncs. This demonstrates cleanup in the simulated transport, not browser/Worker cancellation, GPU leak freedom or D1 stability. Metric retention remained capped at 2048 samples per series. Heap checkpoints are recorded as observations without a memory-leak conclusion.

The wall-paced run recorded 14/15 zero-displacement samples on peers 0/1 and zero stale-stop samples. Variable wall-tick durations versus fixed simulation steps make this count different from the fixed-60-Hz reproduction; it is not a smoothness verdict or a claim that every rendered movement frame advanced.

Read-only review caught a fixture-only zero-duration tick artifact around rejoins. It was corrected before this final soak: when deliberate joining advances simulated time, input sampling waits until the wall clock catches up. An earlier exploratory soak was stopped and is not acceptance evidence. Browser and simulated-client clock domains were also separated before the final desktop capture. No gameplay fix was layered onto these diagnostic corrections.

The checkpoint consists of opt-in instrumentation, development-only fixtures/runners, focused regression coverage, the module-URL validation repair and this evidence. `source-receipt.json` records exact SHA-256 hashes of every authored runtime/test/runner source and the verified base. The authored commit is the commit containing this document and that receipt; its parent/rollback point is `3bcfe4a00575135fec94ae94888cfbfcdd23be66`. A single `git revert <checkpoint-commit>` is the safe rollback path; do not reset or clean the shared checkout.

The portable binary patch was checked against an untouched archive of the verified base. Final commit SHA and patch location are reported in the task completion receipt. This is a reviewable diagnostics checkpoint with known baseline suite failures and remaining hardware/HTTP/hosted acceptance, not production stability acceptance. No merge, push, deployment, account-manifest change, database operation or external message occurred. All pre-existing dirty/untracked planning files remain outside the authored commit.


## Authorized movement-continuity experiment — rejected

Latest main `538e075feb407c9985f1bfc79ee904cfb9948ccf` (quick-tour UI only) was integrated separately as `0b17f9ed427522dc98f62fdbb4d7078e5cf181c2`. This is the frozen optimization baseline; its archive is isolated from the shared checkout. Earlier diagnostics and merge history remain ancestors. The owner-baseline pause is explicitly superseded for this slice.

Selected hypothesis: serialized syncs make already sampled frames wait almost two round trips for acknowledgment. Test one extra **movement-only** sync slot after a successful RTT above 750 ms, paced at half the measured RTT. Maximum two syncs. The first variant drained movement before commands; a second allowed a command behind one older movement request and blocked every subsequent send until its response. Neither variant preserved sustained-fire outcomes. A final trial removing the extra high-latency held-fire polling delay also failed. Both the 90-frame prediction bound and 1000 ms freshness gate stay unchanged. Existing server sequence/frame IDs and wall-clock movement credit remain authoritative; no worker/core, collision, combat, interpolation, renderer or storage change is selected.

Before evaluating the complete candidate matrix, acceptance criteria are: at least 20% fewer held zero-displacement ticks at 1600 ms on both peers, no worse longest stop; no added stops at 0/100/600 ms; no extra normal-latency requests; pending frames at most 90 and sync requests at most two; no worse correction displacement or release overshoot; preserved authoritative speed, frame order/ACK monotonicity and command deduplication. Asymmetric/jitter and fault scenarios must retain bounded drift and cleanup, terminal expiry, deliberate rejoin and round transitions. Any command loss/duplication or unbounded recovery rejects the candidate. Timing uses fixed seeded inputs, sequential runs and explicit stationary/collision/death exclusions. Exploratory gate-only removal was rejected (369→339 stopped ticks, only 8%, no coherent fix).

The comparison is movement continuity, not FPS. Local adapter/rendered evidence will be labeled separately from Worker/D1, hardware GPU and hosted acceptance.

### Failed hypothesis and retained result

The rejected client allowed two bounded, overlapping slow-link requests, retaining full unacknowledged frame prefixes, the 90-frame bound, 1000 ms freshness gate and unchanged authoritative frame credit. The local player moved on more held-input ticks, with zero measured replay correction and release overshoot in the fixed movement scenarios. This was insufficient for acceptance.

With two bow-equipped peers following identical 3-second holds / 1-second releases, the new command timing aligned their requests. Serialized held-fire traffic then advanced the room about every 1720 ms. `advanceRoom` simulates at most the latest 1000 ms; after skipping 720 ms, its first 30 Hz step is about 753 ms after the prior input, beyond `INPUT_STALE_MS=750`. Existing staggered peers advance the room sooner. Explicit fire commands still deduplicated and eventually acknowledged, but held-fire simulation was lost. Removing the extra 120 ms high-latency held-fire delay did not pass the repeated comparison either. No server/combat timing rewrite or weapon-specific exemption was added to hide this failure.

The final rejected source has no candidate Git commit: it was never accepted. Its exact bytes are identified by the SHA-256 in the comparison and its patch against baseline. The retained runtime candidate is exactly baseline `0b17f9ed427522dc98f62fdbb4d7078e5cf181c2`; source equality is checked in the final receipt. Do not attribute main's quick-tour changes to performance work.

The minimum next experiment is a fixed two-peer authoritative trace that preserves accepted `input.fire` intervals while varying request phase (staggered versus aligned) and RTT around 1500–1750 ms. Establish a bounded way to process held attacks without skipping their valid input window or replaying command effects; compare command IDs, shot times, cooldown/heat and release boundaries before attempting movement overlap again. This is one precisely scoped server-input-timing experiment, not permission for a general server/CAS or transport rewrite. No further runtime improvement starts in this session.

### Rejected before/after values

Node v22.22.0; seed 452067; two active clients; fixed 60 Hz virtual time. Both versions use their own client/core module graph. Static obstacles and drops are disabled in the fixture; firing peers start separated with bows. Held-input stops exclude stationary periods, death, joining and round/spawn discontinuities. The firing window is 18 seconds with a 3-second hold / 1-second release pattern. Metrics are frozen before leave/drain.

| Scenario | Baseline stopped ticks, peer 0 / 1 | Rejected candidate stopped ticks, peer 0 / 1 | Baseline → rejected longest stop, ms, peer 0 / 1 |
| --- | --- | --- | --- |
| hold-0 | 0 / 0 | 0 / 0 | 0 / 0 → 0 / 0 |
| hold-100 | 0 / 0 | 0 / 0 | 0 / 0 → 0 / 0 |
| hold-600 | 0 / 0 | 0 / 0 | 0 / 0 → 0 / 0 |
| hold-1600 | 369 / 369 | 271 / 283 | 1100 / 1100 → 717 / 1083 |
| asymmetric-600-1600 | 0 / 436 | 0 / 297 | 0 / 1100 → 0 / 1083 |
| asymmetric-directions | 435 / 436 | 303 / 297 | 1100 / 1100 → 717 / 1083 |
| seeded-jitter | 309 / 253 | 230 / 173 | 833 / 800 → 550 / 717 |
| movement-firing | 553 / 543 | 482 / 477 | 1100 / 1200 → 1100 / 1067 |
| accepted-response-loss | 929 / 709 | 601 / 525 | 1500 / 1100 → 1100 / 1083 |
| late-ACK | 475 / 436 | 297 / 297 | 1500 / 1100 → 783 / 1083 |

At 1600 ms, stopped time was **6150 / 6150 ms → 4517 / 4717 ms** (26.6% / 23.3% fewer stopped ticks). This candidate is nevertheless **rejected**: authoritative shots in the timed firing window fell **7 / 9 → 6 / 6**. Explicit command effects were 4 / 5 → 5 / 5 within the window and 5 / 5 on both versions after drain. Counting only explicit commands or only event-delivery IDs would have missed the regression.

Both candidates retained the 90-frame high-water and produced zero measured movement replay error and release overshoot in the fixed movement scenarios. The rejected scheduler used up to two sync requests rather than one at high RTT; normal-latency request counts remained unchanged. Detailed per-peer stop counts/durations, accepted/displayed travel, ACK progress, correction p95/max, pending high-water and cleanup are in the comparison JSON. None of these values is a useful retained improvement after the runtime revert.

### Final checks and reproducible commands

- Full `npm run check` passes on the frozen baseline and restored final source. Final suite includes 11 new movement/failure/comparison checks plus the 10 existing diagnostics checks and existing movement/authority, combat/contact, weapon attachment, camera, controls, history and no-upload voice regressions. The comparison command intentionally exits 1 for the rejected candidate (lost held-fire shots) and restored runtime (no 20% improvement). These are expected negative acceptance results, not unexplained suite failures.
- `npm run build`, `node scripts/check-package.mjs` and `node scripts/check-voice-package.mjs` pass: 67 public assets, 3 unchanged migrations, byte-identical asset serving, unauthenticated Arena/transcription rejection and development-runner exclusion. No production runtime, worker, renderer, hosting identity or migration file differs from frozen baseline.
- Real localhost Node HTTP/fetch checks ran sequentially on frozen and restored clients: 35-second active targets, **36,633.8 / 36,632.1 ms** after join including cleanup. Each run destroyed one response socket after an accepted mutation, delayed a separate accepted response beyond the real 12-second AbortSignal timeout, and injected a transient 503. Each explicit fire command produced one authoritative effect. Both peers remained connected; final requests, timers, seats and sockets were all zero. Final request/accepted-frame counts matched across runs. This is an isolated authoritative-core adapter, not Worker/D1, authenticated sessions or build-reservation/CAS validation.
- The virtual matrix covers 0/100/600/1600 ms RTT, independent per-peer seeded jitter, peer-asymmetric and direction-asymmetric delay, hold/release/reverse, moving/firing, accepted response loss, transient errors, late ACK, downlink outage, genuine uplink outage with expiry, 401/410, pending leave and round transition. Explicit rejoin is exercised only in the core fixture; its `addPlayer` helper is not a claim that production allows creating a new seat mid-round.
- No 30-minute HTTP soak, hardware-GPU benchmark or hosted acceptance is claimed. The candidate failed the gameplay gate and was reverted before a long soak; running a long acceptance soak of that rejected runtime would not make it safe. The previous six-minute simulated soak remains historical. Round transition here is deterministic virtual coverage, with the current round deadline shortened in the test fixture, not a new real-time round soak.

From the repository, prepare isolated copies without switching the shared checkout:

```sh
arena_base=$(mktemp -d /private/tmp/arena-base.XXXXXX)
git archive 0b17f9ed427522dc98f62fdbb4d7078e5cf181c2 | tar -x -C "$arena_base"
npm run check:movement-continuity
npm run diagnose:movement -- --baseline "$arena_base" --baseline-sha 0b17f9ed427522dc98f62fdbb4d7078e5cf181c2 --output /private/tmp/arena-restored.json
```

The last command is expected to exit 1: restored runtime equals baseline and makes no improvement claim. To reproduce the rejected attempt safely in a separate copy:

```sh
arena_trial=$(mktemp -d /private/tmp/arena-trial.XXXXXX)
git archive 0b17f9ed427522dc98f62fdbb4d7078e5cf181c2 | tar -x -C "$arena_trial"
git -C "$arena_trial" apply "$PWD/validation/performance-stability/movement-attempt/rejected-candidate.patch"
npm run diagnose:movement -- --baseline "$arena_base" --candidate "$arena_trial" --baseline-sha 0b17f9ed427522dc98f62fdbb4d7078e5cf181c2 --output /private/tmp/arena-rejected.json
npm run check:arena-http -- --baseline "$arena_base" --output /private/tmp/arena-http.json
```

The rejected comparison exits 1 specifically for reduced authoritative held-fire shots on both peers. The HTTP command uses ephemeral loopback ports, no existing service and no external calls. No manual Arena URL is offered: the local Vite preview still does not provide Arena APIs. Do not send Yerzhan to Practice to certify this failure.

Rollback: no runtime rollback remains necessary; it was already restored. Revert only the final authored test/evidence checkpoint commit reported in the session receipt if those additions are unwanted. Preserve integration `0b17f9e`, Hadrien's main changes and unrelated files. All 22 pre-existing dirty/untracked files were verified byte-identical before checkpointing.

### Desktop completion and checkpoint evidence

Final desktop verification used Chrome/ANGLE SwiftShader at 1440×900, sequentially, with 960 rendered steps per run. The corrected diagnostics-off/on runs at 100 ms both completed without captured page, console or request errors. Frozen-baseline versus restored-source runs then matched at 100 and 1600 ms: 9 / 6 authoritative shot events respectively, two completed builds, identical held-stop counts and zero sampled muzzle-attachment error (35 / 14 visible-flash samples). Screenshots were inspected; both equipped bows and actors remain coherent. Each run drained all fixture seats and timers. These are simplified two-client Arena scenes, not Practice and not a hardware-GPU performance claim.

One initial frozen-asset browser attempt closed unexpectedly before producing a result. A bounded retry with browser process logging completed all four runs. The process log included display-link/GPU warnings; the successful runs' page/console/request captures were clear. The failed attempt is not counted as acceptance, and no frame-rate improvement is inferred from the retry.

Evidence is under `validation/performance-stability/movement-attempt/`: rejected source patch and comparison, restored comparison, real HTTP receipt, observer/rendered JSON and four inspected screenshots. The source receipt hashes authored test code and verifies production-runtime equality with the frozen baseline. A final local test/evidence commit accompanies this document; the rejected runtime has no commit and must not be treated as deployable.

Reproduce the desktop checks using an existing localhost Vite preview at 5194 and externally available Playwright (not a new release dependency):

```sh
PLAYWRIGHT_MODULE=file:///private/tmp/brickwild-browser-run/node_modules/playwright/index.mjs STABILITY_OUTPUT=/private/tmp/arena-desktop node scripts/diagnose-arena-desktop.mjs
PLAYWRIGHT_MODULE=file:///private/tmp/brickwild-browser-run/node_modules/playwright/index.mjs STABILITY_BASELINE="$arena_base" STABILITY_OUTPUT=/private/tmp/arena-desktop-restored node scripts/diagnose-arena-desktop.mjs
```

The last command serves frozen baseline assets explicitly and fails on missing baseline files rather than mixing them with live candidate assets. The local preview was verified listening at `127.0.0.1:5194`; the driver supplies its synthetic test route. This is an automated command, not a persistent manual Arena endpoint.

## Fresh held-fire correction — independent validation

The timing-only runtime change is four lines in `applyInput`: one call to the existing `shoot` path plus a comment. It runs only for a new, command-free accepted held-fire packet, after movement acceptance. No catch-up loop, input-expiry constant, cooldown, damage, frame budget, request scheduling, renderer or storage rule changes. Projectile caps can still reject the attempt; “fresh hold” is not a guarantee of a projectile while a gameplay guard blocks it.

The added regression fails on baseline (zero effects immediately after eligible fresh acceptance) and passes with the correction (one current-time effect). Sixteen firing/playback checks and 29 movement/network regressions pass. New assertions cover fixed accepted input with extra advancement phases, 0/100/600/1500/1600/1720/1750 ms gaps, release before/at/after expiry, old sequence/epoch/round, heat/protection/cooldown/death/building, current moved muzzle and supplied aim solver, and melee windup/contact after release. The deterministic clone assertion supports pure-core replay; it is not evidence of real D1 CAS contention. Existing store mutation advances the room before invoking the callback; the change adds no external side effect inside that callback.

The 35-second-per-version real localhost HTTP test now uses sustained held fire on both active clients, not only a single explicit fire command. Baseline produced 0 / 0 effects immediately from fresh command-free acceptance; timing-only produced 11 / 5. Observed total effects were 10 / 10 versus 16 / 12, all respecting the unchanged authoritative cadence. These wall-clock counts demonstrate the exercised path, not a deterministic performance ratio. Accepted response loss, a separate real 12-second timeout/late response, 503, command-ID effect deduplication and cleanup passed. Post-join wall durations including cleanup were 36,632.7 / 36,631.8 ms; final timers, requests, seats and sockets were zero. Scope remains isolated Node HTTP + actual core, not Worker/D1.

The original deterministic matrix showed unchanged movement and 7 / 9 shots on both baseline and timing-only; it correctly rejected a movement-improvement claim for timing-only. An isolated combined trial (timing fix plus the old scheduler patch) passed the unchanged comparison criteria: 1600 ms stops 369 / 369 → 271 / 283, and moving/firing effects 7 / 9 → 9 / 9. Current-time eligibility tests, rather than equal totals alone, establish why the extra valid effects are allowed. Rendered and soak acceptance of that scheduler remain separate gates.

Timing-only desktop acceptance completed with the original tap phase preserved and an additional five-second held-fire phase (1,320 frames/run). At 100 ms both versions delivered 12 held-phase shot events and 77 total visible muzzle-attachment samples; at 1600 ms both delivered six held-phase events and 21 samples. Maximum attachment error was zero; page/console/request error arrays were empty. Baseline/candidate screenshots were inspected. This profile demonstrates preserved rendering, not the causal timing benefit. An earlier held-only trial had no visible baseline muzzle-flash samples at 1600 ms, exposing an existing stale-view-clock limitation; it was not counted as acceptance. The retained driver reports tap and held-phase samples separately and keeps its original attachment assertions.

Full timing-only `npm run check`, `npm run build`, package and voice-package checks passed. Independently reviewed: current-time pose/aim, guarded eligible attempt, pure-core replay boundary and no command recasting. Timing evidence is in `validation/performance-stability/input-timing/`; candidate source hashes identify this separate correction before its commit. Rollback is a focused revert of the timing correction commit, after reverting any dependent scheduler. The next authorized step is the separately committed bounded scheduler, contingent on its unchanged gameplay comparison, real HTTP and round-spanning soak gates.

## Bounded scheduler — acceptance in progress

Timing-only commit: `3e3724e` (full SHA is recorded in the final source receipt). The combined candidate now permits at most two requests only after a successful slow sync, with the older request restricted to pure movement. Movement packets retain the entire unacknowledged frame prefix and are paced at half the measured RTT. A command or held-fire packet may follow one older movement packet, then serializes all later requests. Existing 90-frame prediction, 1000 ms freshness gate, frame credit, input expiry, command IDs and seat lifecycle stay intact. Shared failure backoff cannot be bypassed by a sibling success; an ignored old snapshot cannot update RTT.

The refreshed matrix passes both `6ae537f` versus combined and timing-only versus combined. The new >=20% movement regression fails with the timing-only client and passes with the scheduler. A targeted asymmetric 600/1600 ms wall-contact/release check also passes: both predicted and authoritative bodies remain outside the wall, accepted movement matches shared replay, and release settles without drift. Collision stops are deliberately excluded from the movement-performance table.

Independent adversarial review found no ordering/authority blocker, but correctly identified a pose-lag tradeoff: asymmetric slow-peer maximum predicted-versus-current-server separation increases from 3.85 m to 5.53 m (directional asymmetry 4.13 m to 5.67 m). This is not reconciliation correction; it must not be hidden behind zero correction numbers. The fixture now additionally checks the theoretical 6.3 m travel bound of its unchanged 90-frame queue at fixed 0.6 input and 7 m/s kit speed. No general combat-alignment improvement is claimed. At symmetric1600, pose separation instead falls 5.88/4.90 m → 3.71/3.92 m.

This intermediate gate is now complete: real HTTP, desktop rendering and the30-minute HTTP soak passed, as recorded below. No hosted or hardware-GPU acceptance is inferred.

## Combined candidate — deterministic before/after

Runtime remained frozen throughout the completed30-minute HTTP soak. Baseline `6ae537f61114aefebea7cb653ce7d81dee899f5f`; timing-only `3e3724e989d6e6be01c1ca9ae7c9155d486e9401`. The verified candidate is `01a08f319bbce55833dc9d180ad999417ddeff04`; the source receipt checks the measured client/core hashes against its committed blobs. Measurements below use identical seed452067, 60 Hz input ticks, scene and profile; baseline/candidate run sequentially with each version’s own client/core graph. Queue and movement credit remain90 frames. Normal0/100/600 ms packet/outcome behavior is unchanged in this profile.

| Scenario | Held stop time, peer1 (ms), before → after | Held stop time, peer2 (ms), before → after | Longest stop, peer1 (ms), before → after | Longest stop, peer2 (ms), before → after |
| --- | ---: | ---: | ---: | ---: |
| hold-0 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 |
| hold-100 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 |
| hold-600 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 | 0.0 → 0.0 |
| hold-1600 | 6150.0 → 4516.7 | 6150.0 → 4716.7 | 1100.0 → 716.7 | 1100.0 → 1083.3 |
| asymmetric-600-1600 | 0.0 → 0.0 | 7266.7 → 4950.0 | 0.0 → 0.0 | 1100.0 → 1083.3 |
| asymmetric-directions | 7250.0 → 5050.0 | 7266.7 → 4950.0 | 1100.0 → 716.7 | 1100.0 → 1083.3 |
| seeded-jitter | 5150.0 → 3833.3 | 4216.7 → 2883.3 | 833.3 → 550.0 | 800.0 → 716.7 |
| press-release-reverse | 7250.0 → 5050.0 | 7266.7 → 4950.0 | 1100.0 → 716.7 | 1100.0 → 1083.3 |
| movement-firing | 9216.7 → 8033.3 | 9050.0 → 7950.0 | 1100.0 → 1100.0 | 1200.0 → 1066.7 |

The symmetric1600 ms hold lasts12,000 ms (720 held-input ticks per peer). The reduction is26.56% /23.31%, above the predeclared20% minimum for each peer. Remaining stale-snapshot/full-queue pauses are still deliberate bounds; this does not eliminate all pauses or raise authoritative speed.

| Symmetric1600 ms metric | Peer1 before → after | Peer2 before → after |
| --- | ---: | ---: |
| Zero-displacement held ticks (count) | 369.000 → 271.000 | 369.000 → 283.000 |
| Stop episodes (count) | 8.000 → 13.000 | 7.000 → 10.000 |
| Pending-frame high-water (frames) | 90.000 → 90.000 | 90.000 → 90.000 |
| ACK advancement (frames) | 261.000 → 359.000 | 261.000 → 347.000 |
| Accepted path length (m) | 20.930 → 27.720 | 20.860 → 27.160 |
| Displayed path length (m) | 24.570 → 31.430 | 24.570 → 30.590 |
| Maximum pose gap (m) | 5.880 → 3.710 | 4.900 → 3.920 |
| Correction p95 (m) | 0.000 → 0.000 | 0.000 → 0.000 |
| Maximum correction (m) | 0.000 → 0.000 | 0.000 → 0.000 |
| Release overshoot (m) | 0.000 → 0.000 | 0.000 → 0.000 |
| Concurrent sync high-water (requests) | 1.000 → 2.000 | 1.000 → 2.000 |

Accepted path length increases as well as displayed travel; every accepted frame is checked against the unchanged shared movement simulation. Measurement ends before teardown; drain traffic is recorded separately. Held movement metrics exclude stationary input, death and joining; collision is tested independently and never counted as a network improvement. All18 scenarios passed: normal/asymmetric/jitter, press/release/reverse, moving while firing, accepted-response loss, transient failure, late response, prolonged outage, unaccepted uplink outage/seat expiry,401/410, round transition and leave pending. A separate warmed-overlap regression requires a genuinely out-of-order ACK, followed by build completion; another verifies that sibling success cannot bypass429 backoff.

In the18-second moving/firing scenario, authoritative shot counts are7/9 →9/9 with no command duplication. Timing-only remains7/9 in this profile, and its movement figures are identical to baseline. The pure-core fresh-acceptance regression and actual HTTP held-fire test establish the separate timing correction; automatic shot totals are not promised to be independent of room-advance phase.

Combined real HTTP comparison passed35 seconds of active input per version (36,643.1 /36,642.1 ms including cleanup). Accepted fresh held-fire effects were0/0 →11/6, each respecting authoritative cadence. Response loss after accepted mutation, a13-second delayed response beyond the real12-second client timeout,503 and command-ID effect/delivery deduplication were exercised. Final requests, sockets, seats and timers were zero; sync high-water was1/1 →2/2. This adapter uses actual localhost Node HTTP/fetch and core code, not Worker authentication, build reservation or D1/CAS. Existing packaged Worker/gameplay regressions passed separately; they do not establish hosted behavior.

Combined desktop runs at1440×900 used Chrome ANGLE SwiftShader,1,320 frames/run and sequential baseline/candidate100/1600 ms. At100 ms both runs had zero held stops,21 shot events and77 visible attachment samples. At1600 ms the rendered profile had632/594 →528/527 held stops,12 →14 delivered shot events, and21 attachment samples in each version. Both retained six held-phase shot events; maximum sampled muzzle-attachment error was0 m. Page/console/request errors were empty. Both candidate screenshots were inspected; actors and equipped bows remain coherent. No renderer, remote interpolation or visual quality setting changed; no FPS/hardware-GPU claim.

The full suite (including14 movement-continuity groups,16 firing groups, network/contact, control/camera/history and voice checks), build and both package checks passed. Package contents:67 assets,3 unchanged migrations, public assets byte-identical, development fixtures excluded. No paid requests or hosted load tests.

## Completed lifecycle soak and reproducible handoff

The real localhost HTTP soak ran for **1,800,022.076 ms (30 minutes plus22 ms)**, excluding final cleanup, on macOS26.6.2 arm64 / Node22.22.0. Target RTT was600 /1600 ms with independently seeded±100 ms jitter per direction. Natural5-minute rounds and15-second intermissions remained unchanged. It traversed round IDs1–6, began a second match through one explicit two-client leave/rejoin, and observed four round-started/four round-ended events on peer1. The fixture initiates the next match from authoritative completion before every final-score event is necessarily delivered; it does not certify the hosted lobby/final-score UX.

There were2,492 /1,469 requests and2,485 /1,465 accepted sync/build mutations; sync concurrency peaked at2 /2. The whole adapter peaked atfive requests including lifecycle traffic. All three accepted-response losses, three13-second late responses/real client timeouts and three503s were observed. Each peer exercised58 distinct command effects with no duplicate command key, plus42 /457 fresh held-fire effects. Counts are wall-clock observations, not performance ratios. Pending input stayed≤90 frames. Minute samples showed3–10 timers and9.99–28.87 MB heap; the loop also enforced the20-timer ceiling throughout. These bounded samples do not establish a universal memory-leak guarantee. Final requests, sockets, client/server timers and seats were all zero.

The soak runner now guarantees cleanup even when a loop gate fails and requires actual round/match transitions, nonempty firing paths, loss and timeout coverage for a30-minute pass. Source hashes for runtime and adapter stayed unchanged during the run. The final receipt verifies all23 unrelated dirty/untracked files byte-identical. No second implementation session, merge to main, push, deployment, paid request, production traffic, migration or database operation occurred.

Evidence: `validation/performance-stability/input-timing/combined-source-receipt.json`, `movement-combined.json`, `timing-vs-combined.json`, `http-combined.json`, `desktop-combined.json`, inspected `combined-100.png` / `combined-1600.png`, and bounded `http-soak-30m.json` / `.log`. Comparison JSON distinguishes HEAD at measurement from the later commit whose source hashes were verified, avoiding attribution of dirty runtime to the baseline HEAD. Timing-only evidence remains alongside it.

From the repository root, reproduce without switching the shared checkout:

```sh
arena_base=$(mktemp -d /private/tmp/brickwild-baseline.XXXXXX)
git archive 6ae537f61114aefebea7cb653ce7d81dee899f5f | tar -x -C "$arena_base"
node scripts/compare-arena-movement.mjs --baseline "$arena_base" --baseline-sha 6ae537f61114aefebea7cb653ce7d81dee899f5f --output /private/tmp/arena-comparison.json
node scripts/check-arena-http.mjs --baseline "$arena_base" --output /private/tmp/arena-http-comparison.json
PLAYWRIGHT_MODULE=file:///private/tmp/brickwild-browser-run/node_modules/playwright/index.mjs STABILITY_BASELINE="$arena_base" STABILITY_HELD_FIRE=1 STABILITY_OUTPUT=/private/tmp/arena-desktop-comparison node scripts/diagnose-arena-desktop.mjs
node scripts/soak-arena-stability.mjs --http --duration-ms 1800000 --output /private/tmp/arena-http-soak.json
```

Run these sequentially. The rendered command uses the already-verified localhost Vite preview on5194 and external Playwright; it creates the automated synthetic route, not a persistent manual Arena endpoint. No manual owner test is required or offered through Practice. The short automated movement comparison is the useful repeatable acceptance check now. Full validation commands are `npm run check`, `npm run build`, `node scripts/check-package.mjs`, `node scripts/check-voice-package.mjs`.

**Rollback:** `git revert 01a08f319bbce55833dc9d180ad999417ddeff04` removes the scheduler and its improvement regression while retaining the independently useful firing-timing fix. To restore the original runtime completely, then `git revert 3e3724e989d6e6be01c1ca9ae7c9155d486e9401`; retain any later soak evidence as historical. This is a rollback command, not an executed rollback or authorization to deploy.

**One proposed next improvement, not started:** remote-player interpolation under irregular snapshots. First capture a separate desktop before/after trace of remote step size and visual delay, while checking authoritative contact and the pose-gap tradeoff exposed here. It must preserve this local movement/authority result and will be announced before implementation. Hosted reliability and hardware-GPU performance remain separate acceptance work; no claim that this fixes hosted disconnects or raises FPS.
