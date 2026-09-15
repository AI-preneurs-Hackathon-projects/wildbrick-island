import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {RealtimeRoomAuthority} from './room-authority.js';
import {LostRoomLeaseError} from './room-store.js';
import {verifyRealtimeTicket} from '../server/realtime-ticket.js';

const OWNER_LEASE_MS = 8_000;
const OWNER_RENEW_MS = 2_500;
const OWNER_LOOKUP_MS = 1_000;
const STREAM_BLOCK_MS = 1_000;
const INPUT_STREAM_MAX = 4_096;
const OUTPUT_STREAM_MAX = 2_048;
const MAX_PACKET_BYTES = 110_000;
const MAX_BUFFERED_BYTES = 512 * 1024;
const MAX_LOCAL_RELAYS = 256;
const MAX_OWNED_ROOMS = 8;
const MAX_RECENT_ENVELOPES = 8_192;
const VIRTUAL_PEER_IDLE_MS = 6_000;
const STREAM_EXPIRY_MS = 20 * 60_000;
const DEFAULT_NAMESPACE = 'brickwild:arena';
const RELAY_RETRY_TYPES = new Set(['authenticate', 'join', 'start', 'ready', 'leave']);
const RELAY_RETRY_DELAYS_MS = [1_200, 2_400];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalizeNamespace = value => {
  const namespace = String(value || DEFAULT_NAMESPACE).trim();
  if (!/^[A-Za-z0-9:_-]{1,80}$/.test(namespace)) throw new TypeError('Redis Arena namespace must use 1-80 letters, numbers, colons, underscores or hyphens');
  return namespace;
};
const inputKey = (namespace, room) => `${namespace}:${room}:input`;
const ownerKey = (namespace, room) => `${namespace}:${room}:owner`;
const outputKey = (namespace, instance) => `${namespace}:instance:${instance}:output`;
const fields = flat => Object.fromEntries(Array.from({length: Math.floor(flat.length / 2)}, (_, index) => [flat[index * 2], flat[index * 2 + 1]]));

class RedisVirtualSocket extends EventEmitter {
  constructor(bridge, envelope) {
    super();
    this.bridge = bridge;
    this.peerId = envelope.peerId;
    this.replyInstance = envelope.replyInstance;
    this.room = envelope.room;
    this.readyState = WebSocket.OPEN;
    this.bufferedAmount = 0;
    this.lastSeen = bridge.now();
    this.arena = null;
  }

  send(data) {
    if (this.readyState !== WebSocket.OPEN) return;
    void this.bridge.output(this.replyInstance, this.peerId, {type: 'data', data: String(data)}).catch(() => this.close(1012, 'Redis relay unavailable'));
  }

  ping() { queueMicrotask(() => this.emit('pong')); }
  terminate() { this.close(1012, 'Arena relay expired'); }
  close(code = 1000, reason = '') {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    void this.bridge.output(this.replyInstance, this.peerId, {type: 'close', code, reason}).catch(() => {});
    queueMicrotask(() => this.emit('close', code, Buffer.from(reason)));
  }
}

export class RedisArenaBridge {
  constructor({redis, store, ticketSecret, instanceId = randomUUID(), namespace = DEFAULT_NAMESPACE, now = Date.now}) {
    if (!redis) throw new TypeError('Redis is required for cross-instance Arena routing');
    this.redis = redis;
    this.store = store;
    this.ticketSecret = ticketSecret;
    this.instanceId = instanceId;
    this.namespace = normalizeNamespace(namespace);
    this.now = now;
    this.authority = new RealtimeRoomAuthority({store, ticketSecret, now});
    this.relays = new Map();
    this.virtualPeers = new Map();
    this.owners = new Map();
    this.remoteOwners = new Map();
    this.outputReader = null;
    this.outputCursor = '0-0';
    this.outputStarting = null;
    this.expiryTouched = new Map();
    this.processedEnvelopes = new Set();
    this.retryTimers = new Set();
    this.closed = false;
  }

  async startOutput() {
    if (this.outputStarting) return this.outputStarting;
    this.outputStarting = (async () => {
      const key = outputKey(this.namespace, this.instanceId), tail = await this.redis.xrevrange(key, '+', '-', 'COUNT', 1);
      this.outputCursor = tail[0]?.[0] || '0-0';
      this.outputReader = this.redis.duplicate();
      void this.outputLoop(key);
    })();
    return this.outputStarting;
  }

  register(socket, origin) {
    if (this.closed || this.relays.size >= MAX_LOCAL_RELAYS) { socket.close(1013, 'Arena relay is busy'); return; }
    const peerId = randomUUID(), relay = {socket, peerId, origin, room: null, chain: Promise.resolve(), closed: false};
    this.relays.set(peerId, relay);
    void this.startOutput().catch(() => socket.close(1012, 'Redis relay unavailable'));
    socket.on('message', (data, isBinary) => {
      relay.chain = relay.chain.then(() => this.incoming(relay, data, isBinary)).catch(() => socket.close(1008, 'Invalid Arena packet'));
    });
    const close = () => {
      if (relay.closed) return;
      relay.closed = true;
      this.relays.delete(peerId);
      if (relay.room) void this.forward(relay.room, {kind: 'disconnect', messageId: randomUUID(), room: relay.room, peerId, replyInstance: this.instanceId, origin}).catch(() => {});
      if (!this.relays.size) void this.releaseIdleOwners();
    };
    socket.on('close', close);
    socket.on('error', close);
  }

  async incoming(relay, data, isBinary) {
    if (relay.closed || isBinary || data.length > MAX_PACKET_BYTES) throw new Error('Invalid Arena packet');
    const raw = data.toString('utf8');
    let packet;
    try { packet = JSON.parse(raw); } catch {}
    if (!relay.room) {
      if (!packet) throw new Error('Invalid Arena packet');
      if (packet?.type !== 'authenticate' || typeof packet.ticket !== 'string') throw new Error('Authentication required');
      const claims = verifyRealtimeTicket(packet.ticket, this.ticketSecret, Math.floor(this.now() / 1000));
      if (claims.origin !== relay.origin) throw new Error('Origin mismatch');
      relay.room = claims.room;
    }
    await this.startOutput();
    const envelope = {kind: 'message', messageId: randomUUID(), room: relay.room, peerId: relay.peerId, replyInstance: this.instanceId, origin: relay.origin, raw};
    await this.forward(relay.room, envelope);
    if (RELAY_RETRY_TYPES.has(packet?.type)) this.scheduleRelayRetries(relay, envelope);
  }

  scheduleRelayRetries(relay, envelope) {
    for (const delay of RELAY_RETRY_DELAYS_MS) {
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        if (!this.closed && !relay.closed) void this.forward(envelope.room, envelope).catch(() => relay.socket.close(1012, 'Redis relay unavailable'));
      }, delay);
      this.retryTimers.add(timer);
    }
  }

  async forward(room, envelope) {
    await this.ensureOwner(room);
    const key = inputKey(this.namespace, room);
    await this.redis.xadd(key, 'MAXLEN', '~', INPUT_STREAM_MAX, '*', 'd', JSON.stringify(envelope));
    await this.touchExpiry(key);
  }

  async ensureOwner(room) {
    if (this.owners.has(room)) return;
    const cached = this.remoteOwners.get(room);
    if (cached && cached.until > this.now()) return;
    const key = ownerKey(this.namespace, room), current = await this.redis.get(key);
    if (current) { this.remoteOwners.set(room, {value: current, until: this.now() + OWNER_LOOKUP_MS}); return; }
    if (this.owners.size >= MAX_OWNED_ROOMS) throw new Error('This Arena relay owns its room limit');
    const token = `${this.instanceId}:${randomUUID()}`;
    if (await this.redis.set(key, token, 'PX', OWNER_LEASE_MS, 'NX') !== 'OK') {
      this.remoteOwners.set(room, {value: 'remote', until: this.now() + OWNER_LOOKUP_MS});
      return;
    }
    const tail = await this.redis.xrevrange(inputKey(this.namespace, room), '+', '-', 'COUNT', 1);
    const state = {room, token, cursor: tail[0]?.[0] || '0-0', active: true, reader: this.redis.duplicate(), renewTimer: null};
    this.owners.set(room, state);
    state.renewTimer = setInterval(() => void this.renewOwner(state), OWNER_RENEW_MS);
    state.renewTimer.unref?.();
    void this.ownerLoop(state);
  }

  async renewOwner(state) {
    if (!state.active) return;
    const renewed = await this.redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end", 1, ownerKey(this.namespace, state.room), state.token, OWNER_LEASE_MS).catch(() => 0);
    if (Number(renewed) !== 1) this.stopOwner(state, new LostRoomLeaseError(`Redis lease lost for ${state.room}`));
  }

  async ownerLoop(state) {
    while (state.active && !this.closed) {
      try {
        const result = await state.reader.xread('BLOCK', STREAM_BLOCK_MS, 'STREAMS', inputKey(this.namespace, state.room), state.cursor);
        if (!result) { this.expireVirtualPeers(state.room); continue; }
        for (const [, entries] of result) for (const [id, flat] of entries) {
          state.cursor = id;
          const data = fields(flat).d;
          if (data) await this.processEnvelope(state.room, JSON.parse(data));
        }
        this.expireVirtualPeers(state.room);
      } catch {
        if (state.active) await sleep(250);
      }
    }
  }

  async processEnvelope(room, envelope) {
    if (envelope.room !== room || typeof envelope.peerId !== 'string' || typeof envelope.replyInstance !== 'string') return;
    if (envelope.messageId !== undefined) {
      if (typeof envelope.messageId !== 'string' || envelope.messageId.length < 1 || envelope.messageId.length > 64) return;
      if (this.processedEnvelopes.has(envelope.messageId)) return;
      this.processedEnvelopes.add(envelope.messageId);
      if (this.processedEnvelopes.size > MAX_RECENT_ENVELOPES) this.processedEnvelopes.delete(this.processedEnvelopes.values().next().value);
    }
    const key = `${envelope.replyInstance}:${envelope.peerId}`;
    let peer = this.virtualPeers.get(key);
    if (envelope.kind === 'disconnect') { peer?.close(1000, 'Relay disconnected'); return; }
    if (envelope.kind !== 'message' || typeof envelope.raw !== 'string') return;
    let packet;
    try { packet = JSON.parse(envelope.raw); } catch { return; }
    if (!peer) {
      if (packet.type !== 'authenticate') {
        await this.output(envelope.replyInstance, envelope.peerId, {type: 'close', code: 1012, reason: 'Arena owner changed; reconnecting'});
        return;
      }
      peer = new RedisVirtualSocket(this, envelope);
      this.virtualPeers.set(key, peer);
      peer.once('close', () => this.virtualPeers.delete(key));
      this.authority.attach(peer, envelope.origin);
    }
    peer.lastSeen = this.now();
    peer.emit('message', Buffer.from(envelope.raw), false);
  }

  expireVirtualPeers(room) {
    const cutoff = this.now() - VIRTUAL_PEER_IDLE_MS;
    for (const peer of this.virtualPeers.values()) if (peer.room === room && peer.lastSeen < cutoff) peer.close(1012, 'Arena relay timed out');
    const state = this.owners.get(room);
    if (state && !this.authority.rooms.has(room) && ![...this.virtualPeers.values()].some(peer => peer.room === room)) this.stopOwner(state, new LostRoomLeaseError('Arena room expired'), true);
  }

  stopOwner(state, error, release = false) {
    if (!state.active) return;
    state.active = false;
    clearInterval(state.renewTimer);
    this.owners.delete(state.room);
    void state.reader.quit().catch(() => {});
    if (release) void this.redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, ownerKey(this.namespace, state.room), state.token).catch(() => {});
    const runtime = this.authority.rooms.get(state.room);
    if (runtime) { runtime.fail(error); this.authority.rooms.delete(state.room); }
    for (const peer of this.virtualPeers.values()) if (peer.room === state.room) peer.close(1012, 'Arena owner changed; reconnecting');
  }

  async releaseIdleOwners() {
    if (this.relays.size || this.closed) return;
    await Promise.allSettled([...this.owners.values()].map(state => this.releaseOwner(state)));
  }

  async releaseOwner(state) {
    if (!state.active) return;
    state.active = false;
    clearInterval(state.renewTimer);
    this.owners.delete(state.room);
    await state.reader.quit().catch(() => {});
    const runtime = this.authority.rooms.get(state.room);
    if (runtime) {
      await runtime.release().catch(error => runtime.fail(error));
      this.authority.rooms.delete(state.room);
    }
    for (const peer of [...this.virtualPeers.values()]) if (peer.room === state.room) peer.close(1012, 'Arena owner changed; reconnecting');
    await this.redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, ownerKey(this.namespace, state.room), state.token).catch(() => {});
  }

  async output(instance, peerId, payload) {
    const key = outputKey(this.namespace, instance);
    await this.redis.xadd(key, 'MAXLEN', '~', OUTPUT_STREAM_MAX, '*', 'p', peerId, 'd', JSON.stringify(payload));
    await this.touchExpiry(key);
  }

  async touchExpiry(key) {
    const next = this.expiryTouched.get(key) || 0;
    if (next > this.now()) return;
    this.expiryTouched.set(key, this.now() + STREAM_EXPIRY_MS / 4);
    await this.redis.pexpire(key, STREAM_EXPIRY_MS);
  }

  async outputLoop(key) {
    while (!this.closed && this.outputReader) {
      try {
        const result = await this.outputReader.xread('BLOCK', STREAM_BLOCK_MS, 'STREAMS', key, this.outputCursor);
        if (!result) continue;
        for (const [, entries] of result) for (const [id, flat] of entries) {
          this.outputCursor = id;
          const entry = fields(flat), relay = this.relays.get(entry.p);
          if (!relay || relay.closed) continue;
          let payload;
          try { payload = JSON.parse(entry.d); } catch { continue; }
          if (payload.type === 'close') relay.socket.close(payload.code || 1012, String(payload.reason || '').slice(0, 120));
          else if (payload.type === 'data' && relay.socket.readyState === WebSocket.OPEN) {
            if (relay.socket.bufferedAmount > MAX_BUFFERED_BYTES) relay.socket.close(1013, 'Arena connection is too slow');
            else relay.socket.send(payload.data);
          }
        }
      } catch {
        if (!this.closed) await sleep(250);
      }
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.retryTimers) clearTimeout(timer);
    this.retryTimers.clear();
    this.processedEnvelopes.clear();
    for (const state of [...this.owners.values()]) this.stopOwner(state, new LostRoomLeaseError('Arena relay closed'));
    for (const relay of this.relays.values()) relay.socket.close(1012, 'Arena relay closed');
    await this.authority.close();
    if (this.outputReader) await this.outputReader.quit().catch(() => {});
  }
}
