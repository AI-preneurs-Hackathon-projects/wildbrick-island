// Original game meshes rendered on the CPU for the three onboarding cards.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as T from '../public/vendor/three.module.js';
import {character,brick,box,house,C} from '../public/models.js';
import {createGeneratedModel} from '../public/generated-model.js';
fs.mkdirSync('public/tutorial',{recursive:true});
for(const name of ['move','build','fight']){
 const root=new T.Group(),pilot=character();root.add(pilot.group);
 if(name==='move'){pilot.arms[0].rotation.x=-.65;pilot.arms[1].rotation.x=.65;pilot.legs[0].rotation.x=.6;pilot.legs[1].rotation.x=-.6;pilot.group.rotation.y=-.4;house(root,5,0,C.teal,0);}
 if(name==='build'){const b=JSON.parse(fs.readFileSync('validation/live/arena-dragon.json')).blueprint,model=createGeneratedModel(b);model.update(0,.92,0);model.group.position.set(2.5,0,-1);root.add(model.group);pilot.group.position.set(-2,0,0);pilot.arms.forEach(a=>a.rotation.x=-1.3);}
 if(name==='fight'){pilot.arms[1].rotation.x=-1.95;pilot.arms[1].position.z=.5;pilot.group.rotation.y=.6;const rival=character();rival.group.position.set(1.5,0,1.5);rival.group.rotation.set(-.2,Math.PI+.6,.1);root.add(rival.group);brick(root,-2,.55,1,1.25,1.1,1.25,0xec6556);box(root,-2,1.12,1,.26,.05,1.1,C.cream);box(root,-2,1.12,1,1.1,.05,.26,C.cream);}
 root.updateMatrixWorld(true);const triangles=[],matrix=new T.Matrix4(),instance=new T.Matrix4(),color=new T.Color();
 root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,ix=m.geometry.index;for(let j=0;j<(m.isInstancedMesh?m.count:1);j++){matrix.copy(m.matrixWorld);color.copy(m.material.color);if(m.isInstancedMesh){m.getMatrixAt(j,instance);matrix.multiply(instance);if(m.instanceColor){const c=new T.Color();m.getColorAt(j,c);color.multiply(c);}}for(let k=0;k<(ix?ix.count:p.count);k+=3){const v=[];for(let l=0;l<3;l++)v.push(...new T.Vector3().fromBufferAttribute(p,ix?ix.getX(k+l):k+l).applyMatrix4(matrix).toArray());triangles.push([...v,...color.toArray()]);}}});
 const r=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['scripts/render-tutorial.py'],{input:JSON.stringify({name,triangles}),encoding:'utf8',maxBuffer:1024*1024});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout.trim());
}
