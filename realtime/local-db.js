import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {createTursoDb} from '../server/turso-db.js';

export function createLocalRealtimeDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
  }
  const client = {
    async execute({sql, args = []}) {
      const statement = sqlite.prepare(sql), columns = statement.columns().map(column => column.name);
      const rows = columns.length ? statement.all(...args) : [];
      const meta = columns.length ? sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid').get() : statement.run(...args);
      return {columns, rows, rowsAffected: Number(meta.changes), lastInsertRowid: meta.lastInsertRowid};
    },
    async batch(queries, mode) {
      if (mode !== 'write') throw new TypeError('Local Arena batches must be writes');
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const query of queries) results.push(await this.execute(query));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return {db: createTursoDb(client), close: () => sqlite.close(), sqlite};
}
