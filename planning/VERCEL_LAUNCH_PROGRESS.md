# Vercel launch progress

## Objective and authorization

Deploy the full game from latest main to the user's existing Vercel project for an independent performance comparison. Deployment is authorized. Preserve Sites and its data, the performance branch, and parallel map work. Desktop acceptance only at 1440×900. Do not substitute a static-only release or Sites backend proxy for a complete Vercel migration.

## Verified source and access

- Latest fetched main: dd5dab936fcd25d6e6c50cdf79a1cd4985a96a66. No deployment changes made yet.
- Vercel connector resolves team ai-preneurs-hackathon-projects, ID team_mAsr3DVHbKyjdmaRA7cyQAwb, Hobby plan.
- Project lookup wildbrick-island returns404 with slug and team ID; team project listing is empty. This establishes connector visibility failure, not that the user's project does not exist.
- Requested project URL opens Vercel login in Chrome. User asked to sign into the owning account. No credentials requested in chat.

## Portability requirements found in source

- Frontend is static browser JavaScript/Three.js; existing build packages a Worker for Sites rather than a Vercel API.
- worker/arena-api.js trusts Sites-injected oai-authenticated-user-id. Vercel adapter must supply identity only after genuine server-side authentication; never trust a browser-supplied copy of that header.
- Arena uses env.DB.prepare/bind/first/run, SQLite tables and atomic room revision checks. Need durable shared storage with equivalent concurrency semantics; process memory or ephemeral filesystem is not a multiplayer database.
- AI generation and recorded transcription need server-side OpenAI configuration and database-backed admission control. Do not silently expose paid routes without identity/rate safeguards. Secrets must remain server-side, not printed or committed.
- Existing Sites cookies/account data cannot be assumed portable to another domain. Inspect available auth and storage in the Vercel project before choosing adapters; preserve Sites data and state separately.

## Next steps after project access

1. Inspect linked Git source, existing deployment/build settings, storage integrations, function region and environment variable names (not secret values).
2. Create an isolated implementation branch/worktree from latest verified main. Keep gameplay unchanged. Choose minimal compatible runtime/auth/storage adapters using existing provisioned services where possible; disclose any required new paid resource before provisioning.
3. Implement and test API adaptation, auth spoof rejection, two-client room consistency/retries/cleanup, generation/transcription availability and static serving. Preserve original Worker compatibility where feasible.
4. Commit authored code; deploy the adapted latest-main candidate to the exact verified project. Record that it is main plus portability changes, not byte-identical main.
5. Verify live assets, identity, real two-client Arena and server logs at desktop1440×900. Verify feature readiness independently of paid content generation; obtain specific paid-test budget if needed.
6. Report exact source, URL, remaining limitations and measured request latency. Hosting improvement is a hypothesis until comparable measurements exist.

## References checked

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/storage

No guarantee of faster gameplay. The frontend alone would not replace the source of multiplayer backend delay.

## Implementation checkpoint

- Isolated deployment/vercel at /private/tmp/wildbrick-vercel, based on dd5dab9. Existing performance checkout preserved.
- Verified existing frontend production deployment, but /api/arena/sync returned404.
- User accepted Turso terms. Created Starter free database wildbrick-arena in Tokyo and connected production only. Sites data untouched.
- Added Vercel API adapter, signed guest identity (not ChatGPT login), same-origin guards and explicit paid-feature gates. Existing worker gameplay unchanged.
- Added injected libSQL/D1 adapter preserving SQL CAS and RETURNING semantics. Atomicity/session tests and handler trust tests pass.
- Production build initializes the new database using existing ordered migrations and a transactional migration ledger. This creates schema; never drops/resets data.
- SESSION_SECRET set as production sensitive variable. Database credentials remain within Vercel. An attempt to pull all production secrets was denied by approval review; no bulk production env download occurred.
- Existing main check-round-refinements expects keyboard hints without X, while current UI includes X. Do not weaken that assertion as part of this hosting change.
- AI generation and recorded transcription intentionally fail closed until explicit public-use flags and server API configuration are supplied. Native voice and saved client creations remain available. This is not yet full paid-feature acceptance.

## Live verification

- Production backend deployment succeeded; nested API routing corrected in434f367 after the first live404.
- Public unauthenticated two-guest create/join/start and five paired syncs passed against actual Vercel/Turso. Both players left through the API. Observed ten sync durations:158,199,220,139,117,553,182,218,178,225ms. This short smoke is not a controlled Sites comparison or a stability benchmark.
- Desktop Chrome1440×900 created/started Arena and rendered the full map. Guest-access lobby copy replaces Sites invitation text only in the Vercel output.
-29/30 original check commands pass; one main keyboard-hint test misses X. New database/handler checks pass. Existing gameplay source is untouched.
- AI generation and recorded transcription are not complete: require owner's server-side API key and explicit public paid-feature configuration. Never claim the entire feature set enabled.
- Deployment uses latest verified main dd5dab9 plus deployment-branch adapters, not the experimental performance branch. No GitHub main push.

## Gateway activation follow-up — 2026-09-15

- Refreshed origin/main; still dd5dab9. Production AI_GATEWAY_API_KEY exists (names-only check). Never downloaded or printed the secret. Older OPENAI_API_KEY remains unchanged.
- Implementing a Vercel-only Gateway provider adapter with no fallback after Gateway errors; preserve Sites and gameplay source. Existing durable admission limits remain applicable.
- Increased function maximum to120s to accommodate the existing85s generation deadline and cleanup; this is within the documented Fluid Hobby maximum.
- Automatic approval review rejected setting ENABLE_PUBLIC_GENERATION=true due to public paid-use exposure. No flag changed. Finish code/local validation/deployment with gates closed, then request the explicit public billing approval. Do not claim live AI acceptance or incur paid calls before that step.

- Added Node disconnect propagation so canceled uploads/responses abort the shared worker request. Actual loopback HTTP cancellation, binary transport, nested routing and listener cleanup pass.
- Gateway mock acceptance: six groups pass, including actual worker schema/reasoning validation, key precedence, sanitized errors, no retries, WebM/MP4 translation and SQLite duplicate admission.
- All new Vercel checks pass. Shared suite33/34 passes; unchanged main test check-round-refinements still omits X from expected help hints. Sites build plus both package checks pass (66 assets, three migrations).
- Paid gates remain disabled; no billable provider requests made. Prepared launch requires approval of public paid AI use, then bounded live generation/transcription acceptance.
