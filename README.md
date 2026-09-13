# Brickwild

## Current arena release (September 13, 2026)

Play joins the shared ISLAND arena directly. The normal journey has no Explore choice or room-code form. A name/sign-in/retry dialog appears only when needed. Site viewer access remains separate and unchanged. Legacy room APIs and Explore simulation remain for compatibility.

There is no eight-player seat limit or automatic room splitting. Same-isolate room mutations are serialized; revision compare-and-swap still protects writes across isolates, with bounded randomized retries. Session, packet and request protections remain. Placed cover is bounded per player rather than by an eight-object room pool.

Run `node scripts/check-capacity.mjs` for synthetic shared-room contention at 10, 20 and 40 players. This is an in-memory SQLite test with optional per-query delay, not a live D1 capacity claim. Results are in `validation/capacity-entry.json`. The shared snapshot remains a scaling bottleneck; a single 40-client burst with simulated 5 ms storage operations reached about 420 ms p95. No small rooms are introduced to conceal this.

Buildings, major brick rocks and generated placed cover now block movement with shared swept-box sliding. Mounts use conservative rotation-independent footprints, so large creations need broad routes. Trees and small decorations remain passable; shot cover is separate. Explicit rise/lower permits roof overflight and holds at roof contact. Builds finish only where their full footprint fits, preserving the old kit and pose otherwise. Destroyed blocking cover waits until occupants leave before returning. Airborne dismount holds altitude; lower explicitly to descend.

The existing ring road, central plaza and colored houses remain; four major rocks add deliberate cover without closing the broad lanes. Spawn candidates spread across open ground and are filtered against active blockers. Camera positions still follow directly; obstructing houses and rocks fade locally instead of pulling the camera forward. There is no rigid-body engine, gravity, inertia, ramming, crash damage or physical knockback.

Historical sections below describe prior releases; their eight-seat, room-selection and dual-onboarding descriptions are superseded here.

An original 3D toy-brick browser game. Explore Wildbrick Island and assemble usable creations while moving. Free-form speech or typed descriptions request new brick geometry from the connected OpenAI service. The playfield now has only Imagine and Speak creation controls; preset buttons and number-key builds are removed.

## Controls

Left hand uses WASD/Shift for movement and Q/E, R/F for the camera. Right hand uses the arrow cluster. Open **Hotkeys** on screen, or press **H**, for the visual key layout; H, Escape and the close button dismiss it.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD | Left joystick |
| Run on foot | Shift | Movement joystick |
| Jump / fly higher | ↑ (Space also works) | Jump / Rise |
| Lower (also after dismount) | ↓ | Lower |
| Speak on / off | ← | Speak |
| Attack / use / solo boost | →; hold to fire in Arena | Action button |
| Type an idea | Enter | Imagine |
| Return to foot | Backspace | On foot |
| Look left / right | Q / E | Drag horizontally |
| Aim up / down | R / F | Drag vertically |
| Show / hide hotkeys | H | Hotkeys |
| Open / close menu | P / Escape | Pause / Back |
| Recover in Explore | Home | Pause → Return to plaza |

Arrow actions can be used while holding movement keys. They do not rotate the camera. Enter opens Imagine and focuses its text field immediately. Typing, browser modifiers and open menus suppress game actions; Escape still closes the dialog. Browser microphone permission is required for speech recognition. Number keys no longer select original builds. The old J/K/L/U bindings and arrow-key aiming are superseded by this layout.

## Direct movement — latest fix

No runtime physics engine, rigid bodies, gravity, momentum, collision response, knockback, automatic takeoff, or auto-run remains. Walking and all mounts use the same direct, camera-relative controls and stop immediately on release. Island/height bounds keep the game on its map. Jump is a single intentional scripted lift-and-return, not a gravity simulation; it never repeats without another press. Hold ↑ to rise with a flying creation, release to hover, and hold ↓ to lower. Dismounting in the air holds height; ↓ or the touch Lower control returns you to the ground.

Body bob, banking/rocking, bouncing assembly arcs, decorative projectile arcs, falling debris and the bobbing destination marker are removed. Assembly travels directly into place; hit/reward flashes shrink in place. Walking limbs, propellers and wing articulation remain purposeful model animations. Scenery still provides query-only shot cover as requested, with no movement forces.

Multiplayer replays only unacknowledged input. A connection failure holds the last displayed position and offers **Rejoin**. Changing equipment and receiving delayed snapshots cannot teleport an idle player. Actual arena defeat/respawn, explicit joining, Home recovery, and a page reload remain intentional location resets.

## Architecture

- `public/rules.js`: serializable state, build vocabulary, objective definitions.
- `public/simulation.js`: fixed-step movement, ground/island limits, construction and rewards; pure geometry queries provide shot cover and placement spacing only.
- `public/models.js`: procedural, articulated 3D brick models; geometry and material reuse.
- `public/world.js`: island geometry and instance batching.
- `public/main.js`: Three.js view, follow camera, assembly, projectile animation, particles, lifecycle.
- `public/input.js`: keyboard and independent multitouch pointers.
- `public/ui.js`: game HUD, dialogs, speech recognition, user-facing fallback messages.
- `public/audio.js`: synthesized action and reward sounds.

The static output ships pinned Three.js 0.180.0 locally. Rapier 0.19.0 is archived under `vendor-archive/` for source recovery and is no longer imported, initialized or deployed; its license is preserved. Production does not fetch external models or engine packages. Vite is a development-only dependency. OpenAI calls require a server-only runtime secret. All Three.js imports and checks use the committed vendor files, so a temporary node_modules link is no longer needed. All character, vehicle, and environment geometry is original and assembled directly as 3D objects. This intentionally uses procedural geometry to support per-brick construction animation.

Run `npm run check` for deterministic simulation and static asset validation. Run `npm run build` to produce the Cloudflare Worker in `dist/server/index.js`. It serves the game and the server-only generation API. Sites identity is in `.openai/hosting.json`.

## Scope and behavior

Explore mode is a solo toy island with generated vehicles/equipment, four drive gates, five flight rings, three archery targets, and three breakable crates. Challenges can be played in any order. Player and mount movement passes through scenery; all movement starts and stops directly with controls, and flying only changes altitude on explicit input. The bow assists aim toward targets in front of the player. Challenge completions, derived brick rewards and up to 12 validated creation blueprints save on this browser/device. Refresh restores progress at the plaza on foot. Blueprints rebuild without another API call; placements and the currently equipped model are not restored. Clearing browser storage clears the adventure. If storage is unavailable, the game warns that progress lasts only for this visit. The original procedural model constructors remain in source for compatibility and validation; their preset UI and hotkeys are removed. Speak or type a free-form description through Imagine to generate new brick geometry with OpenAI. Generated models can fly, drive, walk, be carried, or be placed. Behavior comes from trusted game adapters; new arbitrary software behavior is not generated.

Voice is tap-to-speak. It depends on browser support, permission, and the browser's online speech service. On iPad, Safari and enabled Siri may be required. The game never uploads or stores recordings itself. Recognition transcripts are shown as text and sent unchanged to the creation service. Voice on physical iPad hardware has not been verified in this environment.

## Research references

- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): repeated brick/stud geometry is batched to reduce draw calls.
- [Three.js shadows](https://threejs.org/manual/en/shadows.html): one shadow-casting directional light, bounded shadow camera and resolution.
- [Web Speech API guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API): user-triggered recognition and result lifecycle.
- [WebKit Safari 14.1 features](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/): Safari/iPad speech recognition and Siri requirement.
- [SpeechRecognition errors](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error): actionable failure messages.

Third-party license texts are shipped under `public/vendor`. All gameplay artwork and sound synthesis are original.


## OpenAI generation

`worker/index.js` calls the OpenAI Responses API with strict Structured Outputs. The model defaults to `gpt-5.4` with low reasoning effort, configurable with the server environment variable `OPENAI_MODEL`. Set `OPENAI_API_KEY` as a secret runtime variable through the OpenAI Developers connection and Sites settings; never put it in client code, source control, or a browser form. API usage is billed to that connected API project.

The owner-provided key is configured as a **server-side Sites secret**. Live model access and generation have succeeded. OpenAI Developers was confirmed installed and enabled; its supported key-setup capability remained unavailable in this session, but that earlier blocker no longer prevents this game from using the owner-configured secret. Do not place credentials in this repository, public files, browser forms, or chat. API-key replacement should use the supported secure setup or Sites secret settings.

- `public/blueprint.js`: shared bounded schema and validator; rejects executable data and invalid dimensions.
- `public/generated-model.js`: generic instanced primitive renderer, studs, joints, normalization and seat anchors.
- `public/creation-service.js`: request lifecycle, cancellation and late-result suppression.
- `worker/index.js`: private-site generation endpoint, server-held key, request bounds, timeout, refusal/error handling and an isolate-local rate guard.
- `scripts/build.mjs`: self-contained Worker packaging; public game assets are embedded, while secrets remain runtime-only.

New version-3 blueprints require at least 32 parts and target 40–64, capped at 128 parts, 16 joints and 256 studs. Every part and pivot uses root coordinates; joints rotate around their pivots without translating the resting model. Version-1 and version-2 saved blueprints remain compatible. Creation geometry is generated from the prompt; animation and interaction use safe built-in movement and ability adapters. No returned code is executed. New designs may take several seconds or longer; movement continues while waiting. Up to 12 creations are saved on this device and can be rebuilt without another API call, including after refresh. Up to six placed objects remain on the island as shot cover; they do not obstruct movement. The game remains private to its existing owner.

The schema now expresses numeric/string limits directly, while runtime validation checks cross-references. Requests are limited to 360 characters and 2,048 UTF-8 body bytes (including streamed bodies), with an 85-second upstream timeout, 12,000 output-token budget, eight requests/minute per IP per isolate and two concurrent upstream requests per isolate. These in-memory guards are not a global quota or billing cap. Owner-only Sites access is the primary access boundary and has not been broadened. Client cancellation is forwarded to the upstream request when the runtime propagates disconnects; cancellation cannot guarantee an already-running request is unbilled.

Normal status reports key presence. `GET /api/generation-status?verify=1` performs a bounded, non-generating model-access check without exposing credentials. The UI marks generation verified after a successful response in that visit. Real API responses and exact prompts are saved under `validation/live/`; they are validation evidence and are never served as substitute creations.

## September 12 adventure improvements

- A gold destination beacon and camera-relative direction cue point to the nearest unfinished challenge suitable for the active creation. Generated flying mounts, ground mounts, pulse equipment and swing equipment use the existing objectives. All 15 objectives still total 226 bricks.
- Larger generated creatures influence camera distance and look height; carried creations preserve their authored grip through normalization and swing animation. Movement is unobstructed; simplified geometry is used for weapon hits only.
- Saved progress and a 12-creation collection use `public/adventure.js`; `public/guidance.js` supplies activity guidance and control descriptions.
- Generation shows elapsed time, preserves recognized text, handles timeout reasons, and prevents a cancelled response overriding a later choice. Choosing a saved creation cancels an outstanding design. Assembly itself finishes before another build begins.
- Final speech segments are combined before submission, and callbacks from cancelled microphone sessions are ignored. Typed Imagine remains available without speech support.
- Equipment has an independent Jump control. Touch controls retain their independent pointers; text and tap targets have been enlarged.

Research: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4). The initial GPT-5 Mini dragon hit the 85-second timeout. GPT-4.1 Mini was faster but failed shape review. GPT-5.4 is the production choice after live geometry comparisons; the server override is also set to it.


## Permissions and development preview

Speech is optional. Imagine needs text only and no microphone access. Denied or unsupported speech opens typed input; speech cannot start before play or while paused. Private Sites sign-in is separate from voice permission. The game requests no camera, location, contacts or notifications access. If a device shows a different permission prompt, inspect its exact wording before granting access.

`npm run dev` starts Vite for supported browser QA. Production still uses the self-contained Worker build. A development-only API proxy may use the existing private Site origin and authorized Sites bypass token in `.sites-runtime/api-preview.json`. That file is ignored, excluded from public assets, and must be removed after QA. Never store an OpenAI key there.

`npm run check` runs deterministic checks and replays captured live outputs without calling OpenAI. `scripts/check-live-request.mjs` is an explicit opt-in acceptance test that makes one real, billable teapot request while the movement simulation runs. Supply `BRICKWILD_ORIGIN` and the authorized `BRICKWILD_BYPASS` token through temporary environment variables; `BRICKWILD_OUTPUT` optionally selects the response file. Never commit those values.

`node scripts/render-blueprint.mjs validation/live/dragon.json --site . --output /tmp/dragon.png` produces an offline three-view geometry diagnostic using the actual instanced triangles. It requires Python, NumPy and Pillow for development only. This does not replace a WebGL browser or device playtest. See `VALIDATION.md` for exact observed results and limitations.

## Multiplayer arena — September 12 update

Choose **Enter arena**, enter a name and a 4–8 character room code, and join. Up to eight players with access to this Site can use the same code. Everyone is an opponent. The Site's existing owner-only access is preserved: the owner must add friends as viewers through **Share** before they can join. A room code selects a match; it does not grant Site access. **Explore solo** keeps the original 15 challenges and device-saved collection.

In Arena, hold **→** or the **Fire** touch button to attack. **↑** or Space jumps on foot and rises in flight; **↓** lowers. **←** toggles Speak, **Enter** opens Imagine, and **Backspace** exits the current creation. Q/E turns the camera; R/F aims vertically; dragging still works. Every builder starts with 100 health and a basic pulse blaster. Eliminations award one KO, deaths are tracked, and the in-room leaderboard sorts by KOs then deaths. Defeated players return on foot after 12 seconds with three seconds of spawn protection. They cannot shoot during that protection. Scores last for the current room membership; they are not an all-time leaderboard.

Parachute supplies arrive every 12 seconds, with the first drop after four seconds. Walk or drive into a landed box to collect it. Red restores pilot health, blue gives 55% additional damage reduction for ten seconds, and yellow doubles movement speed for ten seconds. Boxes descend for 5.5 seconds, expire after 45 seconds, and can be claimed by one player only. The HUD shows pilot health, creation health, buffs, weapon stats, build cooldown, and connection status.

All scenery is pass-through for movement: trees, buildings, gates, rings, targets, crates, plaza decoration and generated placements. Foot movement, vehicles and generated mounts integrate position directly with ground and island boundaries only. Scenery no longer blocks turns, pushes bodies, changes speed, causes crashes or refuses a mounted build. Other players also cause no pushing or ram damage. Ground landings do not break mounts. Combat can still destroy a mount and expose its pilot.

Trees, buildings and placed objects remain cover against shots; weapon ray/segment checks and destructible cover are separate from movement. Destroyed cover reappears after one minute without relocating occupants. Static creation placement still chooses clear spacing to avoid overlapping scenery. The follow camera tracks directly, without inertia or obstruction adjustments. A player or camera can enter a visible building; the geometry may obscure the view while inside. This is intentional pass-through movement, not realistic collision physics.

### Creation stat foundation

Version-3 generated blueprints add semantic `traits`: weapon family, armor category, mass category, and a root-coordinate mouth/muzzle emitter. Geometry is still newly generated from the whole description. No model-selected damage, executable code, or arbitrary physics is accepted. Old version-1 and version-2 saves retain compatibility through conservative behavior adapters.

| Weapon family | Damage per hit | Shot/swing interval | Range | Tradeoff |
| --- | ---: | ---: | ---: | --- |
| Basic pulse | 16 | 0.42 s | 42 m | Balanced starter |
| Fire breath | 7 | 0.16 s | 15 m | Fast, broad, short range |
| Automatic | 14 | 0.18 s | 38 m | Higher sustained offense, slower on foot, heat cooldown |
| Bow | 24 | 0.85 s | 56 m | Slower shots, longer reach |
| Sword | 36 | 0.62 s | 3.5 m | Close combat |
| Knife | 17 | 0.32 s | 2.3 m | Fast swings, very short reach |
| Hammer | 55 | 1.15 s | 3.4 m | Heavy, slow swings |

Heavy creations trade speed for mass and mount health. Shields preserve the basic pulse attack, add 90 protection health and 45% armor, and slow movement. Mount protection absorbs damage before pilot health; destroying it dismounts the pilot. Armor is bounded and mounts have at most 250 protection health. Normal base movement is capped at 32 units/s; a timed speed pickup deliberately doubles it. Unarmed cars/planes have no weapon; describing guns or breath supplies a compatible ranged family. The stats panel shows the resulting rules. Automatic fire overheats and rests for 2.2 seconds. Friendly toy effects replace graphic violence.

A successful build assembles for 2.8 seconds while movement continues, then equips/mounts automatically. Arena builds have a ten-second cooldown. A new build refreshes that creation's protection, so building is also a limited defensive choice; firing is disabled during assembly. Up to two static creations per player and eight per room can be placed as shared, breakable cover in clear space. The existing device collection allows free rebuilds without another generation request.

### Shared server and limits

- `public/arena-core.js` is the authoritative, serializable fixed-step game simulation; it also supplies movement-only local prediction.
- `public/combat.js`, `world-data.js`, and `blueprint-metrics.js` define trusted stats, scenery shapes and normalized dimensions/emitter bounds.
- `worker/arena-api.js` authenticates every request with Sites' trusted `oai-authenticated-user-id`, checks same-origin JSON actions and validates session tokens. The server computes positions, hits, health, timers and scores from bounded inputs; client-supplied state is ignored.
- `worker/arena-store.js` stores D1 room snapshots with atomic revision compare-and-swap and bounded retries. Competing updates cannot overwrite accepted match state. Session tokens are random, held only in page memory, hashed at rest, and tied to the authenticated Site viewer. Sessions expire after 90 idle seconds; inactive room seats are removed after 20 seconds. An explicit leave removes membership. Returning after a long disconnect requires joining again.
- Input updates are serialized by `arena-client.js`, normally every 120 ms after the previous response. Movement uses acknowledged 60 Hz input frames, capped at 90 buffered frames and wall-clock-budgeted on the server; each frame is applied once. Held fire goes stale after 750 ms without an update. The client stops prediction on an unhealthy connection and shows reconnect feedback. Old responses cannot replace a newer session, revision or command.
- This is an eight-seat HTTP snapshot implementation on supported Sites D1 storage, not a WebSocket/high-tick competitive shooter. Latency and frequent concurrent clients affect responsiveness. Each server update simulates at most one second of missed time. Client prediction substeps frames up to 100 ms; the render loop still caps unusually long frames at 80 ms. Acknowledged movement is not replayed, and remaining input frames are replayed locally without RTT extrapolation. Ordinary snapshots and loadout changes cannot teleport the display; any residual correction converges only during deliberate movement. Actual death/respawn uses an explicit spawn epoch. Expired sessions freeze the displayed pose and expose Rejoin instead of returning to Explore. Explicit Leave also preserves the displayed coordinates. Authoritative positions and damage remain server-owned. Menus stop local controls, but the match and opponent attacks continue.
- Bounds: 160 active projectiles, six supply drops, eight placed models, 90 recent events per room; 100 API updates per ten seconds/session; at most 12 active sessions per Site viewer; at least 9.5 seconds between creation uploads per session. Duplicate saved blueprints use content hashes. Join/leave actions are limited to 4 KB, movement sync to 16 KB, and blueprint upload actions to 100 KB. Frames contain bounded inputs, never client coordinates. Generation retains its separate limits documented above.
- `db/schema.ts` and generated `drizzle/` migrations define `arena_rooms`, `arena_sessions`, and `arena_creations`. `.openai/hosting.json` declares logical D1 binding `DB`. Sites applies the packaged migrations. Never put a physical database ID or credentials in the manifest.

`npm run check` runs 98 checks in total, including 23 arena simulation/SQLite API checks, nine DOM/Three.js scene checks, ten movement/camera regressions and 13 direct-movement/network regressions. These are automated logic checks. The supported browser also verified the isolated real HUD, Hotkeys dialog and keyboard entry points through the development-only `/__controls` harness. This does not run WebGL, multiplayer networking or speech recognition; full 3D rendering and physical iPad performance remain unverified. The harness and validation evidence are excluded from production. See `VALIDATION.md` for the exact checks.


The current live acceptance result is saved in `validation/live/arena-acceptance.json`. A fresh 55-part version-3 Emerald Firewing Dragon was generated by GPT-5.4 in 19.033 seconds; its root mouth emitter, flying mount and flame family were validated, then its actual geometry was assembled and used in the local authoritative simulation. The deployed arena correctly rejected the automation bypass token with HTTP 401 because that token carries no signed-in player identity. No user header was forged and no authentication check was weakened. The arena provides a dispatch-owned, top-level **Sign in with ChatGPT** link when identity is missing. Production multiplayer between signed-in devices remains an acceptance check for the owner and invited viewers; the shared API logic has passed the local three-identity SQLite tests.
