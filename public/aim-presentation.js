import {weaponOffset,weaponMuzzle} from './weapon-aim.js';
import * as THREE from './vendor/three.module.js';
// Pose the existing model at the solved emitter, including legacy stored offsets.
// Rebuilding a saved blueprint restores the corrected origin; no kit is mutated.
export function poseRangedModel(model,p,solution){
 if(!model||p.kit.stats.mounted||p.kit.stats.projectileSpeed<=0)return;
 const correction=solution.correction??Math.atan2(Math.sin(solution.yaw-p.yaw),Math.cos(solution.yaw-p.yaw));
 model.group.rotation.set(0,correction,0,'YXZ');
 const emitter=model.emitter||(model.grip?model.grip.clone().add(new THREE.Vector3(...weaponOffset(p.kit))):new THREE.Vector3(.13,0,.84));
 const muzzle=weaponMuzzle({kit:p.kit,x:0,y:0,z:0,yaw:0},{yaw:correction});
 model.group.position.set(muzzle.x,muzzle.y,muzzle.z).sub(emitter.clone().applyQuaternion(model.group.quaternion));
}
export function createWeaponGuide(parent){
 const root=new THREE.Group();root.name='weapon-path-guide';root.visible=false;root.userData.prediction=true;parent.add(root);
 const guideColor=0x605b50;
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:guideColor,transparent:true,opacity:.28,dashSize:.22,gapSize:.18,depthWrite:false}));
 const end=new THREE.Mesh(new THREE.RingGeometry(.72,1,24),new THREE.MeshBasicMaterial({color:guideColor,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));end.name='weapon-path-end';
 // Independent yaw/pitch samples have a rectangular angular envelope, not an ellipse.
 const points=[];for(const x of [-1,1])for(const y of [-1,1])points.push(new THREE.Vector3(x*.65,y,0),new THREE.Vector3(x,y,0),new THREE.Vector3(x,y,0),new THREE.Vector3(x,y*.65,0));
 const spread=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:guideColor,transparent:true,opacity:.23,depthWrite:false}));spread.name='weapon-spread-envelope';root.add(line,end,spread);
 function update(path,camera){root.visible=!!path;if(!path)return;const a=new THREE.Vector3(path.from.x,path.from.y,path.from.z),b=new THREE.Vector3(path.to.x,path.to.y,path.to.z),positions=line.geometry.attributes.position;positions.setXYZ(0,a.x,a.y,a.z);positions.setXYZ(1,b.x,b.y,b.z);positions.needsUpdate=true;line.geometry.computeBoundingSphere();line.computeLineDistances();end.position.copy(b);end.quaternion.copy(camera.quaternion);end.scale.setScalar(.10);
  spread.position.copy(b);spread.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(path.direction.x,path.direction.y,path.direction.z));const length=a.distanceTo(b);spread.scale.set(Math.tan(path.spread/2)*length,Math.tan(path.spread*.35)*length/Math.cos(path.spread/2),1);spread.visible=path.spread>0&&!path.launch;root.userData.launch=path.launch;
 }
 return {root,update,clear(){root.visible=false;},dispose(){for(const o of [line,end,spread]){o.geometry.dispose();o.material.dispose();}root.removeFromParent();}};
}
