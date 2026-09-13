import {segmentBox} from './geometry.js';
import {WORLD_ENTITIES,LOOSE_BRICKS,HOMES,TREES,ROCKS,RING_RADIUS} from './world-data.js';
import * as THREE from './vendor/three.module.js';
import {C,box,brick,cylinder,tree,house,batchStatic,material,target,crate} from './models.js';
import {GATES,RINGS,TARGETS,CRATES} from './rules.js';
export function createWorld(scene){
 const statics=new THREE.Group(),entityGroups=new Map(),obstacles=WORLD_ENTITIES.flatMap(e=>e.boxes.map(b=>({...b,id:e.id,kind:e.kind,hp:e.hp})));
 const tag=(g,id)=>{g.userData.entityId=id;entityGroups.set(id,g);return g;};
 box(statics,0,-1.80,0,119,3.5,119,C.sand);box(statics,0,-.12,0,112,.24,112,C.grass);
 // Broad, connected lanes give every vehicle room to turn.
 for(const x of [-29,29])box(statics,x,.035,0,10,.075,68,C.road);
 for(const z of [-29,29])box(statics,0,.04,z,68,.08,10,C.road);
 box(statics,0,.045,0,7,.09,52,C.road);box(statics,0,.047,0,52,.095,7,C.road);
 cylinder(statics,0,.08,0,8,.15,C.sand);cylinder(statics,0,.18,0,3.8,.18,C.cream).userData.entityId='plaza';cylinder(statics,0,.30,0,2.9,.13,C.orange).userData.entityId='plaza';
 const plaza=tag(new THREE.Group(),'plaza');statics.add(plaza);
 // A small pile of possibility at the heart of the island.
 brick(plaza,-.4,.74,0,1.9,.6,1.3,C.yellow);brick(plaza,.35,1.28,.13,1.3,.47,1.3,C.teal);brick(plaza,-.14,1.76,0,1.3,.38,.63,C.red);
 for(let i=-5;i<=5;i++){for(const x of [-29,29])box(statics,x,.09,i*5.9,.12,.03,1.4,C.cream);for(const z of [-29,29])box(statics,i*5.9,.095,z,1.4,.03,.12,C.cream);}
 // Actual 3D studs, batched into a handful of draw calls.
 for(let x=-54;x<=54;x+=2)for(let z=-54;z<=54;z+=2){if((Math.abs(x)<34&&Math.abs(Math.abs(z)-29)<5.5)||(Math.abs(z)<34&&Math.abs(Math.abs(x)-29)<5.5)||Math.abs(x)<4||Math.abs(z)<4||Math.hypot(x,z)<8)continue;cylinder(statics,x,.08,z,.17,.16,((x+z)%6===0)?C.darkGrass:C.grass);}
 for(const [i,[x,z,c,r]]of HOMES.entries())tag(house(statics,x,z,c,r),'house:'+i);
 for(const t of TREES)tag(tree(statics,t.x,t.z,t.scale,t.kind),t.id);
 // Flowers and scattered loose bricks make paths readable at toy scale.
 for(const b of LOOSE_BRICKS)tag(brick(statics,b.x,.13,b.z,.33,.24,.33,[C.cream,C.yellow,C.orange][b.color],false),b.id);
 // Gate posts surround the road; their openings stay fully traversable.
 const gates=GATES.map((p,i)=>{const g=new THREE.Group();g.position.set(p.x,0,p.z);if(p.axis==='z')g.rotation.y=Math.PI/2;for(const x of [-4.8,4.8]){brick(g,x,1.95,0,.54,3.9,.7,C.teal);brick(g,x,4.0,0,.72,.23,.95,C.cream);}brick(g,0,4.05,0,10.1,.35,.7,C.teal);for(let x=-4;x<=4;x+=1)box(g,x,.1,0,.55,.07,1.1,i%2?C.cream:C.teal);tag(g,'gate:'+i);scene.add(g);return g;});
 const rings=RINGS.map((p,i)=>{const g=new THREE.Group();g.position.set(p.x,p.y,p.z);const next=RINGS[(i+1)%RINGS.length];g.rotation.y=Math.atan2(next.x-p.x,next.z-p.z);const torus=new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS,.24,6,32),material(C.yellow));g.add(torus);for(let j=0;j<8;j++){const a=j*Math.PI/4;brick(g,Math.sin(a)*RING_RADIUS,Math.cos(a)*RING_RADIUS,0,.43,.44,.44,j%2?C.orange:C.cream,false);}tag(g,'ring:'+i);scene.add(g);return g;});
 const targets=TARGETS.map((p,i)=>{const g=tag(target(),'target:'+i);g.position.set(p.x,0,p.z);scene.add(g);return g;});
 const crates=CRATES.map((p,i)=>{const g=tag(crate(),'crate:'+i);g.position.set(p.x,0,p.z);scene.add(g);return g;});
 // A runway points toward the first sky ring.
 box(statics,-42,.06,-28,8,.1,24,0x799687);for(let z=-38;z<-17;z+=4)box(statics,-42,.13,z,.27,.025,2,C.cream);
 // Major landmarks are independently batched so camera occluders can fade.
 ROCKS.forEach(([x,z,w,h,d],i)=>{const g=new THREE.Group();brick(g,x,h*.25,z,w,h*.5,d,0x8a9ca3);brick(g,x,h*.75,z,w*.7,h*.5,d*.7,0xa6b3b4);statics.add(g);tag(g,'rock:'+i);});
 const fading=[];for(const e of WORLD_ENTITIES.filter(e=>['house','rock'].includes(e.kind))){const source=entityGroups.get(e.id);source.removeFromParent();const group=batchStatic(source);group.userData.entityId=e.id;group.traverse(m=>{if(m.isMesh)m.material=m.material.clone();});scene.add(group);entityGroups.set(e.id,group);fading.push({group,entity:e,opacity:1});}
 const batched=batchStatic(statics);scene.add(batched);
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:0x80cbd3,roughness:.27,metalness:.12}));ocean.rotation.x=-Math.PI/2;ocean.position.y=-2.25;ocean.receiveShadow=true;scene.add(ocean);
 const waves=new THREE.Group();for(let i=0;i<100;i++){const x=Math.sin(i*2.13)*(78+i%7*18),z=Math.cos(i*3.79)*(78+i%9*14);if(Math.abs(x)<62&&Math.abs(z)<62)continue;box(waves,x,-2.20,z,1.8+i%5,.025,.14,0xa8e0df);}scene.add(batchStatic(waves));
 const clouds=new THREE.Group();for(let i=0;i<12;i++){const g=new THREE.Group();g.position.set(Math.sin(i*2.4)*120,36+(i%4)*5,Math.cos(i*2.4)*120);for(let j=0;j<3;j++)brick(g,j*3,Math.sin(j*1.5),0,4,2.2,3.5,C.white,false);clouds.add(g);}scene.add(batchStatic(clouds));
 function updateCamera(position,focus,dt){for(const f of fading){const obscures=f.entity.boxes.some(b=>segmentBox(focus,position,b,[.4,.4,.4]));const target=obscures?.16:1;f.opacity+=(target-f.opacity)*Math.min(1,dt*12);f.group.traverse(m=>{if(m.isMesh){m.material.transparent=f.opacity<.995;m.material.opacity=f.opacity;m.material.depthWrite=f.opacity>.8;}});}}
 return {updateCamera,obstacles,gates,rings,targets,crates,setDestroyed(ids){const destroyed=new Set(ids);for(const e of WORLD_ENTITIES){const visible=!destroyed.has(e.id);batched.userData.setEntityVisible(e.id,visible);const g=entityGroups.get(e.id);if(g&&g.parent===scene)g.visible=visible;}},entityGroups};
}
