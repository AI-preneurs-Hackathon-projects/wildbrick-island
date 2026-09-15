import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createRealtimeArenaClient} from '../public/realtime-arena-client.js';

const base = new URL(process.env.LOCAL_HANDOFF_URL || 'http://127.0.0.1:4178');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This smoke is loopback-only');
const room = `H${Date.now().toString(36).slice(-7)}`.toUpperCase();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const metrics = [];
function peer(name) {
  let cookie = '', disconnectedAt = 0;
  const storage = new Map();
  const record = {name, gapsMs: [], closes: [], errors: []}; metrics.push(record);
  class Socket extends WebSocket {
    constructor(url) {
      super(url, {origin: base.origin});
      this.on('close', (code, reason) => record.closes.push({code, reason: String(reason)}));
    }
  }
  return createRealtimeArenaClient({
    onStatus(status) {
      if (status === 'reconnecting' && !disconnectedAt) disconnectedAt = performance.now();
      if (status === 'online' && disconnectedAt) {record.gapsMs.push(Math.round(performance.now() - disconnectedAt)); disconnectedAt = 0;}
    },
    onError(message) {record.errors.push(message);},
  }, {WebSocket: Socket, baseUrl: base.href, resumeStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}, async getTicket(room, create) {
    const response = await fetch(new URL('/api/arena/realtime-ticket', base), {method: 'POST', headers: {'content-type': 'application/json', origin: base.origin, ...(cookie ? {cookie} : {})}, body: JSON.stringify({room, create}), signal: AbortSignal.timeout(5000)});
    const value = response.headers.get('set-cookie'); if (value) cookie = value.split(';')[0];
    assert.equal(response.status, 200); return response.json();
  }});
}
const a = peer('first'), b = peer('second');
let ticking;
try {
  assert.equal(await a.join('First', room, '#ffcf55', true), true, JSON.stringify(metrics));
  assert.equal(await b.join('Second', room, '#ffcf55', false), true, JSON.stringify(metrics));
  const ids = [a.self.id, b.self.id];
  assert.equal(await a.start(), true);
  ticking = setInterval(() => {a.tick(.05, {z: 1, fire: true}); b.tick(.05, {});}, 50);
  await delay(35000); // One accelerated 30-second scheduled owner rotation.
  assert.deepEqual([a.self.id, b.self.id], ids);
  assert.ok(a.connected && b.connected && !a.stale && !b.stale, JSON.stringify(metrics));
  for (const record of metrics) {
    assert.ok(record.closes.some(close => close.code === 1012), 'must exercise a real owner handoff');
    assert.ok(record.gapsMs.length >= 1, 'must fully resynchronize');
    assert.deepEqual(record.errors, []);
  }
  console.log(JSON.stringify({room, sameSeats: true, resumedFreshSnapshots: true, metrics}, null, 2));
} finally {
  clearInterval(ticking);
  await Promise.all([a.leave(), b.leave()]);
}
