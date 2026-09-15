import {segmentBox} from './geometry.js';
import {bounds} from './shot-geometry.js';

// Intentional presentation policy: keep roughly 1.5 snapshots (75 ms at the
// 20 Hz authority cadence) for jitter absorption, then extrapolate only when a
// newer sample is briefly late. This is visual state only; hits and collisions
// always use the authoritative snapshot.
export const REMOTE_JITTER_MS=75,REMOTE_EXTRAPOLATION_MS=100;
const MAX_SAMPLES=8;
const identity=(snapshot,p)=>[snapshot.epoch,snapshot.round?.id,p.spawnSerial||0,p.kit.id,p.health>0].join(':');
const sample=(snapshot,p)=>({time:snapshot.time,x:p.x,y:p.y,z:p.z,yaw:p.yaw,speed:Math.abs(p.speed)||0});
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

export function remoteMotionTarget(state,p,snapshot,dt,boxes,renderTime=snapshot.time){
 const id=identity(snapshot,p),maxSpeed=Math.max(0,Number(p.kit.stats.speed)||0)*(snapshot.time<p.speedUntil?2:1)*1.35;
 let snap=false,newSample=false;
 if(!state||state.identity!==id||dt>.25){state={identity:id,samples:[sample(snapshot,p)],snapshot,snap:true};snap=true;}
 else if(state.snapshot!==snapshot){newSample=true;
  const next=sample(snapshot,p),last=state.samples.at(-1),seconds=(next.time-last.time)/1000,distance=Math.hypot(next.x-last.x,next.y-last.y,next.z-last.z);
  if(seconds<=0||seconds>1||distance>Math.max(4,maxSpeed*seconds*1.9)){state.samples=[next];snap=distance>2;state.snap=snap;}
  else{state.samples.push(next);if(state.samples.length>MAX_SAMPLES)state.samples.shift();state.snap=false;}
  state.snapshot=snapshot;
 }
 const samples=state.samples,targetTime=renderTime-REMOTE_JITTER_MS;
 let x=samples[0].x,y=samples[0].y,z=samples[0].z,yaw=samples[0].yaw;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];if(targetTime>b.time){x=b.x;y=b.y;z=b.z;yaw=b.yaw;continue;}
  const t=Math.max(0,Math.min(1,(targetTime-a.time)/Math.max(1,b.time-a.time)));x=a.x+(b.x-a.x)*t;y=a.y+(b.y-a.y)*t;z=a.z+(b.z-a.z)*t;yaw=angle(a.yaw,b.yaw,t);break;
 }
 const latest=samples.at(-1),previous=samples.at(-2);
 if(previous&&targetTime>latest.time&&latest.speed>.05&&snapshot.round?.status==='active'){
  const seconds=(latest.time-previous.time)/1000,age=Math.min(REMOTE_EXTRAPOLATION_MS,targetTime-latest.time)/1000;
  if(seconds>0&&seconds<=.25){const dx=latest.x-previous.x,dz=latest.z-previous.z,distance=Math.hypot(dx,dz),scale=distance>0?Math.min(1,maxSpeed*seconds/distance)/seconds:0;x=latest.x+dx*scale*age;z=latest.z+dz*scale*age;y=latest.y;yaw=latest.yaw;}
 }
 const bb=bounds(p);
 if(x!==latest.x||z!==latest.z){
  const from={x:latest.x,y:latest.y+bb.hy,z:latest.z},to={x,y:from.y,z};let fraction=1;
  for(const {box} of boxes){const hit=segmentBox(from,to,box,[bb.hx,Math.max(0,bb.hy-.03),bb.hz]);if(hit)fraction=Math.min(fraction,Math.max(0,hit.t-.001));}
  x=latest.x+(x-latest.x)*fraction;z=latest.z+(z-latest.z)*fraction;x=Math.max(-53+bb.hx,Math.min(53-bb.hx,x));z=Math.max(-53+bb.hz,Math.min(53-bb.hz,z));
 }
 return {state,x,y,z,yaw,snap:snap||state.snap,newSample};
}
