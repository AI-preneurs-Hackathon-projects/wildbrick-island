// Synthetic D1-style contention, not production clients or a D1 service benchmark.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {arenaStore} from '../worker/arena-store.js';
import {addPlayer,applyInput,roomSnapshot} from '../public/arena-core.js';
const rows=[];
for(const storageDelayMs of [0,5])for(const clients of [10,20,40]){
 const sqlite=new DatabaseSync(':memory:');for(const n of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+n,'utf8'));
 let queries=0;const delay=async()=>{queries++;if(storageDelayMs)await new Promise(r=>setTimeout(r,storageDelayMs));else await Promise.resolve();};
 const DB={prepare(sql){return {bind(...args){return {async first(){await delay();return sqlite.prepare(sql).get(...args)||null;},async run(){await delay();return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};}};
 const store=arenaStore(DB),times=[];let errors=0,payload=0;
 await Promise.all(Array.from({length:clients},(_,i)=>store.mutate('LOAD',(r,t)=>addPlayer(r,'p'+i,'Test '+i,t))));
 for(let round=1;round<=5;round++)await Promise.all(Array.from({length:clients},async(_,i)=>{const start=performance.now();try{const {room}=await store.mutate('LOAD',(r,t)=>applyInput(r,'p'+i,{seq:round,input:{z:1,fire:true,cameraYaw:i}},t));payload=Math.max(payload,Buffer.byteLength(JSON.stringify(roomSnapshot(room,'p'+i))));}catch{errors++;}times.push(performance.now()-start);}));
 const r=JSON.parse(sqlite.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').get('LOAD').snapshot);assert.equal(Object.keys(r.players).length,clients);assert.equal(errors,0);times.sort((a,b)=>a-b);
 rows.push({clients,storageDelayMs,requests:times.length,errors,p50Ms:+times[Math.floor(times.length*.5)].toFixed(1),p95Ms:+times[Math.floor(times.length*.95)].toFixed(1),maxSnapshotBytes:payload,queries});sqlite.close();
}
console.log(JSON.stringify({kind:'synthetic SQLite / D1-style per-query delay; no production identity or service used',rows},null,2));
