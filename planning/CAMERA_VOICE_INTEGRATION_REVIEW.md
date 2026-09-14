# Camera and voice integration review — 2026-09-14

Main baseline `256ef38`; Hadrien's camera commit `3f35086`; resolved merge `753ad5b`. The subsequent availability-fix commit also contains this report and the follow-up handoffs. Read the containing commit SHA from Git rather than treating a creator-account SHA as interchangeable.

## Changed behavior

- Merged Hadrien's R/F camera controls and labels into the voice-enabled interface. Both UI conflicts were resolved without restoring the old typing-only fallback. Q/E and Down/G/T stay intact; camera pitch does not change weapon pitch.
- Record instead now performs an authenticated, no-store GET to `/api/transcription-status` before requesting microphone access. It checks again on every explicit attempt; native recognition never depends on this endpoint. Missing configuration, sign-in failure, invalid response or an eight-second timeout prevents microphone capture and audio upload. The UI explains the failure and offers typing; another Speak action can retry after configuration changes.
- The status response reveals only a `configured` boolean. It checks key/model/DB binding presence without a provider request, quota reservation or database operation. It is configuration readiness, not a claim that credentials, the database or the provider are operational. POST transcription remains authoritative and can still reject a later change/failure.
- Cancel during readiness, including synchronous UI cancellation, invalidates callbacks and releases timers. New regressions caught and fixed a cancellation race before microphone permission.
- `npm run check` now includes the dedicated camera regression and `npm run check:voice`, so ordinary validation cannot silently omit the voice slice.

## Validation

Node 24.19.0: full `npm run check`, build, package check and voice package check passed on the combined source. Includes six camera groups and ten new availability groups, as well as existing voice, aiming, contact, emitter, network, control and balance checks. Package: 64 assets, same three migrations, development fixtures excluded, byte-identical source assets and public-secret scan passed.

Local Chrome with software WebGL, isolated profile, 1440×900:

- Rendered ordinary Practice, held R/F and visually checked changed camera views; merged Help shows camera and voice instructions.
- Missing transcription configuration: real local status request, zero microphone requests, zero audio POSTs. Disabled Record action and typing alternative shown before recording.
- Rendered synthetic recording: one mock transcript/creation callback. Cancel during a delayed mock response: zero creation callbacks.
- Rendered combat harness: zero-spread carried pulse contact at 2/5/10/20 m; cover and protected targets take no damage; controlled default-armor punch KO is five hits / 2130 ms; flight descent retains the kit and the separate drop action returns to foot.
- Viewed weapon presentation after the harness movement/old-ACK actions; the old-ACK fixture reports the current 2.28-degree angle. This is a limited rendered smoke check, not exhaustive visual/latency acceptance.
- No JavaScript page errors in the completed browser run. The initial skill client recorded a missing favicon 404; no application exception. One first pass was interrupted by a development reload and rerun successfully after edits stopped.

Sanitized browser/status evidence: `validation/integration/browser-review.json` and `validation/integration/combat-review.json`. Screenshots were inspected locally under `/private/tmp/brickwild-camera-voice-review/`; that temporary location is not a portable artifact. The supplied game-skill client was run using installed Chrome because its bundled Playwright browser was absent; targeted Playwright scenarios supplemented it.

## Remaining limits and handoff

No real microphone recording, live transcription, paid generation, hosted two-account acceptance or Sites deployment occurred in this local integration. The creator account reports version 19 deployed at the prior source. This account's native Sites lookup returned project not found for that creator project; no replacement site was created.

GitHub hosting identity remains Hadrien's `appgprj_6aa6b740f7908191b26dc41dfb7cf9cb`. Creator target remains `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`. Neither configuration, audience nor database was changed. Keep the published-state claim separate from this GitHub integration.

The next creator-account task should synchronize the containing commit, finish voice configuration/acceptance, and implement the bounded visible-hotkeys/five-recent-creations slice. Interactive Practice without rewards remains a later iteration. See `VOICE_ACTIVATION_AND_CREATION_SHORTCUTS_MASTER_PROMPT.md` and `HADRIEN_WHATSAPP_UPDATE.md`.
