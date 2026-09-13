// Explicit opt-in real API acceptance check; excluded from npm run check. Never store credentials in this file.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSimulation} from '../public/simulation.js';
import {createCreationService} from '../public/creation-service.js';
import {createGeneratedModel} from '../public/generated-model.js';
assert.ok(process.env.BRICKWILD_ORIGIN&&process.env.BRICKWILD_BYPASS,'Provide the existing private Site origin and authorized Sites bypass token via server-side environment variables. This explicit check makes one billable generation request.');
const sim=await createSimulation([],()=>{});sim.state.started=true;
const original=globalThis.fetch;let model,waitingDistance=0,assemblyDistance=0,states=[],raw;
globalThis.fetch=async(path,options={})=>{const r=await original(new URL(path,process.env.BRICKWILD_ORIGIN),{...options,headers:{...options.headers,Origin:process.env.BRICKWILD_ORIGIN,'OAI-Sites-Authorization':'Bearer '+process.env.BRICKWILD_BYPASS}});raw=await r.clone().json();return r;};
const service=createCreationService({onState:s=>states.push(s),onError:e=>{throw Error(e);},onReady:b=>{model=createGeneratedModel(b);sim.buildCustom({blueprint:b,dimensions:model.size.toArray()});}});
function tick(){const x=sim.state.x,z=sim.state.z,assembling=!!sim.state.building;sim.update(1/60,{z:1,cameraYaw:sim.state.time*.25,up:sim.state.mode==='plane'&&sim.state.y<12});const distance=Math.hypot(sim.state.x-x,sim.state.z-z);if(assembling)assemblyDistance+=distance;else if(service.pending)waitingDistance+=distance;if(model)model.update(sim.state.time,sim.state.building?sim.state.building.time/sim.state.building.duration:1,sim.state.speed/10);}
const interval=setInterval(tick,1000/60),started=Date.now();
try{assert.equal(await service.generate('A flying turquoise teapot with a curved spout, open handle, golden lid, tiny wings and a seat I can ride.'),true);clearInterval(interval);for(let i=0;i<360;i++)tick();assert.ok(waitingDistance>1);assert.ok(assemblyDistance>1);assert.equal(sim.state.mode,'plane');assert.ok(sim.state.y>4);assert.equal(sim.state.custom.blueprint.name,model.blueprint.name);fs.writeFileSync(process.env.BRICKWILD_OUTPUT||'/tmp/brickwild-live-response.json',JSON.stringify(raw,null,2));console.log(JSON.stringify({name:model.blueprint.name,parts:model.parts,generation:raw.generation,totalMs:Date.now()-started,waitingDistance,assemblyDistance,mountedMode:sim.state.mode,flightHeight:sim.state.y,states},null,2));}finally{clearInterval(interval);sim.dispose();model?.dispose();globalThis.fetch=original;}
