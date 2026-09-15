# Realtime Arena progress

Objective: replace request-driven Arena polling with a fixed-clock authoritative room while preserving the Vercel/Turso/AI stack and the accepted art/gameplay changes.

## Current decision

- Base remains the refreshed `origin/deployment/vercel` hosting line. The approved Mountain palette, lightweight sky, and Island gate commits are integrated without changing their `public/main.js` sky values or `public/rules.js` gate layout.
- Vercel is the candidate host. Current Vercel WebSocket Functions pin a connection to one Function instance, but later connections can land elsewhere and every connection ends at the Function maximum duration. A process-local map is therefore only a cache of rooms currently owned by that instance.
- The candidate uses Redis Streams for cross-instance input/output relay, an 8-second compare-and-expire Redis owner lease, and the existing 12-second Turso owner epoch as the durable fencing check. Only the fenced owner runs a room at 20 Hz. Turso is checkpointed every two seconds, not on frames or inputs.
- `api/arena-realtime.js` is the Vercel upgrade endpoint. `realtime/redis-bridge.js` elects and fences the single owner, relays sockets across Function instances, bounds streams/backpressure, and forces a full client reconnect when ownership changes. The existing standalone/local service remains the no-Redis development path. The unapproved Render Blueprint was removed.
- Transport remains pinned per room as `http-v1` or `realtime-v1`. Rollback is `ENABLE_REALTIME_ARENA=false` for newly created rooms; a live room never runs both authorities.

## Implemented

- Fixed 20 Hz server simulation and timestamped, sequenced snapshots independent of HTTP polling.
- Ordered input acknowledgements, local prediction/reconciliation, reconnect backoff/full resync, 75 ms render jitter window, 100 ms maximum extrapolation, bounded correction, and discontinuity resets.
- Signed admission from the trusted Vercel guest boundary, origin checks, packet/rate/queue/backpressure bounds, heartbeat, room expiry, fenced checkpoints, and crash recovery from the last checkpoint.
- Successful authentication and join now cancel their admission timers; the desktop check caught and fixed the prior five-second disconnect.
- Between-round Ready is authoritative, round-scoped, and idempotent. The 15-second automatic timer remains. When at least two eligible connected players are ready, the remaining wait becomes at most three seconds and is never lengthened. Eligibility has a five-second disconnect grace; a stale or lone seat cannot trigger an immediate round. Readiness resets on the next round. Match-complete behavior is unchanged: everyone exits before a fresh host lobby is created.

## Focused evidence

- Build and round/UI checks pass, including Ready reset, stale request rejection, disconnect grace, completed-match behavior, and preserved automatic timeout.
- Local realtime smoke passes two-player movement, stop/reversal, moving-and-firing, Ready, reconnect/full sync, cleanup, and four-client fanout. The post-fix loopback sample stayed within 35–51 ms between snapshots and at most 26 ms snapshot age; this is local evidence only.
- A two-bridge Redis fixture passes cross-instance join/fanout and verifies exactly one elected room owner. No hosted Vercel/Redis performance claim has been made.

## Review and release steps (not performed)

1. Review and approve a Redis integration in the existing Vercel project. It must expose native `REDIS_URL`; provider commands, bandwidth, connection limits, and any paid tier must be accepted before provisioning. No subscription has been created.
2. Add `REALTIME_ARENA_MODE=vercel-redis`, `REALTIME_TICKET_SECRET` (32+ random characters), and `REDIS_URL` to a preview environment. Keep the existing Turso variables. Do not set `REALTIME_ARENA_URL` in this mode.
3. Apply additive migration `drizzle/0003_authoritative_realtime_rooms.sql` once through `npm run db:migrate:vercel`; it preserves existing data.
4. Deploy a preview with `ENABLE_REALTIME_ARENA=true`. The WebSocket Function is configured for 300 seconds, so clients reconnect at or before that lifecycle boundary. Function compute/duration plus Redis command and bandwidth usage are the material cost drivers.
5. Run the two-person desktop review below on the preview. Only after review should the production flag be considered. No production merge or deployment is part of this branch.

Local review: run `npm run dev:realtime`, open `http://127.0.0.1:4173/` in two separate desktop browser profiles at 1440x900, create/share one room, start as creator, then test continuous movement, stop/reversal, moving while firing, one disconnect/reconnect, and both Ready buttons between rounds. A four-profile join/fanout glance is optional. Practice is not required.

Known limit: this reduces transport/scheduling staleness but cannot remove physical RTT. The 75 ms render delay trades a small amount of immediacy for steadier remote motion; extrapolation is capped at 100 ms. Vercel Function expiry and owner failover cause a reconnect and recovery from the last bounded checkpoint rather than seamless zero-loss continuity.
