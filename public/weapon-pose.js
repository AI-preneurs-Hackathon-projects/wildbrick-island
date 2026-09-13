import * as THREE from './vendor/three.module.js';
import {weaponGrip,weaponAim} from './weapon-aim.js';
// Local +Z is the face; arm 0 (-X) is the anatomical right arm.
export function poseWeaponHands(pilot,kit,pitch=0,strike=0){
 const right=pilot.arms[0],left=pilot.arms[1];
 for(const arm of pilot.arms){arm.scale.setScalar(1);arm.rotation.set(arm.rotation.x,0,0);arm.position.z=0;}
 if(kit.stats.mounted)return;
 const point=(arm,target)=>{const v=new THREE.Vector3(...target).sub(arm.position),rest=new THREE.Vector3(0,-.59,.015);arm.quaternion.setFromUnitVectors(rest.clone().normalize(),v.clone().normalize());arm.scale.y=v.length()/rest.length();};
 if(kit.id==='foot'||kit.stats.weapon==='punch'){right.rotation.x=-.35-strike*1.65;right.position.z=strike*.5;left.rotation.x=-.65;return;}
 if(kit.mode==='sword'&&!kit.blueprintId){point(right,[-.81,1.06,.37]);return;}
 const grip=weaponGrip(kit);point(kit.stats.weapon==='bow'?left:right,grip);
 const offset=(v)=>new THREE.Vector3(...v).applyAxisAngle(new THREE.Vector3(1,0,0),-weaponAim({yaw:0,kit},pitch).pitch).add(new THREE.Vector3(...grip)).toArray();
 if(kit.stats.weapon==='bow')point(right,offset([-.067,0,-.32*strike]));
 else if(['automatic','flame'].includes(kit.stats.weapon))point(left,offset([.12,0,.45]));
}
