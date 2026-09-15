import {randomUUID} from 'node:crypto';
import {newRoom} from '../public/arena-core.js';
import {arenaStore, ArenaError, hash, nonce} from '../worker/arena-store.js';

export const REALTIME_TRANSPORT = 'realtime-v1';
const LEASE_MS = 12_000;
const ROOM_STALE_MS = 15 * 60_000;
const SESSION_MS = 15 * 60_000;

export class LostRoomLeaseError extends Error {}

export class RealtimeRoomStore {
  constructor(db, {ownerId = randomUUID(), now = Date.now} = {}) {
    if (!db) throw new TypeError('A database is required');
    this.db = db;
    this.ownerId = ownerId;
    this.now = now;
    this.arena = arenaStore(db);
  }

  async roomRow(roomId) {
    return this.db.prepare('SELECT id, revision, snapshot, updated_at, transport, owner_id, owner_epoch, lease_until FROM arena_rooms WHERE id = ?').bind(roomId).first();
  }

  async verifyResume(resume, principal, roomId) {
    if (!resume || !/^[a-f0-9-]{36}$/.test(resume.session || '') || !/^[a-f0-9]{64}$/.test(resume.token || '')) return null;
    const row = await this.db.prepare('SELECT * FROM arena_sessions WHERE id = ?').bind(resume.session).first();
    if (!row || row.principal !== principal || row.room_id !== roomId || row.expires_at < this.now() || row.token_hash !== await hash(resume.token)) return null;
    return row;
  }

  async claim(roomId, {create, creatorResume = null} = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const now = this.now();
      let row = await this.roomRow(roomId);
      if (!row) {
        if (!create) throw new ArenaError('That arena code was not found. Check the code and try again.', 404);
        const room = newRoom(now, randomUUID());
        const inserted = await this.db.prepare("INSERT INTO arena_rooms (id, revision, snapshot, updated_at, transport, owner_id, owner_epoch, lease_until, checkpointed_at) VALUES (?, 0, ?, ?, 'realtime-v1', ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING")
          .bind(roomId, JSON.stringify(room), now, this.ownerId, now + LEASE_MS, now).run();
        if (inserted.meta.changes === 1) return {room, ownerEpoch: 1, revision: 0, leaseUntil: now + LEASE_MS};
        continue;
      }
      if (row.transport !== REALTIME_TRANSPORT) {
        if (now - row.updated_at <= ROOM_STALE_MS || row.lease_until >= now) throw new ArenaError('This Arena is pinned to the existing transport. Create a new realtime room.', 409);
        if (!create) throw new ArenaError('That arena code was not found. Check the code and try again.', 404);
        const room = newRoom(now, randomUUID()), nextEpoch = Number(row.owner_epoch) + 1;
        const repinned = await this.db.prepare("UPDATE arena_rooms SET snapshot = ?, revision = revision + 1, updated_at = ?, checkpointed_at = ?, transport = 'realtime-v1', owner_id = ?, owner_epoch = ?, lease_until = ? WHERE id = ? AND revision = ? AND transport = ? AND lease_until < ?")
          .bind(JSON.stringify(room), now, now, this.ownerId, nextEpoch, now + LEASE_MS, roomId, row.revision, row.transport, now).run();
        if (repinned.meta.changes === 1) return {room, ownerEpoch: nextEpoch, revision: Number(row.revision) + 1, leaseUntil: now + LEASE_MS};
        continue;
      }
      const expired = now - row.updated_at > ROOM_STALE_MS && row.lease_until < now;
      if (create && !creatorResume && !expired) throw new ArenaError('That arena code is already in use. Create another one.', 409);
      if (row.owner_id && row.owner_id !== this.ownerId && row.lease_until >= now) throw new ArenaError('That Arena is reconnecting to its owner. Try again shortly.', 409);
      const nextEpoch = Number(row.owner_epoch) + (row.owner_id === this.ownerId ? 0 : 1);
      const claimed = await this.db.prepare("UPDATE arena_rooms SET owner_id = ?, owner_epoch = ?, lease_until = ? WHERE id = ? AND transport = 'realtime-v1' AND owner_epoch = ? AND (owner_id = ? OR owner_id IS NULL OR lease_until < ?)")
        .bind(this.ownerId, nextEpoch, now + LEASE_MS, roomId, row.owner_epoch, this.ownerId, now).run();
      if (claimed.meta.changes !== 1) continue;
      let room = expired ? newRoom(now, randomUUID()) : JSON.parse(row.snapshot);
      // A recovered checkpoint is authoritative world state, not permission to
      // replay held input from a dead owner. Reconnected peers send fresh input.
      for (const player of Object.values(room.players || {})) Object.assign(player, {input: {}, inputAt: 0, speed: 0, vertical: 0});
      room.revision = Number(row.revision);
      return {room, ownerEpoch: nextEpoch, revision: Number(row.revision), leaseUntil: now + LEASE_MS};
    }
    throw new ArenaError('The Arena owner changed. Reconnect to continue.', 409);
  }

  async checkpoint(roomId, ownerEpoch, room, {release = false} = {}) {
    const now = this.now();
    const result = await this.db.prepare("UPDATE arena_rooms SET snapshot = ?, revision = ?, updated_at = ?, checkpointed_at = ?, lease_until = ?, owner_id = ? WHERE id = ? AND transport = 'realtime-v1' AND owner_id = ? AND owner_epoch = ?")
      .bind(JSON.stringify(room), room.revision, now, now, release ? 0 : now + LEASE_MS, release ? null : this.ownerId, roomId, this.ownerId, ownerEpoch).run();
    if (result.meta.changes !== 1) throw new LostRoomLeaseError(`Lost ownership of ${roomId}`);
    return release ? 0 : now + LEASE_MS;
  }

  async renew(roomId, ownerEpoch) {
    const now = this.now();
    const result = await this.db.prepare("UPDATE arena_rooms SET lease_until = ? WHERE id = ? AND transport = 'realtime-v1' AND owner_id = ? AND owner_epoch = ?")
      .bind(now + LEASE_MS, roomId, this.ownerId, ownerEpoch).run();
    if (result.meta.changes !== 1) throw new LostRoomLeaseError(`Lost ownership of ${roomId}`);
    return now + LEASE_MS;
  }

  async createSession({principal, roomId, resume}) {
    const verified = await this.verifyResume(resume, principal, roomId);
    const provisional = !verified && resume && /^[a-f0-9-]{36}$/.test(resume.session || '') && /^[a-f0-9]{64}$/.test(resume.token || '');
    // The browser creates this opaque pair before its first join. Persisting it
    // makes a lost `joined` response safe to retry without creating a second seat.
    const id = verified?.id || (provisional ? resume.session : randomUUID()), token = verified ? resume.token : (provisional ? resume.token : nonce());
    const row = await this.arena.saveSession({id, tokenHash: await hash(token), principal, roomId, playerId: verified?.player_id || randomUUID()});
    await this.touchSession(row.id);
    return {row, token, resumed: !!verified};
  }

  async touchSession(id) {
    await this.db.prepare('UPDATE arena_sessions SET expires_at = ? WHERE id = ?').bind(this.now() + SESSION_MS, id).run();
  }

  async expireSession(id) {
    await this.db.prepare('UPDATE arena_sessions SET expires_at = ? WHERE id = ?').bind(this.now() - 1, id).run();
  }

  reserveBuild(id) { return this.arena.reserveBuild(id); }
  saveBlueprint(blueprint) { return this.arena.saveBlueprint(blueprint); }
}
