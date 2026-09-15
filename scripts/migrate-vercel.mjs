import {createClient} from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Database configuration required');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try {
 await client.execute('CREATE TABLE IF NOT EXISTS vercel_schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
 const dir=path.resolve(import.meta.dirname,'../drizzle');
 for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()) {
  const tx=await client.transaction('write');
  try {
   const existing=await tx.execute({sql:'SELECT name FROM vercel_schema_migrations WHERE name = ?',args:[name]});
   if(!existing.rows.length) {
    const sql=fs.readFileSync(path.join(dir,name),'utf8');
    await tx.executeMultiple(sql);
    await tx.execute({sql:'INSERT INTO vercel_schema_migrations (name,applied_at) VALUES (?,?)',args:[name,Date.now()]});
   }
   await tx.commit();
   console.log('Schema ready:',name);
  } catch(e) {await tx.rollback();throw e;} finally {tx.close();}
 }
} finally {client.close();}
