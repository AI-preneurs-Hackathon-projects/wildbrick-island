# Bounded handheld aiming prototype — 2026-09-14

Status: implementation and automated verification complete; local visual review and real two-account acceptance pending. This iteration is committed locally only. No push, saved Sites version, deployment, paid generation, dependency upgrade, access change or database operation is part of it. The 15° limit is an initial playtest value.

## Reviewed source and current release

GitHub baseline: `9e62523b37fef657b02ddb19294e4cdfd203f12d`, tree `f3064c9985c431b386dcd2de173d750b556b7e54`. Dedicated creator checkout baseline: `d2644d50b8f8171e41eb394f5d003b1e259208f9`. A refreshed comparison of all 179 source blobs found only the intentional `.openai/hosting.json` and README differences. Both baselines include the emitter-space correction. No applicable AGENTS.md was found; the checkout was clean before this iteration.

Native Sites read-only metadata still reports the following release; it does **not** contain this prototype or the later emitter correction:

| Field | Verified value |
| --- | --- |
| Project | `appgprj_6aa4e30083f88191a4af01bb8feb2aeb` |
| URL | https://brickwild-adventure.yerzhan452067.chatgpt.site/ |
| Role / audience | Owner / custom, revision 3 |
| Live version | 18 |
| Live creator source | `967983ddacdd60d0b470ce51f2a4daa6c7016ea7` |
| Deployment | `appgdep_6aa77ef82444819191e4945535394ea7` |
| Terminal status | succeeded |
| Deployment update | `2026-09-14T04:59:12.328012+00:00` |
| Environment revision | 6 |

Sanitized evidence is in `validation/aiming-prototype/baseline.json`. Direct creator-origin branch inspection required unavailable Git credentials; native saved/live source and local source equivalence are verified, but unpublished creator remote branch heads are not. GitHub deliberately retains Hadrien's `appgprj_6aa6b740f7908191b26dc41dfb7cf9cb`; neither account's identity files are changed by this patch. Historical release and validation records remain in the previous reports.

## Behavior and geometry

`solveWeaponAim` is a pure shared calculation over trusted kit geometry, body pose and world boxes/actors. For handheld ranged kits it queries the body-forward axis at muzzle height, out to weapon range, using the same padded rival volumes and solid scenery as projectile collision. Shooter and dead actors are excluded. Protected bodies remain blockers. Ground/scenery precede bodies at ties; stable entity IDs resolve equal contacts within a category. The query changes no health and selects depth only.

The focus lies on that axis. Empty-space fallback uses weapon range; the minimum depth is grip-forward position plus horizontal emitter-offset length plus 1.5 m. This slightly conservative radial bound keeps the focus at least 1.5 m beyond the final rotated muzzle. It can lie beyond the projectile's short range; it never extends that range or creates damage there.

One closed-form planar solution rotates the emitter around the existing grip. With focus-minus-grip `(x,z)`, its unconstrained correction is `atan2(x,z) - asin(emitterOffsetX / hypot(x,z))`, with the inverse-sine input bounded for unreachable geometry. Clamp the **final base correction** to ±15°, then recompute the posed muzzle at that angle. Pitch remains zero. Existing spread consumes the same two random samples after base aim; the resulting projectile may exceed the base-angle cap by its intended spread. It has one fixed velocity and never homes or retargets.

The body-to-muzzle bridge retains the nearest-contact fix and rear-target exclusion. Walls, protected bodies and ordinary bodies resolve once, with the same command/projectile IDs. The guide stops at a blocked bridge; it cannot suggest a clear muzzle ray through that obstruction. The focus query may select a wall while the actual offset ray passes beside it. That is a legitimate clear physical path, not permission to shoot through the wall.

Mounted weapons retain their exact body-forward direction and emitter position. Melee, movement, body yaw, zero pitch, damage, armor, protection, heat and cadence remain unchanged. The HTTP API accepts no aiming mode, chosen victim or damage override. The optional solver callback in the trusted simulation is used only by the development harness's fixed-policy comparison; no request field reaches it.

## Pose, guide and confirmation

The carried model rotates relative to the existing player/grip parent and is positioned so its normalized authored emitter equals the solved world muzzle. The body does not turn. A neutral dashed line, hollow endpoint and faint corner brackets show the first physical obstruction or finite range endpoint and the independent yaw/pitch spread envelope. They predict the client's snapshot and never advertise a confirmed hit. No camera targeting or new network request is introduced.

Shot events add only `aimYaw`, `muzzle` and `kitId` for replaying the accepted base pose; existing shot yaw/pitch and projectile data retain the actual post-spread direction. Confirmed event geometry takes precedence over a fresh focus. A 100 ms firing-pose hold keeps model and guide together; acknowledging a preview updates authoritative geometry without restarting its animation or hold. Once an impact is known, the held guide terminates at that authoritative point even if the rival moves away; intended spread can offset it from the pre-shot base line. Immediate contact tracers face the actual launch bridge/contact rather than the unrelated outgoing velocity. Practice uses the same solver and holds the captured path during firing; its existing deterministic spread behavior is retained.

There is no aim interpolation or target hysteresis: identical geometry gives identical selection, and stable IDs prevent insertion-order changes. An object entering/leaving the axis can cause an immediate, capped pose change. The guide stays visible during firing instead of blinking at automatic cadence. The visual tradeoffs to review are these edge transitions, correction jumps on delayed confirmation, and possible short weapon/hand separation when an authoritative world-origin firing pose is held while the character or its remote smoothed representation moves. No pixel-quality claim is made from the transform tests.

Scenery boxes are reused per snapshot (and cached in Practice); remote solutions are reused per snapshot. The local solution uses a bounded number of linear blocker passes, with no iterative solver, broad radial scan, extra network request or scene-object traversal. A 200-rival fixture checks the bounded three-query work.

## Saved geometry and legacy kits

Fixture provenance: saved armed car, octopus and dragon blueprints from `validation/live/final-compact-none/`; carry/pulse/bow/automatic/flame variants are explicitly **derived fixtures**, not captured real handheld designs. No new geometry was generated. Synthetic mirrored and ±2.4 m stored emitter offsets are cap/pose tests only.

Fresh construction and free saved-blueprint rebuild retain the existing normalized-coordinate clamp before grip translation. JSON-serialized/reloaded kits retain their exact muzzle. Pre-correction stored muzzles also remain unchanged: the new solver uses them, and the model is translated to that real origin so pose and shot agree. This can retain the old approximately 9.5 cm octopus or 20 cm dragon hand-position discrepancy. Rebuilding that saved blueprint obtains the corrected origin. Nothing rewrites production rooms or database records, and deployment does not itself rebuild old kits.

## Reproducible automated evidence

Node 24.19.0 and the existing lockfile/dependencies were used. Logs and before/after matrices are in `validation/aiming-prototype/`.

| Evidence | Result |
| --- | --- |
| Same first three aiming regression groups against reviewed creator baseline | 3 fail before; pass after |
| New focused aiming groups | 17 pass |
| Existing contact / emitter groups | 44 / 5 pass |
| Delayed authenticated fixture clients | Original 6 pass; 3 moving-pulse cases added at 50/150/300 ms injected RTT |
| Harness route and interaction wiring | 28 cases pass with a no-op renderer; no pixels |
| Full `npm run check` | Pass |
| `npm run build` | Pass |
| `node scripts/check-package.mjs` | Pass: 62 assets, 3 migrations, byte-identical package, development routes/files excluded, unauthenticated Arena 401, public-secret scan passed |

The geometry matrix freezes spread only for those cells. It tests nine default/saved/derived kits at 0, 0.9, 2, 5, 10 and 20 m where within range, eight body facings and independent camera orbits 0/90/180°. Both derived pulse fixtures improved from **12/24 to 24/24** hits at each of 2/5/10/20 m. Contact/0.9 m remain 24/24. Other eligible zero-spread cells are 24/24 after; flame 20 m is excluded by its 15 m range. Separate four-seed spread samples and exact RNG-consumption tests preserve spread; the finite samples are not a universal accuracy claim. Actual renderer-transform emitter errors are below `1e-12` m.

For the car-derived pulse facing 0°, normal 5/10/20 m base corrections are approximately 10.427° / 4.758° / 2.275°. At 0.9/2 m the 15° cap saturates but the existing launch bridge contacts the rival once; this is not proof that all close offset geometry can converge. Synthetic wide left/right offsets at 5 m saturate and miss, leaving health 100. Extreme valid authored offsets also include legitimate misses. Geometry that exceeds the cap, real range, altitude envelope or physical path must remain able to miss.

Coverage includes left/right and below/at/above cap, no focus, overlap/behind/dead/altitude, short range and expiry, body-query/actual-ray/launch cover, multiple rivals and ties, protection, destroyed/appearing cover, departing targets, fresh/reloaded/legacy/rebuilt kits, all mounted facings, actual model/cannon-axis transforms, guide lifecycle, confirmed and late-ACK playback. Original windup, melee, mount absorption/destruction, defense, armor, cooldown, heat, KO/respawn and retry checks remain. Moving-pulse fixture clients move the target from 5 to 10 m before the delayed server fire, force a CAS conflict and lose the committed response: exactly one 14.4-damage hit, one marker per fixture client and no duplicate preview animation. A separate test moves the target after launch and verifies fixed projectile velocity.

Intentional updates to old assertions:

1. The known parallel-pulse miss expectation now expects a feasible body-forward contact under the authorized policy.
2. Range-edge fixtures position the rival on the accepted final ray, rather than assuming an unrotated +Z muzzle; the inside/outside boundary assertions remain.
3. Firing and network camera tests compare with the shared capped base aim instead of requiring every handheld shot to equal body yaw. Camera independence and zero pitch remain asserted.
4. Emitter and carried-model tests compare actual transforms with the posed muzzle instead of the old unrotated helper. All five emitter groups remain.

Reproduce the before failure using the new test file and an untouched checkout of the baseline:

```sh
BRICKWILD_SOURCE_ROOT=/absolute/path/to/reviewed-baseline node --test --test-name-pattern='derived carried pulse:|accepted shot rotates' scripts/check-handheld-aiming.mjs
node scripts/check-handheld-aiming.mjs
node scripts/diagnose-aiming.mjs
npm run check
npm run build
node scripts/check-package.mjs
```

## Review scope and remaining acceptance

Runtime files: `public/aiming.js`, `public/shot-geometry.js`, `public/aim-presentation.js`, `public/weapon-aim.js`, `public/arena-core.js`, `public/arena-client.js`, `public/arena-view.js`, `public/generated-model.js`, `public/simulation.js`, `public/main.js`.

Tests/handoff: `scripts/check-handheld-aiming.mjs`, `scripts/check-aiming-harness.mjs`, `scripts/check-hit-registration.mjs`, `scripts/check-hit-registration-network.mjs`, `scripts/check-emitter-space.mjs`, `scripts/check-firing.mjs`, `scripts/check-network-movement.mjs`, `scripts/diagnose-aiming.mjs`, `validation/combat-harness.html`, `package.json`; associated planning reports and sanitized validation logs/matrices.

The portable patch targets exact GitHub baseline `9e62523`, **requires its already-included emitter correction**, and excludes both account-specific identity files. A disposable source copy's complete tree was verified as `f3064c9985c431b386dcd2de173d750b556b7e54`; `git apply --check` passed there. It is also applicable to the equivalent creator baseline. Apply/check instructions and actual harness controls are in [LOCAL_AIMING_REVIEW.md](LOCAL_AIMING_REVIEW.md).

The known cloud WebGL limitation was not retried in this iteration. No rendered local pixels, visual quality judgment, real signed-in hosted pair or representative live-network measurement was produced here. Local Codex must review the guide/barrel/tracer/impact together, close contact, cap saturation, focus transitions, old-kit pose, mounted barrels and camera independence. Then use existing authorized accounts for the separate hosted acceptance after an approved deployment. The prototype is ready for that review; issue 1 is not declared fully accepted. Critical controls and the rest of the roadmap remain deferred.

## Subsequent review/release correction — 2026-09-14

The preparation described above was subsequently pushed to GitHub as `d87477233aa9d3d614c96b56d461a2a673eea16d` under Yerzhan's explicit authorization. It was not deployed to Sites: native read-only refresh still reports creator live version 18/source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`, deployment `appgdep_6aa77ef82444819191e4945535394ea7`, succeeded.

Yerzhan supplied a later local WebGL review confirming convergence/cover/protection and demonstrating equipped-model detachment and stale-ACK pose replacement. The next bounded local iteration fixes those presentation issues, separates Down/G/T controls and prepares a measured melee damage candidate. Historical projectile playback is now separated from the currently attached equipped pose and prospective guide; the old frozen-world pose/guide tradeoff is superseded. See [CRITICAL_GAMEPLAY_REVIEW.md](CRITICAL_GAMEPLAY_REVIEW.md). Those new changes remain local, with fresh rendered review and hosted two-account acceptance pending.
