// Wall-paced local core soak. No real HTTP, DB, renderer or production access.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {createArenaDiagnostics} from '../public/arena-diagnostics.js';
import {performanceFixture} from './lib/performance-fixture.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const duration=Number(option('--duration-ms',1800000)),output=option('--output','/private/tmp/arena-stability-soak.json');
assert.ok(Number.isFinite(duration)&&duration>=1000&&duration<=3600000);
const ds=[createArenaDiagnostics({capacity:2048}),createArenaDiagnostics({capacity:2048})],events={},checkpoints=[];
const n=performanceFixture({latency:100,diagnostics:ds,onEvent:(index,e)=>{if(index===0)events[e.type]=(events[e.type]||0)+1;}});await n.start();
const started=performance.now(),origin=n.now;let second=-1,rejoins=0;
while(performance.now()-started<duration){
 const elapsed=performance.now()-started,currentSecond=Math.floor(elapsed/1000),phase=currentSecond%30;
 if(currentSecond!==second){
  second=currentSecond;
  if(phase===2)n.clients.forEach(c=>c.command('build','bow'));
  if(phase===24)n.clients.forEach(c=>c.command('exit'));
  if(second>0&&second%95===0){const leaving=n.clients[1].leave();await n.advance(101);await leaving;await n.join(1);rejoins++;}
  if(second%60===0){const checkpoint={utc:new Date().toISOString(),wallMs:elapsed,simulationMs:n.now-origin,round:n.room.round.id,resources:n.resources,heapBytes:process.memoryUsage().heapUsed,diagnostics:ds.map(d=>d.export())};checkpoints.push(checkpoint);console.log(JSON.stringify({utc:checkpoint.utc,elapsedSeconds:second,round:checkpoint.round,timers:checkpoint.resources.timers,players:checkpoint.resources.players,rejoins}));fs.writeFileSync(output,JSON.stringify({running:true,checkpoints},null,2));}
 }
 const z=currentSecond%2?-.4:.4;
 // Joining drains simulated transport time. Wait for the wall clock to catch
 // up instead of counting zero-duration ticks as apparent movement stalls.
 const delta=origin+elapsed-n.now;
 if(delta>0)await n.step(phase<2?[{},{}]:[{z,fire:phase>=6&&phase<20},{z,fire:phase>=6&&phase<20}],delta);
 assert.ok(n.clients.every(c=>c.connected),'unexpected terminal disconnect');
 assert.ok(n.resources.timers<=10,'unexpected timer growth');
 await sleep(16);
}
const wallMs=performance.now()-started,beforeLeave=n.resources;await n.leave();
assert.equal(n.resources.timers,0);assert.equal(n.resources.players,0);assert.ok(ds.every(d=>d.export().inFlight===0));
const result={running:false,scope:'Wall-paced Node clients, 100 ms simulated RTT and in-memory core. Join/leave includes explicit virtual timer draining; no HTTP/store/GPU evidence.',wallMs,rejoins,events,stats:n.stats,beforeLeave,afterLeave:n.resources,diagnostics:ds.map(d=>d.export()),checkpoints};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,wallMs,rejoins,events,afterLeave:n.resources,output}));
