import {makeKit} from './arena-core.js';
import {weaponMuzzle,aimDirection,weaponAim} from './weapon-aim.js';
import {movementShape,isMovementBlocker,canFit} from './movement-blocking.js';
import {creationStats} from './combat.js';
import {segmentBox,boxesOverlap} from './geometry.js';
import {moveDirect,startJump} from './movement.js';
import {BUILDS,createState,GATES,RINGS,TARGETS,CRATES,completion,nearestTarget} from './rules.js';
import {customMode,validateBlueprint} from './blueprint.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export async function createSimulation(obstacles,onEvent){
 const scenery=new Map(obstacles.map((o,i)=>[i,{...o,y:o.y??o.h/2}]));
 let s=createState();let checkAccumulator=0;
 const movementBoxes=()=>[...scenery.values()].filter(isMovementBlocker).concat([...placements.values()]);
 const placements=new Map();let placementId=0;
 function setMode(mode){s.mode=mode;s.jumpRemaining=0;s.vertical=0;s.vy=0;s.grounded=undefined;s.flightAltitude=s.y;}
 function removeEntity(id){for(const [key,o]of scenery)if(o.id===id)scenery.delete(key);s.destroyed||={};s.destroyed[id]=true;}
 function emit(type,data={}){onEvent({type,...data});}
 function rayDistance(from,to,ignore){const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);let t=1;for(const o of [...scenery.values(),...placements.values()]){if(ignore&&o.id===ignore)continue;const hit=segmentBox(from,to,o);if(hit)t=Math.min(t,hit.t);}return t<1?Math.max(.2,distance*t-.45):distance;}
 // Scenery protects against shots, but never changes movement or camera position.
 function clipCamera(from,to){return {...to};}
 function build(mode){
  if(!(mode in BUILDS)||!s.started||s.paused)return false;
  if(s.building){emit('notice',{text:'Bricks are still snapping into place…'});return false;}
  if(s.mode===mode&&!s.custom){emit('notice',{text:`${BUILDS[mode].name} is ready!`});return false;}
  if(mode==='foot'){s.custom=null;setMode('foot');s.speed=0;s.vertical=0;emit('mode',{mode});return true;}
  s.building={mode,time:0,duration:1.9};emit('build',{mode});return true;
 }
 function buildCustom(design){
  if(!s.started||s.paused||s.building)return false;
  const blueprint=validateBlueprint(design.blueprint),custom={blueprint,dimensions:design.dimensions};const mode=customMode(blueprint);
  s.building={mode,custom,time:0,duration:1.2};emit('build',{mode,custom});return true;
 }
 function jump(){if(s.started&&!s.paused&&startJump(s,['car','plane'].includes(s.mode)))emit('jump');}
 function action(aim){
  if(!s.started||s.paused||s.building||s.cooldown>0)return;
  s.actionTime=.40;s.cooldown=s.mode==='bow'?.62:s.mode==='sword'?.48:.3;
  if(s.custom?.blueprint.ability==='pulse'||s.mode==='bow'&&!s.custom){
   const kit=makeKit(s.custom?'generated':s.mode,s.custom?.blueprint),{yaw,pitch}=weaponAim({...s,kit},aim?.weaponPitch),from=weaponMuzzle({...s,kit},yaw,pitch),dir=aimDirection(yaw,pitch),range=kit.stats.range;
   const anchor={x:s.x,y:s.y+Math.max(1.2,kit.stats.collision[1]*.6),z:s.z};let obstruction=from.y<.02?Math.max(0,(anchor.y-.02)/(anchor.y-from.y)):1;
   for(const o of [...scenery.values(),...placements.values()]){const hit=segmentBox(anchor,from,o);if(hit)obstruction=Math.min(obstruction,Math.max(0,hit.t-.02));}for(const key of ['x','y','z'])from[key]=anchor[key]+(from[key]-anchor[key])*obstruction;
   let to={x:from.x+dir.x*range,y:from.y+dir.y*range,z:from.z+dir.z*range};
   let nearest=to.y<=0?{t:from.y/Math.max(1e-9,from.y-to.y),id:'ground'}:null;
   const targets=TARGETS.map((t,i)=>({x:t.x,y:1.9,z:t.z,w:1.75,h:1.75,d:.4,id:'target:'+i})).filter((_,i)=>!s.targets.includes(i));
   for(const o of [...scenery.values(),...placements.values(),...targets]){const hit=segmentBox(from,to,o);if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,id:o.id};}
   if(nearest)to=Object.fromEntries(['x','y','z'].map(key=>[key,from[key]+(to[key]-from[key])*nearest.t]));
   const target=String(nearest?.id).startsWith('target:')?Number(nearest.id.slice(7)):null;
   emit('shoot',{target,from,to,yaw,pitch,impact:!!nearest,pulse:!!s.custom,color:kit.color,speed:kit.stats.projectileSpeed});return;
  }
  if(s.mode==='foot')jump();
  if(s.mode==='car'&&s.custom?.blueprint.ability!=='swing'){s.boostUntil=s.time+.7;emit('boost');}
  if((s.mode==='sword'&&!s.custom)||s.custom?.blueprint.ability==='swing'){const list=CRATES.map((t,i)=>({...t,id:i})).filter(t=>!s.crates.includes(t.id));const target=nearestTarget(s,list,3.8,-.25);if(target){s.crates.push(target.id);s.bricks+=12;emit('smash',{id:target.id});}else emit('swing');}
 }
 function hitTarget(id){if(Number.isInteger(id)&&id>=0&&id<TARGETS.length&&!s.targets.includes(id)){s.targets.push(id);s.bricks+=10;emit('target',{id});}}
 function respawn(){s.x=0;s.z=17;s.y=0;s.vertical=0;s.jumpRemaining=0;s.flightAltitude=0;s.yaw=Math.PI;s.speed=0;s.vy=0;s.grounded=true;s.autoRun=false;emit('notice',{text:'Back at the plaza. Keep building!'});}
 function returnToFoot(){s.custom=null;s.building=null;setMode('foot');s.speed=0;s.vertical=0;s.autoRun=false;}
 function reset(){s=createState();setMode('foot');emit('reset');}
 function placeCreation(dimensions){
  const [w,h,d]=dimensions.map(v=>clamp(v,.1,10));
  for(const radius of [Math.max(w,d)/2+4,12,18])for(let i=0;i<12;i++){
   const a=s.yaw+i*Math.PI/6,x=clamp(s.x+Math.sin(a)*radius,-49,49),z=clamp(s.z+Math.cos(a)*radius,-49,49),candidate={x,y:h/2,z,w,h,d};
   if([...scenery.values(),...placements.values()].some(b=>boxesOverlap(candidate,b)))continue;
   const id=++placementId;placements.set(id,{...candidate,id});return {id,x,y:0,z};
  }return null;
 }
 function removePlacement(id){placements.delete(id);}
 function update(dt,input){
  if(!s.started||s.paused)return;dt=Math.min(dt,.1);s.time+=dt;s.actionTime=Math.max(0,s.actionTime-dt);s.cooldown=Math.max(0,s.cooldown-dt);
  if(s.building){s.building.time+=dt;if(s.building.time>=s.building.duration){const built=s.building;const stats=creationStats(built.custom?.blueprint||built.mode,built.custom?.dimensions);if(!canFit(s,movementShape(stats),movementBoxes())){s.building=null;emit('notice',{text:'Move into open space and rebuild your creation.'});return;}s.custom=built.custom||null;setMode(built.mode);if(!s.built.includes(s.mode))s.built.push(s.mode);s.building=null;s.vertical=0;if(s.custom?.blueprint.movement==='static'){const design=s.custom;s.custom=null;emit('placed',{design});}else emit('mode',{mode:s.mode,custom:s.custom});}}
  const previous={x:s.x,y:s.y,z:s.z},mounted=['car','plane'].includes(s.mode);
  let speed=(s.custom?creationStats(s.custom.blueprint,s.custom.dimensions).speed:BUILDS[s.mode].speed)*(input.sprint&&s.mode!=='plane'?1.4:1);
  if(s.mode==='car'&&s.time<s.boostUntil)speed=Math.max(speed,25);
  moveDirect(s,input,dt,{speed,mounted,flying:s.mode==='plane',limit:54,shape:movementShape(creationStats(s.custom?.blueprint||s.mode,s.custom?.dimensions)),boxes:movementBoxes()});
  s.distance+=Math.hypot(s.x-previous.x,s.z-previous.z);
  if(Math.abs(s.x)>=53.95||Math.abs(s.z)>=53.95){if(s.time-checkAccumulator>3){checkAccumulator=s.time;emit('notice',{text:'The ocean is the edge of this island. Turn back to explore.'});}}
  if(s.mode==='car')GATES.forEach((p,i)=>{if(s.gates.includes(i)||s.y>2)return;const across=p.axis==='x'?Math.abs(s.x-p.x):Math.abs(s.z-p.z);const forward=p.axis==='x'?Math.abs(s.z-p.z):Math.abs(s.x-p.x);if(across<4.4&&forward<1.65){s.gates.push(i);s.bricks+=15;emit('gate',{id:i});}});
  if(s.mode==='plane')RINGS.forEach((p,i)=>{if(!s.rings.includes(i)&&Math.hypot(s.x-p.x,s.y+1.3-p.y,s.z-p.z)<3.4){s.rings.push(i);s.bricks+=20;emit('ring',{id:i});}});
  if(!s.won&&completion(s)){s.won=true;emit('win');}
 }
 return {get state(){return s;},build,buildCustom,action,jump,hitTarget,respawn,reset,update,clipCamera,placeCreation,removePlacement,removeEntity,returnToFoot,dispose(){scenery.clear();placements.clear();}};
}
