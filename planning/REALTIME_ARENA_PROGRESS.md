# Realtime Arena progress

Objective: replace request-driven Arena polling with a fixed-clock authoritative room while preserving the Vercel/Turso/AI stack and the accepted art/gameplay changes.

## Current decision

- Base remains the refreshed `origin/deployment/vercel` hosting line. The approved Mountain palette, lightweight sky, and Island gate commits are integrated without changing their `public/main.js` sky values or `public/rules.js` gate layout.
- Vercel is the candidate host. Current Vercel WebSocket Functions pin a connection to one Function instance, but later connections can land elsewhere and every connection ends at the Function maximum duration. A process-local map is therefore only a cache of rooms currently owned by that instance.
- The candidate uses Redis Streams for cross-instance input/output relay, an 8-second compare-and-expire Redis owner lease, and the existing 12-second Turso owner epoch as the durable fencing check. Only the fenced owner runs a room at 20 Hz. Turso is checkpointed every two seconds, not on frames or inputs.
- `api/arena-realtime.js` is the Vercel upgrade endpoint. `realtime/redis-bridge.js` elects and fences the single owner, relays sockets across Function instances, bounds streams/backpressure, and forces a full client reconnect when ownership changes. The existing standalone/local service remains the no-Redis development path. The unapproved Render Blueprint was removed.
- `REALTIME_ARENA_NAMESPACE` scopes every owner, input, and output key. Preview uses its own namespace so a shared provider can never route candidate traffic through production room keys.
- Relay envelopes carry bounded unique IDs. The owner discards a repeated Redis append before it can replay authentication, requests, or input; ordered gameplay sequence IDs remain an independent deduplication layer.
- A Vercel owner proactively checkpoints and releases both fenced leases after 240 seconds, leaving a 60-second margin before the platform's 300-second Function ceiling; it also releases when its last local WebSocket invocation ends. A resumed Redis reader verifies its lease synchronously before consuming queued packets, so an expired Function cannot authenticate peers onto a frozen owner. The next live relay can claim the room, and bounded retries carry admission/control envelopes across the brief handoff without creating duplicate actions.
- Transport remains pinned per room as `http-v1` or `realtime-v1`. Rollback is `ENABLE_REALTIME_ARENA=false` for newly created rooms; a live room never runs both authorities.

## Implemented

- Fixed 20 Hz server simulation and timestamped, sequenced snapshots independent of HTTP polling.
- Ordered input acknowledgements, local prediction/reconciliation, reconnect backoff/full resync, 75 ms render jitter window, 100 ms maximum extrapolation, bounded correction, and discontinuity resets.
- Signed admission from the trusted Vercel guest boundary, origin checks, packet/rate/queue/backpressure bounds, heartbeat, room expiry, fenced checkpoints, and crash recovery from the last checkpoint.
- Realtime resume leases are refreshed to the same bounded 15-minute recovery horizon as stale rooms, so a five-minute Function lifecycle plus reconnect backoff cannot silently turn a returning player into a new mid-match seat.
- Ownership recovery clears held input and velocity, then refreshes checkpointed players' presence timestamps so normal stale-player cleanup cannot delete valid seats during the bounded handoff grace.
- Successful authentication and join now cancel their admission timers; the desktop check caught and fixed the prior five-second disconnect.
- Between-round Ready is authoritative, round-scoped, and idempotent. The 15-second automatic timer remains. When at least two eligible connected players are ready, the remaining wait becomes at most three seconds and is never lengthened. Eligibility has a five-second disconnect grace; a stale or lone seat cannot trigger an immediate round. Readiness resets on the next round. Match-complete behavior is unchanged: everyone exits before a fresh host lobby is created.

## Focused evidence

- Build and round/UI checks pass, including Ready reset, stale request rejection, disconnect grace, completed-match behavior, and preserved automatic timeout.
- Local realtime smoke passes two-player movement, stop/reversal, moving-and-firing, Ready, reconnect/full sync, cleanup, and four-client fanout. The post-fix loopback sample stayed within 35–51 ms between snapshots and at most 26 ms snapshot age; this is local evidence only.
- A two-bridge Redis fixture passes cross-instance join/fanout, duplicate-envelope rejection, and verifies exactly one elected room owner. This fixture is local evidence only.
- `npm run check:hosted-realtime` is the bounded preview-only release gate. It uses two real guest identities, rejects the production URL, exercises movement/stop/reversal/fire/reconnect/Ready/leave, records snapshot cadence and age, and stays connected beyond 300 seconds to require real Function/connection rollover.
- Preview provisioning is complete: Upstash resource `wildbrick-realtime-preview` and Turso database `brickwild-rt-preview` are connected only to Preview. All four additive migrations applied and reran idempotently. The branch-only namespace, mode, ticket/session secrets, and `ENABLE_REALTIME_ARENA=true` are configured without changing production.
- A hosted one-minute diagnostic lifecycle reproduced a duplicate Redis append during Function rollover. Bounded envelope deduplication fixed it; both hosted clients then reconnected and received full authoritative resynchronization after the forced one-minute cutoff.
- The final hosted gate passed on the exact `891574f` preview: two guest identities, movement, stop, reversal plus fire, manual reconnect, proactive owner rotation and full resync, Ready, and cleanup. Initial snapshot intervals were 32-121 ms and final snapshot ages were 21 ms and 122 ms. Timestamp age is not physical RTT.

## Remaining review and release steps

1. Run the two-person desktop review below on the tested preview. Only after review should the production flag be considered. No production merge or deployment is part of this branch.

Local review: run `npm run dev:realtime`, open `http://127.0.0.1:4173/` in two separate desktop browser profiles at 1440x900, create/share one room, start as creator, then test continuous movement, stop/reversal, moving while firing, one disconnect/reconnect, and both Ready buttons between rounds. A four-profile join/fanout glance is optional. Practice is not required.

Known limit: this reduces transport/scheduling staleness but cannot remove physical RTT. The 75 ms render delay trades a small amount of immediacy for steadier remote motion; extrapolation is capped at 100 ms. Vercel Function expiry and owner failover cause a reconnect and recovery from the last bounded checkpoint rather than seamless zero-loss continuity.
