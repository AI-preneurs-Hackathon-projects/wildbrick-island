# Brickwild follow-up: activate voice and finish creation shortcuts

Yerzhan wants you to continue the existing creator-account session. Start messages with Yerzhan. Complete useful implementation and validation, not another broad plan. Maintain a dedicated progress document and preserve unrelated work.

## Synchronize first

Repository: https://github.com/AI-preneurs-Hackathon-projects/wildbrick-island. Refresh main and record the exact SHA. This prompt is delivered alongside the recorded-voice availability fix, after merge `753ad5b` integrated Hadrien's `3f35086` camera branch into voice baseline `256ef38`. The containing fix commit must be present. Do not stop at `753ad5b` or reapply Hadrien's older complete UI file. Verify source has:

- R/F camera pitch with visible hints; Q/E camera rotation; weapon pitch remains zero.
- Down descends, G drops/dismounts, T picks up.
- `/api/transcription-status` and its pre-microphone check in `voice-controller.js`.
- `npm run check` includes camera and voice suites.

Creator history may differ. Compare source blobs rather than demanding matching creator SHAs. Preserve creator manifest/README while reconciling gameplay changes. Never overwrite GitHub's Hadrien identity with the creator account's manifest.

Read AGENTS.md, hosting configuration, `planning/CAMERA_VOICE_INTEGRATION_REVIEW.md`, `planning/VOICE_IMPLEMENTATION.md`, and current progress before editing. Old report statements such as no push/version 18 describe historical checkpoints. Latest owner report was version 19 deployed at the voice baseline; verify live source/version/deployment afresh.

## Scope and order

1. Synchronize the combined source; inspect recorded-voice configuration and prepare real-browser acceptance.
2. Implement visible, consistent gameplay hotkeys and five recent creation slots with 1–5 selection.
3. Validate the combined result and provide a release-ready handoff.

If real microphone, two authorized players or paid-test approval is unavailable, record that exact gate as pending and continue the independent hotkey/creation work. Do not pretend mocks close live acceptance. Do not implement the interactive Practice tutorial, new maps, combat rebalance or unrelated refactors in this slice.

## Creator identity and voice activation

Exact creator project: `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`.
URL: https://brickwild-adventure.yerzhan452067.chatgpt.site/.
GitHub manifest intentionally belongs to `appgprj_6aa6b740f7908191b26dc41dfb7cf9cb`.

This local Codex account received project not found for the creator target; your existing creator-account session is the intended place for these actions. Reuse the target and existing credentials; do not create another site, broaden access, export secrets or change the database. Never drop/delete/terminate/restart a database. No reset or migration is needed.

Read the active settings without printing secrets. The current code accepts `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`, with the existing server-only `OPENAI_API_KEY` and DB binding. Do not change the geometry model. Prepare the exact minimal settings update; apply it within Yerzhan's authorization to finish voice configuration in this session. Preserve other values and audience. Explain that enabling the route permits real API usage; the local status check itself makes no provider call and is not a credential-health probe. Do not claim configured=true means a transcript has succeeded.

Before any paid validation, refresh the official model/pricing documentation, verify the active geometry model, and present one concrete bounded test proposal for approval. Prior report proposed six benign clips of at most ten seconds each, at most two generated designs and an aggregate $1 test budget. That historical estimate is not approval and is not a server-enforced billing cap. Do not assume ChatGPT/Codex credits pay the API project. No automatic paid retries. Prepare all no-cost implementation/test work while awaiting that approval.

Official model reference verified during local handoff: https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe. Refresh pricing at https://developers.openai.com/api/docs/pricing before quoting costs.

Real acceptance, when authorized and available:

- Current Chrome and Brave, record exact browser/OS and source/version. Use a deliberate microphone action and benign phrase, verify transcript and one resulting creation.
- Working native recognition remains independent of recorded-service availability. Native failure offers recording and typing. Missing recording configuration is explained before getUserMedia/audio upload.
- Test cancellation during readiness, permission, recording and transcription; reject stale responses and duplicate creation. Test explicit retry after a configuration change.
- Test Help/menu, home/Arena, KO/round and pagehide cancellation in the actual app. Do not confuse harness transition buttons with real match transitions.
- Retain the existing limited duplicate-retention window and byte/time bounds. Thirty-second capture is client-enforced; compressed audio duration is not verified server-side. Do not describe it as a strict billing ceiling.

Local `/__voice` has explicit synthetic/no-upload routes. Local Vite transcription remains unavailable and must not silently proxy audio to production.

## Visible hotkeys and recent creations

Inventory the actual actions and keyboard handlers first. Use one binding definition for dispatch, visible key labels, Help and aria-keyshortcuts. Preserve WASD, Shift, Q/E/R/F, arrows, G/T, H and P/Esc. Never restore R/F weapon tilt. Avoid duplicate handlers, key-repeat double actions, browser shortcuts and controls firing while typing or navigating dialogs. Keep composition/IME, blur, pause, KO and round guards intact.

Add a discoverable shortcut for Your creations, preferably C if the complete inventory confirms it is unused. Display that key on the actual gameplay button and in Help. Give other gameplay actions appropriate visible shortcuts from the same inventory; use scoped dialog shortcuts or normal Tab/Enter/Escape for dialog actions rather than globally triggering hidden buttons. Include touch-friendly labels and accessible names. Do not crowd the HUD with a second duplicate control legend. Record the final action-to-key table and verify it has no conflicting actions in the same context.

Expose at most five most-recent distinct creations as numbered slots 1–5, consistently across the gameplay shortcut UI, collection and any recent-creation list in the typing modal. Use deterministic newest-first order. Completing a new design adds it at the front and evicts the least-recent visible slot; rebuilding a slot should not unexpectedly reshuffle the other numbers. Repeated keydown should not repeatedly rebuild. Empty slots do nothing safely and show no misleading available label.

Reuse the existing saved-blueprint rebuild path: selecting a slot must not call paid generation. Preserve Arena rules, cooldown/build constraints and cancellation behavior; slots must not grant free instant equipment or bypass the server. Guard callbacks against stale slot indices after new creations arrive. Keep input while typing descriptions/names from selecting equipment. Offer equivalent pointer/touch selection.

Handle existing users with more than five stored creations without destructive migration: derive the five-slot recent view and preserve older saved records where the current storage architecture permits it. Do not clear localStorage, remove unrelated progress or reset users' kits. Document the chosen retention behavior. Test reload, missing/corrupt storage, duplicate designs and unavailable storage. Do not overwrite old equipped-kit stats outside the existing ordinary rebuild paths.

## Collaboration and tests

Hadrien's camera work is merged. Check for newer work/coordination before touching shared files. This slice owns the input/action-binding/UI/creation integration required above; don't assume the earlier one-hour reservation still describes current ownership. If another contributor is active in the same files, coordinate exact scope before edits. No automatic external messages.

Preserve combat: 15° bounded body-forward handheld convergence, fixed mounted barrels, camera-independent shots, attached weapon presentation, stale-ACK guards and damage punch27/sword42/knife20/hammer60. Local combined source passed full tests/build/package, rendered camera/help/unavailable-recording checks, synthetic voice success/cancel, and rendered pulse range/cover/protection/punch/flight fixture checks. Those are not real hosted two-player acceptance or human balance approval.

Add meaningful behavior tests for hotkeys/slots: no collisions, typing/menu suppression, repeat/blur, 0/1/5/6+ records, deduplication/order, storage recovery, pointer-key equivalence, one rebuild with zero generation, Arena constraints, matching HUD/Help/aria labels. Update older assertions to the intended behavior; don't delete coverage to make tests pass.

Use Node24 and the existing lockfile. Run focused tests first, then full `npm run check`, `npm run build`, `node scripts/check-package.mjs`, `node scripts/check-voice-package.mjs`. Keep development fixtures out of the package and preserve the three migrations. Render actual Practice and Arena UI if available. Capture screenshots and inspect them. A blocked browser/microphone is a documented limitation, not reason to repeatedly reinstall the environment or fabricate acceptance.

Two-player acceptance with existing authorized players remains required for release confidence: movement/fire attachment, stale-ACK behavior, pulse/contact/cover/protection, Down/G/T, camera independence, fresh/legacy kits and slot rebuild behavior. No fake identities or production-record manipulation to simulate a second player.

## Delivery

Make focused implementation commits with meaningful names, including directly related reports/tests. Preserve others' changes. Provide exact source/base SHA, changed paths, test results, browser evidence and separate implementation/configuration/deployment/acceptance statuses.

Push reviewed changes only within the current session's GitHub authorization, refresh main before pushing, and never force-push over Hadrien. Prepare the creator release against exact tested source and identity. Do not interpret the completed version19 publication as blanket authorization for another production release; if no current publication authorization exists, finish a concrete release candidate and ask for that final action only. A settings change and a source deployment are separate events; report both truthfully.

Return a concise next-action handoff. Mark microphone/paid/two-player steps pending if they were not performed. Interactive Practice without rewards is the next separate feature iteration after this work, not part of this prompt.
