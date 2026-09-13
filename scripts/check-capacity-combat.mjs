// Synthetic concurrency and actual simulation CPU work. No live identities or D1.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {arenaStore} from '../worker/arena-store.js';
import {newRoom,addPlayer,advanceRoom,makeKit,roomSnapshot} from '../public/arena-core.js';
const rows=[],cpu=[];
for(const clients of [10,20,40,80]){
 const db=new DatabaseSync(':memory:');for(const n of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+n,'utf8'));
 let queries=0,conflicts=0;
 function adapter(){return {prepare(sql){return {bind(...args){return {
  async first(){queries++;await new Promise(r=>setTimeout(r,5));return db.prepare(sql).get(...args)||null;},
  async run(){queries++;await new Promise(r=>setTimeout(r,5));const changes=Number(db.prepare(sql).run(...args).changes);if(sql.startsWith('UPDATE arena_rooms')&&!changes)conflicts++;return {meta:{changes}};}
 };}};}};}
 // Four independent queue identities exercise CAS, rather than a single queue.
 const stores=Array.from({length:4},()=>arenaStore(adapter()));
 await stores[0].mutate('LOAD',(r,t)=>{for(let i=0;i<clients;i++)addPlayer(r,'p'+i,'Load '+i,t);});
 const latencies=[];let errors=0;
 for(let round=0;round<4;round++)await Promise.all(Array.from({length:clients},async(_,i)=>{const at=performance.now();try{await stores[i%4].mutate('LOAD',(r,t)=>{r.players['p'+i].lastSeen=t;r.players['p'+i].lastSeq++;});}catch(e){assert.equal(e.status,409);errors++;}latencies.push(performance.now()-at);}));
 const room=JSON.parse(db.prepare('SELECT snapshot FROM arena_rooms WHERE id=?').get('LOAD').snapshot),acks=Object.values(room.players).reduce((n,p)=>n+p.lastSeq,0);assert.equal(acks,clients*4-errors,'CAS must neither lose nor duplicate successful updates');
 latencies.sort((a,b)=>a-b);rows.push({clients,isolates:4,storageDelayMs:5,requests:clients*4,errors,conflicts,queries,p95Ms:+latencies[Math.floor(latencies.length*.95)].toFixed(1),maxMs:+latencies.at(-1).toFixed(1)});db.close();
}
const blueprint=JSON.parse(fs.readFileSync('validation/live/arena-dragon.json')).blueprint;
for(const clients of [10,20,40,80]){
 const r=newRoom(100000),times=[];let peakProjectiles=0,peakEvents=0,oldestEventMs=5000,maxSnapshotBytes=0,maxDeltaSnapshotBytes=0,cursor=0;
 for(let i=0;i<clients;i++){const p=addPlayer(r,'p'+i,'Load '+i);p.kit=makeKit('load',blueprint);p.mountHealth=p.kit.stats.mountMax;const a=i/clients*Math.PI*2;Object.assign(p,{x:Math.sin(a)*40,z:Math.cos(a)*40,y:14,yaw:a,protectedUntil:0});}
 for(let tick=0;tick<300;tick++){
  for(const p of Object.values(r.players)){p.lastSeen=r.time;p.inputAt=r.time;p.input={fire:true,cameraYaw:p.yaw};}
  const at=performance.now();advanceRoom(r,r.time+1000/30);times.push(performance.now()-at);
  peakProjectiles=Math.max(peakProjectiles,r.projectiles.length);peakEvents=Math.max(peakEvents,r.events.length);
  if(tick>150)oldestEventMs=Math.min(oldestEventMs,r.time-r.events[0].time);
  if(tick%4===0){maxDeltaSnapshotBytes=Math.max(maxDeltaSnapshotBytes,Buffer.byteLength(JSON.stringify(roomSnapshot(r,'p0',cursor))));cursor=r.eventId;}
  if(tick%15===0)maxSnapshotBytes=Math.max(maxSnapshotBytes,Buffer.byteLength(JSON.stringify(roomSnapshot(r,'p0'))));
 }
 assert.equal(Object.keys(r.players).length,clients);assert.ok(r.eventId>clients*50,'clients actually attacked');assert.equal(r.events.filter(e=>e.type==='notice').length,0,'normal fire must not hit resource limits');
 times.sort((a,b)=>a-b);cpu.push({clients,simulationSeconds:10,frames:300,p95TickMs:+times[285].toFixed(2),maxTickMs:+times.at(-1).toFixed(2),peakProjectiles,peakEvents,minRetainedEventMs:Math.round(oldestEventMs),maxSnapshotBytes,maxDeltaSnapshotBytes,estimatedDeltaFanoutMbpsAt8Hz:+(maxDeltaSnapshotBytes*clients*8*8/1e6).toFixed(2),estimatedFanoutMbpsAt8Hz:+(maxSnapshotBytes*clients*8*8/1e6).toFixed(2)});
}
console.log(JSON.stringify({kind:'Synthetic SQLite with four CAS contenders; CPU-only flame stress, no real D1, network, WebGL or signed-in clients',contention:rows,combat:cpu},null,2));
