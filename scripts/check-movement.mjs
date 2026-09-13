import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSimulation} from '../public/simulation.js';
import {newRoom,addPlayer,makeKit,predictPlayer,advanceRoom,applyInput,roomSnapshot} from '../public/arena-core.js';
import {createMotionView} from '../public/motion-view.js';
import {followCamera} from '../public/follow-camera.js';
import {WORLD_ENTITIES} from '../public/world-data.js';

let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
const obstacles=WORLD_ENTITIES.flatMap(e=>e.boxes.map(b=>({...b,id:e.id,kind:e.kind,hp:e.hp})));
function walkPath(step,state){
 let seed=48,yaw=0,max=0;
 for(let frame=0;frame<3600;frame++){
  if(frame%30===0){seed=(seed*1664525+1013904223)>>>0;yaw=seed/2**32*Math.PI*2;}
  const before={x:state.x,y:state.y,z:state.z};
  step({z:1,cameraYaw:yaw,sprint:true});
  const distance=Math.hypot(state.x-before.x,state.y-before.y,state.z-before.z);
  max=Math.max(max,distance);
  assert.ok(distance<.35,`frame ${frame}: ${distance.toFixed(4)} m discontinuity`);
 }
 console.log(`  3,600 frames; largest step ${max.toFixed(4)} m`);
}
await check('Explore walking through actual island scenery has no recovery jumps',async()=>{
 const sim=await createSimulation(obstacles,()=>{});sim.state.started=true;
 try{walkPath(input=>sim.update(1/60,input),sim.state);}finally{sim.dispose();}
});
await check('arena walking past actual island edges has no recovery jumps',()=>{
 const room=newRoom(1e5),p=addPlayer(room,'walk','Walker');
 walkPath(input=>{predictPlayer(p,input,1/60,room);room.time+=1000/60;},p);
});
await check('all scenery and placements leave foot, vehicle and generated movement unchanged',async()=>{
 const blueprint=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;
 for(const mode of ['foot','car','plane','dragon']){
  const a=await createSimulation([...obstacles,{x:0,y:10,z:17,w:15,h:20,d:15}],()=>{}),b=await createSimulation([],()=>{});
  try{
   for(const sim of [a,b]){sim.state.started=true;if(mode==='dragon')sim.buildCustom({blueprint,dimensions:[8,6,9]});else if(mode!=='foot')sim.build(mode);for(let i=0;i<180;i++)sim.update(1/60,{});}
   assert.equal(a.state.mode,b.state.mode);const placed=a.placeCreation([5,5,5]);assert.ok(placed);
   Object.assign(a.state,{x:placed.x,z:placed.z});Object.assign(b.state,{x:placed.x,z:placed.z});
   for(let i=0;i<360;i++){
    const input={z:1,cameraYaw:i<180?Math.PI:Math.PI/2,up:i>240};a.update(1/60,input);b.update(1/60,input);
    for(const key of ['x','y','z','yaw','speed','vertical','mode'])assert.equal(a.state[key],b.state[key],mode+' '+key);
   }
  }finally{a.dispose();b.dispose();}
  const world=newRoom(1e5),p=addPlayer(world,'a','A'),empty=newRoom(1e5),q=addPlayer(empty,'a','A');
  for(const e of WORLD_ENTITIES)empty.destroyed[e.id]=1e12;
  world.placed.push({id:'placed:test',x:-17,z:-16,w:20,h:20,d:20,hp:200});
  for(const player of [p,q])Object.assign(player,{x:-17,z:-16,kit:makeKit(mode,mode==='dragon'?blueprint:null),mountHealth:200});
  for(let i=0;i<180;i++){
   const input={z:1,cameraYaw:i<90?0:Math.PI/2,up:i>120};
   for(const [r,player] of [[world,p],[empty,q]]){applyInput(r,player.id,{seq:i+1,input},r.time);advanceRoom(r,r.time+1000/30);}
   for(const key of ['x','y','z','yaw','speed','health','mountHealth'])assert.equal(p[key],q[key],mode+' '+key);
  }
 }
});
await check('mount assembly inside a building succeeds without relocating the builder',async()=>{
 const events=[],sim=await createSimulation([{x:0,y:3,z:17,w:8,h:6,d:8}],e=>events.push(e));sim.state.started=true;
 try{sim.build('plane');for(let i=0;i<125;i++)sim.update(1/60,{});assert.equal(sim.state.mode,'plane');assert.equal(sim.state.x,0);assert.equal(sim.state.z,17);assert.ok(!events.some(e=>e.type==='build-blocked'));}finally{sim.dispose();}
 const room=newRoom(1e5),p=addPlayer(room,'a','Builder');Object.assign(p,{x:-17,z:-16,yaw:0});
 p.building={kit:makeKit('plane'),starts:room.time-2800,ends:room.time};advanceRoom(room,room.time+34);
 assert.equal(p.kit.id,'plane');assert.equal(p.x,-17);assert.equal(p.z,-16);
});
await check('20 FPS prediction retains elapsed movement time',()=>{
 const room=newRoom(1e5),a=addPlayer(room,'a','Walker'),b=structuredClone(a),input={z:1,cameraYaw:0};
 for(const e of WORLD_ENTITIES)room.destroyed[e.id]=1e12;
 for(let i=0;i<20;i++)predictPlayer(a,input,.05,room);
 for(let i=0;i<60;i++)predictPlayer(b,input,1/60,room);
 assert.ok(Math.abs(a.z-b.z)<.12,`${a.z} versus ${b.z}`);
});
await check('contact with another player never pushes, slows or damages either',()=>{
 const room=newRoom(1e5),a=addPlayer(room,'a','Alpha'),b=addPlayer(room,'b','Beta');
 Object.assign(a,{x:0,z:17});Object.assign(b,{x:0,z:17});
 advanceRoom(room,room.time+1000/30);
 assert.equal(a.x,0);assert.equal(b.x,0);assert.equal(a.z,17);assert.equal(b.z,17);assert.equal(a.health,100);assert.equal(b.health,100);
});
await check('delayed network positions blend while damage and respawns apply immediately',()=>{
 const room=newRoom(1e5),p=addPlayer(room,'a','Alpha'),view=createMotionView();p.speed=7;
 view.accept(p);view.update(p,1/60);const old=view.state;
 const corrected={...p,z:p.z-1.5,health:60,yaw:p.yaw+.1};view.accept(corrected);
 assert.equal(view.state.z,old.z);assert.equal(view.state.health,60);
 const next=view.update(corrected,1/60);assert.ok(Math.abs(next.z-old.z)<.07);assert.equal(corrected.z,p.z-1.5);
 for(let i=0;i<180;i++)view.update(corrected,1/60);
 assert.ok(Math.abs(view.state.z-corrected.z)<.001);
 view.accept({...corrected,health:0});view.accept({...p,x:30,z:30},{teleport:true});assert.equal(view.state.x,30);assert.equal(view.state.z,30);
 view.reset();assert.equal(view.state,null);
});
await check('a late jump snapshot cannot draw the pilot below ground on landing',()=>{
 const room=newRoom(1e5),p=addPlayer(room,'a','Jumper'),view=createMotionView();
 view.accept(p);Object.assign(p,{y:1.16,jumpBase:0,jumpRemaining:.3});view.accept(p);
 for(let i=0;i<90;i++){predictPlayer(p,{},1/60,room);const shown=view.update(p,1/60);assert.ok(shown.y>=0);}
 assert.equal(p.y,0);
});
await check('camera follows smoothly through scenery without obstruction corrections',async()=>{
 const target={x:-17,y:2,z:-16},sim=await createSimulation(obstacles,()=>{});sim.state.started=true;sim.update(1/60,{});
 try{let camera={x:-17,y:2,z:-30};for(let i=0;i<60;i++){assert.deepEqual(sim.clipCamera(camera,target),target);const next=followCamera(camera,target,1/60);assert.ok(next.z>=camera.z&&next.z<=target.z);camera=next;}assert.ok(Math.abs(camera.z-target.z)<.02);}finally{sim.dispose();}
});
await check('trees and buildings still shield rivals from projectiles',()=>{
 for(const id of ['house:0','tree:inner:0']){
  const room=newRoom(1e5);for(const e of WORLD_ENTITIES)if(e.id!==id)room.destroyed[e.id]=1e12;
  const box=WORLD_ENTITIES.find(e=>e.id===id).boxes[0],a=addPlayer(room,'a','Shooter'),b=addPlayer(room,'b','Rival');
  Object.assign(a,{x:box.x,z:box.z-8,protectedUntil:0,yaw:0});Object.assign(b,{x:box.x,z:box.z+8,protectedUntil:0});
  applyInput(room,a.id,{seq:1,input:{cameraYaw:0},command:{id:1,type:'fire'}},room.time);
  for(let i=0;i<60;i++){a.lastSeen=b.lastSeen=room.time;advanceRoom(room,room.time+1000/30);}
  assert.equal(b.health,100,id);assert.ok(room.events.some(e=>e.type==='impact'));assert.equal(room.projectiles.length,0);
 }
});
console.log(`\n${checks} movement regressions passed. Simulation and presentation math only; no rendered-browser claim.`);
