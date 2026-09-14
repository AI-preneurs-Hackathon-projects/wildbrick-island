import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createArenaDiagnostics} from '../public/arena-diagnostics.js';
import {createArenaClient} from '../public/arena-client.js';
import {performanceFixture} from './lib/performance-fixture.mjs';
import {newRoom,queuePlayer,startRoom,roomSnapshot} from '../public/arena-core.js';
import {newMotion} from '../public/movement-stream.js';

let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
await check('creator lobby stays immobile and diagnostics distinguish waiting from network stalls',async()=>{
 let now=100000,createFlag;const room=newRoom(now,'lobby-diagnostics'),d=createArenaDiagnostics();
 const client=createArenaClient({}, {diagnostics:d,clock:()=>now,setTimer:()=>0,clearTimer(){},fetcher:async(path,options)=>{
  const packet=JSON.parse(options.body||'{}');
  if(path.endsWith('/join')){createFlag=packet.create;const p=queuePlayer(room,'host','Local host',now);p.motion=newMotion(now);room.revision++;return {ok:true,status:200,json:async()=>({room:'LOCAL',session:p.id,token:'local-only',snapshot:structuredClone(roomSnapshot(room,p.id))})};}
  if(path.endsWith('/start')){startRoom(room,'host',now);room.revision++;return {ok:true,status:200,json:async()=>({snapshot:structuredClone(roomSnapshot(room,'host'))})};}
  return {ok:true,status:200,json:async()=>({})};
 }});
 assert.equal(await client.join('Local host','LOCAL',undefined,true),true);assert.equal(createFlag,true);
 const before={x:client.self.x,z:client.self.z};client.tick(1/60,{z:1,fire:true});assert.deepEqual({x:client.self.x,z:client.self.z},before);assert.equal(client.command('build','bow'),false);assert.equal(d.export().predictionReasons[4],1);assert.equal(d.export().predictionReasons[2],0);
 now+=500;assert.equal(await client.start(),true);assert.equal(client.snapshot.round.status,'active');client.tick(1/60,{z:1});assert.equal(d.export().predictionReasons[1],1);assert.ok(d.export().metrics.pendingFrames.lifetimeMax>0);await client.leave();assert.equal(d.export().inFlight,0);
});
await check('bounded retained window, lifetime maximum, immutable export and sanitized input',()=>{
 const d=createArenaDiagnostics({capacity:4});for(const duration of [1000,2,3,4,5,6])d.record('request-end',{duration,status:200,failure:0,token:'DO_NOT_RETAIN',error:'PRIVATE'});
 d.record('unknown',{secret:'PRIVATE'});d.record('tick',{age:NaN,pending:Infinity,reason:999});
 const e=d.export();assert.deepEqual(e.metrics.requestMs,{count:6,retained:4,p50:4,p95:6,p99:6,windowMax:6,lifetimeMax:1000});assert.doesNotMatch(JSON.stringify(e),/PRIVATE|DO_NOT_RETAIN|secret|unknown/);e.statusTransitions[0]=99;assert.equal(d.export().statusTransitions[0],0);d.stop();d.record('frame',{at:500});assert.equal(d.export().events.frame,0);assert.throws(()=>createArenaDiagnostics({capacity:Infinity}),RangeError);
 const timeline=createArenaDiagnostics({capacity:4});for(let i=0;i<10000;i++)timeline.record('status',{at:i,code:i%2,token:'PRIVATE'});assert.deepEqual(timeline.export().recentEvents.map(e=>e.at),[9996,9997,9998,9999]);const copy=timeline.export();copy.recentEvents[0].code=99;assert.notEqual(timeline.export().recentEvents[0].code,99);
});
await check('browser observer cleanup cancels RAF, disconnects long tasks and removes listeners',()=>{
 const document=new EventTarget(),canvas=new EventTarget();let raf,callback,disconnected=0,canceled=0;
 class Observer{static supportedEntryTypes=['longtask'];constructor(fn){callback=fn;}observe(){}disconnect(){disconnected++;}}
 const target={document,PerformanceObserver:Observer,requestAnimationFrame(fn){raf=fn;return 7;},cancelAnimationFrame(id){assert.equal(id,7);canceled++;}};
 const d=createArenaDiagnostics();const dispose=d.observeBrowser(target,canvas);raf(0);raf(75);callback({getEntries:()=>[{duration:60,name:'private URL'}]});canvas.dispatchEvent(new Event('webglcontextlost'));document.dispatchEvent(new Event('visibilitychange'));dispose();dispose();raf(200);callback({getEntries:()=>[{duration:600}]});canvas.dispatchEvent(new Event('webglcontextlost'));document.dispatchEvent(new Event('visibilitychange'));
 const e=d.export();assert.equal(e.metrics.frameGapMs.p99,75);assert.equal(e.metrics.longTaskMs.count,1);assert.equal(e.events['context-lost'],1);assert.equal(e.events.visibility,1);assert.equal(disconnected,1);assert.equal(canceled,1);assert.equal(e.longTaskSupported,true);
 const unsupported=createArenaDiagnostics();unsupported.observeBrowser({...target,PerformanceObserver:undefined});assert.equal(unsupported.export().longTaskSupported,false);unsupported.stop();assert.equal(canceled,2);
 const replacing=createArenaDiagnostics();replacing.observeBrowser(target,canvas);const oldFrame=raf,oldTasks=callback;replacing.observeBrowser(target,canvas);oldFrame(900);oldTasks({getEntries:()=>[{duration:900}]});assert.equal(replacing.export().events.frame,0);assert.equal(replacing.export().events['long-task'],0);raf(1000);assert.equal(replacing.export().events.frame,1);replacing.stop();assert.equal(canceled,4);
});
for(const latency of [0,100,600,1600])await check(`observation preserves every packet/outcome at ${latency}ms RTT with two active clients`,async()=>{
 async function run(enabled){const hash=createHash('sha256'),ds=enabled?[createArenaDiagnostics({capacity:32}),createArenaDiagnostics({capacity:32})]:[];const original=Math.random;let seed=452067;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  try{const n=performanceFixture({latency,diagnostics:ds,onPacket:p=>hash.update(JSON.stringify(p)),onOutcome:p=>hash.update(JSON.stringify(p))});await n.start();for(let i=0;i<720;i++){const z=Math.floor(i/60)%2?-.6:.6;await n.step([{z},{z}]);}await n.leave();assert.deepEqual(n.resources.timers,0);for(const d of ds){const e=d.export();assert.equal(e.inFlight,0);assert.ok(Object.values(e.metrics).every(s=>s.retained<=32));if(latency===1600){assert.ok(e.predictionReasons[2]>0);assert.ok(e.predictionReasons[3]>0);assert.equal(e.metrics.pendingFrames.lifetimeMax,90);}}
   return {hash:hash.digest('hex'),stats:n.stats};
  }finally{Math.random=original;}}
 assert.deepEqual(await run(true),await run(false));
});
await check('throwing diagnostic sink cannot break join, prediction or leave',async()=>{
 const n=performanceFixture({diagnostics:[{record(){throw Error('observer failure');}},{record(){throw Error('observer failure');}}]});await n.start();await n.step();assert.ok(n.clients.every(c=>c.connected));await n.leave();assert.equal(n.resources.timers,0);
});
await check('transient failures remain recoverable; 401/410 remain terminal and leave drains timers',async()=>{
 for(const fault of [{status:503},{network:true},{status:401},{status:410}]){
  const ds=[createArenaDiagnostics(),createArenaDiagnostics()],n=performanceFixture({diagnostics:ds});await n.start();n.fault(0,fault);await n.advance(1500);
  const e=ds[0].export();assert.ok(e.httpStatuses[fault.status||0]>0);assert.ok(e.requestFailures[fault.network?1:5]>0);
  assert.equal(n.clients[0].connected,![401,410].includes(fault.status));assert.equal(n.clients[1].connected,true);await n.leave();assert.equal(n.resources.timers,0);
 }
});
await check('request diagnostics classify timeout, canceled and invalid JSON without raw errors',async()=>{
 for(const kind of ['timeout','canceled','json']){
  const d=createArenaDiagnostics();let timer;
  const c=createArenaClient({}, {diagnostics:d,setTimer:fn=>{timer=fn;return 1;},clearTimer(){},fetcher:async(path,{signal})=>{
   if(kind==='timeout'){timer();throw signal.reason;}
   if(kind==='canceled')throw new DOMException('private payload','AbortError');
   return {ok:true,status:200,json:async()=>{throw Error('private payload');}};
  }});
  assert.equal(await c.join('private name','private room'),false);const e=d.export();assert.equal(e.requestFailures[{timeout:2,canceled:3,json:4}[kind]],1);assert.equal(e.inFlight,0);assert.doesNotMatch(JSON.stringify(e),/private/);
 }
});
console.log(`${checks} diagnostics checks passed; virtual transport and observer lifecycle, no rendered or hosted acceptance.`);
