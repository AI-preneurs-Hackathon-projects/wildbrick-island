import {createNodeHandler} from '../server/node-handler.js';
import {createClient} from '@libsql/client/web';
import {waitUntil} from '@vercel/functions';
import worker from '../worker/index.js';
import {createTursoDb} from '../server/turso-db.js';
import {createVercelHandler} from '../server/vercel-handler.js';
import {createGatewayWorker} from '../server/ai-gateway.js';

let db;
const handle = createVercelHandler({worker: createGatewayWorker(worker), getDb() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Database configuration missing');
  return db ||= createTursoDb(createClient({url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN}));
}});

export default createNodeHandler(handle, {waitUntil});
