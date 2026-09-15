import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {createReadStream, statSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createRealtimeTicket, normalizeRoomId} from '../server/realtime-ticket.js';
import {createLocalRealtimeDb} from './local-db.js';
import {createRealtimeServer} from './server.js';
import Redis from 'ioredis';
import {RedisArenaBridge} from './redis-bridge.js';

const secret = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
const root = path.resolve(import.meta.dirname, '../public');
const port = Number(process.env.PORT || 4173);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2'};
const sign = value => createHmac('sha256', secret).update(value).digest('base64url');

function principalFrom(request, response) {
  const raw = String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('brickwild-local='))?.slice(16);
  const [id, supplied] = String(raw || '').split('.'), expected = id ? sign(id) : '';
  const a = Buffer.from(supplied || ''), b = Buffer.from(expected);
  if (/^[a-f0-9-]{36}$/.test(id || '') && a.length === b.length && timingSafeEqual(a, b)) return `local-guest:${id}`;
  const created = randomUUID();
  response.setHeader('Set-Cookie', `brickwild-local=${created}.${sign(created)}; Path=/; HttpOnly; SameSite=Lax`);
  return `local-guest:${created}`;
}

async function body(request, max = 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > max) throw Object.assign(new Error('Request too large'), {status: 413}); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}

function localHandler(request, response) {
  return (async () => {
    const host = request.headers.host;
    if (!host || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) { response.statusCode = 400; response.end(); return; }
    const pageOrigin = `http://${host}`;
    const url = new URL(request.url, pageOrigin);
    if (url.pathname === '/api/arena/realtime-ticket') {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'POST' || request.headers.origin !== pageOrigin) { response.statusCode = request.method === 'POST' ? 403 : 405; response.end(JSON.stringify({error: 'Open Brickwild to play.'})); return; }
      try {
        const packet = JSON.parse(await body(request));
        if (!packet || Array.isArray(packet) || typeof packet.create !== 'boolean' || Object.keys(packet).some(key => !['room', 'create'].includes(key))) throw Object.assign(new Error('Invalid Arena ticket request.'), {status: 400});
        const room = normalizeRoomId(packet.room), principal = principalFrom(request, response), now = Math.floor(Date.now() / 1000);
        const {ticket} = createRealtimeTicket({principal, room, create: packet.create, origin: pageOrigin, secret, now, jti: randomUUID()});
        response.end(JSON.stringify({enabled: true, transport: 'realtime-v1', url: `ws://${host}/arena`, ticket}));
      } catch (error) { response.statusCode = error.status || 400; response.end(JSON.stringify({error: error.message})); }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.statusCode = 405; response.end(); return; }
    let relative;
    try { relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); } catch { response.statusCode = 400; response.end(); return; }
    const file = path.resolve(root, `.${relative}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.statusCode = 403; response.end(); return; }
    try { if (!statSync(file).isFile()) throw new Error(); }
    catch { response.statusCode = 404; response.end('Not found'); return; }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file).pipe(response);
  })();
}

const local = createLocalRealtimeDb();
// Opt-in loopback fixture. Never read production REDIS_URL or Turso settings.
let redis;
let authorityFactory;
if (process.env.LOCAL_ARENA_REDIS_URL) {
  const url = new URL(process.env.LOCAL_ARENA_REDIS_URL);
  if (url.protocol !== 'redis:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Local handoff review requires a loopback Redis URL');
  const ownerMaxAgeMs = Number(process.env.LOCAL_ARENA_OWNER_MS || 30_000);
  if (!Number.isSafeInteger(ownerMaxAgeMs) || ownerMaxAgeMs < 5_000) throw new Error('LOCAL_ARENA_OWNER_MS must be at least 5000');
  redis = new Redis(url.href, {lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 1});
  redis.on('error', () => {});
  await redis.connect();
  await redis.ping();
  const namespace = `brickwild:local-handoff:${randomUUID()}`;
  authorityFactory = options => {
    const bridge = new RedisArenaBridge({...options, redis, namespace, ownerMaxAgeMs});
    return {rooms: bridge.authority.rooms, attach: (socket, origin) => bridge.register(socket, origin), heartbeat: () => bridge.authority.heartbeat(), close: () => bridge.close()};
  };
  process.stdout.write(`Local Redis owner handoff every ${ownerMaxAgeMs / 1000}s; isolated namespace, no cloud databases.\n`);
}
const app = createRealtimeServer({db: local.db, ticketSecret: secret, origins: new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]), httpHandler: localHandler, authorityFactory});
await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
process.stdout.write(`Brickwild local realtime Arena: http://127.0.0.1:${port}/\n`);
const shutdown = () => void app.close().finally(() => { redis?.disconnect(); local.close(); process.exit(0); });
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
