import {segmentBox} from './geometry.js';
import {bounds} from './shot-geometry.js';

// Visual-only dead reckoning. Never mutate the authoritative player or use this
// position for collisions, aiming, damage, or local-player prediction.
const HORIZON=.2;
export function remoteMotionTarget(state,p,snapshot,dt,boxes){
 const identity=[snapshot.epoch,snapshot.round?.id,p.spawnSerial||0,p.kit.id,p.health>0].join(':');
 const step=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.25));
 const maxSpeed=Math.max(0,Number(p.kit.stats.speed)||0)*(snapshot.time<p.speedUntil?2:1)*1.35;
 const reset=!state||state.identity!==identity||dt>.25;
 if(reset)state={identity,time:snapshot.time,x:p.x,z:p.z,vx:0,vz:0,age:0,snapshot,snap:true};
 else {
  state.snap=false;state.age+=step;
  if(state.snapshot!==snapshot){
   const seconds=(snapshot.time-state.time)/1000,dx=p.x-state.x,dz=p.z-state.z,distance=Math.hypot(dx,dz);
   // Large relocations and discontinuous clocks must not become velocity.
   if(seconds<=0||seconds>1||distance>Math.max(4,maxSpeed*seconds*1.8)){
    state.vx=0;state.vz=0;state.snap=distance>4;
   }else if(distance<.001||!(Math.abs(p.speed)>.05)||snapshot.round?.status!=='active'){
    state.vx=0;state.vz=0;
   }else{
    const scale=Math.min(1,maxSpeed*seconds/distance)/seconds;
    state.vx=dx*scale;state.vz=dz*scale;
   }
   state.x=p.x;state.z=p.z;state.time=snapshot.time;state.age=0;state.snapshot=snapshot;
  }
 }
 const ahead=Math.min(state.age,HORIZON),bb=bounds(p);
 let x=p.x+state.vx*ahead,z=p.z+state.vz*ahead;
 // Sweep only the extrapolated portion, respecting the actor's body size.
 // A small vertical inset avoids treating a supporting surface as a wall.
 if(x!==p.x||z!==p.z){
  const from={x:p.x,y:p.y+bb.hy,z:p.z},to={x,y:from.y,z};let fraction=1;
  for(const {box} of boxes){const hit=segmentBox(from,to,box,[bb.hx,Math.max(0,bb.hy-.03),bb.hz]);if(hit)fraction=Math.min(fraction,Math.max(0,hit.t-.001));}
  x=p.x+(x-p.x)*fraction;z=p.z+(z-p.z)*fraction;
  x=Math.max(-53+bb.hx,Math.min(53-bb.hx,x));z=Math.max(-53+bb.hz,Math.min(53-bb.hz,z));
 }
 return {state,x,y:p.y,z,snap:state.snap};
}
