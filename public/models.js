import * as THREE from './vendor/three.module.js';
export const C={grass:0x83bc66,darkGrass:0x70ab54,sand:0xeed49a,road:0xe9c593,orange:0xf17a48,red:0xee634e,yellow:0xffcf55,teal:0x63c7b2,blue:0x82bbcd,ink:0x254139,cream:0xfff3d4,purple:0xa6a2db,white:0xfffcf0};
const mats=new Map();
export function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.02}));return mats.get(color);}
const boxGeo=new THREE.BoxGeometry(1,1,1), cylinderGeo=new THREE.CylinderGeometry(1,1,1,12), sphereGeo=new THREE.SphereGeometry(1,12,8);
for(const g of [boxGeo,cylinderGeo,sphereGeo])g.userData.shared=true;
export function box(parent,x,y,z,w,h,d,color){const m=new THREE.Mesh(boxGeo,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function cylinder(parent,x,y,z,r,h,color){const m=new THREE.Mesh(cylinderGeo,material(color));m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function ball(parent,x,y,z,r,color){const m=new THREE.Mesh(sphereGeo,material(color));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);return m;}
export function brick(parent,x,y,z,w,h,d,color,studs=true){const g=new THREE.Group();g.position.set(x,y,z);box(g,0,0,0,w,h,d,color);if(studs){const nx=Math.max(1,Math.round(w/.62)),nz=Math.max(1,Math.round(d/.62));for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)cylinder(g,(i-(nx-1)/2)*w/nx,h/2+.055,(j-(nz-1)/2)*d/nz,Math.min(.19,w/nx*.27,d/nz*.27),.11,color);}parent.add(g);return g;}
export function character(color=C.orange){
 const g=new THREE.Group();const hips=brick(g,0,.82,0,.83,.28,.55,C.ink,false);
 const legs=[];for(const x of [-.24,.24]){const leg=new THREE.Group();leg.position.set(x,.78,0);brick(leg,0,-.28,0,.39,.57,.47,0x426e75,false);brick(leg,0,-.59,.10,.42,.18,.69,C.ink,false);g.add(leg);legs.push(leg);}
 const shirt=brick(g,0,1.32,0,1.03,.80,.59,color,false);const sleeves=[];box(g,0,1.25,.306,.12,.60,.025,C.cream);box(g,-.29,1.44,.315,.18,.15,.04,C.cream);
 const head=brick(g,0,2.06,0,.77,.68,.69,C.yellow,false);cylinder(g,0,2.43,0,.22,.13,C.yellow);
 box(g,-.18,2.12,.353,.075,.11,.02,C.ink);box(g,.18,2.12,.353,.075,.11,.02,C.ink);box(g,0,1.94,.355,.22,.035,.024,C.ink);box(g,-.12,1.98,.355,.035,.09,.024,C.ink);box(g,.12,1.98,.355,.035,.09,.024,C.ink);
 brick(g,0,2.44,-.03,.87,.14,.77,C.teal,false);brick(g,0,2.44,.43,.87,.12,.24,C.teal,false);
 const arms=[];for(const x of [-.68,.68]){const a=new THREE.Group();a.name=x<0?'right-arm':'left-arm';a.position.set(x,1.62,0);sleeves.push(box(a,0,-.23,0,.29,.53,.4,color));cylinder(a,0,-.59,.015,.18,.23,C.yellow);g.add(a);arms.push(a);}
 brick(g,0,1.3,-.48,.72,.74,.37,C.teal);brick(g,0,1.62,-.72,.46,.24,.19,C.cream,false);
 return {group:g,legs,arms,head,hips,setColor(value){shirt.children[0].material=material(value);sleeves.forEach(m=>m.material=material(value));}};
}
export function car(){
 const g=new THREE.Group(),wheels=[];
 brick(g,0,.77,0,2.32,.32,4.25,C.ink,false);brick(g,0,1.06,0,2.46,.35,4.02,C.red);
 brick(g,0,1.43,1.36,2.42,.40,1.24,C.red);brick(g,0,1.31,-1.54,2.4,.3,.91,C.red);
 for(const x of [-1.08,1.08]){brick(g,x,1.61,-.33,.3,.65,2.23,C.red);for(const z of [-1.35,1.32]){const tire=new THREE.Group();tire.position.set(x*1.24,.66,z);const t=cylinder(tire,0,0,0,.65,.39,C.ink);t.rotation.z=Math.PI/2;const hub=cylinder(tire,x>0?.22:-.22,0,0,.30,.035,C.cream);hub.rotation.z=Math.PI/2;g.add(tire);wheels.push(tire);}}
 for(const x of [-.54,.54]){box(g,x,1.34,-.65,.8,.24,.77,C.ink);box(g,x,1.69,-1.02,.81,.69,.22,C.ink);brick(g,x*1.4,1.40,2.055,.38,.28,.08,C.yellow,false);brick(g,x*1.4,1.3,-2.03,.30,.16,.06,C.orange,false);}
 brick(g,0,1.90,.63,2.08,.15,.17,C.cream,false);for(const x of [-1,1])brick(g,x,1.68,.65,.12,.48,.15,C.cream,false);
 box(g,0,1.36,2.11,.87,.17,.08,C.ink);brick(g,0,.87,2.24,2.48,.19,.30,C.cream,false);brick(g,0,.85,-2.21,2.48,.18,.24,C.cream,false);
 const steer=new THREE.Mesh(new THREE.TorusGeometry(.25,.035,6,12),material(C.ink));steer.position.set(-.54,1.76,.18);steer.rotation.x=-.5;g.add(steer);
 return {group:g,wheels};
}
export function plane(){
 const g=new THREE.Group();
 for(let i=0;i<5;i++)brick(g,0,1.02,(i-2)*.87,1.21-i*.045,.47,.87,i===4?C.orange:C.yellow);
 brick(g,0,1.42,1.34,1.19,.39,1.50,C.yellow);brick(g,0,1.29,-1.60,.85,.25,1.1,C.yellow);
 for(const x of [-1,1]){for(let j=0;j<3;j++)brick(g,x*(1.19+j*.93),.96,.36,.96,.20,1.48,j===2?C.orange:C.yellow);brick(g,x*1.06,1.22,-1.87,1.24,.18,.74,C.orange);}
 brick(g,0,1.89,-1.88,.17,1.28,.94,C.orange);brick(g,0,1.93,-1.8,.19,.3,.58,C.cream,false);
 const prop=new THREE.Group();prop.position.set(0,1.4,2.42);brick(prop,0,0,0,.17,2.23,.11,C.ink,false);ball(prop,0,0,.07,.18,C.cream);g.add(prop);
 for(const x of [-.76,.76]){box(g,x,.5,.74,.1,.9,.1,C.ink);const wheel=cylinder(g,x,.2,.74,.31,.18,C.ink);wheel.rotation.z=Math.PI/2;}
 box(g,0,1.3,-.57,.78,.19,.7,C.ink);box(g,0,1.53,-.93,.79,.44,.15,C.ink);
 return {group:g,prop};
}
export function bow(){const g=new THREE.Group();for(let i=0;i<9;i++){const a=(i/8-.5)*2.5;const part=brick(g,.42*Math.cos(a)-.2,.95*Math.sin(a),0,.16,.26,.16,i===4?C.ink:C.teal,false);part.rotation.z=-a;}box(g,-.067,0,0,.025,1.80,.025,C.cream);brick(g,.12,0,.39,.05,.06,.84,C.cream,false);return {group:g};}
export function sword(){const g=new THREE.Group();brick(g,0,.07,0,.19,.45,.21,C.ink,false);brick(g,0,.34,0,.78,.16,.28,C.yellow);for(let i=0;i<4;i++)brick(g,0,.59+i*.29,0,.29-i*.033,.3,.15,i===0?C.purple:C.cream,false);const tip=box(g,0,1.70,0,.12,.20,.12,C.cream);tip.rotation.z=Math.PI/4;return {group:g};}
export function arrow(){const g=new THREE.Group();box(g,0,0,0,.06,.06,1.3,C.cream);const tip=new THREE.Mesh(new THREE.ConeGeometry(.14,.28,4),material(C.ink));tip.rotation.x=Math.PI/2;tip.position.z=.76;g.add(tip);box(g,0,0,-.5,.36,.05,.24,C.teal);return g;}
export function target(){const g=new THREE.Group();brick(g,0,.68,0,.19,1.36,.21,C.ink,false);for(const [r,color,z] of [[.87,C.cream,0],[.65,C.red,.07],[.42,C.cream,.13],[.21,C.yellow,.19]]){const d=cylinder(g,0,1.9,z,r,.12,color);d.rotation.x=Math.PI/2;}box(g,0,.08,0,1.2,.16,.6,C.ink);return g;}
export function crate(){const g=new THREE.Group();brick(g,0,.69,0,1.4,1.3,1.4,C.purple);for(const x of [-.47,.47])box(g,x,.69,.716,.10,1.24,.04,C.cream);box(g,0,.69,.74,1.3,.13,.05,C.cream).rotation.z=.65;return g;}
export function tree(parent,x,z,scale=1,kind=0){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);brick(g,0,1,0,.6,2,.6,0x927551,false);if(kind){for(let i=0;i<3;i++)brick(g,0,2.3+i*.72,0,2.5-i*.65,.80,2.5-i*.65,i%2?0x4b9066:0x39795b);}else{brick(g,0,2.7,0,2.7,1.4,2.4,0x53a575);brick(g,.4,3.65,-.12,1.8,.64,1.75,0x70b87a);brick(g,-.8,2.9,.6,1.2,.7,1.3,0x70b87a);}parent.add(g);return g;}
export function house(parent,x,z,color,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;brick(g,0,2.15,0,6,4.3,5.4,color);brick(g,0,.28,0,6.4,.54,5.8,C.cream,false);brick(g,0,4.45,0,6.55,.33,5.9,C.cream);for(let i=0;i<4;i++)brick(g,0,4.75+i*.4,0,6.8-i*.75,.41,6.05-i*.68,C.orange);brick(g,0,1.25,2.76,1.26,2.3,.15,C.ink,false);for(const xx of [-1.94,1.94]){brick(g,xx,2.5,2.81,1.18,1.26,.17,C.cream,false);box(g,xx,2.5,2.92,.85,.94,.06,C.blue);box(g,xx,2.5,2.97,.07,.94,.06,C.cream);}parent.add(g);return g;}
export function batchStatic(root){root.updateMatrixWorld(true);const buckets=new Map(),entityHandles=new Map();root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+'/'+o.material.uuid;if(!buckets.has(key))buckets.set(key,{geometry:o.geometry,material:o.material,items:[]});let parent=o,id=null;while(parent){if(parent.userData.entityId){id=parent.userData.entityId;break;}parent=parent.parent;}buckets.get(key).items.push({matrix:o.matrixWorld.clone(),id});});const batch=new THREE.Group();for(const b of buckets.values()){const m=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);b.items.forEach(({matrix,id},i)=>{m.setMatrixAt(i,matrix);if(id){if(!entityHandles.has(id))entityHandles.set(id,[]);entityHandles.get(id).push({mesh:m,index:i,matrix});}});m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();batch.add(m);}const hidden=new THREE.Matrix4().makeScale(0,0,0);batch.userData.setEntityVisible=(id,visible)=>{for(const h of entityHandles.get(id)||[]){h.mesh.setMatrixAt(h.index,visible?h.matrix:hidden);h.mesh.instanceMatrix.needsUpdate=true;}};return batch;}
