# Brickwild submission review and proposed strategy

Initial review: September 15, 2026. The sections below preserve the earlier research snapshot; current completion status and final text are identified immediately below. Hadrien's original draft remains available in Git history at dd5dab9.

## Final refinement and form preparation

Yerzhan approved the proposed direction, confirmed all three prepared URLs, and authorized filling the form and committing the text locally on main. No push or submission is authorized.

The final field text is in `HACKATHON_SUBMISSION.md`; it supersedes the candidate answers below. Main was refreshed by parallel release work to `55c5b7a` before this editing pass, incorporating the accepted realtime implementation. Earlier notes below about main being `dd5dab9` and the realtime branch awaiting acceptance are historical.

### Decisions from the second editorial pass

- Lead with a concrete rideable-dragon example, then identify the audience and the imagine/build/use/share loop.
- Make OpenAI's causal role explicit: intent becomes geometry and functional metadata; validated data enters game rules and shared state. Explain what disappears when runtime AI is removed without denying saved designs still work.
- Answer originality through specific comparisons to equipment selection and standalone asset-generation workflows. Avoid unsupported market-first claims.
- Make playability useful to a judge: Practice first, then a two-player Arena interaction. Keep current room/round mechanics and omit long shortcut lists.
- Connect craft to readable player feedback and robust implementation. Include realtime authority and recovery now present in main, without unmeasured latency, scale, or perfect-recovery claims.
- Correct pre-event provenance using Yerzhan's direct confirmation, and include the current Vercel/Turso/Render stack and realtime dependencies.

### Draft verification

The title and six answers were filled and read back for exact text equality. Word counts: description 151; OpenAI 157; originality 152; playability 151; craft 152; materials 129. Each fits the 200-word maximum.

Team, members, Track 1, and all three URLs remain as prepared. The representative email was entered and visually verified. Submission confirmation remains unchecked for Yerzhan; Submit was not clicked. The form reports Draft saved. No gameplay or paid generation tests were run during this editorial pass.

Only this review and `HACKATHON_SUBMISSION.md` are included in the authorized local documentation commit. Unrelated working files are preserved.

---

## Recommendation

Stay in **Track 1: AI-Native Game Prototype**. Lead with **“Imagine it. Build it. Play it.”** Explain the distinctive mechanic as **“Your words become equipment you can actually use in a shared game.”**

Our best opportunity is to make one causal chain unmistakable: a player's free-form idea becomes original geometry, becomes usable equipment, and affects play. The memorable extension is another player collecting and using that same creation. A feature inventory cannot communicate this as effectively as a short, visible example.

This is a scoring strategy, not a prediction of placement. We have no evidence about competing entries or judges' unpublished preferences.

## 1. Verified submission requirements

Sources read live:

- [Submission form](https://docs.google.com/forms/d/e/1FAIpQLSdvUFtWLVKJOaZrvBN6gOHadhnzSf3SM9FjuE77QiTwiZL9Tw/viewform)
- [Luma event and rubric](https://luma.com/3kj24doy)
- [Official rules, English](https://docs.google.com/document/d/1JN4b0HdHHRqBjB0nrQ_CEhK4YvBTvtz4lTKjuJF2rC0/edit?tab=t.m4dkx65teor6)
- [Official rules, controlling Japanese version](https://docs.google.com/document/d/1JN4b0HdHHRqBjB0nrQ_CEhK4YvBTvtz4lTKjuJF2rC0/edit?tab=t.4lv83g79d1no)

| Requirement | Submission consequence |
| --- | --- |
| Deadline September 15, 23:59 JST | Finish the reviewed package and leave time for the representative to submit and verify receipt. |
| One submission per team | Yerzhan reviews and submits on behalf of the team; avoid duplicate entries. |
| Required demo video, maximum 1 minute, accessible publicly or by link | Current linked YouTube video loads, is marked Unlisted, and shows 0:50 duration. Full audiovisual effectiveness and signed-out access were not tested in this review. |
| Project description, four rubric answers, materials/licenses: each maximum 200 words | Six separate answers. Target roughly 110–160 words where sufficient; there is no reason to fill every limit. |
| Demo URL optional in form; working demo required by rules | Keep the working URL and verify actual play. Optional URL labeling is not a reason to provide only a concept. |
| Demo link must remain accessible through September 17 | Check provider capacity, access, and AI availability through judging. |
| Repository URL optional | If included, make sure the repository represents the submitted version and judges can access it. |
| Substantially developed September 11 at 20:00 through September 15 at 23:59 JST; disclose incorporated materials | Yerzhan confirmed the idea and game-specific code started during this hackathon. Correct the misleading pre-existing-game wording. |
| Finalists announced September 16; in-person final September 17 | Plan a Tokyo presentation. Rules specify five minutes including up to two minutes of Q&A; prepare a three-minute core demonstration. |
| Same rubric for finalist selection and final presentation | Use the same central claim and proof in both rounds. |
| Tie-break: meaningful OpenAI use, then originality | Prioritize runtime AI's gameplay consequence. |

The event explicitly gives no advantage for using more OpenAI products. Popularity, audience votes, paid accounts, and optional publicity consent do not determine scores. Do not spend scarce preparation time on these as supposed scoring tactics.

The rules mention possible continued development for finalists; this is not blanket permission to replace the submitted build after the deadline. Preserve the submitted version and follow organizer instructions for any finalist improvements.

## 2. What Hadrien already prepared

GitHub `main` was checked live and remains `dd5dab936fcd25d6e6c50cdf79a1cd4985a96a66`, “Add hackathon submission copy,” authored by Hadrien Roy. That draft is present locally.

Whitespace-based word counts of its answers: description 156; OpenAI 160; originality 171; playability 171; craft 162; materials 163. All fit the form limit.

**Keep:** imagination becoming equipment, visible assembly, generated geometry and usable traits, Practice plus multiplayer, shared dropped creations, validation and trusted game rules.

**Improve:** explain the player's experience earlier; reduce lists of keys and backend mechanisms; assign each paragraph one scoring purpose; replace broad quality claims with visible evidence.

| Draft wording / topic | Proposed treatment |
| --- | --- |
| “Pre-existing Brickwild game baseline” | Correct. Yerzhan confirmed a new idea and new repository during the event. An earlier hackathon snapshot is not pre-event code. State the actual timeline and disclose libraries separately. |
| “ChatGPT Sites hosts the complete web experience” | The form points to Vercel. Describe the submitted host accurately; mention Sites only as part of the development workflow if useful and accurate. |
| “balanced combat traits” | Use “bounded abilities” or “trusted combat rules.” Competitive balance needs playtest evidence. |
| “rejects malformed or unsafe output” | Use “rejects invalid blueprints and constrains geometry and abilities.” Schema validation does not establish comprehensive content moderation. |
| “without templates” | Use “generated geometry within supported movement and weapon families.” Original geometry and predefined game rules coexist. |
| “complete playable game” | Prefer “playable prototype.” Demonstrate its actual loop and scope. |
| Exact model and 20–64 parts | Source supports GPT-5.4 as a configurable fallback and 20–64 in compact mode. Deployment notes record a successful GPT-5.4 generation. Confirm selected release configuration before claiming universal bounds. |
| Recorded transcription | Source supports `gpt-4o-mini-transcribe`; deployment notes do not establish final successful hosted transcription. Keep typed input reliable and distinguish browser-native speech from OpenAI transcription. |
| Room codes, creator start, three rounds, five-step tour | Current source supports these. README contradicts them in places and is not a reliable replacement source. Keep only details checked on the submission build. |
| CAS, monotonic commands, event cursors | Retain technical detail for Q&A/evidence. In form copy emphasize consistent shared state, bounded abilities, and recoverable errors. |

## 3. Scoring strategy and different perspectives

| Criterion | Judge needs to understand | Strongest evidence | Weak framing to avoid |
| --- | --- | --- | --- |
| OpenAI, 30% | Runtime AI changes what the player can create and use | Exact prompt → assembled object → requested movement/ability | A list of products used during development |
| Originality, 25% | Appearance, function, and social use are connected | An unusual functional toy; another player uses the same creation | Unsupported “first ever,” “anything,” or “unlimited” claims |
| Playability, 25% | A judge can experience a satisfying loop now | Clear entry, fresh creation, control, visible outcome, retry/rebuild | A list of features without proof they work together |
| Craft, 20% | Creative output survives contact with a real game | Coherent brick style, readable assembly, consistent controls, constrained rules | Backend terminology without player benefit |

**Player perspective:** “Can I make something funny, recognize it, and immediately discover what it does?” Start with delight and agency.

**Game designer perspective:** “Does the generated object change decisions?” Show a different traversal or attack capability and its constraints. Claim tactical counter-building only if a real interaction demonstrates it; do not invent rock-paper-scissors mechanics.

**AI engineer perspective:** “Is the model selecting an asset or generating one?” Explain geometry/joints/seats/emitters as validated data. The engine interprets supported traits; it does not execute model-written code. Saved creations can still be reused without another call, but removing runtime AI removes open-ended creation of new equipment during play.

**Producer perspective:** “Can someone else run this prototype and get the promise?” Access, a clear solo route, stable links, and a repeatable demo matter more than adding one more system tonight.

**Longer-term product perspective:** A creation can become an object another person uses. This is a credible social direction. Marketplaces, creator economies, education outcomes, retention, and production-scale capacity remain future hypotheses, not submission achievements.

## 4. Proposed form copy for discussion

These are candidate answers, not final approved text. They deliberately avoid exact latency, model configuration, transcription success, and networking-version claims that need final deployment reconciliation. Choose demonstrated examples before finalizing. Each answer is below 200 words.

### Project title

**Brickwild — Imagine it. Build it. Play it.**

Use Brickwild consistently in the form and presentation; Wildbrick Island can remain the repository/hosting name.

### Project description

Brickwild is a browser-based 3D toy-brick game where your words become equipment you can actually use. Describe a rideable dragon or a car with a mounted weapon, watch it assemble, then explore and play with what you imagined.

Built for players who enjoy creative sandboxes and playful competition, Brickwild combines a solo Practice island with multiplayer Arena matches. Players generate vehicles, creatures, weapons, shields, and decorative objects, save their designs, and rebuild them. Dropped creations can become another player's equipment.

OpenAI generates each creation's geometry and functional traits during play. The game validates that blueprint and translates supported traits into constrained movement and combat rules. A flying creation changes how you traverse the island; a weapon changes how you engage other players.

The core loop is imagine, build, use, and share: a player's idea becomes a physical part of the game.

### Meaningful use of OpenAI tools

OpenAI powers Brickwild's central gameplay mechanic: creating new equipment from a player's description during play. The Responses API with Structured Outputs generates a blueprint containing geometry, colors, joints, and the positions needed to hold, ride, or fire from a creation.

This output affects both appearance and function. A rideable flying creature needs a recognizable body, a seat, and flight behavior; a handheld weapon needs a grip and an appropriate supported attack. Our engine validates the blueprint, renders it as toy bricks, and applies trusted movement and combat rules. Model-generated code is never executed.

The result enters the playable world, where it can be used, saved, rebuilt, and shared. Removing runtime AI would remove the ability to invent new equipment through language while playing. Existing saved designs would still work, but the defining creative loop would be lost.

### Originality

Brickwild connects three things in one interaction: what a player imagines, what an object looks like, and what it does in a shared game.

A description creates original brick geometry within a common gameplay vocabulary. A creature can become a mount, an unusual vehicle can fly, and a generated weapon can be held and used. Players watch the parts assemble and then discover the result through movement and play.

The social extension is especially important: a creation can leave its maker's hands and become another player's equipment. An idea becomes a shared object with consequences beyond its original prompt.

Our distinctive combination is runtime creation, physical use, coherent toy-brick presentation, and multiplayer interaction. The creative space is open-ended in appearance, while supported movement and weapon families keep the game understandable and its abilities bounded.

### Playability / Utility

Brickwild offers a playable browser prototype with a solo Practice island and multiplayer Arena matches. Practice lets a judge explore movement, create equipment, and try driving, flying, targets, and destructible props. Arena adds shared play, room joining, combat, scores, and respawning.

The essential experience is straightforward: describe a creation, watch it assemble, equip it, and use its supported abilities. Typed input provides a dependable route alongside speech. Saved designs can be rebuilt without another generation request, making it easy to return to a favorite creation.

Onboarding, visible controls, cancellation, and recovery feedback help players understand what is happening. Generated equipment follows consistent controls and trusted game rules, so unusual shapes remain usable within the same world.

For evaluation, we recommend starting in Practice to experience creation, then joining an Arena with a second player to see the shared interaction.

### Execution and craft

Brickwild turns structured AI output into a coherent playable object. Generated parts use a consistent toy-brick style, assemble visibly, and attach to the player through authored grips or seats. Movement, attacks, impacts, and sound help communicate what the creation is doing.

The implementation separates creative generation from trusted game logic. Blueprints are independently validated, credentials stay server-side, and supported abilities remain constrained by game rules. Cancellation, request limits, and stale-response protection handle the practical failure cases of runtime generation.

Multiplayer uses server-authoritative state for movement, damage, and scores. The repository includes regression checks for generation, controls, combat, camera behavior, room lifecycle, and voice paths.

Our focus is the whole interaction: a readable request state, a recognizable assembled creation, consistent controls, and feedback when players use it.

### Materials, licenses, and build-period disclosure

The Brickwild idea and game-specific code were created during this hackathon, starting from a new repository, as confirmed by our team representative. Earlier Brickwild snapshots belong to the same build period, not a pre-existing game. Original procedural geometry and synthesized game audio were developed for the project.

Incorporated libraries and tools include Three.js, Vite, esbuild, jsdom, Drizzle Kit, and @libsql/client (MIT); Drizzle ORM and @vercel/functions (Apache-2.0); and Barlow Condensed and DM Sans fonts (SIL Open Font License 1.1). Archived Rapier source is retained under Apache-2.0 and is not used at runtime.

OpenAI APIs and ChatGPT Sites were used under applicable service terms. The submitted Vercel build uses Vercel and Turso under their service terms. No external dataset is used.

**Before finalizing this answer:** retain dated initial Sites records if available; the GitHub import date alone is not complete creation-history evidence. If the submitted build includes the realtime branch, also disclose ioredis and ws (MIT) and the actual Redis service. Confirm any additional music/artwork used in the video separately. Do not submit this editorial note.

## 5. Demo strategy

The existing [video](https://www.youtube.com/watch?v=ij-7oTUSIPc) is 50 seconds and marked Unlisted. This review checked its page, duration, and opening frame only, not its complete sound or gameplay sequence. No new upload is needed solely for duration compliance.

Evaluate that video against these proof moments before deciding to recut:

1. **The impossible toy:** show an exact, memorable prompt, the resulting original object, and its requested function. Choose a result already demonstrated well. A flying teapot is a proposed example, not a verified output.
2. **The handoff:** one player drops the creation and another picks it up and uses it. Include only if reliably available in the selected build.
3. **The gameplay consequence:** traversal, a clear hit, a visible score/health change, or another immediately readable outcome.

Suggested 55–58-second structure if a revision is warranted:

| Time | What to show |
| --- | --- |
| 0–4 s | Strongest actual gameplay moment and one-line premise |
| 4–13 s | Readable prompt, generation state, and assembly; label any cut or speed-up through waiting |
| 13–27 s | Ride, fly, drive, or attack using that exact result |
| 27–40 s | Second-player interaction or handoff with a visible outcome |
| 40–51 s | Brief explanation: OpenAI blueprint → validation → playable object; use simple captions |
| 51–58 s | Name, team, working URL, closing promise |

Do not imply instant generation by showing only the 1.2-second assembly animation. Do not present a saved rebuild as a new inference. Preserve the honest distinction between edited footage and continuous live play.

For the final presentation, use a three-minute core: 20 seconds premise, 70 seconds creation and functional play, 40 seconds multiplayer consequence, 30 seconds architecture and limits, 20 seconds conclusion. Prepare up to two minutes of Q&A. Prefer one rehearsed live generation and a clearly identified recording as backup; reliable live behavior matters more than novelty in the stage prompt.

## 6. Priority plan before submission

### First: reconcile evidence and wording

- Correct the pre-existing-game disclosure using Yerzhan's confirmation.
- Select the exact submission deployment and source revision. Main remains Hadrien's draft commit, while hosting and realtime work live on other branches. A repository URL alone currently does not identify the deployed code.
- Use current source and actual submitted behavior when README and draft conflict.
- Remove Sites-as-current-host language for a Vercel submission.
- Complete the deployment-specific dependency/service list. Package metadata checked locally confirms @vercel/functions is Apache-2.0; @libsql/client, ioredis, and ws are MIT.

### Second: verify the judging experience

- Open the final demo and video as a judge without owner privileges. Verify the video is accessible by link and remains at most one minute.
- At desktop 1440×900, verify the advertised entry → creation → use loop and one two-player interaction. This review has not run gameplay acceptance or paid generation.
- Check whether the linked production build or a preview is the intended entry. Realtime progress records a passed earlier preview gate, followed by a Redis provider cutover still needing refreshed acceptance. Do not claim that earlier gate proves the final provider/deployment is ready.
- Check access and service capacity through September 17. Preserve the stable build; avoid an unreviewed last-minute networking change solely to improve the submission story.

### Third: finalize the six answers

- Give each answer its own job: description = experience; OpenAI = causal mechanism; originality = distinctive combination; playability = judge path; craft = implementation quality; disclosure = provenance and licenses.
- Replace proposed examples with what the video and demo actually show.
- Keep terms consistent: Brickwild, Practice, Arena, generated blueprint, supported ability.
- Count words after final edits. Remove all editorial notes and unsupported claims.
- Have Yerzhan review the final text and perform the submission. Confirm receipt afterward and retain the exact submitted text, links, and source revision.

Suggested internal target: finish review by 23:15 JST and leave a submission buffer before 23:59. This is a suggested working deadline, not a change to the official deadline or a scheduled task.

## 7. Next brainstorming decisions

1. Which real creation is most recognizable, surprising, and reliable enough to be our lead example?
2. Does the current 50-second video visibly connect a prompt to a usable result and a multiplayer consequence?
3. Is the primary emotional promise playful invention, tactical invention, or social sharing? Recommendation: playful invention first, social sharing as the memorable second beat.

No need to add a new feature before answering these. The next iteration should sharpen the existing evidence into a memorable submission.
