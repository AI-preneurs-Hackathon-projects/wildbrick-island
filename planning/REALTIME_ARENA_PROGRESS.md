Original prompt: Replace Arena polling with an authoritative realtime room service while preserving gameplay and the working Vercel/Turso/AI stack.

## Scope and decisions

- Base: refreshed `origin/deployment/vercel` at `9860d1d`; `origin/main` is fully contained, so no main cherry-pick is needed.
- Topology: Vercel keeps the frontend, trusted guest identity, AI/API endpoints, and durable Turso data. One long-lived Node WebSocket service owns every active realtime room at 20 Hz.
- Initial hosting target: one Render web-service instance. No service is provisioned and no paid plan is accepted in this iteration.
- Transport pin: each room is `http-v1` or `realtime-v1` for its lifetime. The feature flag changes the default for new rooms; it never starts both authorities for one room.
- Recovery: fenced owner leases and periodic bounded checkpoints; no per-frame or per-input database writes. A reconnect receives a full authoritative snapshot.
- Rendering: timestamped snapshot history with a small explicit jitter delay and bounded extrapolation. Authority, collision, damage, and hit decisions stay on server state.

## Completed vertical slice

- [x] Authoritative room-owner service, admission tickets, fencing/checkpoints, and single-instance deployment config.
- [x] Realtime browser client with ordered inputs, acknowledgements, fixed-step prediction/reconciliation, reconnect backoff, and explicit rollback selection.
- [x] Timestamp-based remote rendering: 75 ms jitter window, 100 ms maximum extrapolation, bounded correction, and lifecycle/discontinuity resets.
- [x] Focused two-client movement/fire/reconnect/cleanup smoke and four-client admission/fanout check.
- [x] Desktop 1440x900 browser join/play visual review; normal Chrome also confirmed a live two-player match with clean console logs.
- [x] Build and focused legacy authority/networking regressions.
- [x] Exact implementation changes prepared for a focused feature-branch commit and backup push.

## Verification notes

- `scripts/check-realtime-rendering.mjs`: 3/3 passed for fixed-clock movement, ordered ACKs, stop/reversal interpolation, and discontinuity resets.
- `scripts/check-realtime-service.mjs`: two peers moved/stopped/reversed/fired and reconnected; four-peer fanout passed at the local 20 Hz cadence. Sampled loopback snapshot age was at most 2 ms; this is not hosted evidence.
- `scripts/check-network-movement.mjs`: 29 passed; `scripts/check-arena.mjs`: 30 passed.
- Production remains unprovisioned. Release requires the additive migration, one approved Render service, a shared ticket secret, the Render `wss` URL in Vercel, then the rollout flag.

## Guardrails

- Do not merge `performance/arena-stability` or restore its rejected overlapping scheduler/interpolation patches.
- Preserve `fbb8c44` held-fire behavior and all gameplay authority rules.
- No database reset/drop/delete/restart, paid inference, production replacement, or production merge.
