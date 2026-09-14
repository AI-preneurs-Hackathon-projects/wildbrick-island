# Combat acceptance follow-up — 2026-09-14

Issue 1 remains open for an aiming-policy decision and rendered/two-player acceptance. This follow-up fixes a separate emitter-coordinate defect locally. It does not change damage or implement convergence. No new push, saved version, deployment, generation request, access change or database operation was performed.

## Verified previous release

Read-only Sites results, independently of the GitHub push:

| Field | Verified value |
| --- | --- |
| Project / owner role | `appgprj_6aa4e30083f88191a4af01bb8feb2aeb` / owner |
| Live URL | https://brickwild-adventure.yerzhan452067.chatgpt.site/ |
| Version | 18 |
| Version ID | `appgprj_6aa4e30083f88191a4af01bb8feb2aeb~appgver_3b2ac5980a2c8191b0f8cd839356d027` |
| Creator source | `967983ddacdd60d0b470ce51f2a4daa6c7016ea7` |
| Deployment ID | `appgdep_6aa77ef82444819191e4945535394ea7` |
| Terminal status / timestamp | `succeeded` / `2026-09-14T04:59:12.328012+00:00` |
| Audience / environment revisions | custom, revision 3 / environment set 6 |
| GitHub main | `7ee2b1e2fd89f9b9b8b17de7cdd3c91fee705f90` |

Sites version/status/audience and GitHub main were refreshed again before the local commit and remained unchanged. The complete GitHub recursive blob tree was compared with the creator checkout at its published source commit. Every gameplay, worker, test, lockfile and migration blob matches. Only `.openai/hosting.json` and README differ; there are no creator-only paths. This establishes source equivalence, not rendered acceptance. The creator manifest retains project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`; GitHub intentionally retains Hadrien's project `appgprj_6aa6b740f7908191b26dc41dfb7cf9cb`. Both use logical D1 binding `DB`. README differences concern account-specific site/setup references. Neither manifest was changed. Runtime settings, secrets, authentication and records were not synchronized.

The previous version-17/no-publication passages in the two earlier reports are historical preparation records. Version 18 is now verified published. Audience revision 3 is the current read-only observation; this follow-up did not change it or infer why it advanced. Sanitized machine-readable release evidence, archive hash and differing blob hashes are in `validation/combat-acceptance/release-status.json`.

## Pulse diagnosis

`weaponAim` uses body yaw and zero pitch. Generated models normalize the authored geometry and emitter with the same rest bounds, scale and translation. Carried models subtract their normalized grip and add `weaponGrip`; the server converts the kit's legacy stored grip into that same grip. Pulse's carried grip X is -0.76 m, while automatic/flame use -0.30 m. Camera orbit is independent.

The fixture described previously as a captured carried pulse is actually the saved automatic car blueprint with `movement: carry` and `traits.weapon: pulse` substituted. Its geometry was captured; its carried pulse configuration was derived. This audit also uses the saved pulse octopus and flame dragon in their original mounted forms and explicitly derived carried forms. Bow coverage includes the built-in bow and a car-derived bow; no standalone saved generated handheld bow was available. No paid generation was used.

For the car-derived pulse, both renderer-transform inspection and the authoritative shot start at approximately `(-0.76, 1.937598, 1.477165)` for a shooter at the origin, yaw zero. The ordinary shot travels parallel to body-forward +Z. A foot target's padded horizontal half-width is 0.57 m, leaving a 0.19 m lateral gap. Cardinal shots truly pass beside the body; they are not lost collisions. At diagonal facings the ray crosses the target's axis-aligned box envelope. Raising/lowering the target to align its center with the muzzle does not repair the lateral miss.

Barrel/emitter findings from source geometry and Three.js transforms, **not pixels**:

- The car has two fixed forward-facing cylinders at X ±0.55, Y 1.82; their tips are at Z 2.625 in authored coordinates. Its single emitter `[0, 1.85, 2.6]` sits between them. Directions agree with +Z, but the single-emitter abstraction does not literally originate at either visible barrel. This authored approximation remains; there is no new second projectile.
- The octopus's fixed cannon cylinder is centered at `[0, 2.2, 2.65]`, rotated 90° around X, with its axis along +Z. Its front is Z 2.875 and emitter Z 2.95: a 0.075 authored-unit gap. Normalization/body rotation preserve that alignment. The carried variant exposed the separate vertical transform bug below.
- The dragon's fixed mouth wedges have different authored slopes; the schema supplies an emitter position, not an oriented mouth vector. Its trajectory follows the existing body-forward policy. This audit cannot establish that the perceived flame direction looks correct from pixels.
- Default bow geometry points along +Z; its approximate arrow-tip/emitter positions differ by about 3 cm. It hits all centered positions in this matrix. No default-bow transform was changed.

## Small coordinate correction

`makeKit` previously translated a normalized emitter into hand coordinates and then clamped it against model-space bounds. The bounds exclude the hand offset, so the clamp lowered some valid carried emitters while the rendered models stayed in place. The correction applies the same bounds in model space **before** translating into the stored hand grip.

| Derived carried creation | Before: renderer/shot origin discrepancy | After |
| --- | --- | --- |
| Car pulse / automatic | effectively zero | effectively zero |
| Octopus pulse | 0.095282 m downward | below 1e-7 m |
| Dragon flame | 0.199596 m downward | below 1e-7 m |

Regression evidence: identical five test groups against published `967983d` produce three passes and two failures (octopus and dragon); corrected source passes all five. They exercise serialized kits, eight body facings, backwards camera input, actual renderer transforms and emitted shot origins. Additional cases retain model-space bounds for extreme emitters, mounted coordinates, immediate contact, cover and duplicate-command behavior. Existing 44 contact groups and six delayed client fixtures also pass.

This fixes muzzle placement only. Damage, armor, trajectory direction, spread, range, cooldown/heat, protection, launch-path contact, melee, retries, networking and model configuration are unchanged. Already persisted kits retain their stored muzzle until rebuilt from the saved blueprint through the normal game flow; no database migration or stored-kit rewrite is included. The runtime change is confined to `public/arena-core.js` (reviewed blob `db8d9ae81cd7b0af7a8fc3d9c458ce5d6f1bacac`).

## Body-centered matrix

`node scripts/diagnose-aiming.mjs` runs disposable pure-simulation rooms with renderer-transform inspection. Targets are centered on the body-forward axis at distances 0, 0.9, 2, 5, 10 and 20 m; eight facings at 45° increments; camera input at 0°, 90° and 180° relative to the body. Zero-spread runs isolate geometry. The report also tests four fixed seeds at normal spread and an altitude-aligned control. These are deterministic samples, not a statistical accuracy estimate. Target/shooter movement is frozen for the aiming comparison.

| Fixture | Contact 0 / 0.9 m | 2 / 5 / 10 / 20 m, zero spread |
| --- | --- | --- |
| Built-in bow | 24/24 each | 24/24 each |
| Car-derived carried pulse | 24/24 each | 12/24 each: cardinal miss, diagonal hit |
| Octopus-derived carried pulse | 24/24 each | 12/24 each: cardinal miss, diagonal hit |
| Car-derived carried automatic / bow | 24/24 each | 24/24 each |
| Dragon-derived carried flame | 24/24 each | 24/24 at 2/5/10; 20 exceeds range |
| Saved mounted car / pulse octopus | 24/24 each | 24/24 each |
| Saved flying flame dragon | 24/24 each | 24/24 at 2/5/10; 20 exceeds range |

All camera-input variants produce identical shot origins and outcomes. Four-seed spread samples yield pulse 16/32 at 2/5 m and 8/32 at 10/20 m, carried automatic 24/32 at 20 m, carried flame 28/32 at 10 m; remaining eligible samples hit 32/32. The clamp correction changes the two muzzle heights, but none of these hit counts. Both complete matrices are retained as `aiming-before.json` and `aiming-after.json`. Range-edge, moving windup, altitude, defense, KO, protection and retry cases remain covered separately by the full existing contact suite; this matrix does not replace it.

The old pulse assertion is now explicitly labeled a **known aiming limitation**, not a usability acceptance criterion.

## Proposed aiming policy — decision required, not implemented

Propose **bounded horizontal body-forward convergence for handheld ranged weapons**, with a truthful trajectory marker:

1. At firing time, query forward from the body axis at muzzle height for the nearest solid scenery or rival body within weapon range. This query selects a focus depth only and cannot apply damage. If empty, use weapon range. Keep the focus depth at least 1.5 m beyond the muzzle's forward position to avoid backward aiming at touching targets.
2. Aim the handheld barrel toward that point on the body-forward axis, limiting correction to 15° horizontally. Keep pitch zero and the camera independent. Compute the final posed emitter and direction consistently on the server and renderer; the final pose must obey that angular bound. Apply existing weapon spread after selecting the base direction.
3. Launch exactly one projectile with that initial direction; it never tracks or redirects after launch. Preserve the existing body-to-muzzle contact segment and nearest-cover ordering. The focus query grants no hit, visibility exception or second damaging ray.
4. Display a marker for the actual resulting path's first physical obstruction, accounting for muzzle offset, angular cap and range, with an indication of spread. It must also represent immediate launch contact truthfully. Keep mounted fixed barrels body-forward and show their actual path without convergence.

This is aim assistance and needs Yerzhan's decision. It can make a body-facing handheld shot usable across changing target distances without a fixed convergence plane overshooting at long range. Its costs are target-dependent initial direction, focus changes when objects enter the body axis, visible weapon rotation and extra server/client agreement work. The 15° bound, spread, close offsets, vertical separation and movement after firing can still produce misses; this proposal is not a promise of universal hits. A fixed 10 m convergence alone would still leave close targets beside the barrel and cross over again at long range. Two-player tests must assess the focus transitions and truthful marker before accepting the policy. No such aiming change is included in this commit.

## Rendered and hosted acceptance

One attempt in the available cloud browser opened the existing `/__combat` harness at the managed preview URL. Chrome again reported `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, `Error creating WebGL context` at `2026-09-14T05:19:18Z`. The inspected screenshot showed harness controls over an empty background; no game scene rendered. The tab and preview were closed. No repeated browser setup or pixel claim followed. Later harness additions have source/wiring checks only.

| Evidence class | Actual result |
| --- | --- |
| Simulation and scene-graph inspection | Matrix, five emitter groups and 44 contact groups passed as documented; known pulse misses remain |
| Delayed fixture clients | Six cases passed at injected 50/150/300 ms RTT; synthetic signed-in principals, SQLite fixtures, CAS/lost-response retry |
| Rendered local harness / Practice | No successful pixels this follow-up; cloud WebGL disabled. Earlier local Practice success is user-reported historical evidence |
| Real hosted two-player game | Not tested; two usable, separately signed-in authorized player sessions were not available here |

Native Sites deployment verification is read-only metadata evidence. It does not show rendered play or validate two real logins. No access change, bypass session, production write proxy, room reset or private header capture was used to simulate that acceptance.

## Exact local handoff

In a WebGL-capable local checkout of this review commit, use Node 24 and the unchanged lockfile, run `npm ci` if needed, then `npm run dev -- --port 4173`; open `http://localhost:4173/__combat`. The harness serves saved fixture JSON through a development-only module and never calls production or generation. Its new weapon, distance and body-facing selectors allow these cases without editing source. Generated fixture spread is zero in the harness so tracer geometry is repeatable. Cover boxes remain axis-aligned in both simulation and rendering, so use body facing 0° for the cover-order checks below.

1. Bow → Body-centered Z 0.9 → facing 0° → Reset → Fire + 20 ms: expect health 78.4, one confirmed hit. Advance 80 ms once to inspect impact completion. Repeat sideways/backward camera orbit and eight body facings; save the tracer/impact and target feedback screenshots.
2. Punch → Exact overlap → Reset → Fire + 20 ms → Advance 80 ms twice: expect health 83.8 and one hit. Repeat with Car center Z 4: mount loses 16.2, pilot stays at 100. Check the swing and target flash/flinch visually.
3. Saved car as carried pulse → Body-forward normal range → 2, 5, 10, 20 m → facing 0°, 45°, then the other six facings. Reset before each shot. Advance in 80 ms steps up to one second. Expect the documented cardinal miss/diagonal hit until an aiming policy is accepted. Orbit the camera separately; inspect whether the parallel tracer makes the offset clear. Repeat with the carried octopus and compare emitter/barrel origin.
4. Repeat contact and normal ranges with carried rifle, carried flame (through 10 m), saved mounted octopus, flying dragon and twin-gun rover. Inspect the corrected carried flame/octopus height; mounted barrels retain their original policy. For a 20 m target, place the camera In front / backward or Sideways so the target remains visible.
5. Bow, facing 0° → Cover before target: wall impact, health 100. Cover after target: one player hit first. Protected Z 0.9: one blocked contact, health 100. Fire again immediately: cooldown rejection. Behind Z -1 and Out of range Z 80: no ordinary forward hit. Check tracer direction, immediate contact position, blocked marker and exactly one health decrement.
6. Boot Practice separately and check movement/camera/attack animation. Practice is not multiplayer acceptance. For hosted acceptance use the verified creator URL with two existing authorized accounts, wait three seconds after spawn, and use saved creations; never change audience to obtain another account. Version 18 contains the old clamp until a later approved publication, so record the exact version under test.
7. With both screens recorded, repeat contact/2/5/10/20 m, cardinal/diagonal facing, independent camera orbit, mounted targets, jump/fall, movement/rotation during windup, front/behind, intact cover, protection and normal respawn. Document browser versions and measured RTT/jitter/loss at representative 50/150/300 ms total RTT. Inspect sanitized authoritative shot/swing/contact IDs and health snapshots from both clients; retries must not duplicate damage, impacts or KO attribution. Lost-acknowledgement experiments belong in an isolated authorized test environment. Do not retain session tokens or private headers.

Remaining gaps: accepted aiming policy; visual barrel/muzzle/tracer alignment (including the twin-barrel abstraction), immediate contact animation and target readability; actual two-login hosted behavior under measured delay; movement/altitude and cover under that rendered network play; a real saved handheld generated bow if available; and rebuilt-versus-existing persisted kits after any future publication. Issue 1 is not marked complete.

## Checks and review scope

Node 24.19.0 / npm 11.9.0, existing dependencies and lockfile unchanged. Full suite, build and package check passed. Package check confirms 59 byte-identical assets, three migrations, development routes excluded (including `/__combat` and its fixture module), unauthenticated Arena 401 and public secret scan. New emitter tests: before 3/5, after 5/5; existing contact groups 44/44; delayed clients 6/6. The development fixture route and 29 harness control cases also passed a wiring smoke check with a no-op renderer; this is not pixel evidence. Logs are in `validation/combat-acceptance/`.

Reproduce the baseline emitter failures by checking out published `967983ddacdd60d0b470ce51f2a4daa6c7016ea7` separately and running the new test script from this checkout with `BRICKWILD_SOURCE_ROOT=/absolute/path/to/published-checkout`. The same variable is supported by `scripts/diagnose-aiming.mjs`; its four fixed seeds and fixture paths are in source. No baseline file overwrite is needed.

Review the local commit against `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`. Runtime change: `public/arena-core.js`. Associated work: emitter regression, aiming diagnostic, known-limitation test label, package check/script registration, development harness and fixed saved-fixture route, dated reports and evidence. No unrelated changes or later-roadmap implementation. After issue 1 is resolved or its remaining policy decision is explicitly accepted, the next batch is ArrowDown lower / G drop-dismount / T pickup / Shift run; all other roadmap work remains later.

## Authorized aiming prototype — 2026-09-14

The previously proposed handheld policy is now implemented locally under Yerzhan's next bounded authorization. Its base is GitHub `9e62523b37fef657b02ddb19294e4cdfd203f12d`, equivalent creator `d2644d50b8f8171e41eb394f5d003b1e259208f9`. The earlier follow-up was pushed as `9e62523`; this new aiming prototype has not been pushed or deployed. Native Sites still reports version 18/source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`, deployment succeeded. See `AIMING_PROTOTYPE.md` and `LOCAL_AIMING_REVIEW.md` for the new implementation, actual evidence, changed assertions and portable local handoff. Earlier records above remain historical.
