import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const sourceRoot=process.env.BRICKWILD_SOURCE_ROOT?pathToFileURL(process.env.BRICKWILD_SOURCE_ROOT.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const core=await import(new URL('public/arena-core.js',sourceRoot));
const {WORLD_ENTITIES}=await import(new URL('public/world-data.js',sourceRoot));
const {weaponMuzzle}=await import(new URL('public/weapon-aim.js',sourceRoot));
const {blueprintMetrics}=await import(new URL('public/blueprint-metrics.js',sourceRoot));
const {createArenaView}=await import(new URL('public/arena-view.js',sourceRoot));
const THREE=await import(new URL('public/vendor/three.module.js',sourceRoot));
import {JSDOM} from 'jsdom';
const base=new URL('../validation/live/final-compact-none/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',base))).blueprint;
const car=read('armed-car'),octopus=read('octopus'),dragon=read('dragon');
const carry=(b,weapon=b.traits.weapon)=>({...b,movement:'carry',traits:{...b.traits,weapon}});
const fixtures=[['default-bow',null],['car-as-carried-pulse',carry(car,'pulse')],['octopus-as-carried-pulse',carry(octopus)],['car-as-carried-automatic',carry(car)],['dragon-as-carried-flame',carry(dragon)],['car-as-carried-bow',carry(car,'bow')],['saved-mounted-car',car],['saved-mounted-octopus',octopus],['saved-mounted-dragon',dragon]];
const dom=new JSDOM('');globalThis.document=dom.window.document;dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
const empty=Object.fromEntries(WORLD_ENTITIES.map(e=>[e.id,1e12]));
function setup(name,b,d,yaw,spread,seed,altitude=false){
 const r=core.newRoom(100000),p=core.addPlayer(r,'p','Shooter'),q=core.addPlayer(r,'q','Target');r.destroyed={...empty};r.nextDrop=1e12;r.seed=seed;
 Object.assign(p,{x:0,y:0,z:0,yaw,protectedUntil:0,kit:core.makeKit(b?name:'bow',b),motion:{}});
 Object.assign(q,{x:Math.sin(yaw)*d,y:0,z:Math.cos(yaw)*d,protectedUntil:0,motion:{}});
 if(spread==='zero')p.kit.stats.spread=0;
 if(altitude)q.y=weaponMuzzle(p).y-1.25;
 return {r,p,q};
}
const data=[];
for(const [name,b] of fixtures){
 const initial=setup(name,b,5,0,'zero',1),muzzle=weaponMuzzle(initial.p),row={name,weapon:initial.p.kit.stats.weapon,range:initial.p.kit.stats.range,muzzle,collision:initial.p.kit.stats.collision,cases:[]};
 // Actual renderer transforms, without a WebGLRenderer or pixel claim.
 if(b){let error=0;for(let i=0;i<8;i++){
  const s=setup(name,b,5,i*Math.PI/4,'zero',1),scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera());view.update(core.roomSnapshot(s.r,'p'),s.p,new Map([[name,b]]),0,s.r.time);
  const model=scene.getObjectByName('arena-player:p').getObjectByName('creation');scene.updateMatrixWorld(true);
  const emitter=new THREE.Vector3(...blueprintMetrics(b).normalize(b.traits.emitter)).applyMatrix4(model.matrixWorld),actual=weaponMuzzle(s.p);
  error=Math.max(error,emitter.distanceTo(new THREE.Vector3(actual.x,actual.y,actual.z)));view.clear();
 }row.maxRendererEmitterError=error;}
 for(const distance of [0,.9,2,5,10,20]){
  if(distance>row.range){row.cases.push({distance,outsideNominalRange:true});continue;}
  const result={distance,zero:0,zeroN:0,spread:0,spreadN:0,alignedAltitude:0,alignedN:0,cameraInvariant:true,zeroFacings:[]};
  for(let face=0;face<8;face++){
   const byCamera=[];
   for(const camera of [0,Math.PI/2,Math.PI]){
    const s=setup(name,b,distance,face*Math.PI/4,'zero',1);core.applyInput(s.r,'p',{seq:1,input:{cameraYaw:s.p.yaw+camera},command:{id:1,type:'fire'}},s.r.time);core.advanceRoom(s.r,s.r.time+1000);
    const hit=s.q.health<100;result.zero+=hit;result.zeroN++;byCamera.push({hit,shot:s.r.events.find(e=>e.type==='shot')?.projectile});
   }result.zeroFacings.push(byCamera[0].hit);result.cameraInvariant&&=JSON.stringify(byCamera[0])===JSON.stringify(byCamera[1])&&JSON.stringify(byCamera[1])===JSON.stringify(byCamera[2]);
   for(const seed of [1,123456,987654321,0x7fffffff]){const s=setup(name,b,distance,face*Math.PI/4,'actual',seed);core.applyInput(s.r,'p',{seq:1,input:{cameraYaw:s.p.yaw+Math.PI},command:{id:1,type:'fire'}},s.r.time);core.advanceRoom(s.r,s.r.time+1000);result.spread+=s.q.health<100;result.spreadN++;}
   const a=setup(name,b,distance,face*Math.PI/4,'zero',1,true);core.applyInput(a.r,'p',{seq:1,command:{id:1,type:'fire'}},a.r.time);core.advanceRoom(a.r,a.r.time+1000);result.alignedAltitude+=a.q.health<100;result.alignedN++;
  }row.cases.push(result);
 }
 data.push(row);console.error(name,'complete');
}
dom.window.close();console.log(JSON.stringify({source:process.env.BRICKWILD_AUDIT_LABEL||'current local source',method:'Isolated simulation plus renderer transform inspection, no WebGL pixels or production calls. Four fixed spread seeds; not statistical accuracy estimates.',data},null,2));
