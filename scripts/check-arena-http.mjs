import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {arenaHttpFixture} from './lib/arena-http-fixture.mjs';
import {createArenaDiagnostics} from '../public/arena-diagnostics.js';
const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const baseline=option('--baseline',null),output=option('--output','/private/tmp/arena-http.json');
const results=[];
for(const version of baseline?['baseline','candidate']:['candidate']){
 const root=version==='baseline'?baseline:path.resolve('.');
 const {createArenaClient}=await import(pathToFileURL(path.join(root,'public/arena-client.js')));
 const core=await import(pathToFileURL(path.join(root,'public/arena-core.js'))),ds=[createArenaDiagnostics(),createArenaDiagnostics()],events=[[],[]];
 const n=await arenaHttpFixture({clientFactory:createArenaClient,core,diagnostics:ds,onEvent:(i,e)=>{if(['swing','shot'].includes(e.type))events[i].push({id:e.id,command:e.commandId,type:e.type});}});
 await n.start();const started=performance.now();let last=started,stage=0;
 try{
  while(performance.now()-started<35000){
   const at=performance.now(),elapsed=at-started;
   if(stage===0&&elapsed>5000){n.fault(0,{loseAfterAccept:true});n.clients[0].command('fire');stage++;}
   if(stage===1&&elapsed>10000){n.fault(1,{responseDelay:13000});stage++;}
   if(stage===2&&elapsed>26000){n.fault(0,{status:503});stage++;}
   const z=Math.floor(elapsed/1000)%2?.4:-.4;await n.step(elapsed%6000<5000?[{z},{z}]:[{},{}],at-last);last=at;await sleep(1000/60);
  }
  assert.ok(n.clients.every(c=>c.connected));assert.ok(n.stats[0].lostResponses===1);assert.ok(n.stats[1].abortedResponses>=1);assert.ok(n.stats[1].lateResponses>=1);
  assert.ok(ds[1].export().requestFailures[2]>=1,'actual fetch timeout observed');
  assert.ok(n.stats.every(s=>s.maxSyncInFlight<=2));assert.ok(ds.every(d=>d.export().metrics.pendingFrames.lifetimeMax<=90));
  assert.ok(Object.keys(n.stats[0].commandEffects).length>0,'explicit fire accepted');for(const s of n.stats)assert.ok(Object.values(s.commandEffects).every(count=>count===1),'one authoritative effect per command ID');
  for(const es of events){assert.equal(new Set(es.map(e=>e.id)).size,es.length,'no duplicate delivered attack');}
  const beforeLeave=n.resources;await n.leave();assert.equal(n.resources.timers,0);assert.equal(n.resources.requests,0);assert.equal(n.resources.players,0);assert.equal(n.resources.sockets,0);assert.ok(ds.every(d=>d.export().inFlight===0));
  results.push({version,wallMs:performance.now()-started,targetActiveMs:35000,stats:n.stats,events,diagnostics:ds.map(d=>d.export()),beforeLeave,afterLeave:n.resources});
  console.log(JSON.stringify({version,stats:n.stats,cleanup:n.resources}));
 }catch(e){await n.leave();throw e;}
}
await fs.writeFile(output,JSON.stringify({scope:'Actual localhost Node HTTP/fetch, two active real clients and authoritative core, 1600 ms target RTT. Response socket destroyed after mutation, separate response delayed beyond 12 s client timeout, and transient503. Node timing is observational; fixed virtual comparison establishes exact tick counts. Not Worker/D1/build reservation/hosted validation.',results},null,2)+'\n');
