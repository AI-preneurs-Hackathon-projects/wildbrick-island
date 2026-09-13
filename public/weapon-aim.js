// The builder faces local +Z: anatomical right is -X. Camera orbit never aims.
export function weaponAim(p,weaponPitch=p.aimPitch||0){return {yaw:p.yaw,pitch:p.kit.stats.mounted||!p.kit.stats.projectileSpeed?0:Math.max(-.75,Math.min(.75,weaponPitch||0))};}
export function aimDirection(yaw,pitch=0){return {x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
export function rotateWeapon(v,yaw,pitch=0){const y=v[1]*Math.cos(pitch)+v[2]*Math.sin(pitch),z=-v[1]*Math.sin(pitch)+v[2]*Math.cos(pitch);return {x:Math.cos(yaw)*v[0]+Math.sin(yaw)*z,y,z:-Math.sin(yaw)*v[0]+Math.cos(yaw)*z};}
export function weaponGrip(kit){return kit.blueprintId&&kit.stats?.weapon!=='bow'?(['automatic','flame'].includes(kit.stats?.weapon)?[-.3,1.3,.35]:[-.76,1.1,.3]):[.25,1.26,.64];}
// Stored kits retain their original emitter coordinates, including existing matches.
const storedGrip=kit=>kit.blueprintId?[.76,1.1,.3]:[-.85,1.26,.64];
export function weaponMuzzle(p,yaw=p.yaw,pitch=0){
 ({yaw,pitch}=weaponAim(p,pitch));
 const m=p.kit.muzzle||[0,1.4,1],mounted=p.kit.stats.mounted;
 const grip=mounted?[0,0,0]:weaponGrip(p.kit),anchor=rotateWeapon(grip,p.yaw);
 const offset=rotateWeapon(m.map((v,i)=>v-(mounted?0:storedGrip(p.kit)[i])),mounted?p.yaw:yaw,mounted?0:pitch);
 return {x:p.x+anchor.x+offset.x,y:p.y+anchor.y+offset.y,z:p.z+anchor.z+offset.z};
}
