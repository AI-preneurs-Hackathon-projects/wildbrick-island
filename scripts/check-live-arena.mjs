// Explicit opt-in acceptance check: one billable OpenAI design and three live
// arena sessions. No credential is written; response records exclude sessions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {validateBlueprint} from '../public/blueprint.js';
import {createGeneratedModel} from '../public/generated-model.js';
import {newRoom,addPlayer,applyInput,advanceRoom,makeKit} from '../public/arena-core.js';
const origin=process.env.BRICKWILD_ORIGIN,token=process.env.BRICKWILD_BYPASS;
if(!origin||!token)throw Error('Supply the authorized Site origin and temporary bypass token securely.');
const headers={'OAI-Sites-Authorization':'Bearer '+token,'Content-Type':'application/json',Origin:origin};
async function call(path,body){const response=await fetch(origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(100000)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Request failed'),{status:response.status});return data;}
const status=await call('/api/generation-status?verify=1');console.log(JSON.stringify({configured:status.configured,reachable:status.reachable,model:status.model}));assert.equal(status.reachable,true);
const report={date:new Date().toISOString(),generation:null,arena:null};
const prompt='Build a rideable emerald dragon with golden wings that breathes fire from its mouth.';
let blueprint;
if(process.env.BRICKWILD_LIVE_DESIGN==='1'){
 const result=await call('/api/generate',{prompt});blueprint=validateBlueprint(result.blueprint);assert.equal(blueprint.version,3);assert.equal(blueprint.movement,'fly');assert.equal(blueprint.traits.weapon,'flame');const model=createGeneratedModel(blueprint);assert.ok(model.drawCalls<=5);assert.ok(model.parts>=32);const record={prompt,...result};fs.writeFileSync(new URL('../validation/live/arena-dragon.json',import.meta.url),JSON.stringify(record,null,2)+'\n');report.generation={name:blueprint.name,parts:blueprint.parts.length,traits:blueprint.traits,model:result.generation.model,durationMs:result.generation.durationMs};model.dispose();console.log('Live new dragon: '+blueprint.parts.length+' parts; flying mount with flame emitter.');
}else{const saved=JSON.parse(fs.readFileSync(new URL('../validation/live/arena-dragon.json',import.meta.url)));blueprint=saved.blueprint;report.generation={name:blueprint.name,parts:blueprint.parts.length,traits:blueprint.traits,model:saved.generation.model,durationMs:saved.generation.durationMs,reusedActualResponse:true};}
// Same real response enters the actual trusted simulation while moving.
const local=newRoom(),p=addPlayer(local,'pilot','Pilot');p.protectedUntil=0;const start={x:p.x,z:p.z};applyInput(local,p.id,{seq:1,command:{id:1,type:'build'}},local.time,makeKit('dragon',blueprint));for(let i=0;i<150;i++){applyInput(local,p.id,{seq:i+2,input:{z:1,cameraYaw:Math.PI/2,up:i>100,fire:i>100}},local.time);advanceRoom(local,local.time+1000/30);}assert.ok(Math.hypot(p.x-start.x,p.z-start.z)>5);assert.equal(p.kit.stats.weapon,'flame');assert.ok(local.events.some(e=>e.type==='shot'));report.generation={...report.generation,localMovingAssembly:true,localMountedFlight:p.y>1,localFlameUse:true};
const sessions=[],room='QA'+Math.random().toString(36).slice(2,8).toUpperCase();
try{
 for(let i=0;i<3;i++){const s=await call('/api/arena/join',{room,name:'Acceptance '+(i+1)});sessions.push({session:s.session,token:s.token,player:s.snapshot.self,seq:0});}
 const packet=(s,input={},command)=>({session:s.session,token:s.token,seq:++s.seq,input,command});
 const startState=await call('/api/arena/sync',packet(sessions[0]));assert.equal(startState.snapshot.players.length,3);
 await call('/api/arena/build',{...packet(sessions[0],{z:1,cameraYaw:Math.PI/2},{id:1,type:'build',mode:'generated'}),blueprint});
 await call('/api/arena/sync',packet(sessions[1],{}, {id:1,type:'build',mode:'car'}));
 await call('/api/arena/sync',packet(sessions[2],{}, {id:1,type:'build',mode:'bow'}));
 const began=Date.now();let last=null;
 while(Date.now()-began<6500){for(let i=0;i<sessions.length;i++)last=await call('/api/arena/sync',packet(sessions[i],i===0?{z:1,cameraYaw:Math.PI/2,fire:true}:{}));await new Promise(r=>setTimeout(r,160));}
 const snapshot=last.snapshot,a=snapshot.players.find(p=>p.id===sessions[0].player),b=snapshot.players.find(p=>p.id===sessions[1].player),c=snapshot.players.find(p=>p.id===sessions[2].player);assert.equal(a.kit.stats.weapon,'flame');assert.equal(a.kit.stats.movement,'fly');assert.ok(a.mountHealth>0);assert.equal(b.kit.id,'car');assert.equal(c.kit.id,'bow');const from=startState.snapshot.players.find(p=>p.id===sessions[0].player);assert.ok(Math.hypot(a.x-from.x,a.z-from.z)>5);assert.ok(snapshot.events.some(e=>e.type==='shot'&&e.player===a.id));const saved=await call('/api/arena/blueprint?id='+a.kit.blueprintId);assert.deepEqual(saved.blueprint,blueprint);report.arena={sessions:3,sameOwnerIdentity:true,sharedPlayers:snapshot.players.length,revision:snapshot.revision,liveMovingAssembly:true,liveMount:a.kit.name,liveAltitude:a.y,liveFlame:true,carAndBow:true,blueprintShared:true};console.log('Live shared arena: three sessions, moving dragon assembly, flight/flame, car, bow and shared blueprint passed.');
}catch(error){report.arena={blocked:true,status:error.status||null,error:error.message};console.log('Live arena acceptance blocker: '+(error.status||'test')+' '+error.message);process.exitCode=1;}
finally{for(const s of sessions)try{await call('/api/arena/leave',{session:s.session,token:s.token});}catch{}fs.writeFileSync(new URL('../validation/live/arena-acceptance.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
