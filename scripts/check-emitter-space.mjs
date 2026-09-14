import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const sourceRoot=process.env.BRICKWILD_SOURCE_ROOT?pathToFileURL(process.env.BRICKWILD_SOURCE_ROOT.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
import fs from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const THREE=await import(new URL('public/vendor/three.module.js',sourceRoot));
const {newRoom,addPlayer,makeKit,applyInput,advanceRoom,roomSnapshot}=await import(new URL('public/arena-core.js',sourceRoot));
const {WORLD_ENTITIES}=await import(new URL('public/world-data.js',sourceRoot));
const {createArenaView}=await import(new URL('public/arena-view.js',sourceRoot));
const {blueprintMetrics}=await import(new URL('public/blueprint-metrics.js',sourceRoot));
const {weaponMuzzle}=await import(new URL('public/weapon-aim.js',sourceRoot));
const dom=new JSDOM('');globalThis.document=dom.window.document;
dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
const read=n=>JSON.parse(fs.readFileSync(new URL('../validation/live/final-compact-none/'+n+'.json',import.meta.url))).blueprint;
function fixture(b,yaw=0){const r=newRoom(100000),p=addPlayer(r,'p','Builder');for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;r.nextDrop=1e12;Object.assign(p,{x:0,y:3,z:0,yaw,kit:makeKit('fixture',b),protectedUntil:0,motion:{}});return {r,p};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
for(const name of ['armed-car','octopus','dragon'])test(`${name}: serialized handheld kit fires from the renderer's authored emitter in eight facings`,()=>{
 const b={...read(name),movement:'carry'};
 for(let i=0;i<8;i++){
  const {r,p}=fixture(b,i*Math.PI/4);p.kit=JSON.parse(JSON.stringify(p.kit));
  const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera());view.update(roomSnapshot(r,p.id),p,new Map([['fixture',b]]),0,r.time);scene.updateMatrixWorld(true);
  const model=scene.getObjectByName('arena-player:p').getObjectByName('creation'),visual=new THREE.Vector3(...blueprintMetrics(b).normalize(b.traits.emitter)).applyMatrix4(model.matrixWorld);
  assert.ok(distance(visual,weaponMuzzle(p))<1e-7,`${name} yaw ${p.yaw}: ${distance(visual,weaponMuzzle(p))}m emitter discrepancy`);
  applyInput(r,p.id,{seq:1,input:{cameraYaw:p.yaw+Math.PI},command:{id:1,type:'fire'}},r.time);
  const shot=r.events.find(e=>e.type==='shot');assert.ok(distance(visual,shot.projectile)<1e-7);assert.equal(p.yaw,i*Math.PI/4);view.clear();
 }
});
test('carried emitter bounds apply in model space before the hand translation',()=>{
 const saved=read('dragon'),b={...saved,movement:'carry',traits:{...saved.traits,emitter:[16,16,16]}},metrics=blueprintMetrics(b),k=makeKit('extreme',b),grip=metrics.normalize([0,0,0]);
 const modelPoint=k.muzzle.map((v,i)=>v-[.76,1.1,.3][i]+grip[i]);
 for(const i of [0,2])assert.ok(Math.abs(modelPoint[i])<=metrics.size[i]/2+.80000001);
 assert.ok(modelPoint[1]>=.2&&modelPoint[1]<=metrics.size[1]+.80000001);
});
test('mounted emitter coordinates and ordinary point-blank cover ordering remain intact',()=>{
 for(const name of ['armed-car','octopus','dragon']){const b=read(name),{p}=fixture(b),expected=blueprintMetrics(b).normalize(b.traits.emitter);assert.ok(distance(weaponMuzzle(p),{x:expected[0],y:expected[1]+3,z:expected[2]})<1e-7);}
 const b={...read('dragon'),movement:'carry'};
 for(const cover of [false,true]){const {r,p}=fixture(b),q=addPlayer(r,'q','Target');Object.assign(q,{x:0,y:3,z:.9,protectedUntil:0,motion:{}});if(cover)r.placed.push({id:'wall',x:0,z:0,w:4,h:8,d:.1,hp:1000});
  const packet={seq:1,command:{id:1,type:'fire'}};applyInput(r,p.id,packet,r.time);advanceRoom(r,r.time+300);applyInput(r,p.id,{...packet,seq:2},r.time);
  assert.equal(r.events.filter(e=>e.type==='hit').length,cover?0:1);assert.equal(r.events.filter(e=>e.type==='impact').length,cover?1:0);assert.equal(r.projectiles.length,0);
 }
});
