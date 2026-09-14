# Brickwild / Wildbrick Island — Hackathon Submission

## Project description

Brickwild is a browser-based 3D toy-brick adventure where imagination becomes playable equipment. A player speaks or types an idea—such as “a dragon I can ride and fly with fire breath”—and OpenAI designs an original brick model with geometry, colors, moving parts, a seat or grip, movement behavior, and balanced combat traits. The creation visibly assembles in the world, can be driven, flown, carried, used in combat, saved, rebuilt, dropped, and picked up by another player.

Practice mode offers a relaxed island with driving, flying, targeting, and smashing challenges. Arena mode lets players create or join a coded room, gather before the creator starts the match, and compete across three rounds with authoritative scoring, health supplies, creation damage, respawning, and final results. A five-step Quick Tour, keyboard Help, speech fallback, snapshots, and consistent controls make the experience approachable. Brickwild turns generative AI output into a shared game mechanic rather than a detached chat response or decorative asset.

## Meaningful use of OpenAI tools — 30%

OpenAI is the core creation system. The Responses API uses GPT-5.4 with strict Structured Outputs to convert each free-form idea into a validated blueprint containing 20–64 original 3D parts, palette colors, animation joints, movement type, seat or grip position, projectile emitter, armor, mass, and a supported weapon class. The model generates new geometry; it does not choose from an asset catalog.

That structured result immediately changes gameplay. A generated object can become a flying or driving mount, walking creature, handheld weapon, shield, or static creation. Its semantic traits map to trusted, balanced rules for speed, health, damage, range, and cooldowns. Server validation rejects malformed or unsafe output, and model-generated code is never executed.

OpenAI audio transcription provides a recorded-speech fallback through `gpt-4o-mini-transcribe`, while native browser speech and typed input share the same creation path. ChatGPT Sites hosts the complete web experience and its server-side APIs, secrets, database binding, and production deployment. Without OpenAI, the defining speak-or-type-to-build loop would not exist.

## Originality — 25%

Brickwild makes generative AI part of the rules of a multiplayer game. Players do not merely request an image or receive prose: they describe an object, watch individual bricks assemble, then physically use the result. The same prompt controls appearance and function. “A red car I can drive with machine guns” produces a mount with wheels, a seat, a recognizable silhouette, and an attack; “a castle” may remain useful scenery with no forced ability.

The system supports unexpected combinations without templates: flying teapots, armed vehicles, rideable creatures, shields, bows, hammers, and decorative builds all share one bounded blueprint language. Creations persist locally, can be rebuilt with number keys, and become social objects in Arena: replacing or dropping one leaves it in the world for another player to collect.

This creates a playful cycle of imagining, building, testing, sharing, and counter-building. Practice challenges reward different generated capabilities, while Arena turns each player’s prompt choices into tactical trade-offs. The toy-brick visual language makes highly varied AI output feel coherent within one original world.

## Playability / Utility — 25%

The project is a complete playable game with two clear paths. Practice teaches movement and creation while offering four goals: drive through gates, hit targets, smash crates, and fly through rings. Arena uses room codes, a joined-player lobby, creator-controlled start, three timed rounds, round totals, a final scoreboard, health and support pickups, creation health, item drops, knockouts, and automatic respawning.

Every generated creation fits a consistent control model. Players move with WASD, build by speech or text, use equipped abilities with the right arrow, drop or pick up with Enter, and select their five newest creations with C and 1–5. Help, Quick Tour, pause, camera controls, visible keycaps, cancelable AI requests, and a clean typing fallback reduce friction. A snapshot shortcut captures the island view for sharing.

Gameplay remains understandable when AI output has no special use: decorative and static objects are valid outcomes, while prompts that specify “drive,” “fly,” “ride,” or a weapon produce functional equipment. Trusted server rules keep generated powers bounded so creativity does not bypass game balance.

## Execution and craft — 20%

Brickwild combines a polished 3D interface with a defensive multiplayer and generation architecture. The frontend uses procedural toy-brick meshes, animated assembly, camera obstruction handling, weapon poses, visual hit feedback, synthesized sound, responsive HUD states, and a consistent design system across Practice and Arena. The onboarding flow teaches both controls and effective prompt language.

AI output is constrained by a strict JSON schema and then independently validated for structure, coordinates, palette and joint indices, geometry bounds, seats, emitters, movement, and combat traits. Server-side secrets never enter browser code. Generation has identity-aware cancellation, concurrency and rate limits, timeouts, and stale-response protection.

Arena state is authoritative on the server. Session-bound identity, monotonic commands, acknowledged movement frames, event cursors, bounded projectiles, collision checks, and database compare-and-swap retries protect movement, damage, scores, and room lifecycle. The repository includes focused regression suites for creation rendering, controls, camera behavior, combat, hit registration, maps, rounds, room joining, voice paths, resource limits, and desktop UI behavior, plus a reproducible production build.

## Pre-existing code, open-source components, datasets, and third-party tools

- **Pre-existing Brickwild game baseline:** Team-authored 3D toy-brick world, procedural geometry, synthesized audio, and initial gameplay code were extended for this submission. Team-owned; no third-party license applies.
- **Three.js 0.180.0:** Vendored 3D rendering library. MIT License; notice included in `public/vendor/THREE-LICENSE.txt`.
- **Vite 8.0.13, esbuild 0.28.2, jsdom 30.0.1, and Drizzle Kit 0.31.10:** Development, build, and test tooling. MIT License.
- **Drizzle ORM 0.45.2:** Database tooling. Apache License 2.0.
- **Barlow Condensed and DM Sans:** Bundled fonts. SIL Open Font License 1.1.
- **Rapier:** Historical archived physics source retained for recovery but not used at runtime. Apache License 2.0; notice included in `public/vendor/RAPIER-LICENSE.txt`.
- **OpenAI GPT-5.4 Responses API, `gpt-4o-mini-transcribe`, and ChatGPT Sites:** AI generation, transcription, hosting, server runtime, and database services; used under applicable OpenAI service terms.
- **Browser WebGL, Web Audio, MediaRecorder, and Web Speech APIs:** Browser platform capabilities; no bundled third-party dataset.

No external datasets or asset packs are used. Island meshes, tutorial renders, interface artwork, and sounds are produced within the project.
