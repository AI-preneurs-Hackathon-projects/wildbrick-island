# Critical gameplay review — 2026-09-14

This run prepares separate local commits for presentation, control separation and melee balance. No push, Sites save/deploy, runtime/access change, database operation, paid API call or dependency upgrade is authorized for this run.

## Baseline and release correction

GitHub main refreshed at `d87477233aa9d3d614c96b56d461a2a673eea16d`, tree `4f8558c397c003b9c384a9db5c09820e6f8cd5ee`. Creator baseline `c8d5d1f7ccab4e71ddab6492ef4248e4687dc10c`. Complete source comparison matches except `.openai/hosting.json` and README. No unrelated dirty work or applicable AGENTS.md found. No attached `LOCAL_AIMING_REVIEW_RESULT.md` found; the user's pasted review supplies the local findings.

The earlier aiming preparation was subsequently pushed to GitHub as d874772. That push was **not** a Sites release. Refreshed native metadata verifies exact creator project `appgprj_6aa4e30083f88191a4af01bb8feb2aeb`, URL https://brickwild-adventure.yerzhan452067.chatgpt.site/, owner role, custom audience revision 3. Live version 18 is creator source `967983ddacdd60d0b470ce51f2a4daa6c7016ea7`; deployment `appgdep_6aa77ef82444819191e4945535394ea7` remains **succeeded**, updated `2026-09-14T04:59:12.328012+00:00`, environment revision 6. It lacks later emitter/aiming work. Account-specific manifests and all runtime/data settings remain intact.

## Part A: attached and ordered presentation

The three deterministic before tests reproduce the review exactly: 0.64 m additional local grip error during the firing hold, 0.818730753 m remote error in the first interpolation frame, and an old acknowledgement replacing the newer 2.275° correction with 10.427°. Logs: `validation/critical-gameplay/attachment-before.txt`.

The equipped model now uses a relative aiming correction in its actor parent, including the displayed remote interpolation transform. Its local emitter placement retains stored legacy geometry. A firing hold preserves that relative correction, not a historical world position. The attached flash follows the current equipped emitter. Practice shares the relative pose and recomputes its prospective guide at the current actor location. Old kits retain their original grip discrepancy; tests measure only additional movement-induced error.

The guide now always predicts a prospective path from the currently equipped pose, including launch cover. Historical shot origins, velocities and confirmed impacts belong exclusively to shot playback. A previous prototype assertion anchoring the guide to an old impact was deliberately replaced with this separation; the impact/tracer itself still uses the authoritative old position. No fired projectile moves with the shooter or changes direction to reconnect to the gun.

Shot/swing presentation carries trusted `roundId`, `spawnSerial` and kit/command identity; ranged events also include the accepted relative `aimCorrection`. The view confirms only its matching current preview and preserves that preview's timestamp. Old ACKs can enter historical projectile playback but cannot borrow a newer preview's geometry or animation clock. Duplicate matching acknowledgements cannot restart a hold. Kit changes, KO, round changes, respawn and leaving invalidate equipped presentation. The server does not consume client aim/victim/damage fields; damage and simulation policy are unchanged in Part A.

Six attachment/order groups cover fresh and legacy carried geometry, strafe/forward/turn motion, remote interpolation, attached flash and current guide versus historical tracer, two outstanding commands, stale/matching/duplicate/expired ACKs, kit/round/respawn changes and Practice. Existing delayed authenticated fixture clients cover CAS conflict and lost committed responses independently of the view-order tests. These are transform/fixture results, not new pixels or real hosted sessions.

Local reviewer evidence supplied by the user includes actual WebGL convergence at 5/10/20 m, fixed/capped misses, cover/protection and visible detached/reattached states. This cloud run does not relabel those as its own rendered validation. No repeated WebGL setup is attempted.

### Local Part A controls

Use Node 24.19.0 and the existing lockfile. Run `npm ci`, then `npm run dev -- --port 4173`; open http://localhost:4173/__combat. Use **Saved octopus as carried pulse**, normal 5 m, fresh or stored origin. **Fire + 20 ms**, then **Strafe shooter +0.64 m**, **Advance shooter +0.64 m**, or **Turn shooter 45°**. The gun and flash stay attached; the old projectile continues from its original position. **Advance 80 ms** passes the hold without a positional snap.

Set **Displayed shooter → Remote interpolation**, then **Remote step +1 m** and advance. The gun remains attached through interpolation. **Preview newer shot / old ACK** prepares the exact two-command case; **Displayed weapon angle** must stay approximately 2.28° while the older shot replays. The original camera/aim/cover/protection/mounted controls remain. In Practice, move and turn during firing with an existing saved creation and inspect grip/guide/tracer independently.

Part A gate passed on Node 24.19.0: 6 new attachment groups, 17 aiming groups, 44 contact groups, 5 emitter groups, 9 delayed-client cases, firing and movement-network checks, and 28 original plus 2 added harness interactions. Evidence is in `validation/critical-gameplay/*-gate.txt`. No solver/damage changes were needed.

## Part B: independent descent and item controls

`action-bindings.js` defines the relevant physical keys and labels once. ArrowDown is held descent only; G and T are independent, edge-triggered drop/dismount and pickup commands. W/A/S/D, Shift, Up/Space, Right attack, Left speech, Q/E and H/P/Escape retain their actions. Shift combinations remain usable while running; Ctrl/Alt/Meta and composition suppress gameplay. Repeat and duplicate keydown cannot dispatch G/T twice.

Keyboard, touch HUD, Help, creation guidance and `aria-keyshortcuts` use the shared definitions. T with an equipped kit gives G-first feedback and cannot drop/replace it; absent items give clear nearby-item feedback. G retains the exact dropped Arena kit, blueprint ID, mount health, heat and cooldown in the existing recoverable item record. It does not teleport the player; midair dismount continues the existing safe fall/support behavior. Building blocks item changes in the input/action path and trusted server drop handler. KO/intermission, menus, editable fields (including descendant contenteditable targets), composition and modifier shortcuts suppress gameplay; focus loss releases held keyboard/touch state. Independently held movement and lower controls survive a separate item-button action.

Practice retains its existing return-to-foot behavior and saved-blueprint rebuilds; it does not gain a new recoverable-world-item system. T there explains that recoverable items are in Arena. No saved blueprint is deleted. Holding Down never invokes that return-to-foot path.

Six focused control groups pass, including foot/bow/car/plane, empty/equipped/absent/nearby items, building, KO, intermission, typing/dialog/composition/modifiers, repeat/focus loss, simultaneous movement/attack, real simulation descent/hover/fall and independent touch controls. Existing Arena UI, control-fix and round-refinement checks pass. Obsolete Down-pickup expectations were replaced intentionally with separate Down/G/T assertions; the focused-touch fixture now explicitly leaves text-entry focus and releases the matching pointer. Original support pickups remain automatic and unaffected.

### Local Part B controls

In `/__combat`, choose a mounted/flying creation, check **Enable keyboard / touch controls**, click the island to leave form focus, then use **Lift shooter to 6 m**. Hold Down and click **Advance 80 ms**: height falls 0.8 m per step while the kit remains equipped. Release Down: the flying mount hovers. Press G or **Drop / dismount G**: kit becomes foot, one recoverable item appears, and the player stays at the same position before falling on subsequent steps. After landing, T or **Pick up T** restores the item. Holding Down cannot perform either operation. The small joystick, **Rise ↑**, **Lower ↓** and **Attack →** use the actual input module; item buttons remain separate. Four harness cases verify descent, drop, fall and pickup in addition to the original/presentation cases. This fixture steps time manually and uses body-frame movement for convenient inspection.

In ordinary local Practice inspect actual HUD layout, Help, G/Down hints and separate touch movement/lower/item controls, including text and menu guards. Recoverable Arena items require the harness or later authorized hosted review; Vite's Arena API remains unavailable. Real multi-touch pixels and hosted two-player checks remain pending.
