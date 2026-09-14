import {segmentBox} from './geometry.js';
import {arenaMap} from './map-catalog.js';
export function bounds(p){const [w,h,d]=p.kit.stats.collision,yaw=p.kit.stats.mounted?p.yaw:0,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));return {hx:(w*c+d*s)/2,hy:h/2,hz:(d*c+w*s)/2,h};}
export function solidBoxes(room){const list=[];for(const e of arenaMap(room).entities)if(!room.destroyed?.[e.id])for(const box of e.boxes)list.push({entity:e,box});for(const e of room.placed||[])if(!room.destroyed?.[e.id])list.push({entity:e,box:{x:e.x,y:e.h/2,z:e.z,w:e.w,h:e.h,d:e.d}});return list;}
// Stable identity breaks exact ties; ground/scenery precede protected or ordinary bodies.
function earlier(h,hit,rank,key){return !hit||h.t<hit.t-1e-12||(Math.abs(h.t-hit.t)<=1e-12&&(rank<(hit.rank??-1)||(rank===hit.rank&&key<hit.key)));}
export function projectileContact(room,b,from,to,boxes,launchYaw=null){
 let hit=to.y<=0&&from.y>=0?{t:from.y/Math.max(1e-9,from.y-to.y),ground:true}:null;
 // Scenery wins ties, including a launch origin inside both cover and a rival.
 for(const {entity,box} of boxes){if(room.destroyed?.[entity.id])continue;const h=segmentBox(from,to,box);if(h&&earlier(h,hit,0,String(entity.id)))hit={...h,entity,rank:0,key:String(entity.id)};}
 for(const p of (Array.isArray(room.players)?room.players:Object.values(room.players||{}))){
  if(p.id===b.owner||p.health<=0)continue;
  // Overlapping bodies are legal; the launch bridge must not become a rear attack.
  if(launchYaw!==null&&(p.x-from.x)*Math.sin(launchYaw)+(p.z-from.z)*Math.cos(launchYaw)<-1e-9)continue;
  const bb=bounds(p),h=segmentBox(from,to,{x:p.x,y:p.y+bb.hy,z:p.z,w:bb.hx*2,h:bb.h,d:bb.hz*2},b.weapon==='flame'?[.45,.45,.45]:[.12,.12,.12]);
  if(h&&earlier(h,hit,1,String(p.id)))hit={...h,player:p,rank:1,key:String(p.id)};
 }
 return hit;
}
