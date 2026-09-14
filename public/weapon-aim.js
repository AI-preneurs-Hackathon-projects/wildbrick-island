// The builder faces local +Z: anatomical right is -X. Camera orbit never aims.
export function weaponAim(p){return {yaw:p.yaw,pitch:0};}
export function aimDirection(yaw,pitch=0){return {x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};}
export function rotateWeapon(v,yaw,pitch=0){const y=v[1]*Math.cos(pitch)+v[2]*Math.sin(pitch),z=-v[1]*Math.sin(pitch)+v[2]*Math.cos(pitch);return {x:Math.cos(yaw)*v[0]+Math.sin(yaw)*z,y,z:-Math.sin(yaw)*v[0]+Math.cos(yaw)*z};}
export function weaponGrip(kit){return kit.blueprintId&&kit.stats?.weapon!=='bow'?(['automatic','flame'].includes(kit.stats?.weapon)?[-.3,1.3,.35]:[-.76,1.1,.3]):[.25,1.26,.64];}
// Stored kits retain their original emitter coordinates, including existing matches.
const storedGrip=kit=>kit.blueprintId?[.76,1.1,.3]:[-.85,1.26,.64];
export function weaponOffset(kit){return (kit.muzzle||[0,1.4,1]).map((v,i)=>v-(kit.stats.mounted?0:storedGrip(kit)[i]));}
// Numeric legacy pitch/yaw inputs never steer a weapon. Only a solved pose is used.
export function weaponMuzzle(p,aim=null){
 const yaw=aim&&typeof aim==='object'?aim.yaw:p.yaw,pitch=0;
 const mounted=p.kit.stats.mounted;
 const grip=mounted?[0,0,0]:weaponGrip(p.kit),anchor=rotateWeapon(grip,p.yaw);
 const offset=rotateWeapon(weaponOffset(p.kit),mounted?p.yaw:yaw,mounted?0:pitch);
 return {x:p.x+anchor.x+offset.x,y:p.y+anchor.y+offset.y,z:p.z+anchor.z+offset.z};
}

// Presentation pose: retain a relative correction, never a historical world origin.
export function equippedAim(p,solution,correction=solution.correction){
 const yaw=p.yaw+(correction||0),muzzle=weaponMuzzle(p,{yaw}),anchor={x:p.x,y:p.y+Math.max(1.2,p.kit.stats.collision[1]*.6),z:p.z};
 const t=muzzle.y<.02?Math.max(0,(anchor.y-.02)/(anchor.y-muzzle.y)):1;
 for(const key of ['x','y','z'])muzzle[key]=anchor[key]+(muzzle[key]-anchor[key])*t;
 return {...solution,yaw,correction:correction||0,pitch:0,muzzle,anchor,direction:aimDirection(yaw),launchContact:null};
}
