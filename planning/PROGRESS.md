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
