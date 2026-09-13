import * as THREE from './vendor/three.module.js';
import {validateBlueprint} from './blueprint.js';
const rad=Math.PI/180;
const unit=new THREE.Vector3(1,1,1),zero=new THREE.Vector3(),axis={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
function makeWedge(){const g=new THREE.BufferGeometry();const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[-.5,.5,.5],[.5,.5,.5]],indices=[0,2,1,1,2,3,2,4,3,3,4,5,0,4,2,1,3,5,0,1,4,1,5,4];g.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap((_,i)=>v[indices[Math.floor(i/3)*3+(i%3===0?0:i%3===1?2:1)]]),3));g.computeVertexNormals();return g;}
export function createGeneratedModel(raw){
 const blueprint=validateBlueprint(raw),group=new THREE.Group();
 const shapes={box:new THREE.BoxGeometry(1,1,1),wedge:makeWedge(),cylinder:new THREE.CylinderGeometry(.5,.5,1,12),cone:new THREE.ConeGeometry(.5,1,10),sphere:new THREE.SphereGeometry(.5,12,8)};
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.48,metalness:.02});
 const joints=blueprint.joints.map(j=>({source:j,matrix:new THREE.Matrix4(),pivot:new THREE.Vector3(...j.pivot)}));
 const parts=blueprint.parts.map((p,i)=>({source:p,index:i,position:new THREE.Vector3(...p.position),quaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rotation.map(v=>v*rad))),size:new THREE.Vector3(...p.size),matrix:new THREE.Matrix4(),rest:new THREE.Matrix4()}));
 // A cylinder on a spin joint is an axle part. Keep its cylinder axis aligned
 // with the declared axle so malformed rotations cannot make wheels tumble.
 for(const p of parts){const j=joints[p.source.joint]?.source;if(p.source.shape==='cylinder'&&j?.motion==='spin')p.quaternion.setFromUnitVectors(axis.y,axis[j.axis]);}
 const temp=new THREE.Matrix4(),rotation=new THREE.Quaternion(),bounds=new THREE.Box3(),point=new THREE.Vector3();
 joints.forEach(j=>{j.matrix.makeTranslation(...(blueprint.version>=2?[0,0,0]:j.source.pivot));if(j.source.parent>=0)j.matrix.premultiply(joints[j.source.parent].matrix);});
 for(const p of parts){p.rest.compose(p.position,p.quaternion,p.size);if(p.source.joint>=0)p.rest.premultiply(joints[p.source.joint].matrix);for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])bounds.expandByPoint(point.set(x,y,z).applyMatrix4(p.rest));}
 const size=bounds.getSize(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);if(!Number.isFinite(extent)||extent<.1)throw new Error('The model has no usable shape. Try another description.');
 const maxSize=blueprint.movement==='carry'?2.3:blueprint.movement==='static'?10:8;
 const scale=Math.min(maxSize/extent,extent<1?2/extent:1),offset=new THREE.Vector3(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
 const normalize=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(offset.x,offset.y,offset.z));
 const normalizedSize=size.clone().multiplyScalar(scale),grip=new THREE.Vector3().applyMatrix4(normalize);
 const seat=new THREE.Vector3(...blueprint.seat).applyMatrix4(normalize);seat.x=THREE.MathUtils.clamp(seat.x,-normalizedSize.x/2,normalizedSize.x/2);seat.z=THREE.MathUtils.clamp(seat.z,-normalizedSize.z/2,normalizedSize.z/2);seat.y=THREE.MathUtils.clamp(seat.y,.5,normalizedSize.y+.4);
 // Seat the rider on the highest fixed surface at the authored seat X/Z.
 // Generated seat heights occasionally intersect the torso or float above it.
 if(!['carry','static'].includes(blueprint.movement)){
  const ray=new THREE.Ray(new THREE.Vector3(seat.x,normalizedSize.y+1,seat.z),new THREE.Vector3(0,-1,0)),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3(),surfaceMatrix=new THREE.Matrix4();let support=-Infinity;
  for(const p of parts){if(p.source.joint!==-1)continue;const g=shapes[p.source.shape],positions=g.attributes.position,indices=g.index;surfaceMatrix.multiplyMatrices(normalize,p.rest);
   for(let i=0;i<(indices?.count||positions.count);i+=3){a.fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(surfaceMatrix);b.fromBufferAttribute(positions,indices?indices.getX(i+1):i+1).applyMatrix4(surfaceMatrix);c.fromBufferAttribute(positions,indices?indices.getX(i+2):i+2).applyMatrix4(surfaceMatrix);if(ray.intersectTriangle(a,b,c,false,hit))support=Math.max(support,hit.y);}
  }
  if(Number.isFinite(support))seat.y=support;
 }
 const entries={box:[],wedge:[],cylinder:[],cone:[],sphere:[]};let studs=0;
 parts.forEach(p=>{entries[p.source.shape].push({part:p,local:new THREE.Matrix4(),color:p.source.color});if(p.source.studs&&p.source.shape==='box'&&studs<256){const nx=Math.min(3,Math.max(1,Math.round(p.size.x/.55))),nz=Math.min(3,Math.max(1,Math.round(p.size.z/.55)));for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){if(studs++>=256)continue;const radius=Math.min(.19,p.size.x/nx*.25,p.size.z/nz*.25),height=Math.min(.11,p.size.y*.25);const local=new THREE.Matrix4().compose(new THREE.Vector3((i+.5)/nx-.5,.5+height/p.size.y*.5,(j+.5)/nz-.5),new THREE.Quaternion(),new THREE.Vector3(radius*2/p.size.x,height/p.size.y,radius*2/p.size.z));entries.cylinder.push({part:p,local,color:p.source.color});}}});
 const batches=[];for(const [shape,items]of Object.entries(entries)){if(!items.length)continue;const mesh=new THREE.InstancedMesh(shapes[shape],mat,items.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;items.forEach((entry,i)=>mesh.setColorAt(i,new THREE.Color(blueprint.palette[entry.color])));mesh.instanceColor.needsUpdate=true;group.add(mesh);batches.push({mesh,items});}
 const motionMatrix=new THREE.Matrix4(),endPosition=new THREE.Vector3(),endQuaternion=new THREE.Quaternion(),endScale=new THREE.Vector3(),start=new THREE.Vector3(),composeQuaternion=new THREE.Quaternion();
 let disposed=false;
 function update(time,progress=1,moving=0,action=0){
  if(disposed)return;
  joints.forEach(j=>{const d=j.source,phase=d.phase*rad;let angle=0;if(progress>=1){if(d.motion==='spin')angle=time*moving*7*(d.amplitude<0?-1:1);else if(d.motion==='flap')angle=Math.sin(time*6+phase)*d.amplitude*rad;else if(d.motion==='stride')angle=Math.sin(time*9+phase)*d.amplitude*rad*Math.min(1,moving);else angle=0;}rotation.setFromAxisAngle(axis[d.axis],angle);j.matrix.compose(j.pivot,rotation,unit);if(blueprint.version>=2)j.matrix.multiply(motionMatrix.makeTranslation(-j.pivot.x,-j.pivot.y,-j.pivot.z));if(d.parent>=0)j.matrix.premultiply(joints[d.parent].matrix);});
  for(const p of parts){p.matrix.compose(p.position,p.quaternion,p.size);if(p.source.joint>=0)p.matrix.premultiply(joints[p.source.joint].matrix);p.matrix.premultiply(normalize);if(progress<1){p.matrix.decompose(endPosition,endQuaternion,endScale);const delay=p.index/parts.length*.55,t=THREE.MathUtils.clamp((progress-delay)/(1-delay),0,1),ease=1-Math.pow(1-t,3),a=p.index*2.399;start.set(Math.sin(a)*(4+p.index%3),2.5+(p.index%6)*.4,Math.cos(a)*(4+p.index%3)).lerp(endPosition,ease);composeQuaternion.setFromAxisAngle(axis.y,(1-ease)*Math.PI*2).multiply(endQuaternion);p.matrix.compose(start,composeQuaternion,endScale.multiplyScalar(.4+.6*ease));}}
  for(const {mesh,items}of batches){items.forEach((e,i)=>{temp.multiplyMatrices(e.part.matrix,e.local);mesh.setMatrixAt(i,temp);});mesh.instanceMatrix.needsUpdate=true;}
 }
 update(0,1,0);
 return {group,blueprint,seat,grip,size:normalizedSize,parts:parts.length,drawCalls:batches.length,update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();batches.forEach(b=>b.mesh.dispose());Object.values(shapes).forEach(g=>g.dispose());mat.dispose();}};
}
