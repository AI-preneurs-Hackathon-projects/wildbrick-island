# Brickwild / Wildbrick Island

Yerzhan’s existing 3D toy-brick game, now centered on a shared fighting arena:
**Choose Explore or Arena → speak an idea → watch it build → explore or battle.**

[Play Brickwild](https://brickwild-island.hadrienroy.chatgpt.site/) · [GitHub main](https://github.com/AI-preneurs-Hackathon-projects/wildbrick-island/tree/main)

## Playing

Enter a builder name on the home screen and choose **Explore** for the existing solo challenges or **Arena** for the shared **ISLAND**. The name is limited to 20 characters and retained for the browser tab through refresh/sign-in when session storage is available. Enter in the name field chooses Explore. Arena preserves the latest speech, combat, supplies and generation systems, without a room-code form, eight-player seat limit or automatic room splitting. Site sign-in and viewer access still apply. The pause menu offers **Exit to home** in either mode. It clears Arena state immediately, even offline, and returns to the builder-name screen. The join/reconnect dialog retains Back to Explore. A transparent 3D builder preview floats on the right of the home screen: drag or use left/right arrows to rotate, and select one of eight shirt colors. The color is saved on this device when storage is available, used in Explore, and shared with other Arena players on joining.

First entry offers three short illustrated cards with Next and Skip, adapted to the chosen mode. They appear once per device and can be reopened through Help. The illustrations use the game’s actual procedural meshes and an existing generated dragon, rendered offline. Help also contains saved creations, sound settings and a discreet typing fallback. Microphone denial or unsupported speech opens that fallback automatically. Speech recognition uses the browser’s service; the game sends the recognized description, not a recording, to its generation API.

| Action | Desktop | Touch |
| --- | --- | --- |
| Move / run | WASD / Shift | Left joystick |
| Look / aim | Q/E horizontally, R/F vertically; drag the world | Drag the world |
| Attack | Hold →; short taps also work | Hold Punch / Fire / Swing |
| Speak / finish speaking | ← | Speak / Build |
| Jump / rise | ↑; Space also works | Jump / Rise |
| Lower, including after airborne dismount | ↓ | Lower |
| Dismount | Backspace | Contextual On foot button |
| Help | H | Help |
| Menu / close dialog | P / Escape | Pause / close / Back to play |

Text entry, browser modifiers, focus loss and dialogs suppress gameplay shortcuts. The multiplayer match continues while a menu is open. Leave arena lives in the Escape/Pause menu. The leaderboard starts expanded, has a translucent background and can be collapsed. Enter-to-Imagine, Home/recovery, preset-build shortcuts and the old Explore/Arena entry choice are superseded. Legacy Explore, room API support and original procedural models remain in source for compatibility and regression checks.

## Combat and movement

Empty-handed builders visibly punch: 18 base damage before armor, 2.2 m range, 0.5 s cooldown and 0.13 s authoritative windup. Punches keep the builder’s current facing even when the camera looks elsewhere. A strike resolves once, requires facing and clear short-range contact, and cannot repeat damage on a retried command. Shields retain protection and punching. Unarmed vehicles do not shoot.

Trusted weapon families provide visible sword swings, arrows, automatic tracers/muzzle flashes, and flame emitted from a generated dragon’s authored mouth position. Body and vehicle facing follows movement, never the firing animation. Carried ranged weapons pivot at their grip to follow horizontal and vertical aim; mounted emitters stay attached to the vehicle. Confirmed shot events carry projectile IDs, origins and velocities, so even shots that hit between snapshots have visible travel followed by feedback at the authoritative contact point. Ground strikes now emit impact events, and range expiry does not invent a hit. Immediate local attack animation is separate from confirmed impact events. Confirmed hits flash and flinch the target, change health and play nearby sound. Creation destruction, defeat, blocked hits and 12-second respawn have distinct feedback. Armor, creation health, weapon trade-offs, pickups, KOs and spawn protection remain bounded server rules. Sky drops cycle through health, defense and speed support only. Existing equipment drops are removed from persisted matches. These pickups retain their effects and never replace an equipped or building creation. Weapons and vehicles remain available through creation with no added lifetime. The legacy rover blueprint remains readable for already-created loadouts. Spoken creation still generates new geometry independently. Model-generated code is never executed.

The existing ring road, colored houses and central plaza remain, with four major brick rocks providing additional cover. Houses, major rocks and placed creations block movement using shared swept boxes with sliding. Trees and small decorations remain passable; shot cover is queried separately. Large mounts use conservative footprints and need broad routes. Builds that do not fit retain the old kit and pose, with a prompt to move into open space and rebuild the saved design. Restoring destroyed cover waits for occupants to leave. Camera obstruction fades houses/rocks locally without moving the camera toward them.

Walking, driving and flying stop immediately when controls release. Flight uses explicit rise/lower and hover. Airborne dismount holds altitude; lower to descend. Jump is one scripted jump per press. There is no rigid-body engine, gravity, momentum, bounce, ramming or scenery crash damage. Ordinary snapshots, equipment changes and connection errors do not intentionally relocate an idle player. Explicit joining and real defeat/respawn can relocate. Acknowledged movement frames prevent duplicate movement on retries and reject pre-death frames after respawn. Expiry retains the displayed pose and offers Rejoin.

## Creation pipeline

The server calls OpenAI Responses with strict Structured Outputs to generate **new free-form geometry**, joints, seats and emitters. It does not select a preset. Device-local blueprints rebuild without another OpenAI request; up to 12 designs and legacy progress are retained when browser storage is available.

The compact schema is version 4: 20–64 parts, with a prompt targeting 20–40 meaningful parts. Versions 1–3 retain their original limits and coordinate compatibility. Fresh v4 output can repair uniformly one-based array references when the range makes that interpretation unambiguous. Mixed references and invalid data are rejected; saved blueprints and arena uploads still use the strict validator directly. Simpler geometry may have loose appendage joins; schema validity does not prove visual quality.

Assembly now takes **1.2 seconds**, down from 2.8. Movement remains active during the request and assembly. The uploading client reuses its already-received blueprint instead of immediately downloading it again. Cancellation, stale-response protection, busy errors, saved rebuilds and manual retry remain. There is no rough-model/detail-replacement pipeline.

Server runtime settings:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only secret; the new Site needs its own key configured through secure Sites runtime settings |
| `OPENAI_MODEL` | Selected model; source fallback is `gpt-5.4` |
| `OPENAI_BLUEPRINT_DETAIL` | `compact` selects v4; other/unset selects legacy detailed v3 |
| `OPENAI_REASONING_EFFORT` | `none` or `low`; unset source fallback is low |
| `DB` | Sites-managed D1 binding |

The new Site is configured for GPT-5.4, compact geometry and no reasoning effort; new AI designs remain unavailable until its own OpenAI key is configured. The final three live trials took 9.9–27.1 seconds per request; model work took 9.0–12.5 seconds. See [VALIDATION.md](VALIDATION.md) for comparisons, costs and limits. API model access was verified for GPT-5.4 and GPT-5.4 Mini. Secrets are never needed in browser code or repository files.

D1 admission provides four expiring global generation slots, 30 starts/minute for the Site and eight starts/minute per requester, alongside two upstream requests per isolate and bounded body/output/time limits. These are resource protections, not player limits. A missing/unavailable admission database returns a retryable error. API account spend limits remain the billing boundary; cancellation cannot guarantee an upstream request is unbilled.

## Multiplayer architecture and capacity

The trusted Sites identity binds arena sessions to players. The browser cannot set authoritative positions, damage or scores. HTTP synchronization uses acknowledged movement frames, monotonic commands and acknowledged event cursors. Responses send new combat events instead of retransmitting the entire recent event history. Same-isolate room writes are serialized; D1 compare-and-swap and bounded randomized retries protect cross-isolate writes.

There is no advertised unlimited capacity. Synthetic tests cover 10, 20, 40 and 80 players, including four independent storage contenders and flame-heavy simulation. At 10 players, event acknowledgements reduced the stress-test snapshot from about 84.6 KB to 23.0 KB. The full room is still a shared JSON D1 row, and player/projectile snapshots still fan out to everyone. This architecture needs production measurement before a large public launch; a single authoritative broadcaster with persistent connections is the likely next step if sustained crowds require it. No incomplete networking migration or small-room workaround is included.

Security/resource bounds remain: 12 sessions per principal, bounded request packets and update rate, two placed objects per player, 24 outstanding projectiles per shooter / 2,048 globally, and five seconds of events with a bounded player-scaled retention count. Heavy load may cause reconnect feedback rather than silent room splitting. See measured evidence and exact test limits in VALIDATION.md.

## Development and publication

JavaScript ES modules, vendored Three.js 0.180.0, Vite preview, esbuild Worker packaging, Drizzle migrations and Sites D1. Runtime Rapier is removed; historical vendor files are retained only for source recovery and licensing.

```sh
npm ci
npm run check
npm run build
node scripts/check-package.mjs
node scripts/check-capacity.mjs
node scripts/check-capacity-combat.mjs
npm run dev -- --host 0.0.0.0 --port 4173
```

Vite serves the frontend and development-only `/__controls` and `/__layouts` UI harnesses. It is **not a local Arena backend**. Tests call the actual Arena handler against SQLite executing the committed SQL through a D1 adapter, with isolated test identities. Production acceptance requires real signed-in Site sessions. An optional ignored server-side preview connection can proxy generation; never use a `VITE_` credential or forge identity headers.

`npm run build` writes `dist/server/index.js`, embeds the 45 public assets, and packages hosting metadata plus all three Drizzle migrations. `.openai/hosting.json` identifies the existing Sites project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb` and D1 binding. Reuse this identity and preserve its audience. Push the exact source to the configured Sites source repository before saving and publishing a version with the supported Sites workflow.

The GitHub and historical Sites histories differ because the original verified snapshot was transferred through object APIs. Every completed stage of this release is committed on GitHub `main`; matching Git tree hashes verify file equality independently of differing commit ancestry. GitHub publication and Site deployment are separate operations. Never force-push either branch over newer work.

## Source map

| Area | Files |
| --- | --- |
| World and procedural assets | `public/main.js`, `world.js`, `world-data.js`, `models.js` |
| Controls, speech, onboarding | `public/input.js`, `ui.js`, `arena-ui.js`, `style.css`, `tutorial/` |
| Movement and prediction | `movement.js`, `movement-blocking.js`, `movement-stream.js`, `motion-view.js`, `follow-camera.js` |
| Authoritative combat and presentation | `arena-core.js`, `combat.js`, `combat-pose.js`, `arena-client.js`, `arena-view.js`, `audio.js` |
| Generated data and rendering | `blueprint.js`, `blueprint-metrics.js`, `generated-model.js`, `creation-service.js` |
| API and persistence | `worker/index.js`, `arena-api.js`, `arena-store.js`, `generation-budget.js`, `db/schema.ts`, `drizzle/` |
| Verification | `scripts/check*.mjs`, `benchmark-generation.mjs`, `render-blueprint.mjs`, `validation/` |

Third-party licenses ship under `public/vendor`. Original game geometry and synthesized sounds are preserved. Historical README/VALIDATION descriptions of universal pass-through, Rapier physics, eight seats and Imagine controls are superseded by this document; Git history retains those prior reports.

## Local preview and synchronization

This revision integrates GitHub main at `693f7ebb1d947884fece174733ef57e1eadcfcfc` before applying the requested home-screen and Arena-exit changes. `npm run dev` serves Explore and the actual UI. It does not host authenticated Arena services; Arena requests now receive an explicit JSON 503 with a Back to Explore instruction. AI generation requires the existing optional private API preview configuration. The production Worker, authentication and runtime secrets are unchanged.

The current hosting manifest targets the new private BrickWild Island Site created for this account. It uses a fresh database; no identity, data, access policy or secret from the original Site was copied.
