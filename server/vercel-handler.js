import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
import {createRealtimeTicket, normalizeRoomId} from './realtime-ticket.js';

const COOKIE = '__Host-brickwild-guest';
const MAX_AGE = 60 * 60 * 24 * 30;
const reply = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
const signature = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

async function ticketRequest(request, principal, env, now, uuid, getDb) {
  if (!request.headers.get('content-type')?.includes('application/json')) return reply({error: 'Use a game action.'}, 415);
  if (Number(request.headers.get('content-length')) > 1024) return reply({error: 'That arena request is too large.'}, 413);
  let packet;
  try {
    const text = await request.text();
    if (text.length > 1024) return reply({error: 'That arena request is too large.'}, 413);
    packet = JSON.parse(text);
  } catch { return reply({error: 'The arena request was not valid.'}, 400); }
  if (!packet || Array.isArray(packet) || typeof packet !== 'object' || Object.keys(packet).some(key => !['room', 'create'].includes(key)) || typeof packet.create !== 'boolean') {
    return reply({error: 'Choose whether to create or join an arena.'}, 400);
  }
  let room;
  try { room = normalizeRoomId(packet.room); }
  catch (error) { return reply({error: error.message}, error.status || 400); }
  let transport = env.ENABLE_REALTIME_ARENA === 'true' ? 'realtime-v1' : 'http-v1';
  try {
    const db = await getDb();
    const row = await db.prepare('SELECT transport, updated_at, lease_until FROM arena_rooms WHERE id = ?').bind(room).first();
    const current = now * 1000;
    if (row && (row.updated_at >= current - 15 * 60_000 || row.lease_until >= current)) transport = row.transport;
  } catch { return reply({error: 'Arena transport discovery is temporarily unavailable.', code: 'unavailable'}, 503); }
  if (transport === 'http-v1') return reply({enabled: false, transport});
  if (transport !== 'realtime-v1') return reply({error: 'This Arena transport is not supported.', code: 'transport'}, 409);
  if (typeof env.REALTIME_TICKET_SECRET !== 'string' || env.REALTIME_TICKET_SECRET.length < 32 || typeof env.REALTIME_ARENA_URL !== 'string') {
    return reply({error: 'Realtime Arena setup is incomplete.', code: 'not_configured'}, 503);
  }
  let endpoint;
  try {
    endpoint = new URL(env.REALTIME_ARENA_URL);
    if (!['wss:', 'ws:'].includes(endpoint.protocol) || (endpoint.protocol === 'ws:' && !['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname))) throw new Error();
  } catch { return reply({error: 'Realtime Arena setup is incomplete.', code: 'not_configured'}, 503); }
  const {ticket} = createRealtimeTicket({principal: `vercel-guest:${principal}`, room, create: packet.create, origin: new URL(request.url).origin, secret: env.REALTIME_TICKET_SECRET, now, jti: uuid()});
  return reply({enabled: true, transport: 'realtime-v1', url: endpoint.toString(), ticket});
}

function guestFromCookie(header, secret, now) {
  const values = (header || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(COOKIE.length + 1);
  if (token.length > 200) return null;
  const [id, expires, sig, extra] = token.split('.');
  if (extra || !/^[a-f0-9-]{36}$/.test(id || '') || !/^\d{10}$/.test(expires || '') || !sig) return null;
  const expiry = Number(expires);
  if (expiry <= now || expiry > now + MAX_AGE) return null;
  const expected = signature(`${id}.${expires}`, secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

/** Hosting boundary: only this adapter may assert the worker's trusted identity. */
export function createVercelHandler({worker, getDb, env = process.env, now = () => Math.floor(Date.now() / 1000), uuid = randomUUID}) {
  return async function handle(request, ctx = {}) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return reply({error: 'Not found.'}, 404);
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      if ((origin && origin !== url.origin) || (site && !['same-origin', 'none'].includes(site))) return reply({error: 'Open Brickwild to play.'}, 403);
    }
    if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) return reply({error: 'Arena setup is incomplete.', code: 'not_configured'}, 503);
    const time = now();
    let principal = guestFromCookie(request.headers.get('cookie'), env.SESSION_SECRET, time);
    let cookie;
    if (!principal) {
      principal = uuid();
      const value = `${principal}.${time + MAX_AGE}`;
      cookie = `${COOKIE}=${value}.${signature(value, env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
    }
    const finish = response => {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      if (cookie) headers.append('Set-Cookie', cookie);
      return new Response(response.body, {status: response.status, headers});
    };
    if (url.pathname === '/api/arena/realtime-ticket') {
      if (request.method !== 'POST') return finish(reply({error: 'Use an arena action.'}, 405));
      return finish(await ticketRequest(request, principal, env, time, uuid, getDb));
    }
    const transcription = ['/api/transcription-status', '/api/transcribe'].includes(url.pathname);
    const generation = ['/api/generate', '/api/generation-status'].includes(url.pathname);
    if (transcription && env.ENABLE_PUBLIC_TRANSCRIPTION !== 'true') {
      return finish(url.pathname.endsWith('-status') ? reply({configured: false}) : reply({error: 'Recorded voice is not enabled on this host.', code: 'not_configured'}, 503));
    }
    if (generation && env.ENABLE_PUBLIC_GENERATION !== 'true') return finish(url.pathname.endsWith('-status') ? reply({configured: false}) : reply({error: 'New AI designs are not enabled on this host. Saved creations remain available.', code: 'not_configured'}, 503));
    const headers = new Headers(request.headers);
    for (const name of [...headers.keys()]) if (name.startsWith('cf-') || name.startsWith('oai-')) headers.delete(name);
    headers.set('oai-authenticated-user-id', `vercel-guest:${principal}`);
    // Give existing per-client admission a trusted identifier, never a forwarded IP.
    headers.set('cf-connecting-ip', `vercel-guest:${principal}`);
    try {
      const db = await getDb();
      const forwarded = new Request(request, {headers});
      return finish(await worker.fetch(forwarded, {...env, DB: db}, {waitUntil: ctx.waitUntil || (() => {})}));
    } catch {
      return finish(reply({error: 'Arena service is temporarily unavailable. Please try again.', code: 'unavailable'}, 503));
    }
  };
}
