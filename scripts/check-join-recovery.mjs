import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {arenaStore} from '../worker/arena-store.js';
import {handleArenaAPI} from '../worker/arena-api.js';
import {createArenaClient} from '../public/arena-client.js';
const sqlite=new DatabaseSync(':memory:');for(const name of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
const DB={prepare(sql){return {bind(...args){return {async first(){await Promise.resolve();return sqlite.prepare(sql).get(...args)||null;},async run(){await Promise.resolve();const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
const api=(path,body,user='recovery')=>handleArenaAPI(new Request('https://brickwild.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://brickwild.test','oai-authenticated-user-id':user},body:JSON.stringify(body)}),{DB});
const ticket=()=>({session:crypto.randomUUID(),token:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')});
const count=room=>Object.keys(JSON.parse(sqlite.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').get(room).snapshot).players).length;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);};
await check('a stranded request cannot hold subsequent room joins behind its promise',async()=>{
 let first=true;const stuckDB={prepare(sql){const stmt=DB.prepare(sql);return {bind(...args){const bound=stmt.bind(...args);return {...bound,first(){if(first&&sql.startsWith('SELECT revision')){first=false;return new Promise(()=>{});}return bound.first();}};}};}};
 const store=arenaStore(stuckDB);void store.mutate('HANG',()=>{});await Promise.resolve();
 let timeout;try{const result=await Promise.race([store.mutate('HANG',r=>{r.seed=42;}),new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Later request stranded')),200))]);assert.equal(result.room.seed,42);}finally{clearTimeout(timeout);}
});
await check('concurrent retries and a lost join response reuse one authenticated seat',async()=>{
 const resume=ticket(),body={resume,room:'RETRY',name:'Retry',create:true,motionVersion:1};const responses=await Promise.all([api('/api/arena/join',body),api('/api/arena/join',body)]);assert.ok(responses.every(r=>r.status===200));const [a,b]=await Promise.all(responses.map(r=>r.json()));assert.equal(a.session,b.session);assert.equal(a.snapshot.self,b.snapshot.self);assert.equal(count('RETRY'),1);
 const again=await (await api('/api/arena/join',body)).json();assert.equal(again.snapshot.self,a.snapshot.self);assert.equal(count('RETRY'),1);
 assert.equal((await api('/api/arena/join',body,'someone-else')).status,409);assert.equal((await api('/api/arena/join',{...body,resume:{...resume,token:'a'.repeat(64)}})).status,409);
 // Recover an expired seat/session with proof of the original random token.
 sqlite.prepare('UPDATE arena_sessions SET expires_at = 0 WHERE id = ?').run(resume.session);await arenaStore(DB).mutate('RETRY',r=>{delete r.players[a.snapshot.self];});
 assert.equal((await api('/api/arena/join',body)).status,200);assert.equal(count('RETRY'),1);
 assert.equal((await api('/api/arena/leave',resume)).status,200);assert.equal(count('RETRY'),0);
});
await check('leaving during a pending room join prevents a late seat from reappearing',async()=>{
 const resume=ticket();let release,blocked=false;const delayedDB={prepare(sql){const stmt=DB.prepare(sql);return {bind(...args){const bound=stmt.bind(...args);return {...bound,async first(){if(!blocked&&sql.startsWith('SELECT revision')){blocked=true;await new Promise(resolve=>release=resolve);}return bound.first();}};}};}};
 const req=new Request('https://brickwild.test/api/arena/join',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://brickwild.test','oai-authenticated-user-id':'recovery'},body:JSON.stringify({resume,room:'RACE',name:'Canceled',create:true})});
 const pending=handleArenaAPI(req,{DB:delayedDB});for(let i=0;i<100&&!release;i++)await new Promise(r=>setImmediate(r));assert.ok(release);
 assert.equal((await api('/api/arena/leave',resume)).status,200);release();assert.equal((await pending).status,410);assert.equal(count('RACE'),0);
});
function clientHarness(room){const timers=new Map(),requests=[],errors=[];let next=0,mode='ok',release=null,joinAttempts=0;
 const client=createArenaClient({onError:m=>errors.push(m)},{setTimer(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async(path,opts)=>{const body=JSON.parse(opts.body||'{}');requests.push({path,body});const response=await api(path,body);if(path.endsWith('/join')&&mode==='timeout'){mode='ok';return new Promise((resolve,reject)=>{release=()=>resolve(response);opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true});});}if(path.endsWith('/join')&&mode==='delay'){mode='ok';return new Promise(resolve=>release=()=>resolve(response));}return response;}});
 return {client,requests,errors,timers,setMode:m=>mode=m,release:()=>release?.(),get ready(){return !!release;},join:()=>client.join('Tester',room,undefined,joinAttempts++===0)};
}
const flush=async()=>{for(let i=0;i<100;i++)await new Promise(r=>setImmediate(r));};
await check('client timeout shows a retryable message and retry preserves one player',async()=>{const n=clientHarness('TIME');n.setMode('timeout');const failed=n.join();await flush();assert.ok(n.ready);[...n.timers.values()].find(t=>t.ms===12000).fn();assert.equal(await failed,false);assert.equal(n.client.connected,false);assert.match(n.errors[0],/timed out.*try Join Arena/i);assert.doesNotMatch(n.errors[0],/signal is aborted/i);assert.equal(count('TIME'),1);assert.equal(await n.join(),true);assert.deepEqual(n.requests.filter(r=>r.path.endsWith('/join')).map(r=>r.body.resume)[0],n.requests.filter(r=>r.path.endsWith('/join'))[1].body.resume);assert.equal(count('TIME'),1);const id=n.client.snapshot.self;assert.equal(await n.join(),true);assert.equal(n.client.snapshot.self,id);assert.equal(n.requests.filter(r=>r.path.endsWith('/leave')).length,0);await n.client.leave();assert.equal(count('TIME'),0);});
await check('canceling a late join does not strand a new attempt or remove its player',async()=>{const n=clientHarness('CANCEL');n.setMode('delay');const old=n.join();await flush();assert.ok(n.ready);await n.client.leave();const fresh=n.join();assert.equal(await fresh,true);n.release();assert.equal(await old,false);await flush();assert.equal(n.client.connected,true);assert.equal(count('CANCEL'),1);await n.client.leave();assert.equal(count('CANCEL'),0);});
sqlite.close();
