# Combat hit registration — issue 1

## Source reconciliation (2026-09-14)

- Verified Sites owner role, exact project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`, custom audience and existing external viewer. No access changes.
- Version 17 deployment succeeded; source `6617ba834a58adf4f033200bc602d4da97aa000e`. Recovered clean target checkout from its returned source repository.
- GitHub main refreshed: `68a6c36cc0f0a251295eac6261121a4a6e8b095d` (Hadrien Roy, Unify item controls and clarify round scores and support pickups).
- GitHub history uses different commit IDs: target's complete source tree equals GitHub ancestor `693f7ebb1d947884fece174733ef57e1eadcfcfc`, verified by every Git blob SHA and path. There are no target-only source changes to merge. GitHub direct Git transport was unavailable; fetched pinned files through the GitHub connector and verified their blob hashes.
- Imported downstream GitHub source changes, retaining the exact target hosting manifest and correcting account-specific README deployment prose. Lockfile, three migrations, DB schema, generation backend and model defaults are identical. Runtime settings/secrets and database contents were not read or modified.
- No AGENTS.md in checkout or ancestors; no companion MASTER_ROADMAP.md supplied or found.

## Status

- [x] Recover and reconcile sources locally.
- [x] Confirm body-centered hit repros and record failing regression evidence.
- [x] Implement launch-path contact and bounded melee-volume contact; preserve damage and controls.
- [x] Complete deterministic behavior and persistence/retry validation.
- [x] Record rendered/two-client limitations and exact acceptance steps.
- [x] Commit focused local result; no push, save-version or deploy.

## Validation outcome

- Final deterministic suite: 44 passing test groups; the identical suite fails 22 groups against GitHub 68a6c36. Bow Z=.9 now deals 21.6 damage; overlap punch and car-surface punch deal 16.2 after existing armor.
- Two authenticated fixture clients pass bow/punch at injected 50/150/300 ms RTT with a lost committed response and forced CAS retry. Exactly one hit and one scene-graph impact per client.
- Browser visual acceptance remains pending: cloud Chrome cannot create a WebGL context (renderer disabled), including after Retry. No live two-user session was tested.
- Existing authored lateral pulse trajectories can still miss body-centered targets at distance; no aim assistance or camera aiming was added.
- Full details, evidence, exact repros and pending acceptance steps: [HIT_REGISTRATION.md](HIT_REGISTRATION.md).
- GitHub main, target version 17 and audience revision 2 were refreshed after implementation and remained unchanged. No push/publication/runtime/database change.

## Deferred scope

Controls (ArrowDown/G/T), combat strength, speech fallback, camera/hotkey/history changes, and interactive Practice remain later batches. No new lag compensation, networking rewrite, visual redesign, database reset or paid generation.

## Release-status correction — 2026-09-14, creator acceptance follow-up

The pre-publication statements above are retained as historical evidence. Read-only native Sites verification now confirms **live version 18**, creator source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`, deployment `appgdep_6aa77ef82444819191e4945535394ea7`, terminal **succeeded**, updated `2026-09-14T04:59:12.328012+00:00`. Exact target remains `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`, https://brickwild-adventure.yerzhan452067.chatgpt.site/. Owner role; current custom audience revision 3; environment set revision 6. No access or runtime change was made by this follow-up.

GitHub main is `7ee2b1e2fd89f9b9b8b17de7cdd3c91fee705f90`. Despite different histories, a complete blob comparison confirms the published creator source matches GitHub except the account-specific hosting manifest and README. GitHub intentionally retains Hadrien's project ID `appgprj_6aa6b740f7908191b26dc41dfb7cf9cb`; the dedicated creator checkout retains its own manifest. Publication is verified from the Sites deployment result, not inferred from GitHub.

**Issue 1 remains open.** A separate model-space/hand-space clamp defect is corrected locally with failing-before/passing-after emitter tests; it does not solve the normal-range offset pulse miss. The pulse test is explicitly labeled a known aiming limitation. No convergence policy was implemented. Full suite (including 44 contact groups, six delayed client fixtures and five emitter groups), build and package checks pass. This follow-up has not pushed, saved or deployed a new version.

Rendered acceptance has not occurred: a single browser attempt again failed to create WebGL, and two real authorized signed-in player sessions were unavailable here. Scene-graph and delayed synthetic-client results are not pixels or hosted acceptance. The previous no-publication-authorization wording no longer describes the released version; this follow-up is intentionally local-only under the latest instruction.

See [COMBAT_ACCEPTANCE_FOLLOWUP.md](COMBAT_ACCEPTANCE_FOLLOWUP.md) for exact saved-version/deployment evidence, fixture provenance, the 0/0.9/2/5/10/20 m matrix, bounded aiming-policy proposal, precise local harness/hosted checklist, persisted-kit limitation and review scope. Sanitized release metadata and fresh check logs are under `validation/combat-acceptance/`. Historical validation records above remain intact.

## Bounded handheld aiming prototype — 2026-09-14, ready for local review

- Refreshed GitHub main `9e62523b37fef657b02ddb19294e4cdfd203f12d`; creator baseline `d2644d50b8f8171e41eb394f5d003b1e259208f9`. Every blob matches except the intentional hosting manifest and README differences. Dedicated creator checkout was clean; no applicable AGENTS.md found.
- Native Sites read-only refresh: version 18/source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`, deployment `appgdep_6aa77ef82444819191e4945535394ea7`, succeeded; owner role, custom audience revision 3, environment revision 6. No site/runtime/data changes.
- Authorized scope: shared deterministic 15° handheld convergence, matching pose/path guide, regression coverage and portable local visual handoff. Mounted barrels, damage, movement and later roadmap unchanged. No push/publication this run.
- Implemented the shared closed-form solver, matching carried pose, neutral path/spread guide, confirmed-shot presentation and fixed-policy harness comparison. Preserved legacy stored muzzles; normal free blueprint rebuild obtains corrected coordinates.
- Verified 17 focused aiming groups, all 44 contact groups, all five emitter groups, the original six delayed fixtures plus three moving-pulse fixtures, and 28 harness wiring cases. Full suite/build/package passed (62 assets, three migrations, Arena 401). Original three aiming repro groups fail against the reviewed baseline.
- Both derived pulse fixtures: 12/24 to 24/24 zero-spread hits at each of 2/5/10/20 m. Extreme offsets still have legitimate capped misses. No rendered/pixel or real hosted two-account acceptance this run.
- Review report: `AIMING_PROTOTYPE.md`; exact portable setup and cases: `LOCAL_AIMING_REVIEW.md`. Local commit/portable patch prepared for review; no new push/deployment.

## Critical gameplay iteration — 2026-09-14

- Refreshed GitHub main `d87477233aa9d3d614c96b56d461a2a673eea16d`, equivalent creator `c8d5d1f7ccab4e71ddab6492ef4248e4687dc10c`; every gameplay blob matches, with only hosting/README identity differences. Clean dedicated checkout, no applicable AGENTS.md or attached LOCAL_AIMING_REVIEW_RESULT.md found. The user's pasted local review is the supplied evidence.
- Release correction: the aiming prototype was pushed to GitHub as d874772 under subsequent authorization. Prior local-only wording describes preparation history. Native Sites still verifies version 18/source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`, deployment `appgdep_6aa77ef82444819191e4945535394ea7`, succeeded; owner/custom audience revision 3, environment revision 6. No deployment or runtime change in this run.
- Part A: reproduced 0.64 m local detachment, 0.818730753 m remote detachment and stale-command angle overwrite in actual Three.js transforms. Implemented relative attached pose/flash and command/lifecycle matching; historical projectile origins remain independent. Part A gate passed: six attachment groups, 17 aiming groups, 44 contact groups, five emitter groups, nine delayed clients, firing/network-movement checks and 28 original plus two presentation harness wiring cases. Part A is committed independently before Parts B/C.
- Local reviewer reports actual WebGL checks of convergence/cover/protection plus visible attachment failure; those are user-supplied local evidence, not new cloud pixels. Cloud visual and real hosted pair acceptance remain unavailable.
- Ordered scope: A presentation fix, B independent Down/G/T controls, C measured punch/melee candidate. Local commits and portable patch only; no push/publication.
