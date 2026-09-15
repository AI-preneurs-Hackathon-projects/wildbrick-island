// Adapt the D1 subset used by the Workers without rewriting their atomic SQL.
// In particular, UPDATE ... RETURNING executes once, and CAS uses rowsAffected.
export function createTursoDb(client) {
  if (!client || typeof client.execute !== 'function') throw new TypeError('A libSQL client is required');
  const statements = new WeakMap();
  const normalize = result => ({
    success: true,
    results: result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]]))),
    meta: { changes: Number(result.rowsAffected), last_row_id: result.lastInsertRowid == null ? null : String(result.lastInsertRowid) }
  });
  function prepare(sql, args = []) {
    if (typeof sql !== 'string' || !sql.trim()) throw new TypeError('SQL is required');
    const statement = {
      bind(...values) { return prepare(sql, values); },
      async first(column) {
        const result = normalize(await client.execute({ sql, args }));
        const row = result.results[0];
        if (!row) return null;
        if (column === undefined) return row;
        if (!Object.hasOwn(row, column)) throw new Error('Requested SQL result column does not exist');
        return row[column];
      },
      async run() { return normalize(await client.execute({ sql, args })); },
      async all() { return normalize(await client.execute({ sql, args })); }
    };
    statements.set(statement, { sql, args });
    return statement;
  }
  return {
    prepare,
    async batch(batch) {
      if (!Array.isArray(batch)) throw new TypeError('Expected prepared statements');
      const queries = batch.map(statement => {
        const query = statements.get(statement);
        if (!query) throw new TypeError('Batch statements must belong to this database');
        return query;
      });
      // libSQL write batches are transactional; never emulate with Promise.all.
      return (await client.batch(queries, 'write')).map(normalize);
    }
  };
}
