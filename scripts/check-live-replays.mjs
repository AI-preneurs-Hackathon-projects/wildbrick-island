// Replays actual saved OpenAI responses. This test makes no API calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createGeneratedModel} from '../public/generated-model.js';
import {createSimulation} from '../public/simulation.js';
import {createAdventure} from '../public/adventure.js';
import {GATES,RINGS} from '../public/rules.js';
for(const [kind,mode] of [['dragon','plane'],['octopus','car'],['teapot','plane'],['arena-dragon','plane']]){
 const {blueprint,generation}=JSON.parse(fs.readFileSync(new URL(`../validation/live/${kind}.json`,import.meta.url)));
 assert.equal(generation.model,'gpt-5.4');assert.equal(blueprint.version,kind==='arena-dragon'?3:2);
 const model=createGeneratedModel(blueprint),events=[],sim=await createSimulation([],e=>events.push(e));sim.state.started=true;
 assert.ok(model.drawCalls<=5);assert.ok(Math.max(...model.size.toArray())<=8.001);
 const m=new THREE.Matrix4();for(const progress of [0,.25,.75,1])for(const t of [0,.25,.8,1.6]){model.update(t,progress,1);for(const mesh of model.group.children)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));}}
 const start=sim.state.z;assert.equal(sim.buildCustom({blueprint,dimensions:model.size.toArray()}),true);
 for(let i=0;i<45;i++)sim.update(1/60,{z:1,cameraYaw:Math.PI,up:mode==='plane'});assert.ok(sim.state.building);assert.ok(Math.abs(sim.state.z-start)>5);
 for(let i=0;i<240;i++)sim.update(1/60,{z:1,cameraYaw:Math.PI,up:mode==='plane'});assert.equal(sim.state.mode,mode);assert.equal(sim.state.custom.blueprint.name,blueprint.name);
 if(mode==='plane'){assert.ok(sim.state.y>4);const ring=RINGS[0],yaw=Math.atan2(RINGS[1].x-ring.x,RINGS[1].z-ring.z);Object.assign(sim.state,{x:ring.x-Math.sin(yaw)*.1,y:ring.y-model.size.y/2,z:ring.z-Math.cos(yaw)*.1,yaw,speed:0});sim.update(1/60,{z:1,cameraYaw:yaw});assert.ok(sim.state.rings.includes(0));}
 else{const gate=GATES[0];Object.assign(sim.state,{x:gate.x,y:0,z:gate.z,speed:0});sim.update(1/60,{});assert.ok(sim.state.gates.includes(0));}
 if(blueprint.ability==='pulse'){sim.action();assert.ok(events.some(e=>e.type==='shoot'&&e.pulse));}
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},adventure=createAdventure(storage);adventure.remember(blueprint);adventure.save(sim.state);const saved=createAdventure(storage);assert.deepEqual(saved.creations[0],blueprint);
 assert.equal(sim.build('foot'),true);assert.equal(sim.buildCustom({blueprint:saved.creations[0],dimensions:model.size.toArray()}),true);for(let i=0;i<180;i++)sim.update(1/60,{});assert.equal(sim.state.custom.blueprint.name,blueprint.name);
 console.log(`PASS actual ${kind} blueprint: finite animated geometry, moving assembly, automatic ${mode}, objective, saved rebuild`);sim.dispose();model.dispose();
}
console.log('\n4 saved live-output replay checks passed. These are Node integration checks, not browser/device tests or new live API calls.');
