import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArenaClient} from '../public/arena-client.js';
import {newRoom,addPlayer,advanceRoom,applyInput,roomSnapshot,makeKit,hurt} from '../public/arena-core.js';
import {newMotion,packFrame,validFrames} from '../public/movement-stream.js';
import {MOVE_DT} from '../public/movement.js';
import {createSimulation} from '../public/simulation.js';
import {createMotionView} from '../public/motion-view.js';
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
const pose=p=>({x:p.x,y:p.y,z:p.z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function network(latency=250){
 let now=100000,timerId=0,forced=0,failAfterApply=0,lossCommandOnly=false,joins=0;const timers=new Map(),errors=[],statuses=[],packets=[],events=[],room=newRoom(now,'network-test');
 const setTimer=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimer=id=>timers.delete(id);
 const runtime={clock:()=>now,setTimer,clearTimer,fetcher:(path,options)=>new Promise(resolve=>{
  const packet=options.body?JSON.parse(options.body):{};packets.push({path,packet});
  setTimer(()=>{
   let status=200,data={};advanceRoom(room,now);
   if(path.endsWith('/join')){const id='player-'+(++joins),p=addPlayer(room,id,packet.name,now);assert.equal(packet.motionVersion,1);p.motion=newMotion(now);room.revision++;data={room:'TEST',session:id,token:'fixture-session',snapshot:structuredClone(roomSnapshot(room,id))};}
   else if(path.endsWith('/leave'))delete room.players[packet.session];
   else if(forced){status=forced;data={error:'Fixture connection ended'};}
   else if(!room.players[packet.session]){status=410;data={error:'Fixture seat expired'};}
   else{applyInput(room,packet.session,packet,now,packet.command?.type==='build'?makeKit(packet.command.mode):null);room.revision++;data={snapshot:structuredClone(roomSnapshot(room,packet.session))};if(failAfterApply>0&&(!lossCommandOnly||packet.command?.type==='fire')){failAfterApply--;status=503;data={error:'Fixture lost response'};}}
   setTimer(()=>resolve({ok:status===200,status,json:async()=>data}),latency/2);
  },latency/2);
 })};
 const client=createArenaClient({onError:(...e)=>errors.push(e),onStatus:s=>statuses.push(s),onEvent:e=>events.push(e)},runtime);
 async function advance(ms){const end=now+ms;while(true){let next=null;for(const [id,t]of timers)if(t.at<=end&&(!next||t.at<next.t.at))next={id,t};if(!next)break;now=next.t.at;timers.delete(next.id);next.t.fn();await flush();}now=end;await flush();}
 async function step(input={},dt=MOVE_DT){await advance(dt*1000);return client.tick(dt,input);}
 async function join(){const result=client.join('Tester','TEST');await advance(latency+1);assert.equal(await result,true);return client.self;}
 return {client,room,errors,statuses,packets,events,advance,step,join,get now(){return now;},get player(){return room.players[client.snapshot?.self];},force(status){forced=status;},loseResponse(onlyFire=false){lossCommandOnly=onlyFire;failAfterApply++;}};
}
await check('all original and generated modes stop immediately and stay still without input',async()=>{
 const dragon=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;
 for(const mode of ['foot','car','plane','dragon']){
  const sim=await createSimulation([],()=>{});sim.state.started=true;
  if(mode==='dragon')sim.buildCustom({blueprint:dragon,dimensions:[8,6,9]});else if(mode!=='foot')sim.build(mode);
  for(let i=0;i<180;i++)sim.update(MOVE_DT,{});
  for(let i=0;i<60;i++)sim.update(MOVE_DT,{z:1,up:sim.state.mode==='plane'});
  const stopped=pose(sim.state);Object.assign(sim.state,{speed:40,vertical:-50,autoRun:true});
  for(let i=0;i<300;i++){sim.update(MOVE_DT,{});assert.deepEqual(pose(sim.state),stopped,mode);assert.equal(sim.state.speed,0);assert.equal(sim.state.autoRun,false);}
  sim.dispose();
 }
});
await check('sequenced movement rejects gaps and retries; frame budget prevents speed cheating',()=>{
 const room=newRoom(100000),p=addPlayer(room,'p','Budget');p.motion=newMotion(room.time);const initial=pose(p),frames=Array.from({length:90},(_,i)=>packFrame(i+1,{z:1}));
 assert.equal(validFrames(frames),true);assert.equal(validFrames([...frames,packFrame(91,{})]),false);assert.equal(validFrames([[1,0,0,0,0,32]]),false);assert.equal(validFrames([frames[0],frames[2]]),false);
 applyInput(room,p.id,{seq:1,motionEpoch:0,frames,input:{z:1}},room.time);assert.equal(p.motion.frame,6);assert.ok(distance(p,initial)<=p.kit.stats.speed*.1+1e-8);
 const after=pose(p);applyInput(room,p.id,{seq:2,motionEpoch:0,frames},room.time);assert.deepEqual(pose(p),after);
 applyInput(room,p.id,{seq:3,motionEpoch:0,frames:[packFrame(8,{z:1})]},room.time+100);assert.deepEqual(pose(p),after);
 applyInput(room,p.id,{seq:4,motionEpoch:0,frames},room.time+100);assert.equal(p.motion.frame,12);
 const accepted=pose(p);advanceRoom(room,room.time+500);assert.deepEqual(pose(p),accepted,'room ticks never repeat a held movement frame');
});
for(const latency of [50,250,600])await check(`real client/server movement stays continuous across ${latency}ms simulated round trips`,async()=>{
 const n=network(latency);await n.join();let previous=pose(n.client.self),largest=0;
 for(let i=0;i<240;i++){
  const input=i<60?{z:1}:i<120?{x:1}:i<180?{z:-1}:{x:-1};
  const p=await n.step(input),d=distance(p,previous);largest=Math.max(largest,d);assert.ok(d<=p.kit.stats.speed*MOVE_DT+.00001,`frame ${i}, unexpected ${d}m step`);previous=pose(p);
 }
 const released=pose(n.client.self);
 for(let i=0;i<120;i++){const p=await n.step();assert.ok(distance(p,released)<1e-8,'late ack moved an idle player');}
 assert.ok(distance(n.player,released)<1e-8,'authoritative position catches up exactly');
 assert.equal(n.errors.length,0);console.log(`  largest displayed step ${largest.toFixed(4)} m; released drift ${distance(n.client.self,released).toFixed(8)} m`);
 const leave=n.client.leave();await n.advance(latency+1);await leave;
});
await check('moving plane assembly, manual rise, hover and dismount stay controlled over delayed sync',async()=>{
 const n=network(250);await n.join();assert.equal(n.client.command('build','plane'),true);const start=pose(n.client.self);
 for(let i=0;i<230;i++)await n.step({z:1});assert.equal(n.client.self.kit.id,'plane');assert.ok(distance(n.client.self,start)>10);assert.equal(n.client.self.y,0);
 for(let i=0;i<60;i++)await n.step({up:true});assert.ok(n.client.self.y>8);
 const hover=pose(n.client.self);for(let i=0;i<120;i++)assert.ok(distance(await n.step(),hover)<1e-8);
 n.client.command('exit');for(let i=0;i<90;i++)assert.ok(distance(await n.step(),hover)<1e-8);assert.equal(n.client.self.kit.id,'foot');
 for(let i=0;i<120;i++)await n.step({down:true});assert.ok(n.client.self.y<1e-8);
});
await check('lost sync response retries acknowledged frames without repeating movement or rolling back',async()=>{
 const n=network(250);await n.join();n.loseResponse();let last=pose(n.client.self);
 for(let i=0;i<240;i++){const p=await n.step(i<120?{z:1}:{});assert.ok(distance(p,last)<=p.kit.stats.speed*MOVE_DT+1e-8);last=pose(p);}
 assert.ok(n.statuses.includes('reconnecting'));assert.ok(distance(n.player,n.client.self)<1e-8);
});
await check('jump is replayed once, returns to its start height, and does not bounce again',async()=>{
 const n=network(250);await n.join();assert.equal(n.client.command('jump'),true);let rises=0,oldY=0,wasRising=false,max=0;
 for(let i=0;i<180;i++){const p=await n.step(),rising=p.y>oldY+1e-8;if(rising&&!wasRising)rises++;wasRising=rising;oldY=p.y;max=Math.max(max,p.y);}
 assert.equal(rises,1);assert.ok(max>1.2&&max<=1.25);assert.equal(n.client.self.y,0);assert.equal(n.player.y,0);
 assert.equal(n.packets.filter(p=>p.path.endsWith('/sync')).flatMap(p=>p.packet.frames).filter(f=>(f[5]&16)&&f[0]===1).length>0,true);
});
await check('kit changes and large ordinary corrections cannot teleport an idle display',()=>{
 const room=newRoom(1e5),p=addPlayer(room,'p','Steady'),view=createMotionView();view.accept(p);const held=pose(view.state);
 const changed={...p,kit:makeKit('plane'),x:p.x+18,y:12};view.accept(changed);assert.deepEqual(pose(view.update(changed,MOVE_DT,{correct:false})),held);
 view.accept({...changed,x:30,z:30},{teleport:true});assert.equal(view.state.x,30);
});
for(const status of [401,410])await check(`HTTP ${status} holds the last position and requires deliberate rejoin`,async()=>{
 const n=network(250);await n.join();for(let i=0;i<45;i++)await n.step({z:1});n.force(status);for(let i=0;i<100;i++)await n.step();
 const held=pose(n.client.self);assert.equal(n.client.connected,false);assert.equal(n.client.active,true);assert.equal(n.client.self.speed,0);assert.equal(n.client.command('fire'),false);
 for(let i=0;i<120;i++)assert.deepEqual(pose(await n.step({z:1,up:true})),held);
 assert.ok(n.errors.some(e=>e[1]===status));n.force(0);await n.join();assert.equal(n.client.connected,true);
});
await check('a join response arriving after Leave cannot reactivate or relocate the player',async()=>{
 const n=network(600),joining=n.client.join('Tester','TEST');await n.advance(100);await n.client.leave();await n.advance(1800);assert.equal(await joining,false);assert.equal(n.client.active,false);assert.equal(n.client.self,null);assert.equal(Object.keys(n.room.players).length,0);
});
await check('only actual arena respawn increments teleport epoch; pre-death frames cannot move it',()=>{
 const room=newRoom(1e5),p=addPlayer(room,'p','Respawn');p.motion=newMotion(room.time);p.protectedUntil=0;p.x=31;p.z=29;hurt(room,p,1000,null);p.respawnAt=room.time+50;advanceRoom(room,room.time+60);assert.equal(p.spawnSerial,1);assert.equal(p.motion.frame,0);const spawn=pose(p);
 applyInput(room,p.id,{seq:1,motionEpoch:0,frames:[packFrame(1,{z:1})]},room.time);assert.deepEqual(pose(p),spawn);
 applyInput(room,p.id,{seq:2,motionEpoch:1,frames:[packFrame(1,{z:1})]},room.time);assert.ok(distance(p,spawn)>0);
});

await check('a one-frame attack survives release and a lost response without duplicate damage or confirmed effects',async()=>{
 const n=network(250);await n.join();Object.assign(n.player,{x:0,z:10,y:0,protectedUntil:0});const q=addPlayer(n.room,'target','Target',n.now);Object.assign(q,{x:0,z:11.7,y:0,protectedUntil:0});
 // Let the normal snapshot acknowledge the fixture positions before input.
 for(let i=0;i<30;i++)await n.step();const before=pose(n.client.self);n.loseResponse(true);await n.step({fire:true,cameraYaw:0});
 assert.equal(n.events.filter(e=>e.type==='attack-preview').length,1);assert.equal(q.health,100,'prediction never causes damage');
 for(let i=0;i<150;i++)await n.step({cameraYaw:0});
 assert.equal(q.health,83.8);assert.equal(n.room.events.filter(e=>e.type==='hit').length,1);assert.equal(n.events.filter(e=>e.type==='hit').length,1);assert.deepEqual(pose(n.client.self),before);
 const firePackets=n.packets.filter(p=>p.packet.command?.type==='fire');assert.ok(firePackets.length>=2,'lost response retried the command');assert.equal(new Set(firePackets.map(p=>p.packet.command.id)).size,1);
});
console.log(`\n${checks} direct movement and network regressions passed. Latency/failures are simulated; no production network or rendered-device claim.`);
