import * as THREE from './vendor/three.module.js';

// Cosmetic debris only. Keep the avatar's real colors, shapes and death pose.
export function createBrickCollapse(root){
 const bodies=[];
 function remove(body){for(const part of body.parts){part.mesh.removeFromParent();part.mesh.material.dispose();}bodies.splice(bodies.indexOf(body),1);}
 function scatter(player,pilot){
  const body={player,parts:[],fade:null};pilot.updateWorldMatrix(true,true);
  pilot.traverse(source=>{if(!source.isMesh)return;const mesh=new THREE.Mesh(source.geometry,source.material.clone());source.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.material.transparent=true;mesh.material.opacity=1;mesh.material.emissiveIntensity=0;mesh.castShadow=true;mesh.name='fallen-brick:'+player;root.add(mesh);const i=body.parts.length,angle=i*2.399;source.geometry.computeBoundingBox();const size=source.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);body.parts.push({mesh,half:Math.max(.025,Math.min(size.x,size.y,size.z)/2),velocity:new THREE.Vector3(Math.sin(angle)*(.6+i%3*.2),.25+(i%4)*.15,Math.cos(angle)*(.6+i%3*.2)),spin:new THREE.Vector3(Math.sin(angle)*2,Math.cos(angle)*2,1.2),settled:false});});
  bodies.push(body);while(bodies.length>32)remove(bodies[0]);
 }
 function fade(player){for(const body of bodies)if(body.player===player&&body.fade===null)body.fade=0;}
 function update(dt,boxes){for(const body of [...bodies]){if(body.fade!==null)body.fade+=dt;for(const part of body.parts){const {mesh,velocity,spin,half}=part;if(!part.settled){const bottom=mesh.position.y-half;velocity.y-=12*dt;mesh.position.addScaledVector(velocity,dt);mesh.rotation.x+=spin.x*dt;mesh.rotation.y+=spin.y*dt;mesh.rotation.z+=spin.z*dt;let floor=0;for(const box of boxes){const top=box.y+box.h/2;if(top<=bottom+.08&&Math.abs(mesh.position.x-box.x)<box.w/2&&Math.abs(mesh.position.z-box.z)<box.d/2)floor=Math.max(floor,top);}if(mesh.position.y-half<=floor){mesh.position.y=floor+half;if(Math.abs(velocity.y)<.8){part.settled=true;mesh.rotation.x=Math.round(mesh.rotation.x/(Math.PI/2))*Math.PI/2;mesh.rotation.z=Math.round(mesh.rotation.z/(Math.PI/2))*Math.PI/2;mesh.geometry.computeBoundingBox();const bounds=new THREE.Box3().setFromObject(mesh);mesh.position.y+=floor-bounds.min.y;}else{velocity.y=Math.abs(velocity.y)*.22;velocity.x*=.5;velocity.z*=.5;spin.multiplyScalar(.5);}}}mesh.material.opacity=body.fade===null?1:Math.max(0,1-body.fade/3);mesh.material.depthWrite=mesh.material.opacity>.8;}if(body.fade>=3)remove(body);}}
 function clear(){for(const body of [...bodies])remove(body);}
 return {scatter,fade,update,clear};
}
