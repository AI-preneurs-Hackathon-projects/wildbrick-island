// Bounded Gate A experiment using the existing two-client transport/core fixture.
// Virtual metrics characterize timing and contact, never a human feel judgment.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {performanceFixture} from './lib/performance-fixture.mjs';
import {movementShape,canFit} from '../public/movement-blocking.js';
const DT=1000/60,SEED=452067;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function assessTradeoffs(control,candidate,{requirePriorGain=true}={}){
 const failures=[];let assessedRows=0;
 for(const row of candidate.rows){
  const base=control.rows.find(b=>b.network===row.network&&b.profile===row.profile);assert.ok(base,'missing matched control');
  // Combat/death totals have different alive/kit denominators. They are reported
  // with a common early window, not admitted as a synchronization improvement.
  if(!['hold','mixed'].includes(row.profile))continue;
  assessedRows++;
  row.peers.forEach((p,i)=>{const b=base.peers[i],label=`${row.network}/${row.profile}/peer${i+1}`;
   if(Math.abs(p.eligibleMs-b.eligibleMs)>DT+.001){failures.push(label+': unmatched eligible duration');return;}
   for(const k of ['stopMs','longestStopMs'])if(p[k]>b[k]+DT+.001)failures.push(label+': '+k+' increased');
   if(p.stopCount>b.stopCount)failures.push(label+': stop frequency increased');
   for(const w of [1000,4000])if(p.worstStoppedFraction[w]>b.worstStoppedFraction[w]+DT/w+.000001)failures.push(label+': rolling '+w+'ms stopped fraction increased');
   if(p.separationIntegralMSeconds>b.separationIntegralMSeconds+.9*DT/1000)failures.push(label+': separation integral increased');
   p.separationExposure.forEach((s,j)=>{for(const k of ['durationMs','longestMs'])if(s[k]>b.separationExposure[j][k]+DT+.001)failures.push(label+': separation>'+s.thresholdM+'m '+k+' increased');});
   if(requirePriorGain&&row.network==='1600'&&row.profile==='hold'&&p.stopMs>b.stopMs*.8)failures.push(label+': prior20% stop gain not retained');
  });
 }
 if(!assessedRows)failures.push('No matched movement rows assessed');
 return {passed:failures.length===0,assessedRows,failures};
}
export const networks=[
 ...[0,100,600,1600].map(latency=>({name:String(latency),latency})),
 {name:'asymmetric',latency:[600,1600]},
 {name:'directional',latency:1600,delays:({index})=>index?{up:1400,down:200}:{up:200,down:1400}},
 {name:'jitter',latency:1000,delays:({random})=>({up:300+random()*500,down:300+random()*500})}
];
function episodes(samples,predicate){const out=[];let current=null;for(const s of samples){if(predicate(s)){if(!current){current={startMs:s.atMs,durationMs:0};out.push(current);}current.durationMs+=DT;}else current=null;}return out;}
function summarize(samples,thresholds){const stops=episodes(samples,s=>s.held&&s.stopped),rolling={};for(const windowMs of [1000,4000]){const n=Math.round(windowMs/DT);let sum=0,max=0;for(let i=0;i<samples.length;i++){sum+=samples[i].held&&samples[i].stopped?DT:0;if(i>=n)sum-=samples[i-n].held&&samples[i-n].stopped?DT:0;if(i>=n-1)max=Math.max(max,sum);}rolling[windowMs]=max/windowMs;}
 return {eligibleMs:samples.filter(s=>s.eligible).length*DT,heldMs:samples.filter(s=>s.held).length*DT,stopMs:stops.reduce((n,s)=>n+s.durationMs,0),stopCount:stops.length,longestStopMs:Math.max(0,...stops.map(s=>s.durationMs)),stops,worstStoppedFraction:rolling,separationMaxM:Math.max(0,...samples.filter(s=>s.eligible).map(s=>s.gap)),separationIntegralMSeconds:samples.filter(s=>s.eligible).reduce((n,s)=>n+s.gap*DT/1000,0),separationExposure:thresholds.map(m=>{const spans=episodes(samples,s=>s.eligible&&s.gap>m);return {thresholdM:m,durationMs:spans.reduce((n,s)=>n+s.durationMs,0),longestMs:Math.max(0,...spans.map(s=>s.durationMs))};})};}
export async function runTradeoff(root,network,profile='hold'){
 const core=await import(pathToFileURL(path.resolve(root,'public/arena-core.js'))),{createArenaClient}=await import(pathToFileURL(path.resolve(root,'public/arena-client.js')));
 const random=Math.random;let seed=SEED;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const samples=[[],[]],packets=[],events=[[],[]],owners=new Map(),firing=[0,1].map(()=>({eligibility:{},immediateEffects:0}));let n,cleaned=false;
 const tracedCore={...core,applyInput(room,id,packet,...args){
  const p=room.players[id],i=owners.get(id),wantsFire=packet.command?.type==='fire'||!packet.command&&packet.input?.fire,before=room.eventId;
  if(p&&i!==undefined&&wantsFire){const reason=packet.seq<=p.lastSeq?'old-sequence':packet.motionEpoch!==(p.spawnSerial||0)?'old-spawn':packet.roundId!==room.round.id?'old-round':packet.command&&packet.command.id<=p.lastCommand?'old-command':core.attackBlockReason(room,p)||'eligible';firing[i].eligibility[reason]=(firing[i].eligibility[reason]||0)+1;}
  const result=core.applyInput(room,id,packet,...args);
  if(i!==undefined&&wantsFire)firing[i].immediateEffects+=room.events.filter(e=>e.id>before&&e.player===id&&['shot','swing'].includes(e.type)).length;
  return result;
 }};
 try{
 n=performanceFixture({...network,seed:SEED,clientFactory:createArenaClient,core:tracedCore,measureClient:true,onPacket:p=>{if(p.kind==='sync'||p.kind==='build')packets.push({peer:p.index,at:p.at,seq:p.seq,command:p.command?.type||null});},onEvent:(i,e)=>{if(['shot','swing','hit','blocked','ko','respawn','attack-preview'].includes(e.type))events[i].push({type:e.type,time:e.time,player:e.player,by:e.by,commandId:e.commandId,id:e.id});},setupPlayer:(i,p,room)=>{
  owners.set(p.id,i);
  Object.assign(p,{x:profile==='crossing'?(i?1:-1):profile==='approach'?0:i?6:0,z:profile==='approach'?(i?12:8):10,yaw:i?Math.PI:0,kit:core.makeKit(profile==='crossing'?'bow':'foot')});
  if(profile==='wall')room.placed=[{id:'local-wall',x:3,y:3,z:14,w:16,h:6,d:1,hp:1000}];
 }});await n.start();const origin=n.now;
 // Four-second identical stationary warmup lets both peers acquire RTT samples.
 for(let i=0;i<240;i++)await n.step([{},{}]);
 let crossings=0,previousOrder=0,previousLives=null;const warmEnd=n.now,thresholds=[movementShape(core.makeKit('foot').stats).radius*2,core.makeKit('foot').stats.range];
 for(let i=0;i<1440;i++){
  const phase=i%240,sign=i%120<60?1:-1;
  const inputs=[0,1].map(j=>{
   if(profile==='hold')return {z:.6*sign};
   if(profile==='wall')return i<900?{z:1}:{};
   if(profile==='crossing')return {x:(j?1:-1)*.35*(phase<120?1:-1),fire:phase<180};
   if(profile==='approach')return {z:(j?-1:1)*.35*(phase<120?1:-1),fire:phase<180};
   return phase<90||phase>=120&&phase<210?{z:.6*(phase<120?1:-1)}:{};
  });
  if(profile==='respawn'&&i===480){const p=n.room.players[n.clients[0].snapshot.self];p.protectedUntil=0;core.hurt(n.room,p,1000,null);}
  const before=n.clients.map(c=>({...c.self}));await n.step(inputs);
  if(profile==='crossing'){const ps=n.clients.map(c=>n.room.players[c.snapshot.self]),lives=JSON.stringify([n.room.round.id,...ps.map(p=>p.spawnSerial||0)]);if(ps.every(p=>p.health>0)){const order=Math.sign(ps[0].x-ps[1].x);if(previousLives===lives&&previousOrder&&order&&order!==previousOrder)crossings++;previousLives=lives;if(order)previousOrder=order;}else{previousOrder=0;previousLives=null;}}
  for(let j=0;j<2;j++){
   const shown=n.clients[j].self,p=n.room.players[n.clients[j].snapshot.self],same=before[j].spawnSerial===shown.spawnSerial&&p.spawnSerial===shown.spawnSerial;
   const eligible=!!(same&&shown.health>0&&p.health>0&&n.room.round.status==='active');
   const probe={...shown};core.predictPlayer(probe,inputs[j],1/60,{...n.clients[j].snapshot,preview:true});
   const held=eligible&&!!(inputs[j].x||inputs[j].z)&&distance(probe,shown)>1e-9;
   samples[j].push({atMs:n.now-warmEnd,eligible,held,stopped:distance(before[j],shown)<1e-9,gap:distance(shown,p)});
   if(profile==='wall'){assert.ok(canFit(p,movementShape(p.kit.stats),core.movementBoxes(n.room)));assert.ok(canFit(shown,movementShape(shown.kit.stats),core.movementBoxes(n.room)));}
  }
 }
 if(profile==='crossing')assert.ok(crossings>0,'must demonstrate authoritative path crossing');const result={network:network.name,profile,crossings,warmupMs:warmEnd-origin,durationMs:n.now-warmEnd,peers:samples.map(s=>summarize(s,thresholds)),firstTwoSeconds:samples.map(s=>summarize(s.filter(x=>x.atMs<=2000+1e-5),thresholds)),existing:structuredClone(n.stats),outcomes:n.clients.map(c=>{const p=n.room.players[c.snapshot.self];return {health:p.health,deaths:p.deaths,kills:p.kills,spawn:p.spawnSerial||0,kit:p.kit.id,protected:p.protectedUntil>n.room.time};}),firing,events,packets:packets.map(p=>({...p,at:p.at-warmEnd}))};
 assert.ok(n.stats.every(s=>s.commandOverlap===0&&s.duplicateCommandShots===0&&s.authoritativeDuplicateCommandShots===0&&s.pendingMax<=90&&s.maxSyncInFlight<=2&&s.movementReplayErrorM<1e-6));
 await n.leave();cleaned=true;assert.equal(n.resources.timers,0);assert.equal(n.resources.players,0);return result;
 }finally{if(n&&!cleaned)await n.leave();Math.random=random;}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];},root=get('--root',process.cwd()),selected=get('--profiles','hold,mixed,approach,crossing,wall,respawn').split(','),rows=[];
 for(const network of networks.filter(n=>get('--network',n.name)===n.name))for(const profile of selected)rows.push(await runTradeoff(root,network,profile));
 const result={scope:'Seeded virtual existing two-client fixture; displayed predicted pose versus authoritative pose at the same time. Stationary warmup, collision, death and spawn discontinuities excluded from stalls. Not human feel, HTTP or rendered evidence.',seed:SEED,timestepMs:DT,rows};
 if(get('--control',null))result.assessment=assessTradeoffs(JSON.parse(fs.readFileSync(get('--control'))),result);
 fs.writeFileSync(get('--output','/private/tmp/arena-tradeoffs.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({network:r.network,profile:r.profile,peers:r.peers.map(p=>({stops:p.stopCount,stopMs:p.stopMs,gapIntegral:p.separationIntegralMSeconds,exposure:p.separationExposure})),outcomes:r.outcomes})),null,2));
 if(args.includes('--require-pass')&&!result.assessment?.passed)process.exitCode=1;
}
