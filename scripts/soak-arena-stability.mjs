// Wall-paced local core soak; --http uses real localhost fetch/AbortSignal.
// No Worker/D1, hardware GPU or production access in either adapter.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {createArenaDiagnostics} from '../public/arena-diagnostics.js';
import {performanceFixture} from './lib/performance-fixture.mjs';
import {arenaHttpFixture} from './lib/arena-http-fixture.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const duration=Number(option('--duration-ms',1800000)),output=option('--output','/private/tmp/arena-stability-soak.json');
assert.ok(Number.isFinite(duration)&&duration>=1000&&duration<=3600000);
const realHttp=args.includes('--http');
const ds=[createArenaDiagnostics({capacity:2048}),createArenaDiagnostics({capacity:2048})],events={},checkpoints=[];
const n=await (realHttp?arenaHttpFixture:performanceFixture)({latency:realHttp?[600,1600]:100,jitter:realHttp?100:0,diagnostics:ds,onEvent:(index,e)=>{if(index===0)events[e.type]=(events[e.type]||0)+1;}});
let started=performance.now(),origin=n.now,second=-1,rejoins=0,lastSample=0,matches=1,failure=null;
try{
await n.start();started=performance.now();origin=n.now;
while(performance.now()-started<duration){
 const elapsed=performance.now()-started,currentSecond=Math.floor(elapsed/1000),phase=currentSecond%30;
 if(currentSecond!==second){
  second=currentSecond;
  if(phase===2)n.clients.forEach(c=>c.command('build','bow'));
  if(phase===24)n.clients.forEach(c=>c.command('exit'));
  if(!realHttp&&second>0&&second%95===0){const leaving=n.clients[1].leave();await n.advance(101);await leaving;await n.join(1);rejoins++;}
  if(realHttp&&second>0&&second%180===0){const cycle=second/180%3;n.fault(cycle===2?1:0,cycle===1?{loseAfterAccept:true}:cycle===2?{responseDelay:13000}:{status:503});}
  if(realHttp&&n.room.match.complete){await Promise.all(n.clients.map(c=>c.leave()));await n.start();rejoins+=2;matches++;}
  if(second%60===0){const checkpoint={utc:new Date().toISOString(),wallMs:elapsed,simulationMs:n.now-origin,round:n.room.round.id,resources:n.resources,heapBytes:process.memoryUsage().heapUsed,diagnostics:ds.map(d=>d.export())};checkpoints.push(checkpoint);console.log(JSON.stringify({utc:checkpoint.utc,elapsedSeconds:second,round:checkpoint.round,timers:checkpoint.resources.timers,players:checkpoint.resources.players,rejoins}));fs.writeFileSync(output,JSON.stringify({running:true,checkpoints},null,2));}
 }
 const z=currentSecond%2?-.4:.4;
 // Joining drains simulated transport time. Wait for the wall clock to catch
 // up instead of counting zero-duration ticks as apparent movement stalls.
 const delta=realHttp?elapsed-lastSample:origin+elapsed-n.now;lastSample=elapsed;
 if(delta>0)await n.step(phase<2?[{},{}]:[{z,fire:phase>=6&&phase<20},{z,fire:phase>=6&&phase<20}],delta);
 assert.ok(n.clients.every(c=>c.connected),'unexpected terminal disconnect');
 assert.ok(n.resources.timers<=(realHttp?20:10),'unexpected timer growth');
 await sleep(16);
}
if(realHttp&&duration>=1800000){assert.ok((events['round-ended']||0)>=3,'natural round ends must be observed');assert.ok((events['round-started']||0)>=2,'natural round starts must be observed');assert.ok(matches>=2&&rejoins>=2,'completed match must exercise explicit fixture rejoin');assert.ok(n.stats.every(s=>s.freshHeldEffects>0&&Object.keys(s.commandEffects).length>0),'both peers must exercise fresh holds and commands');assert.ok(n.stats.some(s=>s.lostResponses>0)&&n.stats.some(s=>s.lateResponses>0),'response loss and late timeout must be exercised');assert.ok(ds.some(d=>d.export().requestFailures[2]>0),'real timeout must be observed');}
}catch(e){failure=e;}
const wallMs=performance.now()-started,beforeLeave=n.resources;
// Always stop both clients and the HTTP listener, including a failed loop gate.
try{await n.leave();
assert.equal(n.resources.timers,0);assert.equal(n.resources.players,0);if(realHttp){assert.equal(n.resources.requests,0);assert.equal(n.resources.sockets,0);assert.ok(n.stats.every(s=>Object.values(s.commandEffects).every(count=>count===1)));}assert.ok(ds.every(d=>d.export().inFlight===0));}catch(e){failure??=e;}
const result={running:false,failed:!!failure,failure:failure?.message||null,scope:realHttp?'Wall-paced real localhost HTTP/fetch, actual clients/core, target RTT600/1600ms with seeded100ms one-way jitter. Fault every180s cycles accepted response loss, timeout and503. Explicitly leaves/joins both clients only after match completion via core-adapter helpers; no production lobby/session claim. Not Worker/D1 or GPU.':'Wall-paced Node clients, 100 ms simulated RTT and in-memory core. Join/leave includes explicit virtual timer draining; no HTTP/store/GPU evidence.',wallMs,rejoins,matches,events,stats:n.stats,beforeLeave,afterLeave:n.resources,diagnostics:ds.map(d=>d.export()),checkpoints};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:!failure,wallMs,rejoins,matches,events,afterLeave:n.resources,output}));

if(failure)throw failure;
