import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Separate processes keep the baseline/candidate material caches independent.
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const withoutColors=value=>Array.isArray(value)?value.map(withoutColors):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['color','groundColor','oceanColor'].includes(key)).map(([key,v])=>[key,withoutColors(v)])):value;
if(process.argv[2]==='--snapshot'){
 const root=resolve(process.argv[3]),load=p=>import(pathToFileURL(root+'/'+p));
 const THREE=await load('public/vendor/three.module.js'),{createWorld}=await load('public/world.js'),{MAP_CYCLE,getMap}=await load('public/map-catalog.js');
 const scene=new THREE.Scene(),result={};
 for(let cycle=0;cycle<3;cycle++)for(const id of MAP_CYCLE){
  const world=createWorld(scene,id),geometries=new Set(),materials=new Set(),textures=new Set(),sharedMaterials=new Set(),disposable=new Set(),disposed=new Set(),shape=[];
  let meshes=0,triangles=0,instanceBytes=0;
  world.root.updateMatrixWorld(true);
  world.root.traverse(o=>{
   if(o.isInstancedMesh)disposable.add(o);
   if(!o.isMesh)return;meshes++;
   const g=o.geometry;geometries.add(g);if(!g.userData.shared)disposable.add(g);
   triangles+=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
   if(o.instanceMatrix)instanceBytes+=o.instanceMatrix.array.byteLength;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const m of mats){materials.add(m);if(m.userData.worldOwned)disposable.add(m);else sharedMaterials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}
   shape.push({matrix:o.matrixWorld.toArray(),instances:o.instanceMatrix?Array.from(o.instanceMatrix.array):null,attributes:Object.fromEntries(Object.entries(g.attributes).filter(([key])=>key!=='color').map(([key,v])=>[key,Array.from(v.array)])),index:g.index?Array.from(g.index.array):null,cast:o.castShadow,receive:o.receiveShadow,visible:o.visible,materials:mats.map(m=>({type:m.type,roughness:m.roughness,metalness:m.metalness,transparent:m.transparent,opacity:m.opacity,vertexColors:m.vertexColors}))});
  });
  let geometryBytes=0;for(const g of geometries){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;if(g.index)geometryBytes+=g.index.array.byteLength;}
  const stats={meshes,triangles,geometries:geometries.size,materials:materials.size,textures:textures.size,geometryBytes,instanceBytes,shape:digest(shape),gameplay:digest(withoutColors(getMap(id))),ownedDisposals:disposable.size};
  assert.equal(textures.size,0,'world has no textures; texture bytes are therefore zero');
  for(const resource of disposable)resource.addEventListener('dispose',()=>disposed.add(resource));
  for(const m of sharedMaterials)m.addEventListener('dispose',()=>assert.fail('shared material disposed'));
  world.dispose();assert.equal(scene.children.length,0,'world root removed');assert.equal(disposed.size,disposable.size,'all owned resources dispose');
  if(cycle)assert.deepEqual(stats,result[id],'repeated map cycle has stable resources');else result[id]=stats;
 }
 console.log(JSON.stringify(result));
}else{
 assert.ok(process.argv[2],'Usage: node scripts/check-map-art.mjs /path/to/baseline');
 const snapshot=root=>JSON.parse(execFileSync(process.execPath,[import.meta.filename,'--snapshot',root],{encoding:'utf8',maxBuffer:4*1024*1024}));
 const before=snapshot(process.argv[2]),after=snapshot(resolve(import.meta.dirname,'..'));
 assert.deepEqual(after,before,'palette changes must preserve geometry, gameplay, materials and resource counts');
 console.log(JSON.stringify({before,after,cyclesPerBuild:3,rendered:false},null,2));
 console.log('PASS identical gameplay and render geometry, resource counts and nine world disposals per build. GPU calls/timings are not measured.');
}
