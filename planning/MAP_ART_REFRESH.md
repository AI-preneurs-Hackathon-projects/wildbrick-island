# Map art refresh — 2026-09-14

Implemented; visual acceptance pending. GitHub main baseline `dd5dab936fcd25d6e6c50cdf79a1cd4985a96a66`, reconciled locally on main as `cd14347`. The clean creator checkout had been at `9144289`; 40 upstream files were refreshed from verified GitHub blobs. No performance branch was fetched or merged. Creator hosting manifest and README are preserved. No applicable AGENTS.md or new coordination file was found.

Mountain is the third map. Candidate: blue/teal ridge steps, green pines and valley, warm paths and roofs, slightly cooler restrained snow. Other maps retain their terrain/prop palettes. All three keep the existing large surrounding plane, clouds and decorative marks; pale aqua surroundings reduce the ocean/sky division without exposing an underside void. No distant silhouettes or new geometry/material allocations, lights, shaders, textures or frame work.

Cloud browser probe on the unchanged baseline failed to start WebGL. Actual appearance, matched screenshots, rendered draw calls, GPU memory and timing remain PROVISIONAL; scene-graph tests are not pixels. Local desktop review is required. Nothing pushed or deployed. Existing creator site reports version 21; this art is not live.

Shared production integration: `public/world.js` changes only two color literals; `public/themed-world.js` changes only the mountain base and decorative mark colors. No main.js, material helper, arena client/core/view or their tests edited by this art change. All gameplay source introduced by reconciliation predates this candidate and belongs to upstream main.

## Evidence and limits

Replacing only creator README/manifest blobs in the reconciled baseline reconstructs the exact GitHub tree `5bd79426f423191e5e6db3210b4f012c215bc42f`. This verifies all other source blobs, rather than assuming shared Git ancestry. GitHub was refreshed through its connector; the checkout's origin is the separate creator Sites source repository, so this was not a GitHub `git pull` over that origin.

`scripts/check-map-art.mjs` constructs real Three.js worlds in separate baseline/candidate processes. It verifies unchanged map descriptors after excluding only color fields; identical geometry arrays, transforms, instance matrices, visibility/shadow/material parameters; and identical resource counts. Nine enter/dispose cycles per build remove every root and dispose every owned geometry/material/instanced mesh. Shared resources intentionally remain cached. Browser/GPU retention and frame distributions remain unmeasured.

| World-only structural measure | Island before → after | Beach before → after | Mountain before → after |
|---|---:|---:|---:|
| Meshes/batches, **not rendered calls** | 323 → 323 | 185 → 185 | 216 → 216 |
| Triangles including instances, before culling/shadows | 318,194 → 318,194 | 337,306 → 337,306 | 341,052 → 341,052 |
| Unique geometries | 8 → 8 | 4 → 4 | 4 → 4 |
| Unique attached materials | 83 → 83 | 184 → 184 | 215 → 215 |
| Geometry attribute/index bytes | 52,180 → 52,180 | 349,300 → 349,300 | 52,732 → 52,732 |
| Instance matrix bytes | 434,304 → 434,304 | 460,544 → 460,544 | 469,056 → 469,056 |
| World texture bytes | 0 → 0 | 0 → 0 | 0 → 0 |
| Owned resource dispose events per exit | 161 → 161 | 365 → 365 | 427 → 427 |
| Rendered calls / GPU bytes / frame timing | Pending | Pending | Pending |

These exclude actors, HUD labels and renderer shadow targets. No rendering-budget increase is indicated structurally; this is not a hardware performance result. Existing background/fog color `#b4dedd`, fog 95–240 m, far plane 500 m, lights, tone mapping, shadows and frame code are unchanged. The surrounding plane now uses that pale aqua family, while existing marks are lighter. A lit material is not guaranteed to exactly match the flat background: local horizon/flight review must assess the result. Existing clouds remain at their original locations and fog visibility; no hidden distant silhouettes were added.

Node 24.19.0 and existing dependencies/lockfile used. Focused art comparison passes. Full `npm run check` attempted once and stopped at **pre-existing** `check-round-refinements.mjs:24`: expected Help shortcut list lacks the X snapshot key. The same failure reproduces in the untouched baseline. All remaining suites were then executed, including map (14 groups), geometry/support, movement/network, hit registration, aiming/attachment, control/balance/camera and voice. A timing-sensitive `check-transcription.mjs:23` abort assertion initially failed (0 versus 1 provider calls); isolated baseline and candidate reruns both passed. Remaining voice UI/harness/availability suites pass. Full-suite status is therefore **not green**, with the upstream Help assertion still open; no unrelated tests were modified.

Build and both package checks pass: **66 assets, three migrations**, byte-identical packaged assets, development files excluded, unauthenticated Arena 401 and secret scan passed. New harness module syntax checks. No dependency/lockfile, gameplay authority, IDs/HP/spawns/boxes/drop points, camera, networking or performance-session code changed relative to the frozen main baseline. No provider calls, settings changes or database operations.

## Exact desktop handoff

1. Use Node 24 and `npm ci` with the existing lockfile. In the candidate, run `node scripts/check-map-art.mjs /absolute/path/to/untouched-baseline`. The baseline must be GitHub `dd5dab936fcd25d6e6c50cdf79a1cd4985a96a66` (or the verified creator equivalent `cd14347`).
2. For identical before/after tools, create a baseline worktree, then apply **only** the candidate diff for `validation/map-art-harness.html` and `vite.config.js` to it. Keep all its production art files at the baseline. On each checkout sequentially run `npm run dev -- --host 127.0.0.1 --port 4173`. Open `http://127.0.0.1:4173/__map-art?map=mountain&camera=foot&orbit=0`. The canvas is fixed at 1440×900. Set the desktop viewport to 1440×900 and use the same DPR/browser/GPU for both. No device emulation matrix.
3. Use **Map** (island/beach/mountain), **Camera** (foot/horizon/elevated/overview) and **Orbit** (0/90/180/270). **Save matched image** downloads the actual canvas with matching names; store in separate before/after folders. It preserves the selected camera, unlike the older map harness's overview-only capture. Compare mountain first, then all three maps at foot/horizon/elevated. Inspect paths and cover, snow highlights, shaded cliff steps, pines, warm roofs, plane edge and cloud visibility. No screenshots were fabricated or generated in this run.
4. Leave **Actors, bow, pickup and health label** checked for readability. The stationary arrow is explicitly a readability sample, not an authoritative fired event. Inspect the bow/player silhouettes, rival's 64-HP bar, health supply and arrow against ground and sky. For actual tracer/impact feedback use existing `/__combat` controls and normal Practice: this art harness does not establish combat or hosted multiplayer acceptance. Check the unchanged gameplay HUD in Practice as well.
5. Uncheck actors for world-only comparison. Use **Measure 600 frames**: 120-frame warmup, 600 samples; it reports rendered calls/triangles, renderer geometry/texture counts, scene material count and an explicitly estimated RGBA texture footprint. Shadow target allocation is separately identified and unchanged. CPU submission and requestAnimationFrame p50/p95/p99 are not GPU timings. Repeat the same map/camera/actor state sequentially before/after on one machine, with no background workloads; save outputs. Do not interpret cloud/software-WebGL scheduling noise as hardware evidence.
6. Use **Cycle maps ×3** and compare renderer resource counts for each repeated map, after initial cache warmup. Counts should stabilize. Structural disposal already passes; GPU-memory plateau remains pending. Recheck camera extremes/flight without changing product camera limits.

Changes authored for this effort: four production color files (`public/maps/mountain.js`, `public/maps/beach.js`, `public/world.js`, `public/themed-world.js`); one development-only route in `vite.config.js`; new `validation/map-art-harness.html`, `scripts/check-map-art.mjs`, and this report. No shared package-script registration change, to avoid parallel work conflicts. Run the dedicated check explicitly.

## Delivery and rollback

The portable art patch is against the exact GitHub baseline above, excludes synchronization changes and both account-specific identities, and is verified with `git apply --check --index` followed by application/tree comparison in a disposable copy. Implementation commit and patch location are provided in the completion message. The synchronization commit is separate from the art commit. To roll back art, revert only the art commit (or apply the portable patch in reverse); keep upstream synchronization. Nothing pushed, saved as a new Sites version or deployed. Creator version 21 remains separate from this local candidate. Refresh remote main and reconcile concurrent work before any later authorized push. Actual visual improvement and zero runtime-cost acceptance remain pending local rendered review.
