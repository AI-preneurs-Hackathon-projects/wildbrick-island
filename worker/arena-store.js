import {newRoom,advanceRoom} from '../public/arena-core.js';
export class ArenaError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export const nonce=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export function arenaStore(db){if(!db)throw new ArenaError('The shared arena is unavailable. You can still explore the island.',503);
 return {
  async mutate(roomId,fn){for(let attempt=0;attempt<8;attempt++){
   let row=await db.prepare('SELECT revision, snapshot, updated_at FROM arena_rooms WHERE id = ?').bind(roomId).first();const now=Math.max(Date.now(),row?JSON.parse(row.snapshot).time:0);
   if(!row){const initial=newRoom(now,crypto.randomUUID());await db.prepare('INSERT INTO arena_rooms (id, revision, snapshot, updated_at) VALUES (?, 0, ?, ?) ON CONFLICT(id) DO NOTHING').bind(roomId,JSON.stringify(initial),now).run();continue;}
   let room=JSON.parse(row.snapshot);if(now-row.updated_at>15*60000)room=newRoom(now,crypto.randomUUID());advanceRoom(room,now);const result=await fn(room,now);room.revision=row.revision+1;
   const written=await db.prepare('UPDATE arena_rooms SET snapshot = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(room),now,roomId,row.revision).run();
   if(written.meta.changes===1)return {room,result};
  }throw new ArenaError('The arena is busy. Reconnecting…',409);},
  async session(request,packet){const principal=request.headers.get('oai-authenticated-user-id');if(!principal)throw new ArenaError('Sign in with ChatGPT to join the arena.',401);
   if(typeof packet.session!=='string'||packet.session.length>64||typeof packet.token!=='string'||packet.token.length!==64)throw new ArenaError('Join the arena first.',401);
   const s=await db.prepare('SELECT * FROM arena_sessions WHERE id = ?').bind(packet.session).first();const now=Date.now();if(!s||s.principal!==principal||s.expires_at<now||s.token_hash!==await hash(packet.token))throw new ArenaError('Your session expired. Join the arena again.',401);
   const allowed=await db.prepare('UPDATE arena_sessions SET rate_count = CASE WHEN rate_start < ? THEN 1 ELSE rate_count + 1 END, rate_start = CASE WHEN rate_start < ? THEN ? ELSE rate_start END, expires_at = ? WHERE id = ? AND (rate_start < ? OR rate_count < 100) RETURNING id').bind(now-10000,now-10000,now,now+90000,s.id,now-10000).first();if(!allowed)throw new ArenaError('Too many updates. Wait a moment.',429);return s;
  },
  async saveSession(s){const now=Date.now(),r=await db.prepare('INSERT INTO arena_sessions (id, token_hash, principal, room_id, player_id, expires_at, rate_start, rate_count) SELECT ?, ?, ?, ?, ?, ?, ?, 0 WHERE (SELECT COUNT(*) FROM arena_sessions WHERE principal = ? AND expires_at > ?) < 12').bind(s.id,s.tokenHash,s.principal,s.roomId,s.playerId,now+90000,now,s.principal,now).run();if(r.meta.changes!==1)throw new ArenaError('Close an older arena session before joining again.',429);},
  async reserveBuild(id){const now=Date.now(),r=await db.prepare('UPDATE arena_sessions SET build_at = ? WHERE id = ? AND build_at <= ? RETURNING id').bind(now,id,now-9500).first();if(!r)throw new ArenaError('Wait a moment before uploading another creation.',429);},
  async saveBlueprint(b){const text=JSON.stringify(b),id=await hash(text);await db.prepare('INSERT INTO arena_creations (id, blueprint, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,text,Date.now()).run();return id;},
  async blueprint(id){const row=await db.prepare('SELECT blueprint FROM arena_creations WHERE id = ?').bind(id).first();return row?JSON.parse(row.blueprint):null;},
  async cleanup(){await db.prepare('DELETE FROM arena_sessions WHERE expires_at < ?').bind(Date.now()-60000).run();}
 };
}
