import assert from 'node:assert/strict';
import {addPlayer, newRoom} from '../public/arena-core.js';
import {createLocalRealtimeDb} from '../realtime/local-db.js';
import {LostRoomLeaseError, RealtimeRoomStore} from '../realtime/room-store.js';
import {arenaStore} from '../worker/arena-store.js';

const local = createLocalRealtimeDb();
let now = 2_000_000_000_000;
try {
  const first = new RealtimeRoomStore(local.db, {ownerId: 'owner:first', now: () => now});
  const claimed = await first.claim('FENCE', {create: true});
  claimed.room.marker = 'first';
  const recoveringPlayer = addPlayer(claimed.room, 'recovering-player', 'Recovering');
  recoveringPlayer.lastSeen = now - 60_000;
  claimed.room.revision++;
  await first.checkpoint('FENCE', claimed.ownerEpoch, claimed.room);

  now += 13_000;
  const second = new RealtimeRoomStore(local.db, {ownerId: 'owner:second', now: () => now});
  const takeover = await second.claim('FENCE', {create: false});
  assert.ok(takeover.ownerEpoch > claimed.ownerEpoch, 'takeover increments the owner epoch');
  assert.equal(takeover.room.players['recovering-player'].lastSeen, now, 'owner recovery gives checkpointed seats fresh reconnect grace without replaying input');
  assert.deepEqual(takeover.room.players['recovering-player'].input, {}, 'owner recovery clears held input before reconnect');
  await assert.rejects(first.checkpoint('FENCE', claimed.ownerEpoch, claimed.room), LostRoomLeaseError, 'old owner is fenced after takeover');
  const resume = {session: '10000000-0000-0000-0000-000000000001', token: 'a'.repeat(64)};
  const session = await second.createSession({principal: 'test:realtime', roomId: 'FENCE', resume});
  const sessionRow = await local.db.prepare('SELECT expires_at FROM arena_sessions WHERE id = ?').bind(session.row.id).first();
  assert.ok(sessionRow.expires_at >= now + 14 * 60_000, 'realtime resume remains valid through a full Function lifecycle and bounded handoff');
  assert.ok(await second.verifyResume(resume, 'test:realtime', 'FENCE'), 'the extended realtime resume token remains verifiable');

  const staleAt = Date.now() - 16 * 60_000;
  const legacy = newRoom(staleAt, 'legacy');
  await local.db.prepare("INSERT INTO arena_rooms (id, revision, snapshot, updated_at, transport, owner_epoch, lease_until, checkpointed_at) VALUES ('STALE', 0, ?, ?, 'http-v1', 0, 0, ?)").bind(JSON.stringify(legacy), staleAt, staleAt).run();
  const current = new RealtimeRoomStore(local.db, {ownerId: 'owner:repin'});
  await current.claim('STALE', {create: true});
  assert.equal((await current.roomRow('STALE')).transport, 'realtime-v1', 'expired HTTP room code can start a new realtime lifetime');

  const realtimeRow = await current.roomRow('STALE');
  await assert.rejects(arenaStore(local.db).mutate('STALE', room => room), error => error.status === 409, 'HTTP cannot advance a live realtime room');
  await local.db.prepare('UPDATE arena_rooms SET updated_at = ?, lease_until = 0 WHERE id = ?').bind(staleAt, 'STALE').run();
  await arenaStore(local.db).mutate('STALE', room => { room.marker = 'http-repinned'; });
  const repinned = await current.roomRow('STALE');
  assert.equal(repinned.transport, 'http-v1', 'an expired realtime room code can start a new HTTP lifetime');
  assert.ok(repinned.owner_epoch > realtimeRow.owner_epoch, 'transport repin also fences the previous owner epoch');
  console.log('Realtime room store: lease takeover, stale-owner fencing, transport pin rejection and expired-room repinning passed.');
} finally { local.close(); }
