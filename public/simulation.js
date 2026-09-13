import {creationStats} from './combat.js';
import {segmentBox,boxesOverlap} from './geometry.js';
import {moveDirect,startJump} from './movement.js';
import {BUILDS,createState,GATES,RINGS,TARGETS,CRATES,completion,nearestTarget} from './rules.js';
import {customMode,validateBlueprint} from './blueprint.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export async function createSimulation(obstacles,onEvent){
 const scenery=new Map(obstacles.map((o,i)=>[i,{...o,y:o.y??o.h/2}]));
 let s=createState();let checkAccumulator=0;
 const placements=new Map();let placementId=0;
 function setMode(mode){s.mode=mode;s.jumpRemaining=0;s.vertical=0;s.flightAltitude=s.y;}
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
  s.building={mode,custom,time:0,duration:2.8};emit('build',{mode,custom});return true;
 }
 function jump(){if(s.started&&!s.paused&&startJump(s,['car','plane'].includes(s.mode)))emit('jump');}
 function action(){
  if(!s.started||s.paused||s.building||s.cooldown>0)return;
  s.actionTime=.40;s.cooldown=s.mode==='bow'?.62:s.mode==='sword'?.48:.3;
  if(s.custom?.blueprint.ability==='pulse'){
   const from={x:s.x,y:s.y+Math.max(1.5,(s.custom.dimensions?.[1]||2)*.7),z:s.z};
   const list=TARGETS.map((t,i)=>({...t,id:i})).filter(t=>!s.targets.includes(t.id)&&rayDistance(from,{x:t.x,y:1.9,z:t.z},'target:'+t.id)>=Math.hypot(t.x-from.x,1.9-from.y,t.z-from.z)-.01);
   const target=nearestTarget(s,list,36,.15);emit('shoot',{target:target?.id??null,from,yaw:s.yaw,pulse:true,color:s.custom.blueprint.palette[1]||s.custom.blueprint.palette[0]});return;
  }
  if(s.mode==='foot')jump();
  if(s.mode==='car'&&s.custom?.blueprint.ability!=='swing'){s.boostUntil=s.time+.7;emit('boost');}
  if(s.mode==='bow'&&!s.custom){const from={x:s.x,y:s.y+1.5,z:s.z};const list=TARGETS.map((t,i)=>({...t,id:i})).filter(t=>!s.targets.includes(t.id)&&rayDistance(from,{x:t.x,y:1.9,z:t.z},'target:'+t.id)>=Math.hypot(t.x-from.x,1.9-from.y,t.z-from.z)-.01);const target=nearestTarget(s,list,32,.15);emit('shoot',{target:target?.id??null,from,yaw:s.yaw});}
  if((s.mode==='sword'&&!s.custom)||s.custom?.blueprint.ability==='swing'){const list=CRATES.map((t,i)=>({...t,id:i})).filter(t=>!s.crates.includes(t.id));const target=nearestTarget(s,list,3.8,-.25);if(target){s.crates.push(target.id);s.bricks+=12;emit('smash',{id:target.id});}else emit('swing');}
 }
 function hitTarget(id){if(Number.isInteger(id)&&id>=0&&id<TARGETS.length&&!s.targets.includes(id)){s.targets.push(id);s.bricks+=10;emit('target',{id});}}
 function respawn(){s.x=0;s.z=17;s.y=0;s.vertical=0;s.jumpRemaining=0;s.flightAltitude=0;s.yaw=Math.PI;s.speed=0;s.autoRun=false;emit('notice',{text:'Back at the plaza. Keep building!'});}
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
  if(s.building){s.building.time+=dt;if(s.building.time>=s.building.duration){const built=s.building;s.custom=built.custom||null;setMode(built.mode);if(!s.built.includes(s.mode))s.built.push(s.mode);s.building=null;s.vertical=0;if(s.custom?.blueprint.movement==='static'){const design=s.custom;s.custom=null;emit('placed',{design});}else emit('mode',{mode:s.mode,custom:s.custom});}}
  const previous={x:s.x,y:s.y,z:s.z},mounted=['car','plane'].includes(s.mode);
  let speed=(s.custom?creationStats(s.custom.blueprint,s.custom.dimensions).speed:BUILDS[s.mode].speed)*(input.sprint&&s.mode!=='plane'?1.4:1);
  if(s.mode==='car'&&s.time<s.boostUntil)speed=Math.max(speed,25);
  moveDirect(s,input,dt,{speed,mounted,flying:s.mode==='plane',limit:54});
  s.distance+=Math.hypot(s.x-previous.x,s.z-previous.z);
  if(Math.abs(s.x)>=53.95||Math.abs(s.z)>=53.95){if(s.time-checkAccumulator>3){checkAccumulator=s.time;emit('notice',{text:'The ocean is the edge of this island. Turn back to explore.'});}}
  if(s.mode==='car')GATES.forEach((p,i)=>{if(s.gates.includes(i)||s.y>2)return;const across=p.axis==='x'?Math.abs(s.x-p.x):Math.abs(s.z-p.z);const forward=p.axis==='x'?Math.abs(s.z-p.z):Math.abs(s.x-p.x);if(across<4.4&&forward<1.65){s.gates.push(i);s.bricks+=15;emit('gate',{id:i});}});
  if(s.mode==='plane')RINGS.forEach((p,i)=>{if(!s.rings.includes(i)&&Math.hypot(s.x-p.x,s.y+1.3-p.y,s.z-p.z)<3.4){s.rings.push(i);s.bricks+=20;emit('ring',{id:i});}});
  if(!s.won&&completion(s)){s.won=true;emit('win');}
 }
 return {get state(){return s;},build,buildCustom,action,jump,hitTarget,respawn,reset,update,clipCamera,placeCreation,removePlacement,removeEntity,returnToFoot,dispose(){scenery.clear();placements.clear();}};
}
