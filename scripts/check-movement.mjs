import {moveDirect} from '../public/movement.js';
import {movementShape,canFit,slideMove} from '../public/movement-blocking.js';
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
await check('swept blocking slides at walls and corners for foot, car, plane and generated mounts',()=>{
 const b={x:0,y:3,z:0,w:6,h:6,d:6};const blueprint=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;
 for(const mode of ['foot','car','plane','dragon']){const stats=makeKit(mode,mode==='dragon'?blueprint:null).stats,shape=movementShape(stats);const p={x:-12,y:0,z:-2,yaw:0};
  for(let i=0;i<120;i++){const old={...p};moveDirect(p,{x:-.35,z:1,cameraYaw:Math.PI/2},1/60,{speed:22,mounted:stats.mounted,shape,boxes:[b]});assert.ok(Math.hypot(p.x-old.x,p.z-old.z)<=22/60+1e-6);assert.ok(canFit(p,shape,[b]));}assert.ok(p.z< -3-shape.radius); // Slides to the end of the wall.
  const resting={...p};for(let i=0;i<60;i++)moveDirect(p,{},1/60,{speed:22,shape,boxes:[b]});assert.equal(p.x,resting.x);assert.equal(p.z,resting.z);
  const fast=slideMove({x:-30,y:0,z:0},{x:30,y:0,z:0},shape,[b]);assert.ok(fast.x< -3-shape.radius);assert.ok(canFit(fast,shape,[b]));
 }
 const shape={radius:.45,height:2.5},boxes=[b,{x:0,y:3,z:8,w:6,h:6,d:6}];const start={x:-10,y:0,z:4};const end=slideMove(start,{x:10,y:0,z:4},shape,boxes);assert.equal(end.x,10); // Two metre route admits a walker.
 const large=slideMove(start,{x:10,y:0,z:4},{radius:3,height:3},boxes);assert.ok(large.x< -6);
});
await check('authoritative and predicted blocking agree; flight clears roofs and lowering stops on them',()=>{
 const r=newRoom(1e5),p=addPlayer(r,'a','Pilot');Object.assign(p,{x:-30,z:-16,y:0,kit:makeKit('plane')});const q=structuredClone(p);
 for(let i=0;i<100;i++){const input={z:1,cameraYaw:Math.PI/2};predictPlayer(q,input,1/30,r);applyInput(r,'a',{seq:i+1,input},r.time);advanceRoom(r,r.time+1000/30);assert.ok(Math.abs(p.x-q.x)<1e-6);}
 assert.ok(p.x< -24);p.y=9;for(let i=0;i<18;i++)predictPlayer(p,{z:1,cameraYaw:Math.PI/2},1/30,r);assert.ok(p.x> -20);
 p.x=-17;p.z=-16;for(let i=0;i<90;i++)predictPlayer(p,{down:true},1/30,r);assert.ok(Math.abs(p.y-6.3)<.001);
 p.kit=makeKit();const position={x:p.x,y:p.y,z:p.z};predictPlayer(p,{},1/30,r);for(const k of ['x','y','z'])assert.equal(p[k],position[k]);
});
await check('mount assembly beside a building preserves pose and previous equipment',async()=>{
 const notices=[],room=newRoom(1e5),p=addPlayer(room,'a','Builder');Object.assign(p,{x:-21,z:-16,yaw:0});
 p.building={kit:makeKit('plane'),starts:room.time-2800,ends:room.time};advanceRoom(room,room.time+34);
 assert.equal(p.kit.id,'foot');assert.equal(p.x,-21);assert.equal(p.z,-16);assert.ok(room.events.some(e=>e.type==='notice'));
 const sim=await createSimulation([{kind:'house',x:0,y:3,z:17,w:8,h:6,d:8}],e=>notices.push(e));sim.state.started=true;sim.build('plane');for(let i=0;i<125;i++)sim.update(1/60,{});assert.equal(sim.state.mode,'foot');assert.equal(sim.state.z,17);assert.ok(notices.some(e=>e.type==='notice'));sim.dispose();
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
  Object.assign(a,{kit:makeKit('bow'),x:box.x,z:box.z-8,protectedUntil:0,yaw:0});Object.assign(b,{x:box.x,z:box.z+8,protectedUntil:0});a.kit.muzzle=[0,1.4,1]; // Centered fixture ray must cross the narrow trunk.
  applyInput(room,a.id,{seq:1,input:{cameraYaw:0},command:{id:1,type:'fire'}},room.time);
  for(let i=0;i<60;i++){a.lastSeen=b.lastSeen=room.time;advanceRoom(room,room.time+1000/30);}
  assert.equal(b.health,100,id);assert.ok(room.events.some(e=>e.type==='impact'));assert.equal(room.projectiles.length,0);
 }
});
console.log(`\n${checks} movement regressions passed. Simulation and presentation math only; no rendered-browser claim.`);
