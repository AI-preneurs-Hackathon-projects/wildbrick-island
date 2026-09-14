# Melee balance candidate — 2026-09-14

Candidate for local feel review. Baseline: GitHub `d87477233aa9d3d614c96b56d461a2a673eea16d`. Only four trusted family damage values change; range, interval, windup, spread, movement, heat, armor and contact geometry do not. No knockback is added.

Punch **18 → 27** meets the requested 1.5× increase. Sword **36 → 42** is 1.556× the new punch with its original .62 s cadence and 3.5 m reach. Knife **17 → 20** keeps .32 s cadence and 2.3 m reach: a modest faster-contact advantage without sword reach. Hammer **55 → 60** keeps 1.15 s cadence and 3.4 m reach: its default-armor breakpoint becomes two hits, but heavy armor still requires three and its sustained raw DPS remains below punch. These are one conservative candidate, not repeated tuning or human playtest conclusions.

Ranged values are unchanged. A stationary guaranteed-contact benchmark omits aiming, travel, spread, cover and mobility costs and cannot establish a ranged imbalance. Bow retains 56 m reach, automatic retains its movement/heat tradeoffs, and flame/pulse retain their existing cadence and paths.

## Full family comparison

Hits/time columns mean landed hits to KO / elapsed time from the first command, against 100 HP with default 10% armor. Raw DPS excludes armor, startup, travel and heat.

| Family | Damage before → candidate | Interval s | Reach m | Raw DPS before → candidate | Default KO before → candidate |
| --- | --- | --- | --- | --- | --- |
| punch | 18 → 27 | 0.5 | 2.2 | 36.00 → 54.00 | 7 / 3.13 s → 5 / 2.13 s |
| none | 0 → 0 | 0.5 | 0 | 0.00 → 0.00 | — → — |
| pulse | 16 → 16 | 0.42 | 42 | 38.10 → 38.10 | 7 / 2.52 s → 7 / 2.52 s |
| flame | 7 → 7 | 0.16 | 15 | 43.75 → 43.75 | 16 / 2.40 s → 16 / 2.40 s |
| automatic | 14 → 14 | 0.18 | 38 | 77.78 → 77.78 | 8 / 1.26 s → 8 / 1.26 s |
| bow | 24 → 24 | 0.85 | 56 | 28.24 → 28.24 | 5 / 3.40 s → 5 / 3.40 s |
| blade | 36 → 42 | 0.62 | 3.5 | 58.06 → 67.74 | 4 / 2.04 s → 3 / 1.42 s |
| knife | 17 → 20 | 0.32 | 2.3 | 53.12 → 62.50 | 7 / 2.10 s → 6 / 1.78 s |
| hammer | 55 → 60 | 1.15 | 3.4 | 47.83 → 52.17 | 3 / 2.48 s → 2 / 1.33 s |

## Measurement assumptions

Stationary body-overlap contact, zero spread, no spawn protection, commands at earliest legal cadence on 10 ms ticks; time starts at first fire and includes windup. Armor/absorption and automatic heat are actual Arena rules. Defense starts with its actual 10 s duration. Mount destruction returns target to default armor. No travel/aim/movement or human reaction cost.

Baseline values are captured from the reviewed source in `validation/critical-gameplay/combat-baseline.json`; the same unchanged Arena simulation runs both those stored values and freshly constructed candidate values. The fixture is derived from saved car geometry with controlled family/armor traits, not a captured authentic knife or hammer. Zero-distance body-overlap supplies reliable contact and removes ranged travel time. The normal-range aiming regressions remain separate. Tick resolution is 10 ms. No target moves, receives support drops or attacks back. First melee contact includes .13 s punch windup or .18 s other-melee windup. Later attacks obey the existing cooldown. Automatic heat decays at the existing rate and enforces the existing overheat wait. Mount/shield destruction changes the receiver to default foot armor; the table measures this actual transition rather than dividing combined HP by a fixed armor factor.

## Armor and absorption results

### Default armor (10%), 100 HP

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 7 / 3.13 s | 5 / 2.13 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 7 / 2.52 s | 7 / 2.52 s | 0 / 0.00 |
| flame | 16 / 2.40 s | 16 / 2.40 s | 0 / 0.00 |
| automatic | 8 / 1.26 s | 8 / 1.26 s | 0 / 0.00 |
| bow | 5 / 3.40 s | 5 / 3.40 s | 0 / 0.00 |
| blade | 4 / 2.04 s | 3 / 1.42 s | 0 / 0.00 |
| knife | 7 / 2.10 s | 6 / 1.78 s | 0 / 0.00 |
| hammer | 3 / 2.48 s | 2 / 1.33 s | 0 / 0.00 |

### Heavy armor (24%), 100 HP

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 8 / 3.63 s | 5 / 2.13 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 9 / 3.36 s | 9 / 3.36 s | 0 / 0.00 |
| flame | 19 / 2.88 s | 19 / 2.88 s | 0 / 0.00 |
| automatic | 10 / 1.62 s | 10 / 1.62 s | 0 / 0.00 |
| bow | 6 / 4.25 s | 6 / 4.25 s | 0 / 0.00 |
| blade | 4 / 2.04 s | 4 / 2.04 s | 0 / 0.00 |
| knife | 8 / 2.42 s | 7 / 2.10 s | 0 / 0.00 |
| hammer | 3 / 2.48 s | 3 / 2.48 s | 0 / 0.00 |

### Default armor plus defense aura (.45 damage multiplier, initial 10 s)

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 14 / 6.63 s | 10 / 4.63 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 16 / 6.30 s | 16 / 6.30 s | 0 / 0.00 |
| flame | 36 / 5.60 s | 36 / 5.60 s | 0 / 0.00 |
| automatic | 18 / 9.12 s | 18 / 9.12 s | 3 / 6.06 |
| bow | 11 / 8.50 s | 11 / 8.50 s | 0 / 0.00 |
| blade | 7 / 3.90 s | 6 / 3.28 s | 0 / 0.00 |
| knife | 15 / 4.66 s | 13 / 4.02 s | 0 / 0.00 |
| hammer | 5 / 4.78 s | 5 / 4.78 s | 0 / 0.00 |

### Shield armor (45%), 90 shield then 100 HP

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 16 / 7.63 s | 11 / 5.13 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 18 / 7.14 s | 18 / 7.14 s | 0 / 0.00 |
| flame | 40 / 6.24 s | 40 / 6.24 s | 0 / 0.00 |
| automatic | 20 / 9.48 s | 20 / 9.48 s | 4 / 6.06 |
| bow | 12 / 9.35 s | 12 / 9.35 s | 0 / 0.00 |
| blade | 8 / 4.52 s | 7 / 3.90 s | 0 / 0.00 |
| knife | 17 / 5.30 s | 15 / 4.66 s | 0 / 0.00 |
| hammer | 6 / 5.93 s | 5 / 4.78 s | 0 / 0.00 |

### Default armor (10%), 155 mount then 100 HP

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 16 / 7.63 s | 11 / 5.13 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 18 / 7.14 s | 18 / 7.14 s | 0 / 0.00 |
| flame | 41 / 6.40 s | 41 / 6.40 s | 0 / 0.00 |
| automatic | 21 / 11.68 s | 21 / 11.68 s | 4 / 8.08 |
| bow | 12 / 9.35 s | 12 / 9.35 s | 0 / 0.00 |
| blade | 8 / 4.52 s | 7 / 3.90 s | 0 / 0.00 |
| knife | 17 / 5.30 s | 15 / 4.66 s | 0 / 0.00 |
| hammer | 6 / 5.93 s | 5 / 4.78 s | 0 / 0.00 |

### Heavy armor (24%), 217 mount then 100 HP

| Family | Before hits / time | Candidate hits / time | Candidate overheat cycles / wait s |
| --- | --- | --- | --- |
| punch | 23 / 11.13 s | 15 / 7.13 s | 0 / 0.00 |
| none | — | — | 0 / 0.00 |
| pulse | 25 / 10.08 s | 25 / 10.08 s | 0 / 0.00 |
| flame | 57 / 8.96 s | 57 / 8.96 s | 0 / 0.00 |
| automatic | 29 / 17.16 s | 29 / 17.16 s | 7 / 12.12 |
| bow | 17 / 13.60 s | 17 / 13.60 s | 0 / 0.00 |
| blade | 12 / 7.00 s | 10 / 5.76 s | 0 / 0.00 |
| knife | 24 / 7.54 s | 20 / 6.26 s | 0 / 0.00 |
| hammer | 8 / 8.23 s | 7 / 7.08 s | 0 / 0.00 |

## Persisted kits and trust boundary

Already-equipped or dropped kits persist their stored stats, including old punch 18, sword 36, knife 17 and hammer 55. JSON reload and pickup preserve them. No production room is rewritten. A normal saved-blueprint rebuild constructs candidate stats; default foot construction on dismount, respawn and new rounds uses punch 27. Ordinary round progression resets equipment using the existing rules. Rebuilding uses saved validated geometry and needs no paid generation. The model selects an enumerated family; an arbitrary damage field cannot replace trusted family damage. The focused test injects such fields and verifies the trusted values; the API blueprint validator remains unchanged.

Five balance groups cover exact default KO timing, all unchanged weapon fields, heavy armor/aura/absorption, automatic heat, saved/derived family selection, legacy stats, rebuild/round adoption and exactly-once damage after command retry. Existing CAS/lost-response client fixtures now expect 75.7 health after a fresh punch, while the new persisted-old-kit case still expects 83.8. The maximum trusted-family assertion intentionally changes from 55 to 60. Other contact/authority checks remain.

## Local comparison

Run `npm run dev -- --port 4173` and open http://localhost:4173/__combat. Select **Punch**, **Sword**, **Knife family (derived hammer)** or **Hammer**. Set **Target defense → Default armor**, **Balance rules → Reviewed baseline / Candidate**, then **Run contact KO**. It reports damage, cadence, raw DPS, total landed hits and elapsed milliseconds. Candidate results: punch 5 / 2130 ms, sword 3 / 1420 ms, knife 6 / 1780 ms, hammer 2 / 1330 ms. Baseline results: 7 / 3130, 4 / 2040, 7 / 2100 and 3 / 2480 respectively. This button runs the controlled simulation immediately; it is not an animated human playthrough.

For visible attack/health feel, choose **Exact overlap** or a feasible forward target, press **Fire + 20 ms**, then **Advance 80 ms** to inspect windup/contact and wait out cooldown before the next command. Fresh default-armor single-hit health: punch 75.7, sword 62.2, knife 82.0, hammer 46.0. The knife test uses explicitly derived hammer geometry to isolate family cadence; it is not a new authored knife asset. Compare **Target defense** profiles and existing bow/pulse/automatic/flame cases; ranged default damage is unchanged. Check no health decrement during cooldown, protection or duplicate command. Final actual rendered feel and hosted two-account validation remain local-review work.

Reproduce all measurements with `node scripts/measure-combat-balance.mjs`; machine-readable results are in `validation/critical-gameplay/balance-matrix.json`.
