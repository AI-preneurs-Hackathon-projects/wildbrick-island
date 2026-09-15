import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createTursoDb } from '../server/turso-db.js';
import { arenaStore, hash } from '../worker/arena-store.js';

// Real SQLite semantics behind the libSQL result interface; no remote database.
const sqlite = new DatabaseSync(':memory:');
let executions = 0;
const client = {
  async execute({ sql, args = [] }) {
    executions++;
    const stmt = sqlite.prepare(sql), columns = stmt.columns().map(c => c.name);
    const rows = columns.length ? stmt.all(...args) : [];
    const meta = columns.length ? sqlite.prepare('SELECT changes() AS n, last_insert_rowid() AS id').get() : stmt.run(...args);
    return { columns, rows, rowsAffected: Number(meta.n ?? meta.changes), lastInsertRowid: meta.id ?? meta.lastInsertRowid };
  },
  async batch(queries, mode) {
    assert.equal(mode, 'write');
    sqlite.exec('BEGIN IMMEDIATE');
    try { const results = []; for (const query of queries) results.push(await this.execute(query)); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
};
const db = createTursoDb(client);
try {
  for (const file of ['0000_cultured_mother_askani.sql', '0001_curly_wildside.sql', '0002_robust_silver_samurai.sql']) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  sqlite.exec('CREATE TABLE adapter_test (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)');
  assert.equal((await db.prepare('INSERT INTO adapter_test VALUES (?, ?)').bind(1, 0).run()).meta.changes, 1);
  const before = executions;
  assert.deepEqual(await db.prepare('UPDATE adapter_test SET value = value + 1 WHERE id = ? RETURNING value').bind(1).first(), { value: 1 });
  assert.equal(executions, before + 1, 'RETURNING must execute exactly once');
  assert.equal((await db.prepare('UPDATE adapter_test SET value = 2 WHERE id = 1 AND value = 0').run()).meta.changes, 0, 'failed CAS reports zero');
  assert.equal(await db.prepare('SELECT value FROM adapter_test WHERE id = 2').first(), null);
  assert.equal(await db.prepare('SELECT value FROM adapter_test').first('value'), 1);
  await assert.rejects(db.prepare('SELECT value FROM adapter_test').first('missing'));
  await assert.rejects(db.batch([db.prepare('INSERT INTO adapter_test VALUES (2, 2)'), db.prepare('INSERT INTO adapter_test VALUES (1, 3)')]));
  assert.equal(await db.prepare('SELECT * FROM adapter_test WHERE id = 2').first(), null, 'failed batch rolls back');
  await assert.rejects(db.batch([createTursoDb(client).prepare('SELECT 1')]));
  const bound = db.prepare('SELECT value FROM adapter_test WHERE id = ?');
  assert.equal(await bound.bind(1).first('value'), 1);
  assert.equal(await bound.bind(2).first(), null);

  const store = arenaStore(db);
  const results = await Promise.all([store.mutate('adapter-room', room => { room.adapterCount = (room.adapterCount || 0) + 1; }), store.mutate('adapter-room', room => { room.adapterCount = (room.adapterCount || 0) + 1; })]);
  assert.equal(JSON.parse((await db.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').bind('adapter-room').first()).snapshot).adapterCount, 2, 'concurrent CAS retries preserve both updates');
  assert.equal(results.length, 2);
  const token = 'a'.repeat(64);
  await store.saveSession({ id: 'adapter-session', tokenHash: await hash(token), principal: 'adapter-user', roomId: 'adapter-room', playerId: 'adapter-player' });
  const request = new Request('http://localhost', { headers: { 'oai-authenticated-user-id': 'adapter-user' } });
  assert.equal((await store.session(request, { session: 'adapter-session', token })).id, 'adapter-session');
  await store.reserveBuild('adapter-session');
  await assert.rejects(store.reserveBuild('adapter-session'), error => error.status === 429);
  console.log('Turso adapter: atomic RETURNING, CAS contention, session auth, build reservation, bindings and transactional rollback passed.');
} finally { sqlite.close(); }
