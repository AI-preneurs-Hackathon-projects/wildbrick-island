import {weaponGrip,weaponOffset,weaponMuzzle,aimDirection} from './weapon-aim.js';
import {solidBoxes,projectileContact} from './shot-geometry.js';
export const HANDHELD_AIM_CAP=Math.PI/12,MIN_FOCUS_CLEARANCE=1.5;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const point=(a,d,length)=>({x:a.x+d.x*length,y:a.y+d.y*length,z:a.z+d.z*length});
const atContact=(a,b,h)=>({x:a.x+(b.x-a.x)*h.t,y:a.y+(b.y-a.y)*h.t,z:a.z+(b.z-a.z)*h.t});
// Closed-form horizontal ray/grip solution. R(a) uses the game's +Z-forward yaw.
// In grip space, n(a).(focus-grip)=emitter.x. Select the forward solution,
// then clamp the FINAL barrel angle. The muzzle is recomputed at that angle.
export function horizontalCorrection(grip,offset,depth){
 const x=-grip[0],z=depth-grip[2],radius=Math.hypot(x,z);
 if(!Number.isFinite(radius)||radius<1e-9)return 0;
 return clamp(Math.atan2(x,z)-Math.asin(clamp(offset[0]/radius,-1,1)),-HANDHELD_AIM_CAP,HANDHELD_AIM_CAP);
}
// Pure trusted geometry query. fixed=true is for development comparison only;
// Arena never reads an aiming option, victim, or direction from a client packet.
export function solveWeaponAim(world,p,{boxes=solidBoxes(world),fixed=false}={}){
 const k=p.kit.stats,range=Math.max(0,k.range||0),body=aimDirection(p.yaw),original=weaponMuzzle(p),anchor={x:p.x,y:p.y+Math.max(1.2,k.collision[1]*.6),z:p.z};
 const probe={owner:p.id,weapon:k.weapon},ranged=k.projectileSpeed>0;let correction=0,focusContact=null,focusDepth=range;
 if(ranged&&!k.mounted&&!fixed){
  const start={x:p.x,y:Math.max(.02,original.y),z:p.z},end=point(start,body,range);
  focusContact=projectileContact(world,probe,start,end,boxes,p.yaw);
  const grip=weaponGrip(p.kit),offset=weaponOffset(p.kit);
  // This radial bound keeps focus >=1.5m beyond even the final rotated muzzle.
  focusDepth=Math.max(focusContact?range*focusContact.t:range,grip[2]+Math.hypot(offset[0],offset[2])+MIN_FOCUS_CLEARANCE);
  correction=horizontalCorrection(grip,offset,focusDepth);
 }
 const yaw=p.yaw+correction,direction=aimDirection(yaw),muzzle=weaponMuzzle(p,{yaw});
 // Preserve the legacy ground clip, shared by guide, shot and posed emitter.
 const groundClamp=muzzle.y<.02?Math.max(0,(anchor.y-.02)/(anchor.y-muzzle.y)):1;
 for(const key of ['x','y','z'])muzzle[key]=anchor[key]+(muzzle[key]-anchor[key])*groundClamp;
 const launchContact=ranged?projectileContact(world,probe,anchor,muzzle,boxes,p.yaw):null;
 return {yaw,pitch:0,correction,direction,muzzle,anchor,focusDepth,focusContact,launchContact,range,spread:k.spread||0,active:ranged};
}
// Prediction only: no health mutation or confirmed-hit styling. The actual shot
// still samples unchanged spread after solving aim and sweeps its own one ray.
export function weaponPath(world,p,solution=solveWeaponAim(world,p),boxes=solidBoxes(world)){
 const from=solution.launchContact?solution.anchor:solution.muzzle,end=solution.launchContact?solution.muzzle:point(from,solution.direction,solution.range);
 const contact=solution.launchContact||projectileContact(world,{owner:p.id,weapon:p.kit.stats.weapon},from,end,boxes);
 return {from,to:contact?atContact(from,end,contact):end,contact,launch:!!solution.launchContact,direction:solution.direction,spread:solution.launchContact?0:solution.spread};
}
