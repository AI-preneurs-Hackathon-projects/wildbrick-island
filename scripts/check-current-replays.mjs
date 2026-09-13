// Replays captured live v4 geometry through the actual authoritative arena.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createGeneratedModel} from '../public/generated-model.js';
import {newRoom,addPlayer,applyInput,advanceRoom,makeKit} from '../public/arena-core.js';
import {createState} from '../public/rules.js';
import {createAdventure} from '../public/adventure.js';
for(const [file,weapon,movement] of [['final-compact-none/dragon','flame','fly'],['final-compact-none/armed-car','automatic','drive'],['final-compact-none/octopus','pulse','drive']]){
 const b=JSON.parse(fs.readFileSync('validation/live/'+file+'.json')).blueprint,model=createGeneratedModel(b);
 assert.equal(b.version,4);assert.equal(b.traits.weapon,weapon);assert.equal(b.movement,movement);assert.ok(model.drawCalls<=5);
 const matrix=new THREE.Matrix4();for(const t of [0,.2,.7,1.1]){model.update(t,1,1);for(const mesh of model.group.children)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));}}
 const room=newRoom(100000),p=addPlayer(room,'builder','Builder');Object.assign(p,{x:0,z:10,protectedUntil:0});
 const kit=makeKit(file,b);assert.ok(kit.muzzle.every(Number.isFinite));applyInput(room,p.id,{seq:1,input:{x:1,cameraYaw:0},command:{id:1,type:'build'}},room.time,kit);
 for(let i=0;i<6;i++){p.lastSeen=room.time;p.inputAt=room.time;advanceRoom(room,room.time+250);}assert.equal(p.kit.id,file);assert.ok(Math.abs(p.x)>5,'movement continues during assembly');
 Object.assign(p,{x:0,y:9,z:10,input:{}});const victim=addPlayer(room,'target','Target');Object.assign(victim,{x:0,y:9,z:20,protectedUntil:0});
 applyInput(room,p.id,{seq:2,input:{cameraYaw:0},command:{id:2,type:'fire'}},room.time);advanceRoom(room,room.time+500);assert.ok(victim.health<100,'authored emitter launches a working trusted attack');assert.ok(room.events.some(e=>e.type==='hit'&&e.by===p.id));assert.equal(p.y,9,'attack never knocks the shooter away');
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},saved=createAdventure(storage);saved.remember(b);saved.save(createState());assert.deepEqual(createAdventure(storage).creations[0],b);model.dispose();
 console.log('PASS captured compact '+file+': assembly movement, joints, emitter, damage and saved blueprint');
}
console.log('3 current live-output arena replays passed; no new API calls or rendered gameplay.');
