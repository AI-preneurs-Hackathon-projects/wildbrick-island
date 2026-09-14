# Issue 1 — local review result

Prepared 2026-09-14. **Not pushed, saved as a Sites version, or deployed.** Rendered two-player acceptance remains pending.

## Source and identity

| Evidence | Verified result |
| --- | --- |
| Target | `appgprj_6aa4e30083f88191a4af01bb8feb2aeb` |
| Live URL | https://brickwild-adventure.yerzhan452067.chatgpt.site/ |
| Role and audience | Owner; custom audience, existing external viewer; access revision 2 |
| Deployment | Version 17, succeeded; source `6617ba834a58adf4f033200bc602d4da97aa000e` |
| GitHub main | `68a6c36cc0f0a251295eac6261121a4a6e8b095d`, Hadrien Roy, “Unify item controls and clarify round scores and support pickups” |
| Shared source ancestry | Every target blob/path equals GitHub ancestor `693f7ebb1d947884fece174733ef57e1eadcfcfc`; histories have different commit IDs |
| Local reconciliation commit | `20746c3` on `review/combat-hit-registration` |

Both GitHub main and target version/audience were refreshed again after implementation and were unchanged. GitHub direct Git transport required unavailable credentials. The GitHub connector supplied the pinned tree/files; each downloaded file was verified against its Git blob SHA. No target-only source differences existed. The dedicated target checkout retains its original origin and hosting manifest. Only account-specific README prose differs from upstream in the reconciled baseline. No AGENTS.md or companion MASTER_ROADMAP.md was present.

The lockfile, three migrations, schema, generation backend/model defaults and target `.openai/hosting.json` have zero diff from the recovered target. No production database operation, settings update, secret read, paid generation, audience change, push or publication was performed. This is **local source reconciliation**, not remote synchronization.

## Behavioral change

Ranged attacks query the complete body-to-muzzle launch segment against scenery and live rival volumes. The nearest contact wins; scenery wins equal-distance ties. Launch contact excludes the shooter and centers behind the accepted body facing. Immediate contact emits a shot followed by one hit/blocked/impact event using the same projectile ID, and does not leave a projectile to hit again. Its replay begins at the body anchor and moves toward contact, avoiding reverse travel from an overshooting muzzle. Ordinary surviving projectiles retain their muzzle, direction, speed, spread, padding and range. The existing clamp for legacy below-ground emitters remains.

Melee uses horizontal distance from the attacker's center to the nearest point on the target's existing combat box. Mounted boxes retain the existing yaw-dependent axis-aligned envelope. Reach values remain unchanged, with a strict outside boundary: punch 2.2 m, sword 3.5 m, knife 2.3 m, hammer 3.4 m **to the surface**. This deliberately adds only the target half-extent to effective center reach (for a cardinal on-foot target, punch reaches centers below 2.65 m). No attacker-radius bonus or arbitrary range multiplier is added.

Identical horizontal centers count as contact; separated centers retain facing dot >= .45, base-altitude difference <= 1.8 m, line of sight to the contact point, and one victim per swing. Windup is unchanged: punch .13 seconds, other melee .18 seconds. Resolution uses accepted body yaw and current positions. Movement during windup can enter or leave the attack; no historical sweep or lag compensation was added.

`attackBlockReason` is a pure status query used by the attack gate and development diagnostics. It separates protection, heat, cooldown, dead/building/unarmed/round blocks. Existing authoritative events distinguish accepted attacks, contacts and misses. It sends no additional production events and collects no telemetry.

## Reproducible before/after

All positions are body centers, yaw 0, open fixture world, at ground level, protection disabled unless specified, one command, 300 ms advancement. Damage below includes existing medium armor.

| Case | Before | After |
| --- | --- | --- |
| Bow, target Z=.9 | Miss, 0 damage | One hit, 21.6 damage |
| Bow, target Z=1 | One hit, 21.6 | One hit, 21.6 |
| Punch, identical X/Z | Miss, 0 | One hit, 16.2 |
| Punch, target Z=.1 | One hit, 16.2 | One hit, 16.2 |
| Punch, car center Z=4 (front surface Z=1.64) | Miss, 0 | One mount hit, 16.2 |
| Bow Z=.9, target protected | Miss feedback | One blocked contact, 0 damage |
| Shooter protected / cooling / overheated | No attack | No attack; distinct diagnostic reason |
| Punch target Z=8 | Miss | Miss |

Run `npm run diagnose:combat` for fixture-only JSON. Results are saved in `validation/hit-registration/repro-before.json` and `repro-after.json`. Baseline JSON has null rejection reasons because its diagnostic helper did not exist.

To rerun the same regressions before and after, from this checkout:

```sh
node scripts/check-hit-registration.mjs
BRICKWILD_SOURCE_ROOT=/workspace/scratch/9208304a960e/github-baseline node scripts/check-hit-registration.mjs
```

The second path is the pinned GitHub snapshot recovered in this environment. Elsewhere, set `BRICKWILD_SOURCE_ROOT` to a checkout of GitHub `68a6c36`. The final 44-test suite reports **22 failures before, 44 passes after**. Some tests contain multiple positions, families and facings; counts are test groups, not player trials.

## Acceptance evidence

| Area | Evidence and limit |
| --- | --- |
| Bow, generated automatic/pulse/flame and punch/sword/knife/hammer | Exact overlap, Z=.1/.9/1 in eight cardinal/diagonal facings; behind targets excluded |
| Normal and range boundaries | Bow/automatic/flame body-centered normal shots; all ranged families at range endpoint +/- .01 m; expiry emits shot-end, no invented impact |
| Melee range | Surface boundary +/- .01 m for foot/car/plane targets at four facings; front cone and altitude boundary tests |
| Foot/mounted contact | Ranged versus foot/car/plane at contact, normal and outside range; generated drive/fly shooters; melee against mounted volumes |
| Moving, rotating and airborne actors | Movement into/out of windup, stored yaw while rotating, jump/fall and airborne separation; no network rewind claim |
| Cover | Before muzzle, between muzzle/victim, after victim, tie at origin, melee surface LOS; exactly one nearest victim/contact |
| Defense and lifecycle | Medium/heavy armor, aura, mount absorption/destruction, KO attribution, 12-second respawn, protection, cooldown/heat, duplicate commands and persisted snapshots |
| Authentication, persistence and retries | Two actual Arena clients against handleArenaAPI and SQLite fixtures using all three real migrations; principal/session validation, forced CAS conflict and lost committed responses |
| 50/150/300 ms delays | Injected total RTT, half before request and half after response, plus real processing and existing 120 ms polling; bow Z=.9 and overlap punch at each delay |
| Feedback in delayed clients | Immediate local attack-preview, one authoritative hit per client, correct health snapshots and one contact marker per client in Three.js scene graphs; no duplicate marker after retry |
| Existing features | Existing complete npm check suite passes, including round rotation/scoring, items, support, movement, generation replays, joins and shot playback |
| Rendered browser play | **Blocked:** cloud Chrome reports `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, and failure creating a WebGL context. Retry produced the same game graphics fallback, inspected in a screenshot |
| Live two-user acceptance | **Pending:** no publication authorized; local Vite intentionally returns Arena 503. No production-write proxy was configured |

The authentication fixtures inject distinct synthetic principals at a trusted local test boundary. They test the API's authentication/session logic; they do not represent two real Sites logins. Scene-graph markers are not screenshot-based proof of animation quality or HUD readability. The network results do not establish actual Internet latency or resolve perceived movement misalignment.

## Remaining trajectory limitation

A carried generated pulse weapon with the captured rover geometry has a lateral muzzle X=-.76 m while an on-foot target box extends to X=+/- .45 m with .12 m projectile padding. Its normal-range ray can genuinely pass beside a target centered on the shooter's body axis. The suite confirms a hit on that authored ray and a miss on the displaced body axis. Launch contact is fixed; general aim convergence, broader hitboxes and camera aiming are not implemented. This may still feel like a miss to players and needs separate aim-design review rather than a claim that every facing-aligned shot is fixed.

## Repeatable visual and live checks still required

On a browser with WebGL enabled, run the local preview and open `/__combat`. This existing development-only route uses the real simulation and renderer, but no API or production data. The expanded harness adds target cases and displays rejection reason, health/mount and hit/blocked counts.

1. Select **Bow**, target **Body-centered Z 0.9**; Reset, then Fire + 20 ms. Expect health 78.4 and exactly one confirmed hit. Advance 80 ms to see impact completion. Repeat with sideways/backward camera orbit; body yaw stays 0.
2. Select **Punch**, **Exact overlap**; Fire + 20 ms then advance twice. Expect health 83.8, one hit, and no body rotation. Select **Car center Z 4** and repeat: mount loses 16.2, pilot stays at 100.
3. Select carried rifle and flame; repeat overlap, point-blank, normal and behind targets. Select **Cover before target** to verify impact on the wall with target health 100. Select **Cover after target** to verify player contact wins. Each scenario resets only the disposable local fixture.
4. Select **Protected Z 0.9**: shot contacts but does no damage and shows a blocked marker. A second immediate fire should report cooldown; reset before the next case.
5. Check tracer direction, contact marker position, health label, punch animation, target flash/flinch and camera independence. Capture both pre-contact and confirmed-contact screenshots. Verify Practice boot/input separately; it cannot validate multiplayer damage.

For full two-user acceptance after this exact source is explicitly authorized for publication (or in a separately authorized isolated deployment):

1. Use two real, separately authenticated accounts already in the target audience. Keep the target URL/identity and audience unchanged; do not reset rooms, records or migrations. Use saved creations to avoid paid generation.
2. Wait three seconds after spawning, then stand face-to-face at touching range and normal range. Use a single Right Arrow tap for attack; repeat punch, bow, available generated guns/flame, and mounted targets. Rotate the body through cardinal/diagonal facings; orbit the camera separately.
3. Move/jump during windup, test opposing altitude, front/behind positions and intact cover before/beyond the muzzle. Check protection and mount destruction naturally during play.
4. Repeat at documented 50/150/300 ms total RTT using controlled network shaping, with the existing 120 ms polling delay unchanged. Record browser versions, measured RTT, jitter/loss and both screens. A nominal delay setting alone is not a measured RTT.
5. Capture each client's authoritative `/api/arena/sync` snapshot/events alongside video: one shot/swing ID, one hit/blocked ID, one health decrement, consistent KO source. Simulate a lost acknowledgement in an isolated test setup; reconnect/retry must not duplicate damage or impacts. Do not save session tokens or private headers in evidence.

## Checks and review

Node **24.19.0**, npm **11.9.0**; `npm ci` used the unchanged lockfile. No dependency upgrades. Installation reported existing deprecated esbuild-kit packages and an npm configuration warning; dependency advisory assessment is separate and was not expanded in this gameplay batch.

- `npm run check`: pass; logs in `validation/hit-registration/full-check.txt`.
- Final deterministic hit suite: 44/44 pass (`after.txt`); pinned baseline 22/44 fail (`before.txt`).
- Two-client fixture checks: 6/6 pass (`network.txt`).
- `npm run build`: pass (`build.txt`).
- `node scripts/check-package.mjs`: pass, 59 byte-identical assets, three migrations, excluded development files, unauthenticated Arena 401, public secret scan passed (`package.json`).
- `node --check` on gameplay module and extracted harness module, plus `git diff --check`: pass.

Issue-specific files: `public/arena-core.js`, `package.json`, `scripts/check-hit-registration.mjs`, `scripts/check-hit-registration-network.mjs`, `scripts/diagnose-hit-registration.mjs`, `validation/combat-harness.html`, this report, `planning/PROGRESS.md`, and evidence under `validation/hit-registration/`. All other changes belong to the separate upstream reconciliation commit.

Review only the fix with `git diff 20746c3..HEAD`; review the whole locally reconciled result with `git diff 6617ba834a58adf4f033200bc602d4da97aa000e..HEAD`. Keep both focused commits local until Yerzhan approves that concrete result. Stop after issue 1; the later roadmap remains deferred.
