import * as THREE from './vendor/three.module.js';

// Resolve painted rectangles into one non-overlapping surface. Later paint wins
// at intersections, instead of asking the depth buffer to choose coplanar faces.
export function groundCells(map){
 const limit=56,clip=n=>Math.max(-limit,Math.min(limit,n));
 const tiles=map.pieces.map(p=>({x0:clip(p.x-p.w/2),x1:clip(p.x+p.w/2),z0:clip(p.z-p.d/2),z1:clip(p.z+p.d/2),color:p.color}));
 const xs=[...new Set([-limit,limit,...tiles.flatMap(t=>[t.x0,t.x1])])].sort((a,b)=>a-b),zs=[...new Set([-limit,limit,...tiles.flatMap(t=>[t.z0,t.z1])])].sort((a,b)=>a-b),cells=[];
 for(let j=0;j<zs.length-1;j++){let run=null;for(let i=0;i<xs.length-1;i++){const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;let color=map.groundColor;for(const t of tiles)if(x>t.x0&&x<t.x1&&z>t.z0&&z<t.z1)color=t.color;if(run&&run.color===color)run.x1=xs[i+1];else{run={x0:xs[i],x1:xs[i+1],z0:zs[j],z1:zs[j+1],color};cells.push(run);}}}
 return cells;
}
export function createGroundSurface(map){
 const positions=[],colors=[];for(const cell of groundCells(map)){const {x0,x1,z0,z1}=cell,color=new THREE.Color(cell.color);positions.push(x0,0,z0,x0,0,z1,x1,0,z0,x1,0,z0,x0,0,z1,x1,0,z1);for(let i=0;i<6;i++)colors.push(color.r,color.g,color.b);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});material.userData.worldOwned=true;
 const mesh=new THREE.Mesh(geometry,material);mesh.name='ground:'+map.id;mesh.receiveShadow=true;return mesh;
}
