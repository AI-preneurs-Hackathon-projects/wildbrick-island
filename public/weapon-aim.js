// Body facing belongs to movement. Aim rotates a carried weapon around its grip;
// mounted emitters stay attached to the vehicle while shots follow the aim.
export function aimDirection(yaw,pitch=0){return {x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
export function rotateWeapon(v,yaw,pitch=0){const y=v[1]*Math.cos(pitch)+v[2]*Math.sin(pitch),z=-v[1]*Math.sin(pitch)+v[2]*Math.cos(pitch);return {x:Math.cos(yaw)*v[0]+Math.sin(yaw)*z,y,z:-Math.sin(yaw)*v[0]+Math.cos(yaw)*z};}
export function weaponGrip(kit){return kit.blueprintId?[.76,1.1,.3]:[-.85,1.26,.64];}
export function weaponMuzzle(p,yaw=p.yaw,pitch=0){
 const m=p.kit.muzzle||[0,1.4,1],mounted=p.kit.stats.mounted;
 const grip=mounted?[0,0,0]:weaponGrip(p.kit),anchor=rotateWeapon(grip,p.yaw);
 const offset=rotateWeapon(m.map((v,i)=>v-grip[i]),mounted?p.yaw:yaw,mounted?0:pitch);
 return {x:p.x+anchor.x+offset.x,y:p.y+anchor.y+offset.y,z:p.z+anchor.z+offset.z};
}
