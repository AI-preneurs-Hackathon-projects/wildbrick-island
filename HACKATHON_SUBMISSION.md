# Brickwild — Hackathon submission text

Prepared for Yerzhan’s manual review and submission. Form remains unsubmitted.

## Entry details

- Team: AI'preneurs
- Members: Yerzhan Karatayev; Hadrien Roy
- Track: Track 1: AI-Native Game Prototype
- Working demo: https://wildbrick-island.vercel.app/
- Repository: https://github.com/AI-preneurs-Hackathon-projects/wildbrick-island
- Demo video: https://youtu.be/ij-7oTUSIPc
- Submission confirmation: left unchecked for the representative’s review.

## Project title

Brickwild — Imagine it. Build it. Play it.

## Project description

Brickwild is a browser-based 3D toy-brick game where your words become equipment you can actually use. Describe a dragon you can ride and fly, watch it assemble, then climb aboard and explore the island.

Built for players who enjoy creative sandboxes and playful competition, Brickwild combines a solo Practice island with multiplayer Arena matches. Players imagine vehicles, creatures, weapons, shields, and scenery. OpenAI generates their geometry and functional traits during play; the game turns validated blueprints into usable objects governed by consistent movement and combat rules.

Creations can be saved, rebuilt, dropped, and picked up by another player. Your invention can change how you cross the island, approach a fight, or equip someone else.

Practice provides space to experiment with driving, flying, targets, and destructible props. Arena gives those creations shared stakes through rounds, combat, and scores. The central loop is imagine, build, use, and share: creativity becomes part of playing.

## Meaningful use of OpenAI tools — 30%

OpenAI powers the defining action in Brickwild: inventing new playable equipment through language during a game. We use the Responses API with strict Structured Outputs to generate original brick geometry, colors, animation joints, grips, seats, projectile emitters, and supported gameplay traits.

A request for a rideable flying creature must become both a recognizable model and a functional mount. The generated blueprint connects the player's intent to its appearance and use. Our engine independently validates that data and applies trusted movement and combat rules, keeping abilities bounded. Model-generated code is never executed.

The creation then enters the shared world, where players can use it, save it, rebuild it, or let someone else pick it up. OpenAI therefore affects the player's available actions and the objects other players encounter.

Removing runtime AI would remove the ability to invent new equipment through free-form descriptions while playing. Saved designs could still be reused, but the game's defining creative loop would disappear.

## Originality — 25%

Brickwild makes invention a playable action. A single description shapes what an object looks like, how it moves, and how a player can use it. Players watch individual bricks assemble, then test their idea through exploration or combat.

The distinctive combination is free-form generated geometry, supported gameplay abilities, and social reuse. Compared with selecting a finished item from an equipment catalog, players author the object they want to bring into the world. Compared with a standalone asset-generation workflow, the result is immediately connected to controls, movement, and other players.

A creation can also leave its maker's hands: drop it, and another player can pick it up and use it. This gives an individual prompt a shared consequence.

The common toy-brick style makes varied inventions visually coherent, while supported movement and weapon families keep them understandable. Brickwild brings the pleasure of inventing a toy into a multiplayer game where that toy actually works.

## Playability / Utility — 25%

Brickwild is playable in a desktop browser, with a solo Practice island and multiplayer Arena rooms. Practice lets players learn movement and creation while driving through gates, flying through rings, hitting targets, and smashing crates. Arena adds room codes, a creator-started match, three rounds, health, scores, and respawning.

The main loop is complete: enter an idea, watch the creation assemble, use its supported abilities, and save or share the result. Typed input is available alongside speech. Saved designs can be rebuilt without another generation request, so players can return to a favorite creation.

A short tour, visible controls, help, cancelable requests, and recovery feedback support first-time play. Generated equipment uses a consistent control model, with game rules constraining movement and combat.

For a quick evaluation, start in Practice and create something rideable. Then join an Arena with a second player to experience combat and the ability to drop and exchange creations.

## Execution and craft — 20%

Brickwild connects AI generation, procedural 3D rendering, and authoritative multiplayer in one playable prototype. The visual design gives varied creations a consistent toy-brick identity. Animated assembly, equipment poses, impact feedback, and synthesized sound make their arrival and use readable.

Blueprints undergo independent validation of geometry, references, grips, seats, and gameplay traits. Credentials remain server-side. Request limits, cancellation, timeouts, and stale-response protection address the practical failure cases of runtime generation.

Arena runs an authoritative server simulation with realtime snapshots, input acknowledgements, and reconnect recovery. Movement, damage, and scores follow trusted rules. Durable checkpoints support room recovery, while generated abilities remain within supported bounds.

The repository includes regression checks for creation, controls, camera behavior, combat, room lifecycle, voice paths, and networking, alongside reproducible builds.

The craft is in the complete interaction: an idea becomes a recognizable object, attaches correctly to its player, responds to familiar controls, and produces visible consequences in a shared world.

## Pre-existing code, open-source components, datasets, and third-party tools

Brickwild began as a new idea and repository during the official hackathon build period. The game-specific code, procedural world geometry, and synthesized game audio were created during the event. No pre-event Brickwild game baseline or external dataset was incorporated.

Libraries and tools: Three.js, Vite, esbuild, jsdom, Drizzle Kit, @libsql/client, ioredis, and ws (MIT); Drizzle ORM and @vercel/functions (Apache-2.0); Barlow Condensed and DM Sans fonts (SIL Open Font License 1.1). Historical Rapier source is archived under Apache-2.0 and is not used at runtime. Bundled library and font notices are retained in the repository.

AI and development services include OpenAI Responses API, OpenAI audio transcription, Codex, ChatGPT, and ChatGPT Sites, under applicable service terms. The submitted hosting stack uses Vercel, Vercel AI Gateway, Turso, and Render-hosted Redis under applicable service terms.
