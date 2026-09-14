import {solveWeaponAim,HANDHELD_AIM_CAP} from '../public/aiming.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import * as THREE from '../public/vendor/three.module.js';
import {newRoom,addPlayer,makeKit,applyInput,advanceRoom,roomSnapshot} from '../public/arena-core.js';
import {newMotion,packFrame} from '../public/movement-stream.js';
import {WORLD_ENTITIES} from '../public/world-data.js';
import {poseWeaponHands} from '../public/weapon-pose.js';
import {character} from '../public/models.js';
import {weaponMuzzle,weaponGrip,weaponAim} from '../public/weapon-aim.js';
import {createShotPlayback} from '../public/shot-playback.js';
import {createArenaView} from '../public/arena-view.js';
import {createSimulation} from '../public/simulation.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../validation/live/final-compact-none/armed-car.json',import.meta.url))).blueprint;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(kit=makeKit('bow')){const r=newRoom(100000),p=addPlayer(r,'p','Builder');for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;Object.assign(p,{x:0,y:8,z:0,yaw:1.2,protectedUntil:0,kit});r.nextDrop=1e12;return {r,p};}
let checks=0;async function check(name,fn){await fn();console.log('PASS '+name);checks++;}
await check('every ranged weapon follows the character despite sideways and backward camera orbit',()=>{
 for(const weapon of ['bow','pulse','automatic','flame'])for(const movement of ['carry','drive','fly'])for(const yaw of [-2.1,0,1.7])for(const pitch of [-.65,0,.65]){
  const {r,p}=setup(makeKit('test',{...fixture,movement,traits:{...fixture.traits,weapon}}));p.kit.stats.spread=0;
  applyInput(r,p.id,{seq:1,input:{cameraYaw:yaw,aimPitch:-pitch,weaponPitch:pitch},command:{id:1,type:'fire'}},r.time);
  near(p.yaw,1.2);const b=r.projectiles[0],event=r.events.find(e=>e.type==='shot'),from=solveWeaponAim(r,p).muzzle;assert.ok(b);assert.deepEqual(event.projectile,b);
  for(const k of ['x','y','z'])near(b[k],from[k]);near(Math.atan2(b.vx,b.vz),solveWeaponAim(r,p).yaw);assert.ok(Math.abs(solveWeaponAim(r,p).correction)<=HANDHELD_AIM_CAP);near(Math.atan2(b.vy,Math.hypot(b.vx,b.vz)),0);
 }
});
await check('ground, target and world-cover contacts retain the shot ID and exact position',()=>{
 for(const kind of ['target','cover']){
  const {r,p}=setup();p.yaw=0;p.kit.muzzle=[-.85,1.4,0];const pitch=kind==='ground'?-.65:0;
  if(kind!=='ground')r.placed.push({id:kind,x:0,z:4,w:3,h:20,d:.4,hp:100});
  applyInput(r,p.id,{seq:1,input:{cameraYaw:0,weaponPitch:pitch},command:{id:1,type:'fire'}},r.time);const b={...r.projectiles[0]};advanceRoom(r,r.time+1000);
  const impact=r.events.find(e=>e.type==='impact');assert.ok(impact);assert.equal(impact.attack,b.id);assert.equal(r.projectiles.length,0);
  if(kind==='ground')near(impact.y,0);else near(impact.z,3.8);
  const t=(impact.z-b.z)/b.vz;near(impact.x,b.x+b.vx*t);near(impact.y,b.y+b.vy*t);
 }
});
await check('legacy pitch inputs cannot tilt a weapon or launch an emitter beneath the ground',()=>{
 const {r,p}=setup();p.y=0;p.kit.muzzle=[0,-.2,5];applyInput(r,p.id,{seq:1,input:{cameraYaw:0,weaponPitch:-.75},command:{id:1,type:'fire'}},r.time);assert.ok(r.projectiles[0].y>=.019);near(r.projectiles[0].vy,0);near(p.aimPitch,0);
});
await check('the island target receives impact feedback on its front surface',()=>{
 const {r,p}=setup(),entity=WORLD_ENTITIES.find(e=>e.id==='target:0'),face=entity.boxes[0];delete r.destroyed[entity.id];Object.assign(p,{x:face.x,y:0,z:face.z-6,yaw:0});applyInput(r,p.id,{seq:1,input:{cameraYaw:0,aimPitch:0},command:{id:1,type:'fire'}},r.time);advanceRoom(r,r.time+500);const impact=r.events.find(e=>e.type==='impact');assert.equal(impact.entity,'target:0');near(impact.z,face.z-face.d/2);assert.ok(r.damage['target:0']>0);
});
await check('short shots remain visible before a single confirmed impact; misses do not invent hits',()=>{
 const replay=createShotPlayback(),b={id:1,x:0,y:2,z:0,vx:0,vy:0,vz:68,range:38,weapon:'automatic'};
 replay.add(b);assert.ok(replay.contact({type:'impact',attack:1,x:0,y:2,z:2}));assert.deepEqual(replay.update(.02),[]);assert.ok(replay.shots.get(1).position.z>0);assert.ok(replay.shots.get(1).position.z<2);
 const impacts=replay.update(.09);assert.equal(impacts.length,1);assert.equal(impacts[0].z,2);assert.equal(replay.shots.size,0);replay.add(b);assert.equal(replay.shots.size,0);assert.deepEqual(replay.update(.2),[]);
 replay.add({...b,id:2});replay.contact({type:'shot-end',attack:2,x:0,y:2,z:38});assert.deepEqual(replay.update(2),[]);assert.equal(replay.shots.size,0);
 replay.add({...b,id:3});replay.update(.1,[{x:0,y:2,z:2,w:2,h:2,d:.2}]);near(replay.shots.get(3).position.z,1.9);assert.deepEqual(replay.update(.2),[]);near(replay.shots.get(3).position.z,1.9);replay.clear();assert.equal(replay.shots.size,0);
});
const dom=new JSDOM('');globalThis.document=dom.window.document;dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
await check('rendered ranged attacks keep actors facing and align a carried emitter with its shot origin',()=>{
 for(const movement of ['carry','drive','fly']){const blueprint={...fixture,movement},kit=makeKit('test',blueprint),{r,p}=setup(kit),scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),cache=new Map([['test',blueprint]]);
  Object.assign(p,{aimYaw:-1.1,aimPitch:.5});view.update(roomSnapshot(r,p.id),p,cache,.016,r.time);const actor=scene.getObjectByName('arena-player:p');
  view.effect({type:'attack-preview',player:p.id,weapon:'automatic',yaw:p.aimYaw,pitch:p.aimPitch,origin:weaponMuzzle(p,p.aimYaw,p.aimPitch),time:r.time});view.update(roomSnapshot(r,p.id),p,cache,.016,r.time+16);near(actor.rotation.y,p.yaw);
  if(movement==='carry'){const model=actor.getObjectByName('creation');scene.updateMatrixWorld(true);const grip=new THREE.Vector3(...weaponGrip(kit)).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw).add(actor.position);const expected=weaponMuzzle(p,p.aimYaw,p.aimPitch);const offset=new THREE.Vector3(...kit.muzzle).sub(new THREE.Vector3(.76,1.1,.3)).applyEuler(new THREE.Euler(0,p.yaw,0,'YXZ')).add(grip);near(offset.x,expected.x);near(offset.y,expected.y);near(offset.z,expected.z);near(model.rotation.y,solveWeaponAim(r,p).correction);}
  view.clear();
 }
});
await check('anatomical right hand holds one-handed weapons and fires; bow uses left grip and right draw',()=>{
 const hand=(arm)=>new THREE.Vector3(0,-.59,.015).applyMatrix4(arm.matrixWorld);
 for(const weapon of ['pulse','automatic','flame','blade','hammer','knife','bow']){const pilot=character(),kit=makeKit('test',{...fixture,movement:'carry',traits:{...fixture.traits,weapon}});poseWeaponHands(pilot,kit,.2,.8);pilot.group.updateMatrixWorld(true);const primary=weapon==='bow'?pilot.arms[1]:pilot.arms[0];assert.ok(primary.position.x*(weapon==='bow'?1:-1)>0);assert.ok(hand(primary).distanceTo(new THREE.Vector3(...weaponGrip(kit)))<.02);}
 const pilot=character();poseWeaponHands(pilot,makeKit('foot'),0,1);assert.ok(pilot.arms[0].rotation.x<pilot.arms[1].rotation.x);assert.ok(pilot.arms[0].position.z>pilot.arms[1].position.z);
});
await check('shared Practice hand posing preserves gait and restores it after a punch',()=>{
 const pilot=character(),kit=makeKit('foot');
 for(const swing of [-.4,0,.4]){pilot.arms[0].rotation.x=swing;pilot.arms[1].rotation.x=-swing;poseWeaponHands(pilot,kit,0,0);near(pilot.arms[0].rotation.x,swing);near(pilot.arms[1].rotation.x,-swing);poseWeaponHands(pilot,kit,0,1);assert.ok(pilot.arms[0].position.z>0);pilot.arms[0].rotation.x=swing;pilot.arms[1].rotation.x=-swing;poseWeaponHands(pilot,kit,0,0);near(pilot.arms[0].rotation.x,swing);near(pilot.arms[1].rotation.x,-swing);near(pilot.arms[0].position.z,0);}
});
await check('Arena walking and sprinting alternate arms opposite legs, including the free carrying arm',()=>{
 for(const speed of [7,12])for(const kit of [makeKit('foot'),makeKit('sword')]){
  const {r,p}=setup(kit);p.speed=speed;const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera());
  const draw=t=>view.update(roomSnapshot(r,p.id),p,new Map(),1/60,t);draw(r.time);const pilot=scene.getObjectByName('arena-player:p').children[0],arms=[-.68,.68].map(x=>pilot.children.find(c=>c.position.x===x)),leg=pilot.children.find(c=>c.position.x===.24);let first;
  for(const dt of [0,Math.PI*85]){draw(r.time+dt);const swing=arms[1].rotation.x;assert.ok(Math.abs(swing)>.05);if(first!==undefined)assert.ok(first*swing<0);first=swing;if(kit.id==='foot')assert.ok(arms[0].rotation.x*swing<0);assert.ok(leg);assert.ok(leg.rotation.x*swing<0);}
  view.effect({type:'attack-preview',player:p.id,weapon:kit.stats.weapon,time:r.time});draw(r.time+Math.PI*85+130);draw(r.time+Math.PI*85+800);assert.ok(arms[1].rotation.x>-.5&&arms[1].rotation.x<.5);near(arms[1].position.z,0);p.speed=0;draw(r.time+1500);near(arms[1].rotation.x,0);assert.equal(r.events.filter(e=>['shot','swing'].includes(e.type)).length,0);view.clear();
 }
});
await check('a shot born and hit between snapshots draws a tracer then a marker at the actual contact',()=>{
 const {r,p}=setup(),scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera());view.update(roomSnapshot(r,p.id),p,new Map(),.016,r.time);
 const b={id:77,x:0,y:3,z:0,vx:0,vy:0,vz:36,range:56,weapon:'bow',color:'#ffcf55'};
 view.effect({type:'shot',player:p.id,predicted:true,weapon:'bow',yaw:0,pitch:0,...b,projectile:b});view.effect({type:'hit',player:'rival',attack:77,x:0,y:3,z:2});
 view.update(roomSnapshot(r,p.id),p,new Map(),.02,r.time+20);assert.ok(scene.getObjectByName('projectile:77'));assert.equal(scene.getObjectByName('impact:77'),undefined);
 view.update(roomSnapshot(r,p.id),p,new Map(),.09,r.time+110);assert.equal(scene.getObjectByName('projectile:77'),undefined);assert.deepEqual(scene.getObjectByName('impact:77').position.toArray(),[0,3,2]);view.clear();assert.equal(scene.getObjectByName('impact:77'),undefined);
});
dom.window.close();delete globalThis.document;
await check('Practice shots ignore camera orbit and legacy tilt, and stop at actual contacts',async()=>{
 const events=[],sim=await createSimulation([{id:'wall',x:0,y:2,z:4,w:4,h:4,d:.4}],e=>events.push(e));Object.assign(sim.state,{started:true,x:0,y:0,z:0,yaw:0});sim.build('bow');for(let i=0;i<120;i++)sim.update(1/60,{});
 sim.action({cameraYaw:Math.PI,weaponPitch:0});const shot=events.findLast(e=>e.type==='shoot');assert.ok(shot.impact);near(shot.to.z,3.8);near(sim.state.yaw,0);assert.equal(shot.target,null);
 sim.update(1,{});sim.state.cooldown=0;sim.action({cameraYaw:Math.PI,weaponPitch:-.65});const down=events.findLast(e=>e.type==='shoot');near(down.to.y,shot.to.y);assert.ok(down.impact);assert.ok(down.to.z>down.from.z);sim.dispose();
});
// New held-fire acceptance is current-time work, never historical catch-up.
function acceptedFixture(weapon='bow'){
 const {r,p}=setup(weapon==='bow'?makeKit('bow'):makeKit('test',{...fixture,movement:'carry',traits:{...fixture.traits,weapon}}));p.motion=newMotion(r.time);const origin=r.time;let seq=0;
 const send=(at,input={},command,extra={})=>{advanceRoom(r,origin+at);const packet={seq:++seq,motionEpoch:0,roundId:r.round.id,frames:[],input,command,...extra};applyInput(r,p.id,packet,r.time);return packet;};
 return {r,p,origin,send,shots:()=>r.events.filter(e=>e.type==='shot')};
}
await check('fresh command-free held fire shoots now even with no future room advance',()=>{
 for(const weapon of ['bow','automatic'])for(const gap of [0,100,600,1500,1600,1720,1750]){
  const n=acceptedFixture(weapon);n.send(gap,{fire:true});assert.equal(n.shots().length,1,'a fresh eligible hold must not depend on a later request');const e=n.shots()[0];assert.equal(e.time,n.origin+gap);assert.equal(e.projectile.born,e.time);assert.equal(e.commandId,null);
  const shotCount=n.shots().length;n.send(gap+1720,{fire:false});assert.equal(n.shots().length,shotCount,'expired historical hold is not replayed');advanceRoom(n.r,n.r.time+2000);assert.equal(n.shots().length,shotCount,'accepted release/outage cannot fire');
 }
});
await check('fixed accepted holds retain expiry and cooldown across staggered or aligned advances',()=>{
 for(const weapon of ['bow','automatic'])for(const phase of [[],[200,400,600,800,1000,1200,1400,1600]]){
  const n=acceptedFixture(weapon);n.send(0,{fire:true});for(const at of phase)advanceRoom(n.r,n.origin+at);n.send(1720,{fire:false});const shots=n.shots();assert.equal(shots[0].time,n.origin);assert.ok(shots.every(e=>e.time<n.origin+750));for(let i=1;i<shots.length;i++)assert.ok(shots[i].time-shots[i-1].time>=n.p.kit.stats.interval*1000-1e-7);assert.equal(n.r.projectiles.length,0,'no already-expired projectile survives the later advance');
 }
 for(const release of [100,749,750,751]){const n=acceptedFixture('automatic');n.send(0,{fire:true});n.send(release,{fire:false});const cursor=n.r.eventId;advanceRoom(n.r,n.origin+5000);assert.equal(n.r.events.filter(e=>e.id>cursor&&e.type==='shot').length,0);}
});
await check('current held-fire attempts preserve protection, heat, cooldown, death, building and command guards',()=>{
 for(const block of ['protected','heat','cooldown','dead','building','unarmed','old-epoch','old-round']){
  const n=acceptedFixture();if(block==='protected')n.p.protectedUntil=n.origin+5000;if(block==='heat')n.p.overheatedUntil=n.origin+5000;if(block==='cooldown')n.p.nextShot=n.origin+5000;if(block==='dead')n.p.health=0;if(block==='building')n.p.building={kit:makeKit('bow'),starts:n.origin,ends:n.origin+5000};if(block==='unarmed')n.p.kit.stats.damage=0;
  n.send(0,{fire:true},undefined,block==='old-epoch'?{motionEpoch:99}:block==='old-round'?{roundId:99}:{});assert.equal(n.shots().length,0,block);
 }
 const n=acceptedFixture();const first=n.send(0,{fire:false},{id:1,type:'fire'});assert.equal(n.shots().length,1);n.send(0,{fire:false});advanceRoom(n.r,n.origin+2000);applyInput(n.r,n.p.id,first,n.r.time);assert.equal(n.shots().length,1,'old sequence cannot replay a shot');
 n.send(2000,{fire:true},{id:1,type:'fire'});assert.equal(n.shots().length,1,'duplicate command is not recast as fresh held fire');n.send(2000,{fire:false});advanceRoom(n.r,n.origin+4000);assert.equal(n.shots().length,1);
 n.send(4000,{fire:true});n.send(4000,{fire:true});assert.equal(n.shots().length,2,'same-time fresh updates obey cooldown');
});
await check('held-fire acceptance uses the moved authoritative pose and supplied contact solver',()=>{
 const n=acceptedFixture(),oldZ=n.p.z;let calls=0;const packet={seq:1,motionEpoch:0,roundId:n.r.round.id,frames:[packFrame(1,{z:1})],input:{fire:true}};
 applyInput(n.r,n.p.id,packet,n.r.time,null,(room,p)=>{calls++;assert.equal(p.motion.frame,1);assert.ok(p.z>oldZ);return solveWeaponAim(room,p);});assert.equal(calls,1);assert.deepEqual(n.shots()[0].muzzle,solveWeaponAim(n.r,n.p).muzzle);assert.equal(n.shots()[0].time,n.r.time);
 // A failed CAS attempt is discarded; re-running from the same committed state
 // is deterministic and adds no external side effect or extra accepted shot.
 const left=acceptedFixture(),right=acceptedFixture();left.send(0,{fire:true});right.send(0,{fire:true});assert.deepEqual(left.r,right.r);
});
await check('fresh held melee keeps windup and release never creates another strike',()=>{
 const n=acceptedFixture();n.p.kit=makeKit('foot');Object.assign(n.p,{x:0,y:0,z:10,yaw:0});const target=addPlayer(n.r,'target','Target',n.r.time);Object.assign(target,{x:0,y:0,z:11.7,protectedUntil:0});target.motion=newMotion(n.r.time);
 n.send(0,{fire:true});const swings=()=>n.r.events.filter(e=>e.type==='swing');assert.equal(swings().length,1);assert.equal(target.health,100);const windup=n.p.melee.at;n.send(1,{fire:false});advanceRoom(n.r,windup-1);assert.equal(target.health,100);advanceRoom(n.r,windup+40);near(target.health,100-n.p.kit.stats.damage*(1-target.kit.stats.armor));advanceRoom(n.r,n.origin+5000);assert.equal(swings().length,1);assert.equal(n.r.events.filter(e=>e.type==='hit').length,1);
});
console.log(`\n${checks} firing, shot playback and impact checks passed.`);
