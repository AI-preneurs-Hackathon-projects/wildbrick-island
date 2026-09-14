# Voice activation and creation shortcuts — 2026-09-14

## Synchronization and release boundary

GitHub main refreshed: `d8aa2119a852e7568ad61a33bd8d724d922b2df9`, tree `32292750048b710523999b9ad88fda6b3b36a7cb`. This includes Hadrien's `3f350866de4dde5aa759b71e9bd2c2252c363429`, merge `753ad5bb7694aa7de24086570844ccd34e34638e`, AND the recorded-readiness fix. Creator starting source `f461e752cc58145b9a2e9e6047bec7a5059e7ddf` is equivalent to GitHub `256ef381013b2cac75f402ba4e99e0cca05631b6` except intentional hosting/README differences. All 22 changed GitHub blobs are fetched by SHA and verified before synchronization. No applicable AGENTS.md found. Read CAMERA_VOICE_INTEGRATION_REVIEW, VOICE_IMPLEMENTATION, shared progress and the unsent coordination draft. No open PRs were returned; no message was sent externally.

Dedicated branch: `feature/voice-activation-creation-shortcuts`. Current slice owns input/bindings/UI/creation integration. Hadrien's merged camera controls remain; no older complete UI replacement. New progress lives here; historical progress files are retained.

Native Sites refresh confirms original creator project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`, owner role, custom audience revision 3. Live version 19, creator source `f461e752cc58145b9a2e9e6047bec7a5059e7ddf`, deployment `appgdep_6aa7aba7a4648191b8e197fd47995825`, succeeded, environment revision 6. This is the prior voice baseline, not the new camera/readiness/shortcut source. GitHub's Hadrien manifest is preserved separately.

## Voice configuration

Read-only runtime inspection: existing secret key present; geometry model `gpt-5.4`, compact blueprint detail and reasoning effort none. Authorized minimal settings update applied: only `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe`, environment revision **7**. Other keys/audience/data unchanged. **The new revision requires a subsequent deployment to take effect. No new deployment is authorized by this task's version-19 reference, and none is performed yet.** Readiness is a local configuration check, not a provider/key-health probe or successful transcription. Enabling the route permits real API usage on a deliberate recorded attempt.

No paid transcription/generation, microphone permission or two-player test has been performed. A refreshed bounded paid-test proposal and real-browser checklist will accompany the completed implementation. Work continues independently on hotkeys and slots.

## Completed implementation and retention

The synced source includes `/api/transcription-status`, its pre-microphone readiness check, R/F camera pitch and all voice/camera suites. The implementation adds `creation-slots.js`, shared C/1–5 actions, common pointer/keyboard selection and visible HUD/Help/aria hints. Names and saved blueprints never enter a generation request when rebuilding. The ordinary Practice assembly or authenticated Arena build command remains the only equipment path. Arena still applies 1.2-second assembly, its 10-second build cooldown and lifecycle/command guards.

Five newest **distinct validated blueprints** are exposed identically in the HUD, collection and typing modal. Empty slots are disabled and have no available aria shortcut. Buttons capture displayed blueprint identity and reject stale indices. Dialog choices are scoped pointer/Tab/Enter actions; gameplay digits never select equipment while typing or in a dialog. Rebuilding does not call `remember`, so numbers remain stable. Completing a design moves that distinct design to the front.

The existing adventure store retains **up to 12** records. This slice derives five active slots and exposes records 6–12 under **Older saved designs**, without reducing the existing cap, rewriting production rooms or clearing storage. Existing behavior still evicts the oldest stored design when a thirteenth distinct design is completed. No promise of unlimited history or recovery of already discarded records. Missing/corrupt/unavailable device storage continues to recover safely into a usable in-memory session. Validated saved records are treated as immutable; a WeakMap caches their JSON identity to avoid serializing all geometry on every HUD refresh.

### Final gameplay binding inventory

| Action | Keys | Context |
| --- | --- | --- |
| Move | W / A / S / D | Gameplay |
| Run | Shift | On foot |
| Jump / rise | ArrowUp / Space | Gameplay |
| Lower / descend | ArrowDown | Gameplay, usable descent |
| Drop / dismount | G | Equipped, not assembling |
| Pick up recoverable item | T | Arena, empty hands, nearby item |
| Attack | ArrowRight | Gameplay |
| Speak / finish | ArrowLeft | Gameplay voice callback |
| Camera horizontal look | Q / E | Gameplay, independent of weapon |
| Camera pitch | R / F | Gameplay, weapon pitch remains zero |
| Help | H | Gameplay / Help menu |
| Menu | P / Escape | Gameplay / ordinary menu |
| Your creations | C | Gameplay; pointer equivalent in both modes |
| Rebuild recent slot | 1 / 2 / 3 / 4 / 5 | Gameplay, occupied slot, normal build rules |
| Dialog actions | Tab / Enter / Escape | Focused dialog controls; no global numbered rebuilds |

One physical key maps to one gameplay action. Ctrl/Meta/Alt, composition, typing, blur, menus, home, KO, round end and repeated keydown retain their guards. Touch movement, flight and item buttons remain independent. Existing H/P/Escape dialog behavior is retained; C opens the collection, Escape returns to play.

## Validation — 2026-09-14

Node 24.19.0; unchanged lockfile/dependencies. Focused 10 shortcut/storage groups pass. Existing control separation (7), camera (6) and voice-readiness (10) groups pass. Full `npm run check` passes on the combined final source, including combat/contact, nine delayed bow/punch/pulse fixture cases at 50/150/300 ms, five emitter groups, aiming/presentation, movement, rounds, saved generation, camera and voice suites. The nine cases include the prior six bow/punch cases. The only intentionally updated old assertion adds the visible Shift hint to the existing movement/camera hint inventory; no regression was removed.

`npm run build`, `node scripts/check-package.mjs` and `node scripts/check-voice-package.mjs` pass: 65 byte-identical public assets, three migrations, unauthenticated Arena/transcription 401, development routes excluded, public secret scan passed. The initial full pass was repeated after the final cached-identity and fixture/presentation edits; the final build/package pass follows those edits. No paid calls or production database tests.

### Actual browser evidence and limits

The supervised cloud preview became reachable. The actual game root still reports that this browser cannot start 3D graphics; setup was not repeated. The development `/__creations` route rendered the **real Practice HUD, Arena HUD and collection UI over a plain fixture background**, not a rendered island or multiplayer match. Screenshots were captured and visually inspected at 1363×936:

- `voice-shortcuts/practice-hud.png`: C and numbered slots, Shift/Q/E/R/F hints, Help and pause shortcuts.
- `voice-shortcuts/arena-hud.png`: one visible C collection button beside vitals, numbered slots, correct Punch/Jump hints. The fixture panel is development-only.
- `voice-shortcuts/collection.png`: five numbered full-name choices, older-record disclosure, normal dialog actions.

Browser clicks rebuilt a selected saved design once with generation count zero. C opened collection; a digit inside its dialog did nothing; after closing it the digit requested one ordinary Arena assembly. These observations are UI fixture evidence. No cloud microphone, native Chrome/Brave service, paid API, real match lifecycle or real hosted two-player acceptance is claimed. Narrow/coarse-pointer layouts, 200% text zoom and rendered WebGL play remain for local review.

## Local no-cost handoff

Use the tested Node 24 runtime. If dependencies are absent, `npm ci` with the existing lockfile; then:

```sh
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/__creations`:

1. **Records** selects 0/1/5/6/12 in-memory derived fixtures. Check empty/occupied slots and C. Click a numbered HUD slot or press its digit: **Rebuild requests** increases once, **Generation requests** remains 0. Holding a digit does not repeat. **Finish assembly** clears the fixture assembly; Arena cooldown still applies.
2. Open **Your creations**. Five newest names/numbers match HUD. Expand **Older saved designs** and rebuild an older design; active numbers stay fixed. Open **Type an idea**: typing digits/C never equips anything. Tab/Enter/Escape remain scoped dialog controls.
3. With the collection open, click **Complete new design** only after closing the dialog (the fixture panel remains outside its modal boundary); reopen and confirm newest-first order. Deterministic tests separately inject the genuine asynchronous arrival while a menu is open and prove stale callbacks reject.
4. **Switch to Arena UI**, **Toggle KO**, **Toggle round end**, **Finish assembly** check disabled controls and restoration. These buttons are fixture state changes, not actual live transitions. Practice and Arena fixture modes use existing UI; Arena assembly uses the pure trusted simulation.
5. Repeat at desktop, narrow portrait, landscape/coarse pointer and 200% text zoom. Check the slot strip does not obstruct joystick, action/flight controls or the voice notice. Full names are in tooltips/accessibility names and the collection; compact HUD names are ellipsized.
6. For actual local rendering, open `/`, enter Practice and use existing saved designs on that local origin. Verify C/1–5, jump/flight/Down/G/T and independent Q/E/R/F. Local Vite still returns 503 for real Arena and transcription and does not proxy audio.

For no-upload voice review use `/__voice` and the existing explicit synthetic or recording-only controls documented in `VOICE_IMPLEMENTATION.md`. Actual microphone access requires a deliberate local action. No fixture writes creation history; normal tutorial dismissal can still set the existing tour-seen preference.

## Paid-test proposal — approval still required

Official model and pricing docs refreshed 2026-09-14:
- https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-5.4

Propose at most **six benign clips, each at most ten seconds**, and **two generated designs**, with a manually monitored aggregate **$1 test budget** and no automatic paid retries. `gpt-4o-mini-transcribe` is listed at approximately **$0.003/minute**: at most one minute of clips is about **$0.003** transcription. The unchanged active geometry setting is `gpt-5.4`, **$2.50/million input tokens and $15/million output tokens**. At the existing 12,000-output-token bound, two designs can use up to **$0.36 in output tokens plus input cost**. Actual billing is usage-based; the $1 proposal is not a server-enforced cap and ChatGPT/Codex credits are not assumed to pay the API project.

Before any paid validation, Yerzhan must explicitly approve that count/duration/budget and deliberate benign-audio uploads. Activation permits provider calls after recorded consent; readiness itself makes no provider request and configured=true does not prove credentials, DB health or transcription success. Thirty-second capture is client-enforced; compressed duration is not validated server-side. The 4 MiB server bound, limited duplicate-retention window and no-automatic-retry behavior remain as documented.

## Outstanding real acceptance and publication

After separate source-deployment approval, refresh source/version/config on the exact creator target. In current Chrome and Brave, record browser/OS versions, use explicit microphone consent with a benign description, inspect transcript and one resulting creation. Exercise native success independently of recorded configuration, native failure → recording/typing, readiness/permission/capture/upload cancellation, explicit retry after configuration change and no stale/duplicate creation. Check Help/menu, home/Arena, KO/round and pagehide in the actual application.

Use two existing authorized signed-in accounts for movement-attached weapons, stale-ACK presentation, pulse/contact/cover/protection, Down/G/T, camera independence, fresh/legacy kits and slot rebuild/cooldown at representative 50/150/300 ms delays. No fake identities on production, access expansion, token capture or record manipulation. These remain pending and are not replaced by delayed fixtures.

GitHub main was refreshed again and still equals `d8aa2119a852e7568ad61a33bd8d724d922b2df9`. The completed source is eligible for the session's authorized non-force GitHub advance after commit and patch verification. **No new Sites source version or deployment has been performed in this slice.** The existing succeeded version19 deployment is distinct from the newly saved environment revision7 and this release candidate. A final publication decision is required by the current follow-up's explicit release boundary.

Interactive Practice without rewards remains the next separate feature; no tutorial, map, combat balance or speech-model redesign in this slice.
