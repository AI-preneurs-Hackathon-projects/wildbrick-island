# Cross-browser voice — 2026-09-14

## Baseline and ownership

GitHub main refreshed read-only: `7b516548e159f35a37c91cf2d032c0d37f214b1d`, tree `a0474b8393a6c7b1f13b9f572bf2c9050a7ad615`. Creator base `7000960b2d1b40e5cb69b030c3f43f94b02f7c3d` matches every blob except the intentional hosting manifest and README. Clean dedicated creator checkout; no applicable AGENTS.md found. Branch `feature/cross-browser-voice`.

Sites get_site confirms owner, original project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`, original URL, version 18 and custom audience. No runtime or audience changes. This is not a new deployment verification; the last separately verified deployment remains the historical version 18 publication. The three critical gameplay commits have since been pushed to GitHub (3766d8f/946fe2d/7b51654); prior reports' no-push wording describes preparation. New visual and real two-player acceptance remains pending.

No open GitHub issues or PR coordination messages were returned at the start of this run. Hadrien's allocation is proposed, not confirmed. Reserved input/action-bindings/game-camera/follow-camera files and camera tests/notes remain untouched. No shared progress, combat, generation-budget, migration, lockfile, hosting or README edits. Owned integration: ui/main/style, worker/index, vite config and a dedicated package script only. New voice files/tests/report and development-only harness belong to this slice. Camera integration remains pending an agreed patch.

## Implementation progress

Implementing native success plus deliberate recorded fallback, cancellation and bounded server upload. No paid calls, push or publication authorized in this run.

The endpoint will use the existing generation_requests table and the same global slots/minute/requester admission limits, with a deterministic transcription request ID to reject duplicate submissions during the retained admission window. This requires no edit to the shared generation-budget module or schema. Transcription and generation each consume one admission separately; no slot spans both.

## Completed slice

`public/voice-controller.js` is the dependency-injectable state machine; `ui.js` retains the `createVoice` export for existing callers/tests. States are idle, requesting-permission, listening/recording, stopping, transcribing, ready, error and canceled. Native recognition stays English as before. Final native text survives a later unrelated error and dispatches once. Missing API, constructor/service/no-speech failures, 8-second startup stall and 4-second stop stall offer recorded speech and typing. A failed native route is not retried on every Speak press in the same controller session.

Recorded speech always starts from the explicit **Record instead** button beside the audio-upload notice. Speak / Left Arrow starts native speech or offers recording, and toggles an active capture to finish. Permission denial never loops. Recording/transcription leaves movement usable; Help, pause, typing, home/Arena transitions, round boundaries, local KO and pagehide cancel attempts. Snapshot guards also catch KO/intermission when the event stream missed a transition. Existing input callbacks/bindings remain untouched.

Every attempt owns its recorder, media tracks, timers, chunks, recognition and fetch abort controller. Cancellation invalidates callbacks before cleanup. A stream returned after cancellation is stopped without starting a recorder. Stop waits for the final dataavailable/onstop sequence; no upload begins from an incomplete chunk list. Device loss/mute, recorder errors, byte overflow and stop stalls discard capture. No object URLs are created. Valid text is shown before forwarding once through the existing generation path. Empty/invalid/overlong descriptions do not generate or truncate; local/native invalid text is offered intact in the existing editor, while invalid server results give a retry/type message without returning invalid text. Cancel after the creation callback has already run cannot undo that callback; the existing separate Cancel design control applies to generation already underway.

`worker/transcription-api.js` handles only `/api/transcribe`, ahead of the generation JSON parser. It requires the same trusted Sites `oai-authenticated-user-id` boundary as Arena, POST, compatible origin, supported content type and a UUID attempt ID. Cross-site fetch metadata is rejected. Caller model/key/URL/identity claims are not used. The server builds one multipart upload to the fixed OpenAI transcription endpoint. No paid retries are implemented. Generation retains its 2 KiB body limit and all existing model settings.

### Bounds and actual limitations

- Capture: 30 seconds, 4 MiB, 250 ms requested chunks, 64 kbps requested bitrate. The time limit finishes and submits a recording just like Stop; Cancel discards it. These are application limits, not guarantees about encoder scheduling. MediaRecorder timeslices/timers can be delayed by a suspended/background browser. Oversized delivered chunks are discarded; the byte cap is also enforced by streamed server reads even with absent/false Content-Length.
- Formats: prefer supported audio WebM/Opus, then audio MP4; use final chunk MIME (or actual recorder MIME if chunks omit it). Ogg-only/unsupported encoders receive an honest unavailable state; no transcoding SDK was added. Header checks reject empty, mislabeled and obviously malformed containers before the paid request. Full codec/container validity is checked by the provider, not a local decoder. Synthetic header fixtures test routing and size handling, not actual decodability.
- Permission wait: 30 seconds; native listening bound: 30 seconds plus up to 4 seconds finishing; recorded stop bound: 4 seconds. Client transcription timeout: 30 seconds including upload/response. Server request-body timeout: 30 seconds, then a separate 30-second upstream/response timeout. Upstream JSON is capped at 8 KiB and validated to the game's 2–360 character rule.
- The server enforces bytes, admission and timeouts; it does **not** parse trusted audio duration from compressed containers. The UI enforces 30-second capture. A custom authenticated caller could encode longer audio within 4 MiB, so the advertised clip duration is not a server-enforced billing ceiling. No false duration header is trusted. A stricter duration-based billing boundary would require reviewed container-duration parsing/decoding or further infrastructure.
- Durable admission uses `generation_requests`, the existing 4 active / 30 global requests per minute / 8 per principal per minute limits, and 95-second leases. SQL uses the same predicates as `reserveGeneration`; a SHA-256 principal/attempt key and `INSERT OR IGNORE` reject duplicates atomically. No migration or shared-budget edit. Transcription and generation consume separate admissions and release separately. An unavailable/missing DB fails closed. This is tested with the real SQLite schema and existing generation admission together, not an in-memory-only claimed production limiter.
- Duplicate attempts are rejected while the admission row is retained (at least 60 seconds from admission, longer while leased). IDs are not permanent receipts. After retention expires, or with a new ID, another explicitly submitted request can reach the provider. No forever/exactly-once billing guarantee; request abort does not promise upstream billing cancellation. Slot release failure retains the bounded lease rather than increasing capacity.
- Audio/transcripts are not written to browser storage, application logs, repository recordings or database rows. Only existing admission identity/timing and hashed attempt identifiers are stored. Existing generated blueprint persistence remains unchanged; it stores the resulting design, not this controller's raw audio/transcript. No provider-retention claim is made.

## Provider selection, pricing and approval handoff

Official references refreshed during this run on 2026-09-14:

- [File transcription](https://developers.openai.com/api/docs/guides/speech-to-text): accepted file containers include WebM and MP4; the application's 4 MiB limit is tighter than the provider's documented 25 MB file limit.
- [Transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create): `gpt-4o-mini-transcribe` is supported; JSON is its supported response format. This economical supported model is selected for this bounded prototype; the guide's newer general recommendation does not require changing an existing supported model choice.
- [Official pricing](https://developers.openai.com/api/docs/pricing): estimated mini transcription cost **$0.003/minute**. Six clips of at most ten seconds total one minute, approximately **$0.003**. This is an estimate, not a guaranteed invoice or duration-based server cap.
- [GPT-5.4 pricing](https://developers.openai.com/api/docs/models/gpt-5.4): the unchanged source-default geometry model is **$2.50/M input tokens + $15/M output tokens**. Its existing 12,000-output-token cap corresponds to up to **$0.18 output cost per request, plus input**. Two creations: up to $0.36 output plus input at that model/rate. The actually configured generation model must be read-only verified before quoting a live test against a deployed environment; it was not changed or inferred from a different account.
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) and [isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static): support probing does not guarantee later recording success; runtime errors remain handled.

**No spending was authorized or used.** Proposed later test: at most six benign clips, ten seconds each, at most two resulting generated designs, with an aggregate **$1.00 test ceiling** after verifying the active geometry model/rate. Yerzhan must explicitly approve that current quote/count/ceiling and the benign recording upload before any real call. This is a proposed human-controlled test limit, not a new production billing limiter. ChatGPT/Codex credits are not assumed to pay the API project.

New server configuration name: **`OPENAI_TRANSCRIPTION_MODEL`**. Existing **`OPENAI_API_KEY`** and **`DB`** are reused server-side. Only the supported transcription model above is accepted; unset/unsupported configuration returns 503. No runtime values, secrets or audience policies were changed. No client-side model or key setting. Existing `OPENAI_MODEL`, detail and reasoning settings are untouched.

## Validation results

Node **24.19.0**, existing dependencies/lockfile. `npm run check:voice` runs dedicated scripts without changing the existing shared `check` registration:

- `check-voice.mjs`: 15 lifecycle groups, including native success/failure/stalls, MIME choice/final chunks, recording limits, permission/device errors, cancellations at each stage, old callbacks/new attempts, rapid toggles, timeout, pagehide, exactly-once creation callback and cleanup assertions.
- `check-transcription.mjs`: 11 handler groups with synthetic headers and isolated SQLite migrations, covering auth/method/origin/config/type, streamed bytes, malformed output, duplicate/lost-response admission, shared generation quotas, cancellation/deadlines/provider errors/no retries and actual Worker dispatch with unchanged generation limit.
- `check-voice-ui.mjs`: five DOM/integration groups: explicit notice/Record/Type without a modal, existing Left Arrow callback, menu/typing/pagehide cleanup, intact edit draft/new recording status. Main's KO/round/home/Arena wiring additionally has structural assertions; these are not a rendered gameplay transition test.
- `check-voice-harness.mjs`: executes the actual harness with real UI/input/controller in jsdom, covering synthetic record/finish, delayed cancellation, native success/failure and transition buttons.
- Existing full **`npm run check` passed**; this preserves aiming/contact/emitter/network/control/balance/movement/generation/round/support checks, including 44 contact groups, five emitter groups and nine delayed client fixtures.
- **`npm run build`, `node scripts/check-package.mjs`, and `node scripts/check-voice-package.mjs` passed**: 64 public assets, same three migrations, byte-identical assets, Arena/transcription auth boundaries, public-secret scan, development harness/test exclusion.
- `git diff --check` passed. Reserved/shared files listed above have no diff. Existing tests that name the old typing-only fallback still verify the compatibility callback; the new dedicated tests assert the actual Record/Type UI. No shared tests were deleted or weakened.

Logs: `validation/voice/full-check.txt`, `build.txt`, `package.txt`, `focused-check.txt`. All use synthetic descriptions/status output. No raw user recordings, transcripts, credentials or private headers in evidence.

Cloud browser could not open the local preview: both loopback and the normal preview host returned `ERR_BLOCKED_BY_CLIENT`. Setup was not repeated further. No browser pixels, real microphone, native Chrome/Brave speech, hosted API or two-account acceptance is claimed. The previous WebGL limitation was not re-probed because this task's local browser connection was already unavailable. Local Vite needed the explicit loopback host here to avoid network-interface enumeration failure; dependencies were not changed.

## Exact no-cost local review

Use supported Node 24.19.0 and the existing lockfile (`npm ci` only if dependencies are absent). Run:

```sh
npm run check:voice
npm run dev -- --host 127.0.0.1 --port 5173
```

Open **http://127.0.0.1:5173/__voice**. This development route uses the real UI/input/controller; all transcription fetches are injected local mocks and creation callbacks increment a counter. It never calls generation. Local `/api/transcribe` always returns 503, independently of the existing private generation preview configuration. Local Vite is still not multiplayer Arena.

1. Keep **Route → Synthetic recorder**. Click **Speak / Build**, read the notice, then **Record instead**. Expect Recording/countdown, Finish recording and Cancel voice. Movement keys remain independent. Click Finish or press **Left Arrow**; expect stopping → transcribing → ready, one mock transcription and one creation callback. The synthetic description is displayed, not a claim about what was spoken.
2. Check **Delay mock response 5s**, then **Reset route**. Record/finish; click **Cancel voice** during transcription. After five seconds creation callbacks remain zero. Repeat cancellation during capture and open **Help** or **Pause game** instead. Expect stopped capture/no callback and no stale panel after closing. Test the **Simulate KO / round end** and **Simulate home / Arena transition** buttons too; these test controller invalidation, not actual live match mechanics.
3. Choose **Synthetic native success** and Speak: exactly one creation callback, zero mock transcription calls. Choose **Synthetic native failure**: Record/Type choices appear. Repeated Speak should offer recording directly; it must not restart failed native speech. Choose **Type an idea** and submit a benign synthetic description to verify the existing editor.
4. For an actual local device check, select **Real microphone · no upload**. Only the local reviewer should deliberately grant this site's microphone permission after reading the harness's **no upload** notice. Speak → Record instead, say a benign phrase for 5–10 seconds, then Left Arrow. Audio is discarded in memory; the result is deliberately the same synthetic text. Check the microphone indicator turns off on stop/cancel, permission denial does not loop, and a late allowed permission after Cancel does not start capture. No raw audio is saved or playable; the harness needs no provider key.
5. Repeat recording-only in current **Chrome and Brave**, recording the browser/OS version manually. Check default MIME support, stop finalization, time-limit finish, cancellation, device loss if practical, Help/typing and pagehide. Check desktop/narrow viewport notice, countdown, stop/cancel reachability, keyboard focus and text size. Safari/Firefox should be recorded separately if tested, not inferred.
6. In local Practice (no paid voice), inspect the new notice/UI against the rendered game, and recheck Down/G/T, movement/attack and the pending presentation/balance review. The isolated harness does not substitute for these pixels.

## Later paid and hosted acceptance (not performed)

After explicit cost/upload approval and a separate reviewed release decision, verify the exact creator target, deployment/source and active server configuration without copying credentials. Use existing authorized accounts only; no access expansion/reset. On Chrome and Brave record one benign description, deliberately stop/cancel/retry, and verify the displayed words and one resulting creation. Check native success where the browser service works and native failure → explicit recording where it does not. Confirm canceled uploads never start a later creation and no automatic retry occurs after a failed/lost response. Observe only sanitized request counts/status and user-visible behavior; do not export audio payloads or session headers. Actual microphone/service availability and transcription accuracy remain browser/device/provider-dependent.

## Review/integration boundary

Deliver one focused local implementation commit and portable patch based on GitHub `7b516548e159f35a37c91cf2d032c0d37f214b1d` (creator equivalent `7000960b2d1b40e5cb69b030c3f43f94b02f7c3d`). Patch excludes both account-specific manifest/README differences. Commit SHA and patch applicability result are returned with the handoff, since a commit cannot include its own hash.

Changed paths: new `public/voice-controller.js`, `worker/transcription-api.js`; narrow `public/ui.js`, `public/main.js`, `public/style.css`, `worker/index.js`, `vite.config.js`; dedicated `package.json` script; new five `scripts/check-voice*.mjs` / `check-transcription.mjs` scripts, this report, `validation/voice-harness.html`, and dedicated validation logs. The exact list is available with `git show --stat`.

**No push, publication, runtime change, paid call, schema/record migration or camera integration.** R/F labels/test registration remain pending Hadrien's agreed ready branch. Compare both branches before merging; preserve his precise hunks and rerun combined validation. New code stays owned by this voice branch until that comparison. Creation slots, broad hotkeys, Practice redesign, maps and balance changes were not implemented.
