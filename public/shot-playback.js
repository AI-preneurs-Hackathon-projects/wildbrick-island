import {segmentBox} from './geometry.js';
const position=b=>({x:b.x,y:b.y,z:b.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// Consume authoritative shot and contact events, including shots born and hit
// between snapshots. Only confirmed contacts produce impact feedback.
export function createShotPlayback(){
 const shots=new Map(),seen=new Set();
 function add(b){if(seen.has(b.id)||shots.has(b.id))return;seen.add(b.id);if(seen.size>4096)seen.delete(seen.values().next().value);shots.set(b.id,{...b,origin:position(b),position:position(b),age:0,terminal:null,blocked:false});}
 function contact(e){const s=shots.get(e.attack);if(!s)return false;s.terminal=e;s.stop=position(e);s.duration=Math.max(.1,distance(s.origin,s.stop)/Math.max(1,Math.hypot(s.vx,s.vy,s.vz)));return true;}
 function update(dt,boxes=[]){const impacts=[];
  for(const [id,s] of shots){s.age+=Math.max(0,dt);
   if(s.terminal){const t=Math.min(1,s.age/s.duration);for(const key of ['x','y','z'])s.position[key]=s.origin[key]+(s.stop[key]-s.origin[key])*t;if(t===1){if(s.terminal.type!=='shot-end')impacts.push(s.terminal);shots.delete(id);}continue;}
   if(!s.blocked){const end={x:s.origin.x+s.vx*s.age,y:s.origin.y+s.vy*s.age,z:s.origin.z+s.vz*s.age};let t=1;for(const box of boxes){const h=segmentBox(s.position,end,box);if(h)t=Math.min(t,h.t);}if(end.y<=0&&s.position.y>=0)t=Math.min(t,s.position.y/Math.max(1e-9,s.position.y-end.y));for(const key of ['x','y','z'])s.position[key]+=(end[key]-s.position[key])*t;s.blocked=t<1;}
   if(s.age>(s.range||80)/Math.max(1,Math.hypot(s.vx,s.vy,s.vz))+1)shots.delete(id);
  }return impacts;
 }
 return {add,contact,update,get shots(){return shots;},clear(){shots.clear();seen.clear();}};
}
