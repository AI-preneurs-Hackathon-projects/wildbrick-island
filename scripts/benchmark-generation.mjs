// Explicit billable trials through the existing Site. Never substitutes fixtures.
import fs from 'node:fs';
import {createGeneratedModel} from '../public/generated-model.js';
import {validateBlueprint} from '../public/blueprint.js';
import {createSimulation} from '../public/simulation.js';
const origin=process.env.BRICKWILD_ORIGIN,token=process.env.BRICKWILD_BYPASS,label=process.argv[2];
if(!origin||!token||!label||!/^[a-z0-9-]+$/.test(label))throw Error('Provide the authorized Site environment and a trial label.');
const prompts=[['dragon','A green dragon I can ride, with broad golden wings, a long tail, and fire breath coming from its mouth.'],['armed-car','A red four-wheeled car I can drive, with a visible seat and two mounted machine guns on the hood.'],['octopus','A purple mechanical octopus on wheels, with eight articulated tentacles, a seat on top, and a forward-facing laser.']];
const directory='validation/live/'+label;fs.mkdirSync(directory,{recursive:true});const rows=[];
for(const [id,prompt]of prompts.filter(([id])=>!process.argv[3]||id===process.argv[3])){
 const sim=await createSimulation([],()=>{});sim.state.started=true;let distance=0;const timer=setInterval(()=>{const before={x:sim.state.x,z:sim.state.z};sim.update(1/60,{z:1,cameraYaw:sim.state.time*.3});distance+=Math.hypot(sim.state.x-before.x,sim.state.z-before.z);},1000/60);
 const started=performance.now();let row={id,prompt,label};
 try{const response=await fetch(origin+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'OAI-Sites-Authorization':'Bearer '+token},body:JSON.stringify({prompt}),signal:AbortSignal.timeout(100000)});const headersMs=performance.now()-started,raw=await response.json();row.httpStatus=response.status;row.requestMs=+(performance.now()-started).toFixed(1);row.headersMs=+headersMs.toFixed(1);row.generation=raw.generation;row.error=raw.error;row.issue=raw.issue;
  if(response.ok){const validateAt=performance.now(),b=validateBlueprint(raw.blueprint);row.validationMs=+(performance.now()-validateAt).toFixed(2);const renderAt=performance.now(),model=createGeneratedModel(b);row.modelConstructionMs=+(performance.now()-renderAt).toFixed(2);row.parts=b.parts.length;row.joints=b.joints.length;row.movement=b.movement;row.traits=b.traits;row.name=b.name;row.size=model.size.toArray();row.seat=model.seat.toArray();row.waitingMovementMetres=+distance.toFixed(2);row.live=true;fs.writeFileSync(directory+'/'+id+'.json',JSON.stringify({prompt,...raw},null,2));model.dispose();}
 }catch(e){row.error=e.message;row.requestMs=+(performance.now()-started).toFixed(1);}finally{clearInterval(timer);sim.dispose();}
 rows.push(row);fs.writeFileSync(directory+'/measurements.json',JSON.stringify({kind:'live generation; CPU model construction; speech and browser GPU timings unavailable',rows},null,2));console.log(JSON.stringify(row));
}
