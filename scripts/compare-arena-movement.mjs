import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performanceFixture} from './lib/performance-fixture.mjs';
import * as defaultCore from '../public/arena-core.js';

// Declared before candidate examination. A meaningful gain is >=20% fewer held
// stop milliseconds at 1600 ms for EACH peer, not an aggregate masking regression.
export const CRITERIA={highLatencyStopReductionMinimum:.20,normalLatencyExtraStopMs:0,normalCorrectionExtraM:.02,pendingFramesMaximum:90,syncRequestsMaximum:2,correctionExtraM:.25,releaseExtraM:.01,authoritativeFrameSlack:6,longestStopExtraMs:1000/60+.001};
export const scenarios=[
 ...[0,100,600,1600].map(latency=>({name:`hold-${latency}`,latency,duration:12000,profile:'hold'})),
 {name:'asymmetric-600-1600',latency:[600,1600],duration:18000,profile:'mixed'},
 {name:'asymmetric-directions',latency:1600,duration:18000,profile:'mixed',delays:({index})=>index?{up:1400,down:200}:{up:200,down:1400}},
 {name:'seeded-jitter',latency:1000,duration:18000,profile:'mixed',delays:({random})=>({up:300+random()*500,down:300+random()*500})},
 {name:'press-release-reverse',latency:1600,duration:18000,profile:'mixed'},
 {name:'movement-firing',latency:1600,duration:18000,profile:'fire'},
 {name:'accepted-response-loss',latency:1600,duration:30000,profile:'mixed',fault:{lostResponse:true}},
 {name:'transient-failure',latency:1600,duration:18000,profile:'mixed',fault:{network:true}},
 {name:'late-ACK',latency:1600,duration:18000,profile:'mixed',fault:{responseDelay:4000}},
 {name:'prolonged-outage',latency:1600,duration:30000,profile:'mixed',outage:true},
 {name:'uplink-outage-expiry',latency:1600,duration:30000,profile:'mixed',unacceptedOutage:true},
 {name:'terminal-401',latency:1600,duration:5000,profile:'mixed',fault:{status:401},terminal:401},
 {name:'terminal-410',latency:1600,duration:5000,profile:'mixed',fault:{status:410},terminal:410},
 {name:'round-transition',latency:1600,duration:26000,profile:'mixed',round:true},
 {name:'leave-pending',latency:1600,duration:1200,profile:'hold',leavePending:true}
];
const randomSeed=fn=>{const prior=Math.random;let seed=452067;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);return fn().finally(()=>{Math.random=prior;});};
async function modules(repo){const base=path.resolve(repo);return {clientFactory:(await import(pathToFileURL(path.join(base,'public/arena-client.js')).href)).createArenaClient,core:await import(pathToFileURL(path.join(base,'public/arena-core.js')).href)};}
export async function runScenario(scenario,implementation={}){return randomSeed(async()=>{
 const revisions=[-1,-1],n=performanceFixture({...scenario,...implementation,measureClient:true,seed:452067,setupPlayer:(i,p)=>{if(scenario.profile==='fire')Object.assign(p,{kit:(implementation.core||defaultCore).makeKit('bow'),x:i?24:-24});},onOutcome:e=>{assert.ok(e.revision>=revisions[e.index],'displayed snapshot revision regressed');revisions[e.index]=e.revision;}});await n.start();
 if(scenario.fault)n.fault(0,scenario.fault);
 if(scenario.outage)for(let i=0;i<10;i++)n.fault(0,{lostResponse:true});
 if(scenario.unacceptedOutage)for(let i=0;i<20;i++)n.fault(0,{network:true});
 const origin=n.now,round=n.room.round.id;if(scenario.round)n.room.round.endsAt=origin+1000;
 let frozenAt=null,frozenPosition=null;
 for(let i=0;i<Math.round(scenario.duration/(1000/60));i++){
  const period=i%240,held=scenario.profile==='hold'||scenario.profile==='fire'||period<90||period>=120&&period<210;
  const z=scenario.profile==='hold'?(Math.floor(i/60)%2?-.6:.6):period<120?.6:-.6;
  await n.step([0,1].map(()=>held?{z,fire:scenario.profile==='fire'&&i%240<180}:{}));
  if(scenario.terminal&&!n.clients[0].connected){const p=n.clients[0].self;if(frozenAt===null){frozenAt=n.now;frozenPosition={x:p.x,y:p.y,z:p.z};}assert.deepEqual({x:p.x,y:p.y,z:p.z},frozenPosition,'expired seat moved');}
 }
 const elapsed=n.now-origin;
 if(scenario.terminal){assert.equal(n.clients[0].connected,false);assert.ok(frozenAt!==null);assert.equal(n.clients[1].connected,true);}
 if(scenario.round)assert.notEqual(n.room.round.id,round,'fixture must cross a round transition');
 if(scenario.fault?.lostResponse){assert.equal(n.stats[0].lostResponses,1);assert.ok(n.stats[0].aborted>=1);assert.ok(n.clients[0].connected);}
 const beforeLeave=n.resources,peers=structuredClone(n.stats);
 if(scenario.unacceptedOutage){assert.equal(Object.keys(n.room.players).length,1,'uplink outage must expire the silent authoritative seat');n.clearFaults(0);await n.advance(4000);assert.equal(n.clients[0].connected,false,'restored transport must report expired seat instead of recreating it');}
 n.clearFaults(0);n.clearFaults(1);await n.leave();assert.equal(n.resources.timers,0,scenario.name+' timer cleanup');assert.equal(n.resources.players,0,scenario.name+' seat cleanup');
 for(const s of n.stats){assert.equal(s.inFlight,0);assert.equal(s.syncInFlight,0);assert.ok(s.pendingMax<=CRITERIA.pendingFramesMaximum);assert.equal(s.duplicateShots,0);assert.equal(s.duplicateCommandShots,0);assert.equal(s.authoritativeDuplicateCommandShots,0);assert.equal(s.commandOverlap,0);assert.ok(s.movementReplayErrorM<1e-6,'accepted movement differs from shared movement replay');assert.ok(s.acceptedFrames<=(scenario.duration+10000)/1000*60+CRITERIA.authoritativeFrameSlack);}
 return {name:scenario.name,latencyMs:scenario.latency,durationMs:elapsed,profile:scenario.profile,peers,beforeLeave,cleanup:n.resources,drain:n.stats.map((s,i)=>({additionalAcceptedFrames:s.acceptedFrames-peers[i].acceptedFrames,additionalAcceptedTravelM:s.acceptedTravelM-peers[i].acceptedTravelM,additionalAuthoritativeShots:s.authoritativeShots-peers[i].authoritativeShots,inFlight:s.inFlight,syncInFlight:s.syncInFlight}))};
 });}
export async function runComparison({baseline,baselineSHA,candidate=process.cwd(),onlyBaseline=false,selected=scenarios}={}){
 const baseModules=await modules(baseline),candidateModules=onlyBaseline?null:await modules(candidate),rows=[];
 for(const scenario of selected){const before=await runScenario(scenario,baseModules),after=onlyBaseline?null:await runScenario(scenario,candidateModules);rows.push({scenario:scenario.name,baseline:before,candidate:after});}
 return {scope:'Sequential seeded virtual fetch; baseline client and authoritative core imported from its own repository graph. No real HTTP, Worker/D1, rendering or hosted evidence.',criteria:CRITERIA,baselineSHA:baselineSHA||sha(baseline),baselineFiles:digests(baseline),candidateFiles:onlyBaseline?null:digests(candidate),candidateSHA:onlyBaseline?null:sha(candidate),seed:452067,timestepMs:1000/60,rows};
}
function sha(repo){try{return execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}}
function digests(repo){return Object.fromEntries(['public/arena-client.js','public/arena-core.js','public/movement-stream.js','public/motion-view.js'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')]));}
export function assessComparison(result){const failures=[];for(const row of result.rows){if(!row.candidate)continue;for(let i=0;i<2;i++){const b=row.baseline.peers[i],c=row.candidate.peers[i],label=`${row.scenario} peer ${i}`;if(!['round-transition','leave-pending','terminal-401','terminal-410'].includes(row.scenario)){if(c.stopMs>b.stopMs+1000/60+.001)failures.push(`${label}: held stop duration increased`);if(c.longestStopMs>b.longestStopMs+CRITERIA.longestStopExtraMs)failures.push(`${label}: longest held stop increased`);}if(row.scenario==='movement-firing'&&c.authoritativeShots<b.authoritativeShots)failures.push(`${label}: authoritative held-fire shots decreased`);if(c.authoritativeDuplicateCommandShots>0||c.duplicateCommandShots>0)failures.push(`${label}: duplicate fire command effect or delivery`);if(c.maxSyncInFlight>2)failures.push(`${label}: sync request bound exceeded`);if(row.scenario==='hold-1600'&&c.stopMs>b.stopMs*(1-CRITERIA.highLatencyStopReductionMinimum))failures.push(`${label}: <20% stop reduction`);if(['hold-0','hold-100','hold-600'].includes(row.scenario)){if(c.stopMs>b.stopMs)failures.push(`${label}: normal-latency stops increased`);if(c.correctionMaxM>b.correctionMaxM+CRITERIA.normalCorrectionExtraM)failures.push(`${label}: normal-latency correction increased`);}if(!['prolonged-outage','round-transition','leave-pending','terminal-401','terminal-410'].includes(row.scenario)){if(c.correctionMaxM>b.correctionMaxM+CRITERIA.correctionExtraM)failures.push(`${label}: correction maximum increased >0.25m`);if(c.releaseOvershootM>b.releaseOvershootM+CRITERIA.releaseExtraM)failures.push(`${label}: release overshoot increased >0.01m`);}}}return {passed:!failures.length,failures};}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const args=process.argv.slice(2),get=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];},baseline=get('--baseline',null);assert.ok(baseline,'Use --baseline /absolute/frozen/repository');
 const result=await runComparison({baseline,baselineSHA:get('--baseline-sha',null),candidate:get('--candidate',process.cwd()),onlyBaseline:args.includes('--baseline-only')});result.assessment=assessComparison(result);const output=get('--output',null);if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.assessment.passed)process.exitCode=1;
}
