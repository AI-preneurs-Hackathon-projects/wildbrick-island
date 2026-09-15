import * as THREE from './vendor/three.module.js';
import {box,brick,cylinder,batchStatic,C} from './models.js';
import {segmentBox} from './geometry.js';
import {createGroundSurface} from './ground-surface.js';
export function createThemedWorld(root,map){
 const entityGroups=new Map(),fading=[],statics=new THREE.Group();
 const piece=(parent,p)=>{if(p.shape==='cylinder')return cylinder(parent,p.x,p.y,p.z,p.w/2,p.h,p.color);return (p.shape==='brick'?brick:box)(parent,p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.studs!==false);};
 box(statics,0,-1.8,0,119,3.5,119,map.id==='mountain'?0x5e91a2:C.sand);box(statics,0,-.13,0,112,.24,112,map.groundColor);
 for(let x=-54;x<=54;x+=2.4)for(let z=-54;z<=54;z+=2.4)cylinder(statics,x,.045,z,.14,.09,map.groundColor);
 root.add(createGroundSurface(map));
 root.add(batchStatic(statics));
 for(const e of map.entities){const source=new THREE.Group();source.userData.entityId=e.id;for(const p of e.pieces)piece(source,p);const group=batchStatic(source);group.userData.entityId=e.id;group.name=e.id;
  group.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.userData.worldOwned=true;}});root.add(group);entityGroups.set(e.id,group);if(['house','rock','landmark'].includes(e.kind))fading.push({group,entity:e,opacity:1});
 }
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:map.oceanColor,roughness:.92,metalness:0}));ocean.material.userData.worldOwned=true;ocean.rotation.x=-Math.PI/2;ocean.position.y=-2.25;root.add(ocean);
 const atmosphere=new THREE.Group();for(let i=0;i<14;i++){const angle=i*2.4,radius=88+(i%4)*11,g=new THREE.Group();g.position.set(Math.sin(angle)*radius,14+(i%5)*3.5,Math.cos(angle)*radius);g.rotation.y=angle;brick(g,-3.6,0,0,7.2,2.4,4.8,C.white,false);brick(g,1.4,.9,(i%2?-.3:.3),8,3.5,5.4,C.white,false);brick(g,5.6,.15,(i%2?.2:-.2),5.6,2.1,4.4,C.white,false);atmosphere.add(g);}
 for(let i=0;i<70;i++){const x=Math.sin(i*2.13)*(78+i%7*18),z=Math.cos(i*3.79)*(78+i%9*14);if(Math.abs(x)<62&&Math.abs(z)<62)continue;box(atmosphere,x,-2.2,z,2+i%5,.025,.14,0xd9f1f0);}root.add(batchStatic(atmosphere));
 return {obstacles:map.entities.flatMap(e=>e.boxes.map(b=>({...b,id:e.id,kind:e.kind,hp:e.hp}))),entityGroups,gates:[],rings:[],targets:[],crates:[],
  setDestroyed(ids){const destroyed=new Set(ids);for(const [id,g]of entityGroups)g.visible=!destroyed.has(id);},
  updateCamera(position,focus,dt){for(const f of fading){const obscures=f.entity.boxes.some(b=>segmentBox(focus,position,b,[.4,.4,.4]));f.opacity+=((obscures?.16:1)-f.opacity)*Math.min(1,dt*12);f.group.traverse(m=>{if(m.isMesh){m.material.transparent=f.opacity<.995;m.material.opacity=f.opacity;m.material.depthWrite=f.opacity>.8;}});}}
 };
}
