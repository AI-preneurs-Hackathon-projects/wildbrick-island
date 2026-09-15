import {WebSocket} from 'ws';
import {avatarColor} from '../public/avatar-colors.js';
import {advanceRoom, applyInput, joinPlayer, makeKit, readyForNextRound, removePlayer, roomSnapshot, startRoom} from '../public/arena-core.js';
import {validateBlueprint} from '../public/blueprint.js';
import {ArenaError} from '../worker/arena-store.js';
import {verifyRealtimeTicket} from '../server/realtime-ticket.js';
import {LostRoomLeaseError} from './room-store.js';

const TICK_MS = 50;
const CHECKPOINT_MS = 2_000;
const EMPTY_EXPIRY_MS = 60_000;
const MAX_BUFFERED_BYTES = 512 * 1024;
const MAX_PACKET_BYTES = 110_000;
const MAX_STANDARD_PACKET_BYTES = 16_384;
const MAX_INPUT_QUEUE = 64;
const AUTH_TIMEOUT_MS = 5_000;
const JOIN_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 512;
const MAX_ROOMS = 128;
const MAX_PLAYERS_PER_ROOM = 64;
const REQUEST_TYPES = new Set(['start', 'ready', 'leave']);
const COMMAND_TYPES = new Set(['fire', 'jump', 'exit', 'pickup', 'cancel-build', 'build']);

const statusOf = error => Number.isInteger(error?.status) ? error.status : error instanceof LostRoomLeaseError ? 409 : 503;
const messageOf = error => statusOf(error) < 500 ? error.message : 'The realtime Arena could not continue. Reconnect to resume.';
const validRequestId = value => Number.isSafeInteger(value) || (typeof value === 'string' && value.length > 0 && value.length <= 64);

function send(socket, body) {
  if (socket.readyState !== WebSocket.OPEN) return false;
  if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
    socket.close(1013, 'Arena connection is too slow');
    return false;
  }
  socket.send(JSON.stringify(body));
  return true;
}

function validateInput(packet) {
  const allowed = new Set(['type', 'seq', 'input', 'roundId', 'motionEpoch', 'afterEvent', 'command', 'blueprint', 'mapVersion']);
  if (!packet || Array.isArray(packet) || typeof packet !== 'object' || Object.keys(packet).some(key => !allowed.has(key))) throw new ArenaError('Invalid Arena input.');
  if (!Number.isSafeInteger(packet.seq) || packet.seq < 1 || packet.seq > 1e12) throw new ArenaError('Invalid input sequence.');
  if (packet.roundId !== undefined && !Number.isSafeInteger(packet.roundId)) throw new ArenaError('Invalid Arena round.');
  if (packet.motionEpoch !== undefined && (!Number.isSafeInteger(packet.motionEpoch) || packet.motionEpoch < 0)) throw new ArenaError('Invalid movement epoch.');
  if (packet.afterEvent !== undefined && (!Number.isSafeInteger(packet.afterEvent) || packet.afterEvent < 0)) throw new ArenaError('Invalid event cursor.');
  if (packet.command !== undefined) {
    const command = packet.command;
    if (!command || Array.isArray(command) || typeof command !== 'object' || !COMMAND_TYPES.has(command.type) || !Number.isSafeInteger(command.id) || command.id < 1 || command.id > 1e12) throw new ArenaError('Invalid Arena command.');
    if (command.mode !== undefined && (typeof command.mode !== 'string' || command.mode.length > 64)) throw new ArenaError('Invalid Arena command.');
  }
  if (packet.blueprint !== undefined && packet.command?.type !== 'build') throw new ArenaError('A creation is only valid with a build command.');
}

class RoomRuntime {
  constructor(service, roomId, room, ownerEpoch, leaseUntil) {
    this.service = service;
    this.id = roomId;
    this.room = room;
    this.ownerEpoch = ownerEpoch;
    this.leaseDeadline = leaseUntil;
    this.clients = new Set();
    this.snapshotSeq = 0;
    this.lastCheckpoint = service.now();
    this.emptySince = null;
    this.checkpointing = null;
    this.lost = false;
    this.releasing = false;
  }

  fail(error) {
    this.lost = true;
    for (const socket of this.clients) {
      send(socket, {type: 'error', status: statusOf(error), message: messageOf(error)});
      socket.close(1012, 'Arena owner changed');
    }
    this.clients.clear();
  }

  checkpoint(options) {
    if (this.checkpointing || this.lost) return this.checkpointing;
    const snapshot = structuredClone(this.room);
    this.checkpointing = this.service.store.checkpoint(this.id, this.ownerEpoch, snapshot, options)
      .then(deadline => { if (!options?.release) this.leaseDeadline = deadline; return deadline; })
      .catch(error => this.fail(error)).finally(() => { this.checkpointing = null; });
    return this.checkpointing;
  }

  tick(now) {
    if (this.lost || this.releasing) return;
    if (now >= this.leaseDeadline) { this.fail(new LostRoomLeaseError(`Lease expired for ${this.id}`)); return; }
    advanceRoom(this.room, now);
    for (const socket of this.clients) {
      const state = socket.arena;
      const player = state?.playerId && this.room.players[state.playerId];
      if (!player) continue;
      player.lastSeen = now;
      if (now - state.sessionTouchedAt > 30_000 && !state.touchingSession) {
        state.sessionTouchedAt = now;
        state.touchingSession = this.service.store.touchSession(state.sessionId).catch(() => {}).finally(() => { state.touchingSession = null; });
      }
      const queue = state.inputs.splice(0);
      for (const entry of queue) applyInput(this.room, state.playerId, entry.packet, now, entry.kit);
    }
    this.room.revision = Number(this.room.revision || 0) + 1;
    this.snapshotSeq++;
    for (const socket of this.clients) {
      const state = socket.arena;
      if (!state?.playerId) continue;
      send(socket, {type: 'snapshot', snapshotSeq: this.snapshotSeq, snapshot: roomSnapshot(this.room, state.playerId, state.afterEvent)});
    }
    if (now - this.lastCheckpoint >= CHECKPOINT_MS) {
      this.lastCheckpoint = now;
      void this.checkpoint();
    }
    if (this.clients.size) this.emptySince = null;
    else this.emptySince ??= now;
  }

  async release() {
    this.releasing = true;
    if (this.checkpointing) await this.checkpointing;
    if (!this.lost) await this.checkpoint({release: true});
  }
}

export class RealtimeRoomAuthority {
  constructor({store, ticketSecret, now = Date.now}) {
    this.store = store;
    this.ticketSecret = ticketSecret;
    this.now = now;
    this.rooms = new Map();
    this.sessions = new Map();
    this.sockets = new Set();
    this.usedTickets = new Map();
    this.accepting = true;
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    this.tickTimer.unref?.();
  }

  attach(socket, origin) {
    if (!this.accepting || this.sockets.size >= MAX_CONNECTIONS) { socket.close(1013, 'Arena service is busy'); return; }
    this.sockets.add(socket);
    socket.arena = {stage: 'authenticate', origin, inputs: [], afterEvent: 0, isAlive: true, rate: {at: this.now(), tokens: 120}, pendingMessages: 0, messageChain: Promise.resolve(), authTimer: null, joinTimer: null};
    socket.on('pong', () => { socket.arena.isAlive = true; });
    socket.arena.authTimer = setTimeout(() => socket.close(1008, 'Authentication required'), AUTH_TIMEOUT_MS);
    socket.on('message', (data, isBinary) => {
      if (++socket.arena.pendingMessages > MAX_INPUT_QUEUE) { socket.close(1013, 'Arena input queue is full'); return; }
      socket.arena.messageChain = socket.arena.messageChain.then(() => this.message(socket, data, isBinary))
        .catch(error => this.error(socket, error)).finally(() => { socket.arena.pendingMessages--; });
    });
    socket.on('close', () => this.disconnect(socket));
  }

  consumeRate(socket) {
    const rate = socket.arena.rate, now = this.now(), elapsed = Math.max(0, now - rate.at);
    rate.tokens = Math.min(120, rate.tokens + elapsed * 0.08);
    rate.at = now;
    if (rate.tokens < 1) throw new ArenaError('Too many Arena updates. Wait a moment.', 429);
    rate.tokens--;
  }

  async message(socket, data, isBinary) {
    if (isBinary || data.length > MAX_PACKET_BYTES) throw new ArenaError('That Arena packet is too large.', 413);
    this.consumeRate(socket);
    let packet;
    try { packet = JSON.parse(data.toString('utf8')); }
    catch { throw new ArenaError('That Arena packet was not valid.'); }
    if (!packet || Array.isArray(packet) || typeof packet !== 'object' || typeof packet.type !== 'string') throw new ArenaError('That Arena packet was not valid.');
    if (data.length > MAX_STANDARD_PACKET_BYTES && !(packet.type === 'input' && packet.command?.type === 'build' && packet.blueprint)) throw new ArenaError('That Arena packet is too large.', 413);
    try {
      const state = socket.arena;
      if (state.stage === 'authenticate') return await this.authenticate(socket, packet);
      if (state.stage === 'join') return await this.join(socket, packet);
      if (state.stage !== 'play') throw new ArenaError('Join the Arena first.', 401);
      if (packet.type === 'input') return await this.input(socket, packet);
      if (REQUEST_TYPES.has(packet.type)) {
        if (!validRequestId(packet.requestId)) throw new ArenaError('Invalid Arena request.');
        const allowed = packet.type === 'ready' ? ['type', 'requestId', 'roundId'] : ['type', 'requestId'];
        if (Object.keys(packet).some(key => !allowed.includes(key))) throw new ArenaError('Invalid Arena request.');
        if (packet.type === 'start') return await this.start(socket, packet);
        if (packet.type === 'ready') return await this.ready(socket, packet);
        return await this.leave(socket, packet);
      }
      throw new ArenaError('Unknown Arena action.', 404);
    } catch (error) { error.requestId ??= packet.requestId;error.seq ??= packet.seq;error.commandId ??= packet.command?.id;throw error; }
  }

  authenticate(socket, packet) {
    if (packet.type !== 'authenticate' || Object.keys(packet).some(key => !['type', 'ticket'].includes(key))) throw new ArenaError('Authenticate with an Arena admission ticket.', 401);
    const claims = verifyRealtimeTicket(packet.ticket, this.ticketSecret, Math.floor(this.now() / 1000));
    if (claims.origin !== socket.arena.origin) throw new ArenaError('Arena admission origin did not match.', 403);
    if (this.usedTickets.has(claims.jti)) throw new ArenaError('That Arena admission ticket was already used.', 401);
    this.usedTickets.set(claims.jti, claims.exp * 1000);
    clearTimeout(socket.arena.authTimer);
    socket.arena.authTimer = null;
    Object.assign(socket.arena, {stage: 'join', claims});
    send(socket, {type: 'authenticated'});
    socket.arena.joinTimer = setTimeout(() => socket.close(1008, 'Join required'), JOIN_TIMEOUT_MS);
  }

  async loadRoom(claims, resume) {
    let runtime = this.rooms.get(claims.room);
    if (runtime) {
      if (claims.create && !await this.store.verifyResume(resume, claims.sub, claims.room)) throw new ArenaError('That arena code is already in use. Create another one.', 409);
      return runtime;
    }
    if (this.rooms.size >= MAX_ROOMS) throw new ArenaError('The realtime Arena is full. Try again shortly.', 429);
    const creatorResume = claims.create ? await this.store.verifyResume(resume, claims.sub, claims.room) : null;
    const claimed = await this.store.claim(claims.room, {create: claims.create, creatorResume});
    runtime = new RoomRuntime(this, claims.room, claimed.room, claimed.ownerEpoch, claimed.leaseUntil);
    this.rooms.set(claims.room, runtime);
    return runtime;
  }

  async join(socket, packet) {
    const allowed = new Set(['type', 'requestId', 'name', 'room', 'create', 'avatarColor', 'resume', 'motionVersion', 'mapVersion']);
    if (packet.type !== 'join') throw new ArenaError(`Arena join protocol was out of order (${packet.type || 'unknown'}).`);
    if (!validRequestId(packet.requestId)) throw new ArenaError('Invalid Arena join request identifier.');
    if (Object.keys(packet).some(key => !allowed.has(key))) throw new ArenaError('Arena join request contained unexpected fields.');
    const claims = socket.arena.claims;
    if (packet.room !== claims.room || packet.create !== claims.create) throw new ArenaError('Arena admission does not match this room.', 403);
    if (packet.motionVersion !== 2 || packet.mapVersion !== 1) throw new ArenaError('Refresh Brickwild before joining this Arena.', 410);
    const name = String(packet.name || 'Builder').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20) || 'Builder';
    const runtime = await this.loadRoom(claims, packet.resume);
    advanceRoom(runtime.room, this.now());
    const created = await this.store.createSession({principal: claims.sub, roomId: claims.room, resume: packet.resume}), {row: session, token} = created;
    let player;
    try {
      player = runtime.room.players[session.player_id];
      if (!player && Object.keys(runtime.room.players).length >= MAX_PLAYERS_PER_ROOM) throw new ArenaError('This Arena is full. Create or join another room.', 409);
      player ||= joinPlayer(runtime.room, session.player_id, name, this.now());
    } catch (error) { if (!created.resumed) await this.store.expireSession(session.id); throw error; }
    Object.assign(player, {lastSeen: this.now(), name, avatarColor: avatarColor(packet.avatarColor), input: {}, inputAt: 0, speed: 0, vertical: 0});
    player.motion = {version: 2, frame: 0, at: this.now()};
    const prior = this.sessions.get(session.id);
    if (prior && prior !== socket) {
      prior.arena.stage = 'superseded';
      prior.arena.runtime?.clients.delete(prior);
      prior.close(4001, 'Session resumed elsewhere');
    }
    Object.assign(socket.arena, {stage: 'play', runtime, sessionId: session.id, playerId: session.player_id, inputs: [], afterEvent: 0, sessionTouchedAt: this.now()});
    clearTimeout(socket.arena.joinTimer);
    socket.arena.joinTimer = null;
    runtime.clients.add(socket);
    this.sessions.set(session.id, socket);
    send(socket, {type: 'joined', requestId: packet.requestId, room: claims.room, session: session.id, token, snapshot: roomSnapshot(runtime.room, session.player_id)});
  }

  async input(socket, packet) {
    validateInput(packet);
    const state = socket.arena;
    const previous = state.inputs.at(-1), commandId = packet.command?.id;
    // A relay can deliver several 20 Hz packets just before one authority tick.
    // Movement is state, so only the newest contiguous state is useful. Retried
    // commands keep their first validated payload/kit but take the newest input
    // sequence, preserving both command order and the acknowledgement boundary.
    if (previous && commandId && previous.packet.command?.id === commandId) {
      previous.packet = {...packet, command: previous.packet.command, blueprint: previous.packet.blueprint};
      state.afterEvent = packet.afterEvent ?? state.afterEvent;
      return;
    }
    if (!packet.command && previous && !previous.packet.command) {
      previous.packet = packet;
      state.afterEvent = packet.afterEvent ?? state.afterEvent;
      return;
    }
    if (state.inputs.length >= MAX_INPUT_QUEUE) throw new ArenaError('Arena input queue is full. Reconnecting…', 429);
    let kit = null;
    if (packet.command?.type === 'build') {
      const mode = packet.command.mode;
      if (['car', 'plane', 'bow', 'sword', 'foot'].includes(mode)) kit = makeKit(mode);
      else if (packet.blueprint) {
        let blueprint;
        try { blueprint = validateBlueprint(packet.blueprint); }
        catch { throw new ArenaError('That creation is invalid. Try designing it again.'); }
        await this.store.reserveBuild(state.sessionId);
        const id = await this.store.saveBlueprint(blueprint);
        kit = makeKit('pending', blueprint);
        kit.id = id;
        kit.blueprintId = id;
      } else throw new ArenaError('Choose a starter build or a valid creation.');
    }
    state.afterEvent = packet.afterEvent ?? state.afterEvent;
    state.inputs.push({packet, kit});
    if (this.now() - state.sessionTouchedAt > 30_000) {
      state.sessionTouchedAt = this.now();
      void this.store.touchSession(state.sessionId).catch(() => {});
    }
  }

  start(socket, packet) {
    const state = socket.arena, runtime = state.runtime;
    advanceRoom(runtime.room, this.now());
    startRoom(runtime.room, state.playerId, this.now());
    send(socket, {type: 'result', requestId: packet.requestId, snapshot: roomSnapshot(runtime.room, state.playerId, state.afterEvent)});
  }

  ready(socket, packet) {
    if (!Number.isSafeInteger(packet.roundId) || packet.roundId < 1) throw new ArenaError('Invalid Arena round.');
    const state = socket.arena, runtime = state.runtime;
    advanceRoom(runtime.room, this.now());
    readyForNextRound(runtime.room, state.playerId, packet.roundId, this.now());
    send(socket, {type: 'result', requestId: packet.requestId, snapshot: roomSnapshot(runtime.room, state.playerId, state.afterEvent)});
  }

  async leave(socket, packet) {
    const state = socket.arena;
    removePlayer(state.runtime.room, state.playerId);
    await this.store.expireSession(state.sessionId);
    send(socket, {type: 'result', requestId: packet.requestId});
    socket.close(1000, 'Left Arena');
  }

  error(socket, error) {
    send(socket, {type: 'error', requestId: error?.requestId, seq: error?.seq, commandId: error?.commandId, status: statusOf(error), message: messageOf(error)});
    if ([401, 403, 404, 410, 413].includes(statusOf(error)) && socket.arena.stage !== 'play') socket.close(1008, 'Arena admission rejected');
  }

  disconnect(socket) {
    const state = socket.arena;
    clearTimeout(state?.authTimer);
    clearTimeout(state?.joinTimer);
    state?.runtime?.clients.delete(socket);
    if (state?.sessionId && this.sessions.get(state.sessionId) === socket) this.sessions.delete(state.sessionId);
    this.sockets.delete(socket);
  }

  tick() {
    const now = this.now();
    for (const [jti, expires] of this.usedTickets) if (expires <= now) this.usedTickets.delete(jti);
    for (const [id, runtime] of this.rooms) {
      runtime.tick(now);
      if (runtime.lost) this.rooms.delete(id);
      else if (runtime.emptySince && now - runtime.emptySince >= EMPTY_EXPIRY_MS && !runtime.checkpointing) {
        void runtime.checkpoint({release: true}).then(() => this.rooms.delete(id));
      }
    }
  }

  heartbeat() {
    for (const runtime of this.rooms.values()) for (const socket of runtime.clients) {
      if (!socket.arena.isAlive) { socket.terminate(); continue; }
      socket.arena.isAlive = false;
      socket.ping();
    }
  }

  async close() {
    this.accepting = false;
    clearInterval(this.tickTimer);
    for (const socket of this.sockets) socket.close(1012, 'Arena service restarting');
    const terminate = setTimeout(() => { for (const socket of this.sockets) socket.terminate(); }, 1_000);
    terminate.unref?.();
    await Promise.allSettled([...this.rooms.values()].map(runtime => runtime.release()));
    this.sessions.clear();
    this.rooms.clear();
  }
}
