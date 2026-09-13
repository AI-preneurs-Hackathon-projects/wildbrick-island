// Durable admission across Worker isolates. Slots expire after upstream timeout;
// completed rows remain for the one-minute global/requester request budget.
export async function reserveGeneration(db,principal){
 if(!db)return async()=>{}; // Dependency-injected unit tests / generation-only dev.
 const now=Date.now(),id=crypto.randomUUID();
 await db.prepare('DELETE FROM generation_requests WHERE started_at < ? AND expires_at < ?').bind(now-60000,now).run();
 const result=await db.prepare(`INSERT INTO generation_requests (id, principal, started_at, expires_at)
 SELECT ?, ?, ?, ? WHERE
 (SELECT COUNT(*) FROM generation_requests WHERE expires_at > ?) < 4 AND
 (SELECT COUNT(*) FROM generation_requests WHERE started_at > ?) < 30 AND
 (SELECT COUNT(*) FROM generation_requests WHERE principal = ? AND started_at > ?) < 8`).bind(id,principal,now,now+95000,now,now-60000,principal,now-60000).run();
 if(result.meta.changes!==1)return null;
 return async()=>{await db.prepare('UPDATE generation_requests SET expires_at = 0 WHERE id = ?').bind(id).run();};
}
