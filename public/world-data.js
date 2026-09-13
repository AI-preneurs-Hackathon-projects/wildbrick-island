import {GATES,RINGS,TARGETS,CRATES} from './rules.js';
export const RING_RADIUS=4.4;
export const HOMES=[[-17,-16,0x63c7b2,Math.PI/2],[-18,-42,0xffcf55,0],[13,-43,0xe59b83,0],[44,-17,0x78adce,-Math.PI/2],[45,17,0xffcf55,-Math.PI/2],[-44,21,0x82bbcd,Math.PI/2]];
export const ROCKS=[[-18,8,4,2.8,3],[16,-10,4.5,3,3],[-8,-22,3,2.4,3.5],[22,21,3.5,2.6,3]];
export const TREES=[];
for(let i=0;i<36;i++){const a=i*2.3999,r=39+(i%4)*4.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(HOMES.some(h=>Math.hypot(h[0]-x,h[1]-z)<7))continue;TREES.push({id:'tree:outer:'+i,x,z,scale:.8+(i%3)*.22,kind:i%2});}
[[-12,35],[14,38],[-37,-13],[38,8],[-11,-8],[8,14]].forEach(([x,z],i)=>TREES.push({id:'tree:inner:'+i,x,z,scale:1.1,kind:1}));
const shape=(x,y,z,w,h,d)=>({x,y,z,w,h,d});
export const WORLD_ENTITIES=[];
const add=(id,kind,hp,boxes,color)=>WORLD_ENTITIES.push({id,kind,hp,boxes,color});
HOMES.forEach(([x,z,color,yaw],i)=>{const swap=Math.abs(Math.sin(yaw))>.5,local=(cx,cy,cz,w,h,d)=>shape(x+Math.cos(yaw)*cx+Math.sin(yaw)*cz,cy,z-Math.sin(yaw)*cx+Math.cos(yaw)*cz,swap?d:w,h,swap?w:d);
 const boxes=[local(0,2.15,0,6,4.3,5.4),local(0,.28,0,6.4,.54,5.8),local(0,4.45,0,6.55,.33,5.9)];for(let n=0;n<4;n++)boxes.push(local(0,4.75+n*.4,0,6.8-n*.75,.41,6.05-n*.68));add('house:'+i,'house',1200,boxes,color);});
ROCKS.forEach(([x,z,w,h,d],i)=>add('rock:'+i,'rock',420,[shape(x,h*.25,z,w,h*.5,d),shape(x,h*.75,z,w*.7,h*.5,d*.7)],0x8a9ca3));
TREES.forEach(t=>{const s=t.scale,local=(x,y,z,w,h,d)=>shape(t.x+x*s,y*s,t.z+z*s,w*s,h*s,d*s),boxes=[local(0,1,0,.6,2,.6)];if(t.kind){for(let i=0;i<3;i++)boxes.push(local(0,2.3+i*.72,0,2.5-i*.65,.8,2.5-i*.65));}else boxes.push(local(0,2.7,0,2.7,1.4,2.4),local(.4,3.65,-.12,1.8,.64,1.75),local(-.8,2.9,.6,1.2,.7,1.3));add(t.id,'tree',85,boxes,0x53a575);});
export const LOOSE_BRICKS=[];for(let i=0;i<65;i++){const x=Math.sin(i*7.1)*49,z=Math.cos(i*3.7)*49;if(Math.abs(Math.abs(x)-29)<6||Math.abs(Math.abs(z)-29)<6||Math.abs(x)<5||Math.abs(z)<5)continue;const id='loose:'+i;LOOSE_BRICKS.push({id,x,z,color:i%3});add(id,'loose',0,[shape(x,.13,z,.33,.24,.33)],0xffcf55);}
GATES.forEach((p,i)=>{const boxes=[shape(-4.8,1.95,0,.54,3.9,.7),shape(4.8,1.95,0,.54,3.9,.7),shape(-4.8,4,0,.72,.23,.95),shape(4.8,4,0,.72,.23,.95),shape(0,4.05,0,10.1,.35,.7)].map(b=>p.axis==='z'?shape(p.x+b.z,b.y,p.z+b.x,b.d,b.h,b.w):shape(p.x+b.x,b.y,p.z+b.z,b.w,b.h,b.d));add('gate:'+i,'gate',190,boxes,0x63c7b2);});
RINGS.forEach((p,i)=>{const next=RINGS[(i+1)%RINGS.length],yaw=Math.atan2(next.x-p.x,next.z-p.z),boxes=[];for(let j=0;j<24;j++){const a=j*Math.PI/12,x=Math.sin(a)*RING_RADIUS,y=Math.cos(a)*RING_RADIUS;boxes.push(shape(p.x+x*Math.cos(yaw),p.y+y,p.z-x*Math.sin(yaw),.72,.72,.72));}add('ring:'+i,'ring',0,boxes,0xffcf55);});
TARGETS.forEach((p,i)=>add('target:'+i,'target',55,[shape(p.x,1.9,p.z,1.74,1.74,.4),shape(p.x,.68,p.z,.19,1.36,.21),shape(p.x,.08,p.z,1.2,.16,.6)],0x63c7b2));
CRATES.forEach((p,i)=>add('crate:'+i,'crate',40,[shape(p.x,.725,p.z,1.4,1.45,1.55)],0xa6a2db));
add('plaza','plaza',220,[...Array.from({length:12},(_,i)=>{const z=(i-5.5)*7.6/12;return shape(0,.18,z,2*Math.sqrt(3.8**2-z**2),.18,7.6/12);}),...Array.from({length:12},(_,i)=>{const z=(i-5.5)*5.8/12;return shape(0,.30,z,2*Math.sqrt(2.9**2-z**2),.13,5.8/12);}),shape(-.4,.74,0,1.9,.6,1.3),shape(.35,1.28,.13,1.3,.47,1.3),shape(-.14,1.76,0,1.3,.38,.63)],0xffcf55);
export const WORLD_BY_ID=new Map(WORLD_ENTITIES.map(e=>[e.id,e]));
export const SPAWNS=[[-6,18],[6,-18],[20,6],[-20,-6],[35,32],[-35,-32],[32,-35],[-32,35]];
for(let x=-24;x<=24;x+=8)for(let z=-24;z<=24;z+=8)if(Math.hypot(x,z)>9)SPAWNS.push([x,z]);
export const DROP_POINTS=[[0,12],[12,0],[0,-12],[-12,0],[29,17],[-29,-17],[17,-29],[-17,29],[0,29],[29,0]];
