import {GATES,RINGS,TARGETS,CRATES} from './rules.js';
export const RING_RADIUS=4.4;
export const HOMES=[[-17,-16,0x63c7b2,Math.PI/2],[-18,-42,0xffcf55,0],[13,-43,0xe59b83,0],[44,-17,0x78adce,-Math.PI/2],[45,17,0xffcf55,-Math.PI/2],[-44,21,0x82bbcd,Math.PI/2]];
export const TREES=[];
for(let i=0;i<36;i++){const a=i*2.3999,r=39+(i%4)*4.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(HOMES.some(h=>Math.hypot(h[0]-x,h[1]-z)<7))continue;TREES.push({id:'tree:outer:'+i,x,z,scale:.8+(i%3)*.22,kind:i%2});}
[[-12,35],[14,38],[-37,-13],[38,8],[-11,-8],[8,14]].forEach(([x,z],i)=>TREES.push({id:'tree:inner:'+i,x,z,scale:1.1,kind:1}));
const shape=(x,y,z,w,h,d)=>({x,y,z,w,h,d});
export const WORLD_ENTITIES=[];
const add=(id,kind,hp,boxes,color)=>WORLD_ENTITIES.push({id,kind,hp,boxes,color});
HOMES.forEach(([x,z,color,yaw],i)=>{const swap=Math.abs(Math.sin(yaw))>.5;add('house:'+i,'house',1200,[shape(x,2.3,z,swap?5.9:6.55,4.6,swap?6.55:5.9),shape(x,5.45,z,swap?5.6:6.2,1.7,swap?6.2:5.6)],color);});
TREES.forEach(t=>add(t.id,'tree',85,[shape(t.x,t.scale,t.z,.65*t.scale,2*t.scale,.65*t.scale),shape(t.x,3*t.scale,t.z,2.75*t.scale,2.5*t.scale,2.5*t.scale)],0x53a575));
GATES.forEach((p,i)=>{const boxes=[shape(-4.8,2,0,.72,4.2,.95),shape(4.8,2,0,.72,4.2,.95),shape(0,4.05,0,10.1,.35,.7)].map(b=>p.axis==='z'?shape(p.x+b.z,b.y,p.z+b.x,b.d,b.h,b.w):shape(p.x+b.x,b.y,p.z+b.z,b.w,b.h,b.d));add('gate:'+i,'gate',190,boxes,0x63c7b2);});
RINGS.forEach((p,i)=>{const next=RINGS[(i+1)%RINGS.length],yaw=Math.atan2(next.x-p.x,next.z-p.z),boxes=[];for(let j=0;j<24;j++){const a=j*Math.PI/12,x=Math.sin(a)*RING_RADIUS,y=Math.cos(a)*RING_RADIUS;boxes.push(shape(p.x+x*Math.cos(yaw),p.y+y,p.z-x*Math.sin(yaw),.72,.72,.72));}add('ring:'+i,'ring',0,boxes,0xffcf55);});
TARGETS.forEach((p,i)=>add('target:'+i,'target',55,[shape(p.x,1.9,p.z,1.75,1.75,.4),shape(p.x,.65,p.z,.3,1.3,.3)],0x63c7b2));
CRATES.forEach((p,i)=>add('crate:'+i,'crate',40,[shape(p.x,.7,p.z,1.45,1.4,1.5)],0xa6a2db));
add('plaza','plaza',220,[shape(0,.18,0,5.8,.36,5.8),shape(0,1.1,0,2.1,1.8,1.5)],0xffcf55);
export const WORLD_BY_ID=new Map(WORLD_ENTITIES.map(e=>[e.id,e]));
export const SPAWNS=[[-6,18],[6,-18],[20,6],[-20,-6],[35,32],[-35,-32],[32,-35],[-32,35]];
export const DROP_POINTS=[[0,12],[12,0],[0,-12],[-12,0],[29,17],[-29,-17],[17,-29],[-17,29],[0,29],[29,0]];
