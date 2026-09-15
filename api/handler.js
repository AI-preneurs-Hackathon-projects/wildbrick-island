import {Readable} from 'node:stream';
import {createClient} from '@libsql/client/web';
import {waitUntil} from '@vercel/functions';
import worker from '../worker/index.js';
import {createTursoDb} from '../server/turso-db.js';
import {createVercelHandler} from '../server/vercel-handler.js';

let db;
const handle = createVercelHandler({worker, getDb() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Database configuration missing');
  return db ||= createTursoDb(createClient({url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN}));
}});

export default async function handler(req, res) {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    // Vercel routes this function by Host; do not trust a client forwarded-host override.
    const host = headers.get('host');
    if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host)) { res.statusCode = 400; res.end(); return; }
    const init = {method: req.method, headers};
    if (!['GET', 'HEAD'].includes(req.method)) {
      init.body = req.body === undefined ? Readable.toWeb(req) : (Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      init.duplex = 'half';
    }
    const routed = new URL(req.url, `https://${host}`);
    if (routed.pathname === '/api/handler') {
      const route = routed.searchParams.get('route') || '';
      routed.pathname = '/api/' + route;
      routed.searchParams.delete('route');
    }
    const response = await handle(new Request(routed, init), {waitUntil});
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({error: 'Arena service is temporarily unavailable.', code: 'unavailable'}));
  }
}
