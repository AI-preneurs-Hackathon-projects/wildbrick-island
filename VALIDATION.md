# Brickwild validation — September 13, 2026

This report supersedes the older Rapier, universal pass-through, eight-seat and Imagine-control reports retained in Git history. It separates real OpenAI calls, CPU/SQL simulations and browser UI inspection from unverified rendered multiplayer play.

## New account-owned Site

The user explicitly requested a new ChatGPT Site instead of updating the inaccessible original. The hosting manifest now identifies that new private Site, preserving the logical D1 binding and all migrations. Its generation settings use the documented compact profile, but it needs its own OpenAI API key before newly described models can be generated. The original Site was not changed and its data/secrets were not copied.

## Home modes and Arena exit after GitHub synchronization

The local checkout was fast-forwarded from `034917f` to GitHub main `693f7ebb1d947884fece174733ef57e1eadcfcfc` (12 commits), verified again against the live remote after implementation. All previous uncommitted work was preserved in a Git stash and separate patch/file archives before pulling. The requested home/name/mode work was deliberately reconciled onto the latest source, retaining the shared Arena, speech-first controls, tutorial, combat, generation, collision and supply/rover systems. No older gameplay files were restored over the newer source.

The full suite passes 129 checks on Node 24.19.0. Seven home/exit checks cover names, shared-room transfer, both entry modes and tutorials, storage failure, authentication, all visible exit states and pending join dismissal. Three added network regressions verify immediate departure during reconnect/expiry, ignored late blueprint authentication errors, and useful non-JSON response errors. The Worker build includes 46 assets and the current migrations. `git diff --check` passes.

Browser inspection verified the actual 3D local game with the new home screen, shared-name Arena attempt, explicit local-backend message, and Back to Explore clearing the dialog and restoring solo HUD and controls. A separate development-only UI harness verified the latest Punch/Speak/Build HUD and direct exit on desktop and phone-sized layouts. Health and leaderboard panels no longer overlap on narrow screens. The harness does not establish successful multiplayer; no physical touch device, new paid generation or authenticated production multiplayer was tested.

The Vite preview does not implement Arena APIs and has no private AI preview connection. It now returns a clear JSON 503 instead of an empty 404/reconnecting message. The published Site requires sign-in. Publication was requested, but the selected personal Sites account returns project-not-found for the existing manifest ID and does not list BrickWild among owned/editable Sites. The Site identity and access settings have not been changed; publication must resume using an account with access to that existing Site.

## Recovery and preservation

Recovered `/workspace/sites/brickwild`, initially clean at Sites/local commit `41c119821227b8f74280a425f7c1716faaba3f39`. Current GitHub `main` initially pointed to `034917f1b4c376037cc896ab80abf5d3c91e7973`. All 82 tracked files had matching blob hashes despite the different histories. Current remote branches and Site state were inspected before editing; no reset or force-push was used. The baseline suite passed 98 checks.

The existing Site/project identity, D1 data, server-side OpenAI secret, saved-blueprint compatibility and procedural assets remain. Current access is **custom**, including the owner and an invited external viewer; older reports calling it owner-private are obsolete. No audience settings were changed. Each completed implementation stage was committed and pushed to GitHub main. Sites source pushes and deployments are separate operations, with exact Git trees compared for content equality. Version 11 was the recovered deployment; versions 12–14 supported completed stages and live generation comparisons. The final handoff records the final deployment version and verified remote commit.

## Implemented behavior

- Play joins shared ISLAND directly; no normal Explore selector, room-code form, eight-seat rejection or automatic splitting.
- Houses, major brick rocks and placed creations block through a shared swept-box sliding function. Large mounts use conservative footprints. Failed assembly near obstacles preserves equipment and position; restored cover waits for occupants to leave. Camera obstruction fades landmarks without snapping the camera toward them.
- Empty hands punch with visible arm extension, short range and authoritative delayed contact. Equipped melee, projectiles and flame have distinct presentation. Confirmed hit IDs drive impacts, health changes, flash/flinch and nearby audio separately from immediate local attacks. No positional knockback is applied. Short taps survive both 250 ms and 600 ms simulated round trips and lost responses without duplicate damage or confirmed effects.
- Speech is the single normal build action. Typing and saved creations are in Help; unsupported/denied speech opens a fallback. The first-play three-card tour has Next/Skip, saves once per device and reopens through Help. Illustrations are exact existing game meshes rendered offline, not browser screenshots.
- Assembly is 1.2 s instead of 2.8 s. Compact v4 permits 20–64 meaningful parts while old blueprint versions keep their original bounds. Fresh uniformly one-based references can be normalized; mixed references and invalid data remain rejected.
- Durable D1 generation admission, per-shooter projectile bounds, serialized room writes, cross-isolate CAS retries and acknowledged event delivery address shared-arena resource use without imposing a small player-room limit.

## Automated and browser verification

`npm run check`: **119 passing checks**, using committed Three.js and real migrated SQLite SQL. Current output: `validation/checks-followup.txt`; the previous 111-check release remains in `validation/checks-final.txt`.

| Suite | Checks | Evidence |
| --- | ---: | --- |
| Original simulation/module checks | 16 | Parsing, imports, controls, objectives, original procedural models |
| Generation | 9 | Bounded schema, trusted request construction, cancellation and no preset fallback |
| Adventure and geometry | 14 | Storage, corrupt data, stale results, speech/error doubles, joints/grips/seats |
| Historical captured live replay | 4 | Existing genuine outputs; no new API requests |
| Arena core and isolated HTTP API | 29 | Authoritative combat, destruction, pickups, KO/respawn, cover, authentication and concurrency |
| DOM / Three.js scene structure | 14 | Punch/sword pose, flash/flinch, no positional displacement, entry, tour, Help and touch text |
| Movement regressions | 11 | Swept walls, corners, gaps, large mounts, roof blocking, assembly fit and camera math |
| Actual client/server with simulated networking | 16 | 50/250/600 ms RTT, lost responses, acknowledged movement/events, expiry, stale joins, pre-death inputs |
| Durable generation/schema checks | 3 | Atomic global/requester budgets, legacy/v4 bounds and restricted indexing repair |
| Final captured v4 arena replays | 3 | Dragon/car/octopus assembly while moving, joints, emitters, authoritative damage and saved-blueprint persistence |

The isolated HTTP check now joins **20 concurrent test identities**, then synchronizes all 20 through the real handler and SQL. It does not forge identity headers against the deployed Site. Server tests also reject cross-identity tokens, unauthenticated clients, invalid frames, forged stats/positions and request abuse.

Seeded movement checks run 3,600 frames each: maximum displayed step 0.1633 m in Explore and 0.1575 m in Arena, with no recovery jumps. Simulated network movement reaches 0.1167 m maximum per frame at normal walking speed and zero idle drift after release. Tests include walking versus large-mount narrow-gap behavior, corner sliding, high-speed tunneling prevention, overflight/roof lowering, airborne dismount and safe build failure.

The supported cloud browser could not create WebGL: GL_VENDOR and GL_RENDERER reported Disabled. Its graphics-unavailable state was observed; browser flags were not bypassed. Browser inspection therefore used the actual UI/input modules in the development-only harness. Inspected desktop Play/tour/HUD, all three tutorial cards, once-per-device entry and 1024×768 / 768×1024 iframe layouts. Those tablet-size layouts used desktop input. Coarse-pointer instructions and denied/unsupported speech are covered by DOM/recognizer doubles, not physical device tests.

The compiled Worker serves all **46 public assets byte-for-byte** and includes all **three migrations**. Development harnesses, captured responses, source files and preview credentials return 404. Unauthenticated arena entry returns 401. Public asset scans found no API key literal or server secret reference. `scripts/check-package.mjs` and `validation/package-followup.json` record the current package check; the previous result remains in `validation/package-final.json`.

## Follow-up after owner playtesting

Recovered the finished version 15 source before editing. GitHub main was `ef68b85b610d78a70cd1ff0c7021bae53708e639`, Sites/local source was `4193c05bb68fd77a4fbd518e55f7b80452d01e68`, and both trees matched. All 111 baseline checks passed. The old progress list was stale; the follow-up has its own updated implementation/publishing stages.

- Bottom-left desktop movement hints now include R/F vertical aim beside WASD and Q/E.
- Punch preview, server contact and character presentation use body facing independently of camera yaw. Five facing angles and a camera facing backward are covered, alongside 250/600 ms lost-response checks with one confirmed hit and no positional change.
- The leaderboard starts expanded with a translucent background; collapsing it persists through snapshot updates. Leave arena is only in the Esc/Pause menu and returns to entry. Browser checks exercised collapse/expand, Esc, Leave and Enter to rejoin.
- Enter/Return starts Play, advances Next/Next/Play in the tutorial and resumes from the pause menu. Text fields, focused buttons, modifiers and held-key repeats keep their intended behavior. Real browser inspection found and fixed tutorial focus initially landing on Skip; Next now receives initial and subsequent focus. Touch instructions hide the Enter hint.
- Every third supply drop is equipment, rotating Star sword, Brick bow and Red Twin-Gun Roadster (about 36 seconds between equipment drops). Violet parachutes show a miniature of the actual weapon/vehicle and a landing/collection label. Geometry and trusted stats are ready locally; no generation request is made to collect loot. The authenticated blueprint endpoint also serves the catalog to older tabs still open during a release; unauthenticated requests remain rejected. The rover is an explicitly curated copy of the genuine previously generated car in `validation/live/final-compact-none/armed-car.json`, now shipped separately in `public/supply-catalog.js`. Spoken requests continue to produce new geometry through OpenAI.
- Equipment collects only after landing, when a living empty-handed player on the ground walks within 1.6 m. Existing equipment and active assembly are preserved. Full mount clearance is checked at the player's position, with no relocation. Collection is authoritative, once per drop; creation health and attack cooldown are initialized. Supplies still restore health/defense/speed, with bounded lifetimes and at most six active drops. Kit metrics are cached rather than recomputed for every simulation tick.
- Added checks cover scheduled rotation/landing/expiry, a single eligible collector, assembly/equipment preservation, airborne and obstructed pickup refusal, all three usable attacks, exact rover geometry, render-resource disposal and a delayed pickup without pose changes or blueprint fetches.

Browser verification used the actual UI/input development harness at desktop and tablet dimensions; it did not render 3D or run production multiplayer. Existing WebGL, physical iPad/microphone and two authorized production-client acceptance gaps remain. No new live OpenAI comparison was needed: generation configuration and prompts are unchanged from the measured release below. The additional supply catalog is packaged, while validation files and development harnesses remain excluded. No audience, identity, D1 schema or generation-budget change was made.

## Live generation comparisons

Each trial uses the same three complete descriptions: rideable green/gold fire-breathing dragon, red four-wheel car with two hood guns, and purple eight-arm mechanical octopus on wheels with a forward laser. Raw successful responses and all success/failure timings are committed under `validation/live/<trial>/`. These were real billable requests through the existing authenticated Site generation endpoint. No fixture was substituted. The benchmark runs the real solo simulation while waiting and constructs the actual generated model on the CPU afterward.

| Trial | Dragon request | Car request | Octopus request | Valid responses |
| --- | ---: | ---: | ---: | ---: |
| v11 GPT-5.4, low, detailed | 40.45 s, invalid | 28.68 s, 44 parts | 53.54 s, 49 parts | 2/3 |
| GPT-5.4 Mini, low, compact | 28.06 s, 33 parts | 11.11 s, 24 parts | 17.97 s, invalid | 2/3 |
| GPT-5.4, low, compact | 29.71 s, invalid | 24.76 s, 29 parts | 46.57 s, 32 parts | 2/3 |
| Same low/compact, repeat | 29.37 s, invalid | 27.88 s, 28 parts | 45.56 s, 40 parts | 2/3 |
| Low/compact diagnostic retry | 29.47 s, 27 parts | — | — | 1/1 |
| GPT-5.4, none, compact, before index clarification | 26.43 s, invalid joint index | 22.79 s, 30 parts | 26.45 s, 35 parts | 2/3 |
| **Final GPT-5.4, none, compact, clarified indices** | **27.11 s, 39 parts** | **9.85 s, 25 parts** | **12.62 s, 33 parts** | **3/3** |

Selected runtime: `OPENAI_MODEL=gpt-5.4`, `OPENAI_BLUEPRINT_DETAIL=compact`, `OPENAI_REASONING_EFFORT=none`. Live model access was verified for both evaluated models. The final three outputs reported zero reasoning tokens and required no automatic indexing repair. This is a small sample, not a demonstrated zero failure rate. Before the final prompt adjustment, seven low/compact calls produced five valid responses and two failed dragons. Mini was rejected for weaker geometry and incorrect requested dragon colors despite its speed.

| Final creation | Server generation | CPU validation + construction | Request + 1.2 s assembly floor | Movement / weapon | Joints | Estimated model cost |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Goldenwing Ride Dragon | 12.549 s | 11.46 ms | 28.31 s | fly / flame | 7 | $0.04065 |
| Red Twin-Gun Roadster | 8.969 s | 2.54 ms | 11.05 s | drive / automatic | 4 | $0.02856 |
| Wheeltop Mecha Octopus | 11.693 s | 2.42 ms | 13.82 s | drive / pulse | 8 | $0.03647 |

The assembly-floor column **is not measured time to usable equipment in production multiplayer**. Arena upload, acknowledgement, scheduling and browser GPU work add time. Final HTTP requests included approximately 0.9–14.6 s beyond measured server generation. That transport/gateway overhead varied materially and was not isolated. Speech completion time was not measured on a real microphone; the client now instruments recognized-final-to-end delay separately. Server validation was below the millisecond timer resolution; CPU rendering here means model construction, not GPU rendering. The in-game read-only state hook exposes request/server/assembly timing for an authorized rendered session.

Compared with the v11 successful requests, the final car request was 66% faster and the octopus 76% faster; their server-generation reductions were 42% and 45%. Assembly is 57% shorter for every build, including saved rebuilds. The dragon has no successful same-day v11 baseline, so no comparable usable-speed claim is made for it. Network variability and one final sample per prompt prevent treating these percentages as guarantees.

Exact instantiated-triangle CPU views were inspected for the successful candidates using `scripts/render-blueprint.mjs`. Final geometry has a green dragon body/head, golden wings, four legs and tail; a red car with four wheels and twin visible barrels; and a purple wheeled body with eight articulated tentacle groups and forward emitter. Seats lie on fixed rendered surfaces. The final arena replays verify correct trusted movement and attack from those emitters. **Quality limitations remain:** some wing/tail/tentacle joins visibly float, some trim overlaps, and seating can look awkward. Numeric validation cannot establish an artist-quality connected model. Mini’s brown dragon/cream wings and weaker car were materially worse, so Mini was not selected. The final octopus’s wheels are not separately articulated; its eight joints animate its tentacles.

The final trio’s estimated uncached model cost is $0.10568 combined, based on returned token counts and official standard input/output rates, excluding hosting/network and any cache discount. Earlier v11 failures lack token usage and were not assigned a fabricated cost. Final input counts were 1,651 / 1,651 / 1,652 and output counts 2,435 / 1,629 / 2,156. Mini’s two successful samples were approximately $0.01223 and $0.00933 at its own rates.

Official references consulted September 13, 2026: [GPT-5.4 model capabilities, reasoning levels and pricing](https://developers.openai.com/api/docs/models/gpt-5.4), [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), and [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization). Smaller output and reasoning effort were evaluated alongside quality; the API secret remained server-side throughout.

To reproduce a paid comparison, use `scripts/benchmark-generation.mjs LABEL [dragon|armed-car|octopus]` with an authorized server-side Site connection in process environment. Never paste credentials into source, command output or browser code. To inspect a captured design without any API request:

```sh
node scripts/render-blueprint.mjs validation/live/final-compact-none/dragon.json --output /tmp/dragon-review.png
node scripts/check-current-replays.mjs
```

## Capacity findings

No arbitrary eight-seat rejection remains. No players are silently separated. Capacity is still finite and production multiplayer responsiveness is not established by these simulations.

`validation/capacity-entry.json`: one queue, SQLite with 0 or 5 ms delay per storage operation, five simultaneous bursts at 10/20/40 clients. At 5 ms, p95 mutation latencies were 105.5/212.7/420.4 ms with zero errors; initial snapshots were approximately 9.7/19.4/38.8 KB.

`validation/capacity-combat.json`: four independent queue identities sharing one SQLite database, 5 ms per operation, four concurrent update bursts. CAS preserved all successful mutations with no duplication or loss.

| Concurrent writers | Requests | Errors | CAS conflicts retried | p95 mutation | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 40 | 0 | 43 | 121.3 ms | 121.8 ms |
| 20 | 80 | 0 | 83 | 192.0 ms | 201.6 ms |
| 40 | 160 | 0 | 167 | 378.3 ms | 412.1 ms |
| 80 | 320 | 0 | 376 | 752.9 ms | 835.0 ms |

Separate actual arena CPU simulations run ten seconds at 30 Hz with 10/20/40/80 flame-equipped players. This is intentionally independent of the SQL-delay test; it does not measure their combined production latency.

| Players | p95 simulation tick | Peak projectiles | Full-history snapshot | Acknowledged-event snapshot | Estimated total uncompressed fanout at 8 Hz |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 | 2.50 ms | 40 | 84.6 KB | 23.0 KB | 14.7 Mbps |
| 20 | 5.51 ms | 80 | 169.5 KB | 45.9 KB | 58.7 Mbps |
| 40 | 10.54 ms | 152 | 357.1 KB | 90.0 KB | 230.4 Mbps |
| 80 | 8.34 ms | 52 | 989.2 KB | 124.4 KB | 637.1 Mbps |

These are decimal KB, maximum serialized JSON sizes and arithmetic fanout estimates, not observed network rates; HTTP compression is not included. At 80 players, nearby large mounts hit each other and die, so fewer live projectiles and a lower CPU p95 do not imply better scaling. Five-second event history was retained throughout the tests, with bounded player-scaled storage. Previously a fixed 512-event cap shrank the retained history to about one second at 80 players; acknowledgements now avoid retransmitting that larger history to every client. The per-shooter projectile budget also avoids deleting another player’s shot just because a global small pool filled.

**Demonstrated bottlenecks:** shared-row serialized writes, cross-isolate retries, growing room JSON and all-player snapshot fanout. An 80-writer burst already takes roughly 0.75 s p95 under only 5 ms synthetic query delays. A flame-heavy 80-player room approaches 1 MB stored JSON. This does not establish a production hard player ceiling, but it rules out an unlimited-capacity claim and makes sustained large-crowd operation an unresolved acceptance criterion. The current HTTP/D1 implementation is retained with complete incremental improvements. A persistent-connection broadcaster and single authoritative room process should be evaluated against live load before promising a large public arena.

## Remaining acceptance gaps and owner action

- No full WebGL-rendered combat/camera playtest was possible in the supported cloud browser. Visible meshes/poses are checked structurally and generated geometry was reviewed with offline CPU images; this is not a passing rendered game test.
- No two real authorized signed-in clients completed production combat, destruction, KO and respawn. The Site automation bypass reaches content/generation but does not supply player identity; deployed Arena correctly rejects it with 401. Authentication was not weakened or forged.
- Ten-plus real network clients, live D1 latency/cost, sustained concurrency, packet loss across actual devices, real audio quality and physical iPad frame rate remain unverified.
- Physical microphone permissions, speech completion delay and simultaneous touch movement/attack/speech need an iPad/device check. DOM and recognizer doubles cover lifecycle and fallback only.
- Generated geometry remains variable, including loose joins and awkward seating. The final 3/3 success run is encouraging but too small to establish reliability.

Smallest owner action: open the published Site in two signed-in, authorized devices and run a short punch → spoken build → attack → defeat/respawn match. Invite additional testers through Site Share before the ten-player session. No new API key is needed for the current deployment. Use the read-only in-game timing hook during that session to capture actual speech-to-usable time and device behavior.


## September 14 — avatar selection and home exit

All 132 checks pass. Coverage includes exit-to-home across online, reconnecting, expired, offline and defeated Arena states; Explore exit and fresh entry with another name; eight persistent avatar choices; independent character materials; and authenticated HTTP clients receiving the chosen color with an invalid-color fallback. Existing movement and generation checks also pass.

The actual local WebGL game was inspected at the default viewport and 390×844. Dragging rotated the avatar, selecting Blue changed its shirt, and the pause-menu Exit to home returned the name screen with focus and the chosen color intact. The game's read-state tool confirmed started=false and no pending generation. Multiplayer color propagation was tested through the HTTP/SQLite harness, not a live multiplayer session or physical touch device.


## September 14 — firing direction, visible contacts and support drops

140 automated checks pass, including all ranged weapon families in carried, driving and flying forms across horizontal and vertical aim angles. Focused checks cover unchanged body facing, grip-relative emitter coordinates, shots born and hit between snapshots, actual ground/target/cover contacts, suppression of invented miss impacts, independent render cleanup, and Explore wall/ground shots. Existing network retry and movement regressions pass.

The local WebGL combat harness uses the real Arena simulation and renderer, with controlled snapshot delivery. Bow and twin-gun rover shots visibly left their emitters, traveled toward cover, and produced contact markers at the reported coordinates while body yaw remained 1.20 radians. A downward bow shot landed at ground y=0. This is local rendered validation, not a production multiplayer or physical-device performance claim. The harness is development-only and is not included in the hosted assets.

Sky drops now cycle health, defense and speed only; persisted equipment drops are discarded and legacy equipment is not rendered. Checks confirm support effects, retained equipped creations, and no new weapon/vehicle lifetime. The legacy rover blueprint remains available to existing builds. Room-code work was cancelled before editing; no room-code changes were included.

Character-directed firing and rounds: added camera-independent ranged checks across carry/drive/fly and all ranged weapon families, legacy camera-pitch rejection, right-hand grip and punch checks, separate R/F controls, exact deadline/final-results/restart tests, stale-round frame rejection, and client restart after a lost response. Browser validation uses isolated local core/renderer and HUD harnesses without production sessions or generation calls.
