import http from 'node:http';
import process from 'node:process';
import {createClient} from '@libsql/client';
import {WebSocketServer} from 'ws';
import {createTursoDb} from '../server/turso-db.js';
import {RealtimeRoomStore} from './room-store.js';
import {RealtimeRoomAuthority} from './room-authority.js';

function allowedOrigins(value) {
  const origins = new Set(String(value || '').split(',').map(entry => entry.trim()).filter(Boolean));
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:5173');
  }
  return origins;
}

export function createRealtimeServer({db, ticketSecret, origins = allowedOrigins(process.env.ARENA_ALLOWED_ORIGINS), ownerId, now, httpHandler, authorityFactory = options => new RealtimeRoomAuthority(options)} = {}) {
  if (!db) throw new TypeError('A database is required');
  const store = new RealtimeRoomStore(db, {ownerId, now});
  const authority = authorityFactory({store, ticketSecret, now});
  const wss = new WebSocketServer({noServer: true, maxPayload: 110_000, perMessageDeflate: false, clientTracking: false});
  let ready = true, stopping = false;
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.url === '/healthz' && request.method === 'GET') {
      response.statusCode = ready ? 200 : 503;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ok: ready, transport: 'realtime-v1', rooms: authority.rooms.size}));
      return;
    }
    if (httpHandler) {
      Promise.resolve(httpHandler(request, response)).catch(() => {
        if (!response.headersSent) response.statusCode = 500;
        if (!response.writableEnded) response.end('Internal server error');
      });
    } else { response.statusCode = 404; response.end('Not found'); }
  });
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    let path;
    try { path = new URL(request.url, 'http://arena.local').pathname; } catch { path = ''; }
    if (stopping || path !== '/arena' || typeof origin !== 'string' || !origins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, webSocket => authority.attach(webSocket, origin));
  });
  const heartbeat = setInterval(() => authority.heartbeat(), 15_000);
  heartbeat.unref?.();
  async function close() {
    if (stopping) return;
    stopping = true;
    ready = false;
    clearInterval(heartbeat);
    await authority.close();
    await new Promise(resolve => server.close(resolve));
  }
  return {server, authority, store, close};
}

export async function startRealtimeServer(env = process.env) {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) throw new Error('Turso database configuration is required');
  if (!env.REALTIME_TICKET_SECRET || env.REALTIME_TICKET_SECRET.length < 32) throw new Error('REALTIME_TICKET_SECRET must contain at least 32 characters');
  const client = createClient({url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN});
  const db = createTursoDb(client);
  try { await db.prepare('SELECT transport, owner_epoch, lease_until FROM arena_rooms LIMIT 1').all(); }
  catch (error) { client.close(); throw new Error('Realtime Arena schema is unavailable. Apply the additive migration before starting.', {cause: error}); }
  const app = createRealtimeServer({db, ticketSecret: env.REALTIME_TICKET_SECRET});
  const port = Number(env.PORT || 8788);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, '0.0.0.0', resolve);
  });
  process.stdout.write(`Brickwild realtime Arena listening on port ${port}\n`);
  const shutdown = () => {
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref?.();
    void app.close().finally(() => { client.close(); process.exit(0); });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) await startRealtimeServer();
