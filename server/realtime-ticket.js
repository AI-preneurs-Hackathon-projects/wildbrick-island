import {createHmac, timingSafeEqual} from 'node:crypto';

export const REALTIME_AUDIENCE = 'brickwild-realtime';
export const REALTIME_TRANSPORT = 'realtime-v1';
const MAX_TICKET_AGE_SECONDS = 60;

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

export function normalizeRoomId(value) {
  const room = String(value || 'ISLAND').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(room)) throw Object.assign(new Error('Use a room code with 4–8 letters or numbers.'), {status: 400});
  return room;
}

export function signRealtimeTicket(claims, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('A 32-character realtime ticket secret is required');
  const payload = encode(claims);
  return `${payload}.${signature(payload, secret)}`;
}

export function createRealtimeTicket({principal, room, create, origin, secret, now = Math.floor(Date.now() / 1000), jti}) {
  const claims = {
    v: 1,
    sub: principal,
    room: normalizeRoomId(room),
    create: create === true,
    origin,
    aud: REALTIME_AUDIENCE,
    transport: REALTIME_TRANSPORT,
    iat: now,
    exp: now + 30,
    jti,
  };
  return {claims, ticket: signRealtimeTicket(claims, secret)};
}

export function verifyRealtimeTicket(ticket, secret, now = Math.floor(Date.now() / 1000)) {
  if (typeof ticket !== 'string' || ticket.length > 2048) throw Object.assign(new Error('Invalid arena admission ticket.'), {status: 401});
  const [payload, supplied, extra] = ticket.split('.');
  if (!payload || !supplied || extra) throw Object.assign(new Error('Invalid arena admission ticket.'), {status: 401});
  const expected = signature(payload, secret);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw Object.assign(new Error('Invalid arena admission ticket.'), {status: 401});
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid arena admission ticket.'), {status: 401}); }
  const valid = claims && !Array.isArray(claims) && claims.v === 1 && claims.aud === REALTIME_AUDIENCE && claims.transport === REALTIME_TRANSPORT
    && typeof claims.sub === 'string' && claims.sub.length >= 3 && claims.sub.length <= 200
    && /^[A-Z0-9]{4,8}$/.test(claims.room || '') && typeof claims.create === 'boolean'
    && typeof claims.origin === 'string' && claims.origin.length <= 256 && /^https?:\/\//.test(claims.origin)
    && Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp) && claims.iat <= now + 5
    && claims.exp > now && claims.exp - claims.iat <= MAX_TICKET_AGE_SECONDS
    && typeof claims.jti === 'string' && /^[a-f0-9-]{36}$/.test(claims.jti);
  if (!valid) throw Object.assign(new Error('Arena admission ticket expired or is invalid.'), {status: 401});
  return claims;
}
