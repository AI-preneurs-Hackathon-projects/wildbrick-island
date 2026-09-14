import assert from 'node:assert/strict';
import {performanceFixture} from './lib/performance-fixture.mjs';
import * as core from '../public/arena-core.js';
import {canFit,movementShape} from '../public/movement-blocking.js';
import {runScenario,scenarios,assessComparison} from './compare-arena-movement.mjs';

let count=0;async function check(name,fn){await fn();count++;console.log('PASS '+name);}
await check('accepted mutation survives response loss; client aborts and retries without duplicate movement',async()=>{
 const n=performanceFixture({measureClient:true,latency:100});await n.start();n.fault(0,{lostResponse:true});for(let i=0;i<900;i++)await n.step([{z:i%120<60?.3:-.3},{}]);assert.equal(n.stats[0].lostResponses,1);assert.equal(n.stats[0].aborted,1);assert.ok(n.stats[0].mutations>1);assert.ok(n.clients[0].connected);assert.ok(n.stats[0].pendingMax<=90);assert.equal(n.stats[0].movementReplayErrorM,0);await n.leave();assert.equal(n.resources.timers,0);
});
await check('a lost accepted fire response produces exactly one authoritative effect per command ID',async()=>{
 const n=performanceFixture({measureClient:true,latency:100,setupPlayer:(i,p)=>Object.assign(p,{kit:core.makeKit('bow'),x:i?24:-24})});await n.start();n.fault(0,{lostResponse:true});await n.step([{z:.3,fire:true},{}]);for(let i=0;i<900;i++)await n.step([{z:i%120<60?.3:-.3},{}]);assert.equal(n.stats[0].authoritativeCommandShots,1);assert.equal(n.stats[0].authoritativeDuplicateCommandShots,0);assert.equal(n.stats[0].commandShots,1);assert.equal(n.stats[0].duplicateCommandShots,0);assert.equal(n.stats[0].commandAck,1);assert.equal(n.stats[0].commandOverlap,0);await n.leave();assert.equal(n.resources.timers,0);
});
await check('abort before simulated delivery prevents acceptance; abort after acceptance does not undo mutation',async()=>{
 const n=performanceFixture({measureClient:true,latency:100});await n.start();const prior=n.stats[0].mutations;n.fault(0,{requestDelay:14000});await n.advance(12500);assert.equal(n.stats[0].mutations,prior);assert.equal(n.stats[0].aborted,1);await n.advance(16000);assert.ok(n.stats[0].mutations>prior);await n.leave();assert.equal(n.resources.timers,0);
});
for(const name of ['terminal-401','terminal-410','round-transition','leave-pending','uplink-outage-expiry'])await check(name,async()=>{await runScenario(scenarios.find(s=>s.name===name),{core});});
await check('deliberate leave and rejoin rejects old pending responses and resets the movement stream',async()=>{
 const n=performanceFixture({measureClient:true,latency:1600});await n.start();for(let i=0;i<200;i++)await n.step([{z:i%120<60?.3:-.3},{}]);const old=n.clients[0].snapshot.self;await n.settle(n.clients[0].leave());await n.join(0);assert.notEqual(n.clients[0].snapshot.self,old);for(let i=0;i<120;i++)await n.step([{z:.3},{}]);assert.equal(n.clients[0].connected,true);assert.equal(n.room.players[old],undefined);assert.ok(n.stats[0].pendingMax<=90);assert.equal(n.stats[0].commandOverlap,0);await n.leave();assert.equal(n.resources.players,0);assert.equal(n.resources.timers,0);
});
await check('bounded overlap removes at least 20 percent of the frozen 1600ms held stops for both peers',async()=>{
 const result=await runScenario(scenarios.find(s=>s.name==='hold-1600'));for(const s of result.peers){assert.ok(s.zeroMovement<=Math.floor(369*.8),'must improve frozen 369-stop baseline by at least 20 percent');assert.equal(s.pendingMax,90);assert.equal(s.maxSyncInFlight,2);assert.equal(s.releaseOvershootM,0);}
 const unchanged=assessComparison({rows:[{scenario:'hold-1600',baseline:result,candidate:structuredClone(result)}]});assert.equal(unchanged.passed,false);assert.equal(unchanged.failures.length,2);assert.ok(unchanged.failures.every(f=>f.includes('<20% stop reduction')));
});
await check('delayed overlapping movement respects a real authoritative blocker and accepted release',async()=>{
 const n=performanceFixture({measureClient:true,latency:[600,1600],setupPlayer:(i,p,room)=>{Object.assign(p,{x:i?6:0,z:10,y:0});room.placed=[{id:'local-wall',x:3,y:3,z:14,w:16,h:6,d:1,hp:1000}];}});await n.start();
 for(let i=0;i<600;i++){await n.step([{z:1},{z:1}]);for(const c of n.clients){const p=n.room.players[c.snapshot.self];for(const pose of [p,c.self]){assert.ok(canFit(pose,movementShape(pose.kit.stats),core.movementBoxes(n.room)),'no collision penetration');assert.ok(pose.z<13.5,'must remain before the wall');}}}
 const release=n.clients.map(c=>({x:c.self.x,y:c.self.y,z:c.self.z}));
 for(let i=0;i<360;i++){await n.step([{},{}]);for(let j=0;j<2;j++)assert.deepEqual({x:n.clients[j].self.x,y:n.clients[j].self.y,z:n.clients[j].self.z},release[j],'released display must not drift');}
 for(let j=0;j<2;j++){const p=n.room.players[n.clients[j].snapshot.self];assert.deepEqual({x:p.x,y:p.y,z:p.z},release[j]);assert.equal(n.stats[j].movementReplayErrorM,0);assert.ok(n.stats[j].pendingMax<=90);}
 // Collision stops are deliberate and never included in the performance table.
 await n.leave();assert.equal(n.resources.timers,0);assert.equal(n.resources.players,0);
});
await check('an old ACK arriving after newer overlap cannot roll back motion or duplicate a command',async()=>{
 const revisions=[-1,-1],n=performanceFixture({measureClient:true,latency:1600,onOutcome:e=>{assert.ok(e.revision>=revisions[e.index]);revisions[e.index]=e.revision;}});await n.start();
 for(let i=0;i<360;i++)await n.step([{z:i%120<60?.3:-.3},{}]);n.fault(0,{responseDelay:4000});
 for(let i=0;i<600;i++){if(i===120)n.clients[0].command('build','bow');await n.step([{z:i%120<60?.3:-.3},{}]);}
 assert.ok(n.stats[0].oldACKs>0,'must actually deliver an out-of-order ACK after warmed overlap');assert.equal(n.clients[0].self.kit.id,'bow');assert.equal(n.stats[0].commandOverlap,0);assert.equal(n.stats[0].movementReplayErrorM,0);assert.ok(n.stats[0].pendingMax<=90);assert.equal(n.stats[0].maxSyncInFlight,2);await n.leave();assert.equal(n.resources.timers,0);
});
await check('a sibling success cannot bypass shared429 retry backoff',async()=>{
 const packets=[],n=performanceFixture({measureClient:true,latency:1600,onPacket:p=>{if(p.index===0&&p.kind==='sync')packets.push(p.at);}});await n.start();
 for(let i=0;i<360;i++)await n.step([{z:i%120<60?.3:-.3},{}]);const first=packets.length;n.fault(0,{status:429});
 for(let i=0;i<480;i++)await n.step([{z:i%120<60?.3:-.3},{}]);const rejectedAt=packets[first]+1600;
 assert.ok(packets.slice(first+1).every(at=>at<rejectedAt||at>=rejectedAt+1500),'no new send during429 backoff despite sibling success');assert.ok(packets.some(at=>at>=rejectedAt+1500),'must resume after the bounded backoff');assert.ok(n.clients[0].connected);await n.leave();assert.equal(n.resources.timers,0);
});
await check('comparison rejects a movement gain that loses authoritative held-fire effects',async()=>{
 const baseline=await runScenario(scenarios.find(s=>s.name==='movement-firing')),candidate=structuredClone(baseline);for(const peer of candidate.peers){peer.stopMs*=.7;peer.authoritativeShots--;}
 const assessment=assessComparison({rows:[{scenario:'movement-firing',baseline,candidate}]});assert.equal(assessment.passed,false);assert.equal(assessment.failures.length,2);assert.ok(assessment.failures.every(f=>f.includes('authoritative held-fire shots decreased')));
 candidate.peers[0].authoritativeShots=baseline.peers[0].authoritativeShots;candidate.peers[0].authoritativeDuplicateCommandShots=1;assert.ok(assessComparison({rows:[{scenario:'movement-firing',baseline,candidate}]}).failures.some(f=>f.includes('duplicate fire command')));
});
console.log(`${count} movement continuity checks passed. Virtual transport, not real HTTP/server acceptance.`);
