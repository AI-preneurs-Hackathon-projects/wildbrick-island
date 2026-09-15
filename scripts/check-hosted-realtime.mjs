import assert from 'node:assert/strict';
import {WebSocket} from 'ws';

const rawUrl = process.env.ARENA_PREVIEW_URL;
if (!rawUrl) throw new Error('Set ARENA_PREVIEW_URL to the isolated Vercel preview deployment.');
const base = new URL(rawUrl);
if (base.protocol !== 'https:' || base.hostname === 'wildbrick-island.vercel.app') throw new Error('Hosted Arena smoke is preview-only and refuses the production URL.');
const origin = base.origin;
const bypass = process.env.VERCEL_PROTECTION_BYPASS;
const room = `H${Date.now().toString(36).slice(-7)}`.toUpperCase();
const FUNCTION_DURATION_MS = Number(process.env.ARENA_FUNCTION_DURATION_MS || 300_000);
const HOLD_MS = Number(process.env.ARENA_ROLLOVER_MS || FUNCTION_DURATION_MS + 25_000);
const ROLLOVER_ONLY = process.env.ARENA_ROLLOVER_ONLY === 'true';
if (!Number.isFinite(FUNCTION_DURATION_MS) || FUNCTION_DURATION_MS < 30_000 || !Number.isFinite(HOLD_MS) || HOLD_MS < FUNCTION_DURATION_MS + 5_000) throw new Error('Hosted rollover timing must cover the configured Function lifecycle.');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requestHeaders = extra => ({
  ...(bypass ? {'x-vercel-protection-bypass': bypass} : {}),
  ...extra,
});

class HostedPeer {
  constructor(name, create) {
    this.name = name;
    this.create = create;
    this.cookie = '';
    this.resume = undefined;
    this.socket = null;
    this.messages = [];
    this.waiters = [];
    this.seq = 0;
    this.requestId = 0;
    this.lastSnapshot = null;
    this.snapshotTimes = [];
    this.closeCount = 0;
    this.closeEvents = [];
    this.connectionGeneration = 0;
    this.reconnectRetries = 0;
  }

  async ticket() {
    const response = await fetch(new URL('/api/arena/realtime-ticket', base), {
      method: 'POST',
      redirect: 'manual',
      headers: requestHeaders({
        'content-type': 'application/json',
        origin,
        ...(this.cookie ? {cookie: this.cookie} : {}),
      }),
      body: JSON.stringify({room, create: this.create}),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';', 1)[0];
    let body;
    try { body = await response.json(); } catch { body = {}; }
    assert.equal(response.status, 200, `${this.name} admission failed (${response.status}): ${body.error || 'invalid response'}`);
    assert.equal(body.enabled, true, `${this.name} did not receive an enabled realtime transport`);
    assert.equal(body.transport, 'realtime-v1');
    return body;
  }

  receive(raw) {
    const message = JSON.parse(String(raw));
    if (message.snapshot) {
      this.lastSnapshot = message.snapshot;
      if (message.type === 'snapshot') this.snapshotTimes.push(Date.now());
    }
    this.messages.push(message);
    for (const wake of this.waiters.splice(0)) wake();
  }

  async waitFor(predicate, timeout = 12_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const index = this.messages.findIndex(predicate);
      if (index >= 0) return this.messages.splice(index, 1)[0];
      await new Promise(resolve => {
        const wake = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          const index = this.waiters.indexOf(wake);
          if (index >= 0) this.waiters.splice(index, 1);
          resolve();
        }, 250);
        this.waiters.push(wake);
      });
    }
    throw new Error(`${this.name} timed out waiting for a hosted realtime message`);
  }

  send(packet) {
    assert.equal(this.socket?.readyState, WebSocket.OPEN, `${this.name} socket is not open`);
    this.socket.send(JSON.stringify(packet));
  }

  async connect() {
    const connectionGeneration = ++this.connectionGeneration;
    this.messages.length = 0;
    for (const wake of this.waiters.splice(0)) wake();
    const admission = await this.ticket();
    const headers = requestHeaders(this.cookie ? {cookie: this.cookie} : {});
    const socket = new WebSocket(admission.url, {origin, headers});
    this.socket = socket;
    socket.on('message', raw => {
      if (this.connectionGeneration === connectionGeneration && this.socket === socket) this.receive(raw);
    });
    socket.on('close', (code, reason) => {
      if (this.socket === socket) this.socket = null;
      this.closeCount++;
      this.closeEvents.push({code, reason: String(reason).slice(0, 80), at: Date.now()});
      for (const wake of this.waiters.splice(0)) wake();
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name} WebSocket handshake timed out`)), 15_000);
      socket.once('open', () => { clearTimeout(timer); resolve(); });
      socket.once('error', error => { clearTimeout(timer); reject(error); });
    });
    this.send({type: 'authenticate', ticket: admission.ticket});
    await this.waitFor(message => message.type === 'authenticated');
    this.send({type: 'join', requestId: ++this.requestId, name: this.name, room, create: this.create, avatarColor: '#ffcf55', resume: this.resume, motionVersion: 2, mapVersion: 1});
    const joined = await this.waitFor(message => message.type === 'joined' || message.type === 'error');
    assert.equal(joined.type, 'joined', `${this.name}: ${joined.message}`);
    this.resume = {session: joined.session, token: joined.token};
    this.lastSnapshot = joined.snapshot;
    return joined;
  }

  input(input, command) {
    const packet = {type: 'input', seq: ++this.seq, roundId: this.lastSnapshot?.round?.id, input, afterEvent: 0};
    if (command) packet.command = command;
    this.send(packet);
    return packet.seq;
  }

  async request(type, extra = {}) {
    const requestId = ++this.requestId;
    this.send({type, requestId, ...extra});
    const result = await this.waitFor(message => message.requestId === requestId && ['result', 'error'].includes(message.type));
    assert.equal(result.type, 'result', result.message);
    return result;
  }

  async ensureConnected() {
    if (this.socket?.readyState === WebSocket.OPEN) return false;
    let lastError;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await this.connect();
        return true;
      } catch (error) {
        lastError = error;
        this.reconnectRetries++;
        try { this.socket?.close(); } catch {}
        this.socket = null;
        if (attempt < 5) await delay(Math.min(8_000, 250 * 2 ** attempt));
      }
    }
    throw lastError;
  }
}

const first = new HostedPeer('Hosted One', true);
const second = new HostedPeer('Hosted Two', false);
const startedAt = Date.now();
const waitForRoundFinished = async (peer, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  while (peer.lastSnapshot?.round?.status !== 'finished' && Date.now() < deadline) {
    await peer.ensureConnected();
    peer.input({z: 0});
    await delay(500);
  }
  assert.equal(peer.lastSnapshot?.round?.status, 'finished', `${peer.name} did not receive the finished round after rollover`);
};

try {
  const firstJoin = await first.connect();
  await second.connect();
  assert.equal(firstJoin.snapshot.players.length, 1);
  await first.request('start');
  await second.waitFor(message => message.type === 'snapshot' && message.snapshot.round.status === 'active');

  const playerId = first.resume && first.lastSnapshot.self;
  const initial = second.lastSnapshot.players.find(player => player.id === playerId);
  const movingSeq = first.input({z: 1, cameraYaw: 0});
  await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === playerId && player.lastSeq >= movingSeq));
  const moved = await second.waitFor(message => {
    if (message.type !== 'snapshot') return false;
    const player = message.snapshot.players.find(candidate => candidate.id === playerId);
    return player?.lastSeq >= movingSeq && Math.hypot(player.x - initial.x, player.z - initial.z) > 0.1;
  });
  const movedPlayer = moved.snapshot.players.find(player => player.id === playerId);
  assert.ok(Math.hypot(movedPlayer.x - initial.x, movedPlayer.z - initial.z) > 0.1, 'remote player advances from owner-clock snapshots after the input acknowledgement');

  while (second.snapshotTimes.length < 6) await second.waitFor(message => message.type === 'snapshot');
  const focusedTimes = second.snapshotTimes.slice(-6);
  const intervals = focusedTimes.slice(1).map((time, index) => time - focusedTimes[index]);
  assert.ok(intervals.every(value => value < 180), `hosted snapshot gap exceeded focused bound: ${intervals.join(', ')}`);

  const stopSeq = first.input({z: 0});
  const stopAck = await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === playerId && player.lastSeq >= stopSeq));
  const stopA = await second.waitFor(message => message.type === 'snapshot' && message.snapshotSeq > stopAck.snapshotSeq && message.snapshot.players.some(player => player.id === playerId && player.lastSeq >= stopSeq));
  const stopB = await second.waitFor(message => message.type === 'snapshot' && message.snapshotSeq >= stopA.snapshotSeq + 2 && message.snapshot.players.some(player => player.id === playerId && player.lastSeq >= stopSeq));
  const stopPlayerA = stopA.snapshot.players.find(player => player.id === playerId);
  const stopPlayerB = stopB.snapshot.players.find(player => player.id === playerId);
  assert.ok(Math.hypot(stopPlayerA.x - stopPlayerB.x, stopPlayerA.z - stopPlayerB.z) < 0.001, 'stop does not coast between authoritative snapshots');

  const reverseOrigin = stopPlayerB;
  const reverseSeq = first.input({z: -1}, {type: 'fire', id: 1});
  await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === playerId && player.lastSeq >= reverseSeq));
  const reversed = await second.waitFor(message => {
    if (message.type !== 'snapshot') return false;
    const player = message.snapshot.players.find(candidate => candidate.id === playerId);
    return player?.lastSeq >= reverseSeq && Math.hypot(player.x - reverseOrigin.x, player.z - reverseOrigin.z) > 0.1;
  });
  const reversedPlayer = reversed.snapshot.players.find(player => player.id === playerId);
  assert.equal(reversed.snapshot.players.find(player => player.id === playerId).lastCommand, 1, 'move-and-fire is acknowledged once');
  const forwardDelta = {x: movedPlayer.x - initial.x, z: movedPlayer.z - initial.z};
  const reverseDelta = {x: reversedPlayer.x - reverseOrigin.x, z: reversedPlayer.z - reverseOrigin.z};
  assert.ok(forwardDelta.x * reverseDelta.x + forwardDelta.z * reverseDelta.z < 0, 'reversal changes authoritative travel direction');

  second.socket.close(1000, 'Focused reconnect smoke');
  await second.waitFor(() => !second.socket, 5_000).catch(() => {});
  const secondPlayerId = second.lastSnapshot.self;
  await second.connect();
  assert.equal(second.lastSnapshot.self, secondPlayerId, 'reconnect preserves the authoritative seat');
  assert.equal(second.lastSnapshot.players.length, 2, 'reconnect receives a full two-player snapshot');
  const rolloverBaseline = first.closeCount + second.closeCount;

  let nextProgress = 30_000;
  while (Date.now() - startedAt < HOLD_MS) {
    for (const peer of [first, second]) {
      if (await peer.ensureConnected()) process.stdout.write(`${peer.name} reconnected after hosted Function/connection rollover.\n`);
      peer.input({z: 0});
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed >= nextProgress) {
      process.stdout.write(`Hosted rollover smoke ${Math.floor(elapsed / 1000)}s: snapshot age ${Math.max(0, Date.now() - (second.lastSnapshot?.time || Date.now()))}ms, closes ${first.closeCount + second.closeCount}.\n`);
      nextProgress += 30_000;
    }
    await delay(1_000);
  }

  assert.ok(first.closeCount + second.closeCount > rolloverBaseline, `expected at least one connection rollover after the ${FUNCTION_DURATION_MS}-millisecond hosted Function lifecycle`);
  await Promise.all([first.ensureConnected(), second.ensureConnected()]);
  if (ROLLOVER_ONLY) {
    await second.request('leave');
    await first.request('leave');
    console.log(`Hosted Realtime Arena: ${FUNCTION_DURATION_MS}-millisecond diagnostic rollover and full resynchronization passed.`);
    process.exitCode = 0;
  } else {
  await Promise.all([waitForRoundFinished(first), waitForRoundFinished(second)]);
  const roundId = first.lastSnapshot.round.id;
  const readyOne = await first.request('ready', {roundId});
  assert.equal(readyOne.snapshot.readiness.readyCount, 1);
  const readyTwo = await second.request('ready', {roundId});
  assert.equal(readyTwo.snapshot.readiness.allReady, true);
  assert.ok(readyTwo.snapshot.round.intermissionEndsAt <= readyTwo.snapshot.time + 3_000);

  await second.request('leave');
  await first.request('leave');
  const ages = [first, second].map(peer => Math.max(0, Date.now() - (peer.lastSnapshot?.time || Date.now())));
  console.log(JSON.stringify({
    preview: origin,
    room,
    transport: 'realtime-v1',
    initialSnapshotIntervalsMs: intervals,
    finalSnapshotAgeMs: ages,
    connectionRollovers: first.closeEvents.concat(second.closeEvents).map(({code, reason}) => ({code, reason})),
    reconnectRetries: first.reconnectRetries + second.reconnectRetries,
    movement: true,
    stop: true,
    reversalAndFire: true,
    reconnectFullSync: true,
    ready: true,
    cleanup: true,
  }, null, 2));
  console.log('Hosted Realtime Arena: two-client movement, stop/reversal/fire, reconnect, Ready, cleanup and >300-second rollover passed.');
  }
} finally {
  for (const peer of [first, second]) if (peer.socket?.readyState === WebSocket.OPEN) peer.socket.close(1000, 'Hosted smoke cleanup');
}
