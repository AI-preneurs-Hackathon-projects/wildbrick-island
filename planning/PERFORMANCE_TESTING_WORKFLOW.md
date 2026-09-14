# Performance work: Yerzhan's before/after testing workflow

## Current authorization — autonomous movement-pause comparison

Yerzhan explicitly superseded the owner-baseline pause on 2026-09-14. For this local movement-pause slice, capture the frozen baseline, announce the selected change, implement and verify autonomously. Owner review is optional confirmation of a finished candidate. Do not require a new interactive page or a Practice test for Arena acceptance. Keep the historical agreement below as context; its mandatory pause and deferred-behavior language no longer govern this slice.

Current comparison base: `6d7220a857d15c286b327b2f88ae3c4535cee33a`, after integrating main `dd5dab936fcd25d6e6c50cdf79a1cd4985a96a66`. Integration assertion fix `bd8715b` changes no runtime behavior. The stronger scheduler tradeoff Gate A is **failed/provisional**: total stop time improves, but frequency and mixed-input separation exposure increase. Two attempted repairs failed and were not retained. Gate B remote interpolation is blocked. See the current section of `PERFORMANCE_STABILITY_PROGRESS.md` for evidence and one next bounded contact experiment. Autonomous verification remains authorized; manual owner review is optional, not an acceptance substitute.

## Historical agreement before the explicit follow-up

Before any new performance behavior changes, provide Yerzhan with:

1. The exact problem and one proposed change, in plain language.
2. A frozen baseline commit and runnable URL/command. Explain whether it is Practice, a synthetic local Arena, real local HTTP/server or the hosted game.
3. A short numbered test with duration, browser, viewport, player count, kit, movement and network conditions.
4. What to notice and record before the change: local pauses, rival jumps, input response, missed/duplicated attacks or reconnects. Include an agreed measurable comparison, not just average FPS.
5. A pause for Yerzhan to test that baseline before implementing the behavior change. Do not silently continue into the next performance task.

After each iteration, report exactly what changed, the resulting commit and rollback point, the same numbered test to repeat, measured before/after values, regressions checked and unresolved acceptance. Distinguish our automated evidence from Yerzhan's before/after playtest. If no speed or stability improvement was implemented or established, say that directly.

Keep main synchronization separate from optimization comparisons. When Hadrien's changes are merged, establish a new baseline and repeat the baseline test before attributing any later improvement to performance work. Preserve unrelated changes. Desktop only at 1440×900; do not switch branches underneath an active shared checkout just to compare versions.

## What the diagnostics checkpoint actually changed

Commit `284503ad85754746ba50e1c70195ecd58ef3b952` added optional measurements and repeatable test fixtures. It did **not** improve movement speed, frame rate, remote smoothing, reconnect behavior or the prediction timeout. Normal game play does not enable these diagnostic collectors. No visible speedup is expected from that commit.

It reproduced a useful failure: with two clients and 1600 ms simulated round-trip delay, movement stopped on 369 of 720 fixed simulation ticks for each client while the connection still reported online. Both stale snapshots and a full movement queue contributed. This is a laboratory reproduction, not proof of the hosted problem's cause.

The latest main merge brings Hadrien's separate lobby, snapshot, equipment, score/UI and typing/voice changes. Their visible effects must not be credited to our diagnostics. Historical captures under `validation/performance-stability/` belong to the original diagnostics checkpoint; the merge validation receipt is separate.

## Historical Practice-only instructions — not Arena acceptance

From `/Users/y/ringi-dev/wildbrick-island`:

```sh
npm run dev -- --host 127.0.0.1 --port 5194 --strictPort
```

Open `http://127.0.0.1:5194/` in desktop Chrome or Brave at 1440×900. If the preview is already running, use it rather than launch another server on that port.

For a five-minute **Practice baseline**, use the same browser, graphics settings, starting position and kit each time:

1. Enter your name and choose Practice. Wait 30 seconds for startup to settle.
2. Walk a short square using W/A/S/D for one minute. Note pauses while a movement key stays held.
3. Orbit with Q/E and change camera pitch with R/F for 30 seconds. Note whether camera motion pauses together with the actor.
4. Use one already available kit, move and attack for one minute. Reuse that exact kit in the after test; avoid paid creation requests.
5. Open and close Your creations with C, and pause/resume. Record missing controls, unintended movement while typing or any new error.
6. Continue moving until five minutes have elapsed. Note the elapsed time of each obvious hitch. A screenshot alone does not measure a hitch; record duration/count if possible.

**This local Vite preview does not serve multiplayer Arena.** Its Arena API deliberately returns unavailable. Opening two local tabs is not a valid multiplayer test. Practice can test rendering/control feel but cannot reproduce the delayed Arena prediction failure. Do not interpret a smooth Practice run as an Arena recovery fix.

The repeatable automated network reproduction is available now:

```sh
npm run check:diagnostics
node scripts/diagnose-arena-stability.mjs --diagnostics ../public/arena-diagnostics.js --output /private/tmp/arena-before.json
```

The JSON compares two active simulated clients at 0/100/600/1600 ms RTT. Inspect `stats[].zeroMovement`, `diagnostics[].predictionReasons`, snapshot gap and pending-frame metrics. It runs on virtual time, so the command's execution speed is **not** game performance. The two-client desktop driver is currently an automated synthetic scene; it is not yet a manual playable network test page.

## Historical proposed next task — superseded by the authorized movement fix

Prepare an **interactive local two-client Arena reproduction** with repeatable 100/600/1600 ms network presets and a baseline capture/reset control. Show the measured local movement gate separately from frame timing. Prefer actual client/server request handling in an isolated local adapter, preserving creator-started lobbies, authority, expiry and attack deduplication. No production users, paid calls or storage migrations.

First hand Yerzhan that unchanged-behavior baseline to play. Use one moving/shooting player per peer and the same kit/route for 60 seconds at each delay. Agree which visible symptom is reproduced and record stop duration/count, worst frame gaps, input/attack response and reconnects. The longer 30-minute HTTP/server soak remains a later acceptance check.

Only after that baseline test should we select one small prediction/recovery change. The expected improvement would be fewer/shorter **network-induced movement pauses**, not faster character speed or a blanket FPS increase. No specific queue/timeout change is approved by the current evidence. Do not raise the freshness timeout alone; do not combine recovery work with remote interpolation or rendering optimization.

## Historical autonomous result — rejected first scheduler

The movement-overlap candidate was implemented, compared and rejected: fewer movement pauses came with fewer authoritative held-fire shots. Runtime edits were reverted. The existing progress document and `validation/performance-stability/movement-attempt/` hold the precise failed hypothesis and evidence. No owner test is requested; Practice cannot certify this network change. Future proposals must state the exact next experiment and measurable acceptance before work, while this follow-up authorizes autonomous baseline capture rather than a mandatory owner pause.

## Standard result card

| Field | Required content |
| --- | --- |
| Changed | Exact behavior and affected files/commit; distinguish main merge changes |
| Before | Baseline commit, environment, test steps and observed symptom |
| Expected improvement | User-visible effect and comparison criterion agreed before implementation |
| After | Same environment/test; measured values and Yerzhan's observations |
| Checked | Automated tests, rendered checks, duration and actual server/network scope |
| Not verified | Hardware/hosted/manual gaps and any known failing tests |
| Rollback | Focused revert commit, preserving other work |
| Next | One proposed next task, with an automated baseline before implementation; owner confirmation is optional |

## Current input-timing follow-up

Yerzhan additionally authorized a narrow authoritative input-timing correction and autonomous retry of the movement scheduler. Baseline is `6ae537f61114aefebea7cb653ce7d81dee899f5f`; latest fetched main remains `538e075feb407c9985f1bfc79ee904cfb9948ccf`. Keep timing-only and combined comparisons/commits separable. A fresh accepted held-fire attempt at current authoritative pose/time is a firing-reliability benefit; it must not be described as a movement gain. The scheduler must still pass the original movement, firing, authority, real HTTP and lifecycle gates. Owner playtesting is optional confirmation after these autonomous checks, never a replacement for them. See the existing progress document for live evidence and limitations.

## Verified local candidate

The authorized follow-up is complete: timing-only `3e3724e989d6e6be01c1ca9ae7c9155d486e9401`, combined movement `01a08f319bbce55833dc9d180ad999417ddeff04`, baseline `6ae537f61114aefebea7cb653ce7d81dee899f5f`. Symmetric1600 ms held stops fell26.56% /23.31%;0/100/600 ms stayed at zero. Full checks,1440×900 rendered comparison and30-minute actual localhost HTTP soak passed. Increased asymmetric pose gap is an explicit limitation, not hidden by correction metrics. See the current progress document for exact measurements, transport boundaries, commands and separate revert steps.

Owner review is optional. There is no persistent manual local Arena endpoint to recommend; use the automated comparison command in the progress document. Do not send Yerzhan to Practice to certify this result. Remote-player interpolation is the one proposed next improvement and has not started; announce its own baseline and criteria before beginning.
