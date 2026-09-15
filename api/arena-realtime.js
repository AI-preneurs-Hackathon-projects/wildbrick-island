import {randomUUID} from 'node:crypto';
import Redis from 'ioredis';
import {createClient} from '@libsql/client/web';
import {experimental_upgradeWebSocket} from '@vercel/functions';
import {createTursoDb} from '../server/turso-db.js';
import {RealtimeRoomStore} from '../realtime/room-store.js';
import {RedisArenaBridge} from '../realtime/redis-bridge.js';

let bridge;

function requestOrigin(request) {
  const headers = request.headers, host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  const protocol = String(headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return host ? `${protocol}://${host}` : '';
}

function getBridge() {
  if (bridge) return bridge;
  if (process.env.REALTIME_ARENA_MODE !== 'vercel-redis' || !process.env.REDIS_URL) throw new Error('Vercel Redis Arena is not configured');
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Turso is not configured');
  if (!process.env.REALTIME_TICKET_SECRET || process.env.REALTIME_TICKET_SECRET.length < 32) throw new Error('Realtime tickets are not configured');
  const instanceId = randomUUID();
  const redis = new Redis(process.env.REDIS_URL, {maxRetriesPerRequest: null, retryStrategy: attempts => Math.min(attempts * 200, 5_000)});
  const db = createTursoDb(createClient({url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN}));
  const store = new RealtimeRoomStore(db, {ownerId: `vercel:${instanceId}`});
  bridge = new RedisArenaBridge({
    redis,
    store,
    ticketSecret: process.env.REALTIME_TICKET_SECRET,
    instanceId,
    namespace: process.env.REALTIME_ARENA_NAMESPACE,
  });
  return bridge;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') { response.statusCode = 405; response.end('WebSocket upgrade required'); return; }
  const origin = request.headers.origin, expected = requestOrigin(request);
  if (!origin || origin !== expected) { response.statusCode = 403; response.end('Open Brickwild to play.'); return; }
  let arena;
  try { arena = getBridge(); }
  catch { response.statusCode = 503; response.end('Realtime Arena setup is incomplete.'); return; }
  return experimental_upgradeWebSocket(socket => arena.register(socket, origin), {maxPayload: 110_000});
}
