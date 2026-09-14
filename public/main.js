import {poseRangedModel,createWeaponGuide} from './aim-presentation.js';
import {nearbyItem} from './arena-core.js';
import {meleeRotation} from './combat-pose.js';
import {gameCamera} from './game-camera.js';
import {createAvatarPreview} from './avatar-preview.js';
import {followCamera} from './follow-camera.js';
import * as THREE from './vendor/three.module.js';
import {arenaMap} from './map-catalog.js';
import {createWorld} from './world.js';
import {poseWeaponHands} from './weapon-pose.js';
import {makeKit} from './arena-core.js';
import {weaponGrip} from './weapon-aim.js';
import {character,car,plane,bow,sword,arrow,box,material,C} from './models.js';
import {createSimulation} from './simulation.js';
import {createUI,createVoice,icon} from './ui.js';
import {gameplayBlocked,bindingLabel} from './action-bindings.js';
import {createInput} from './input.js';
import {createAudio} from './audio.js';
import {BUILDS,TARGETS,CRATES,GATES,RINGS} from './rules.js';
import {createGeneratedModel} from './generated-model.js';
import {createCreationService} from './creation-service.js';
import {createAdventure} from './adventure.js';
import {createArenaClient} from './arena-client.js';
import {createArenaView} from './arena-view.js';
import {createArenaUI} from './arena-ui.js';
import {navigationGoal,creationControls} from './guidance.js';
const dom=document.querySelector('#scene');
let renderer;
function fatal(message){const boot=document.querySelector('#boot');boot.innerHTML=`<div class="fatal"><h2>Let’s get the world moving.</h2><p></p><button class="primary" onclick="location.reload()">Try again</button></div>`;boot.querySelector('p').textContent=message;boot.style.display='flex';}
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});}catch{fatal('This browser couldn’t start 3D graphics. Open the game in a recent Safari or Chrome browser, then try again.');}
if(renderer)bootGame().catch(error=>{console.error(error);fatal('The island couldn’t finish loading. Check your connection and try again.');});
async function bootGame(){
 const coarse=matchMedia('(pointer:coarse)').matches;
 renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;dom.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xb4dedd);scene.fog=new THREE.Fog(0xb4dedd,95,240);
 const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,500);camera.position.set(22,21,40);
 scene.add(new THREE.HemisphereLight(0xe9fcff,0x66854d,2.0));const sun=new THREE.DirectionalLight(0xffecc5,2.65);sun.position.set(-28,50,24);sun.castShadow=true;sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;sun.shadow.camera.near=1;sun.shadow.camera.far=140;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
 let poseKit,poseBlueprint,poseMode,practiceShot=null;const practiceAimGuide=createWeaponGuide(scene);
 const practiceWorld=createWorld(scene),pilot=character();let world=practiceWorld,arenaWorld=null,practicePose=null;const actor=new THREE.Group();actor.add(pilot.group);scene.add(actor);
 const constructors={car,plane,bow,sword};const equipment={};for(const [type,fn] of Object.entries(constructors)){const model=fn();model.group.visible=false;actor.add(model.group);equipment[type]=model;}
 const particleGeometry=new THREE.BoxGeometry(.20,.14,.23),pulseGeometry=new THREE.SphereGeometry(.23,10,8),particles=[],projectiles=[];let arena,arenaUI,arenaView,arenaMode=false;let assembly=null,sim,ui,input,voice,creations,avatarPreview,activeGenerated=null,pendingGenerated=null,readyModel=null;const placedModels=[];let buildTiming=null,speechTiming=null;let deviceStorage;try{deviceStorage=window.localStorage;}catch{}const adventure=createAdventure(deviceStorage),recentCreations=adventure.creations;let saveWarning=false;
 const guide=new THREE.Group(),guideRing=new THREE.Mesh(new THREE.TorusGeometry(1.15,.09,6,32),material(C.yellow)),guideArrow=new THREE.Mesh(new THREE.ConeGeometry(.32,.8,5),material(C.yellow));guideRing.rotation.x=Math.PI/2;guideArrow.rotation.z=Math.PI;guideArrow.position.y=1.1;guide.add(guideRing,guideArrow);scene.add(guide);guide.visible=false;const gripOffset=new THREE.Vector3();
 const sound=createAudio();const cameraTarget=new THREE.Vector3(0,1,9),desiredCamera=new THREE.Vector3(),focus=new THREE.Vector3();let previousTime=0,accumulator=0,uiTime=0,snapClock=0,frameCount=0,frameCost=0;
 const makeBurst=(position,color,count=20)=>{for(let i=0;i<count;i++){if(particles.length>160)break;const mesh=new THREE.Mesh(particleGeometry,material(i%4===0?C.cream:color));const a=i*2.4;mesh.position.copy(position).add(new THREE.Vector3(Math.sin(a)*.8,(i%4)*.2,Math.cos(a)*.8));scene.add(mesh);particles.push({mesh,life:.4});}};
 function updateMode(mode){
  for(const [key,e]of Object.entries(equipment))e.group.visible=key===mode&&!sim.state.custom;
  pilot.group.position.set(0,0,0);pilot.group.scale.setScalar(1);pilot.group.rotation.set(0,0,0);pilot.legs.forEach(l=>l.rotation.x=0);
  if(mode==='car'){pilot.group.position.set(-.5,.85,-.53);pilot.group.scale.setScalar(.76);pilot.legs.forEach(l=>l.rotation.x=-1.45);}
  if(mode==='plane'){pilot.group.position.set(0,1.07,-.52);pilot.group.scale.setScalar(.66);pilot.legs.forEach(l=>l.rotation.x=-1.45);}
  if(mode==='bow'){equipment.bow.group.position.set(.25,1.26,.64);equipment.bow.group.rotation.set(0,.05,0);}
  if(mode==='sword'){equipment.sword.group.position.set(-.81,1.06,.37);equipment.sword.group.rotation.set(.35,0,-.15);}
  if(sim.state.custom&&activeGenerated){const movement=sim.state.custom.blueprint.movement;activeGenerated.group.visible=true;if(movement==='carry'){pilot.group.position.set(0,0,0);pilot.group.scale.setScalar(1);pilot.legs.forEach(l=>l.rotation.x=0);activeGenerated.group.position.set(-.76,1.1,.3);}else{pilot.group.position.copy(activeGenerated.seat);pilot.group.position.y-=.48;pilot.group.scale.setScalar(.7);pilot.legs.forEach(l=>l.rotation.x=-1.45);}}
  if(assembly){restoreAssembly();assembly=null;}
 }
 function restoreAssembly(){if(!assembly)return;assembly.parts.forEach(p=>{p.mesh.position.copy(p.end);p.mesh.rotation.copy(p.rotation);p.mesh.scale.copy(p.scale);});}
 function startBuild(mode,custom){
  if(custom){pendingGenerated=readyModel;readyModel=null;actor.add(pendingGenerated.group);makeBurst(new THREE.Vector3(sim.state.x,sim.state.y+1.5,sim.state.z),custom.blueprint.palette[0],20);return;}
  const g=equipment[mode].group;g.position.set(0,0,0);g.rotation.set(0,0,0);
  if(mode==='bow')g.position.set(.25,1.26,.64);if(mode==='sword')g.position.set(-.81,1.06,.37);
  g.visible=true;const parts=g.children.map((mesh,i)=>{const end=mesh.position.clone(),angle=i*2.399,dist=3.2+(i%5)*.5;const start=new THREE.Vector3(Math.sin(angle)*dist,2.3+(i%7)*.43,Math.cos(angle)*dist);const item={mesh,end,rotation:mesh.rotation.clone(),scale:mesh.scale.clone(),start,delay:i/g.children.length*.52};mesh.position.copy(start);mesh.scale.multiplyScalar(.55);return item;});
  assembly={mode,parts};makeBurst(new THREE.Vector3(sim.state.x,sim.state.y+1.5,sim.state.z),BUILDS[mode].color,15);
 }
 function saveAdventure(){if(!adventure.save(sim.state)&&!saveWarning){saveWarning=true;queueMicrotask(()=>ui?.toast('Device storage is unavailable. Progress and creations will last for this visit.',6500));}}
 function onEvent(event){
  sound.play(event.type);
  if(['mode','placed','gate','ring','target','smash','win'].includes(event.type))saveAdventure();
  if(event.type==='break'){world.setDestroyed(Object.keys(sim.state.destroyed||{}));makeBurst(new THREE.Vector3(event.x||sim.state.x,1.5,event.z||sim.state.z),C.yellow,25);ui?.toast('Impact! Those bricks broke apart.');}
  if(event.type==='crash'){if(activeGenerated){activeGenerated.dispose();activeGenerated=null;}ui?.toast('Crash! Your creation broke apart. You’re back on foot.',5000);makeBurst(new THREE.Vector3(sim.state.x,sim.state.y+1,sim.state.z),C.orange||C.yellow,32);}

  if(event.type==='notice')ui?.toast(event.text);
  if(event.type==='build')startBuild(event.mode,event.custom);
  if(event.type==='mode'){practiceShot=null;practiceAimGuide.clear();ui.buildComplete();if(activeGenerated){activeGenerated.dispose();activeGenerated=null;}if(event.custom){activeGenerated=pendingGenerated;pendingGenerated=null;}updateMode(event.mode);const text={car:'Trail car ready. Drive through the mint gates!',plane:'Sky plane ready. Move to take off. Rise / Lower to steer your height.',bow:'Bow ready. Face a striped target and shoot!',sword:'Sword ready. Get close to a purple crate and swing!',foot:'Back on foot. Your next idea is one command away.'};ui.toast(event.custom?`${event.custom.blueprint.name} is ready! ${creationControls(sim.state)}`:text[event.mode],6000);}
  if(event.type==='placed'){ui.buildComplete();const model=pendingGenerated;pendingGenerated=null;const position=sim.placeCreation(model.size.toArray());if(position){model.group.removeFromParent();scene.add(model.group);model.group.position.set(position.x,0,position.z);model.update(sim.state.time);placedModels.push({model,id:position.id});if(placedModels.length>6){const oldest=placedModels.shift();oldest.model.dispose();sim.removePlacement(oldest.id);}ui.toast(`${event.design.blueprint.name} is built nearby.`,5000);}else{model.dispose();ui.toast('There isn’t enough room here. Move to an open area and rebuild it from Your creations in Imagine.',6000);}if(activeGenerated){activeGenerated.dispose();activeGenerated=null;}updateMode('foot');}
  if(event.type==='shoot'){practiceShot={...event,until:sim.state.time+.1};
   const mesh=event.pulse?new THREE.Mesh(pulseGeometry,material(event.color)):arrow(),from=new THREE.Vector3(event.from.x,event.from.y,event.from.z),target=event.to?new THREE.Vector3(event.to.x,event.to.y,event.to.z):event.target!==null?new THREE.Vector3(TARGETS[event.target].x,1.9,TARGETS[event.target].z):new THREE.Vector3(from.x+Math.sin(event.yaw)*36,from.y-.5,from.z+Math.cos(event.yaw)*36);mesh.position.copy(from);scene.add(mesh);projectiles.push({mesh,from,to:target,life:0,duration:Math.max(.1,from.distanceTo(target)/(event.speed||42)),id:event.target,pulse:!!event.pulse,color:event.color,impact:event.impact});
  }
  if(event.type==='smash'){sim.removeEntity('crate:'+event.id);const g=world.crates[event.id];g.visible=false;makeBurst(new THREE.Vector3(CRATES[event.id].x,1.1,CRATES[event.id].z),C.purple,30);ui.toast(`Smashing! ${sim.state.crates.length}/3 crates · +12 bricks`);}
  if(event.type==='target'){const g=world.targets[event.id];g.scale.setScalar(.82);g.rotation.z=.2;makeBurst(new THREE.Vector3(TARGETS[event.id].x,1.9,TARGETS[event.id].z),C.teal,22);ui.toast(`Bullseye! ${sim.state.targets.length}/3 targets · +10 bricks`);}
  if(event.type==='gate'){const g=world.gates[event.id];g.traverse(m=>{if(m.isMesh&&m.material.color.getHex()===C.teal)m.material=material(C.yellow);});makeBurst(new THREE.Vector3(GATES[event.id].x,2,GATES[event.id].z),C.teal,25);ui.toast(`Nice driving! ${sim.state.gates.length}/4 gates · +15 bricks`);}
  if(event.type==='ring'){sim.removeEntity('ring:'+event.id);world.rings[event.id].visible=false;makeBurst(new THREE.Vector3(RINGS[event.id].x,RINGS[event.id].y,RINGS[event.id].z),C.yellow,35);ui.toast(`Sky high! ${sim.state.rings.length}/5 rings · +20 bricks`);}
  if(event.type==='win'){ui.toast('Every challenge complete. You’re a master builder!',4500);setTimeout(()=>ui.openMenu('win'),1500);}
 }
 sim=await createSimulation(world.obstacles,onEvent);adventure.restore(sim.state);
 sim.state.crates.forEach(i=>{world.crates[i].visible=false;sim.removeEntity('crate:'+i);});sim.state.rings.forEach(i=>{world.rings[i].visible=false;sim.removeEntity('ring:'+i);});sim.state.targets.forEach(i=>{world.targets[i].scale.setScalar(.82);world.targets[i].rotation.z=.2;});sim.state.gates.forEach(i=>world.gates[i].traverse(m=>{if(m.isMesh&&m.material.color.getHex()===C.teal)m.material=material(C.yellow);}));
 function queueBlueprint(blueprint){if(arena?.active){arena.blueprints.set('pending',blueprint);if(arena.command('build','generated',blueprint))ui.toast(blueprint.name+' designed. Assembling in the arena…',4500);return;}const next=createGeneratedModel(blueprint);readyModel?.dispose();readyModel=next;ui.toast(`${blueprint.name} designed. Getting the bricks ready…`,4500);}
 const controlsState=()=>({...sim.state,...(arena?.active?{health:arena.self?.health,building:arena.self?.building,roundFinished:arena.snapshot?.round?.status==='finished'}:{})});
 const itemActionAllowed=()=>!gameplayBlocked(controlsState())&&!controlsState().building&&!document.querySelector('dialog[open]');
 const actions={state:controlsState,drop(){if(!itemActionAllowed())return false;if(arena?.active)return arena.command('exit');return actions.build('foot');},pickup(id){if(!itemActionAllowed())return false;if(!arena?.active){ui.toast('Recoverable items are available in Arena. Rebuild saved creations from Your creations.');return false;}if(arena.self.kit.id!=='foot'){ui.toast('Press '+bindingLabel('drop')+' to drop your current item before picking up another.');return false;}const target=nearbyItem(arena.snapshot,arena.self);if(!target){ui.toast('No recoverable item nearby. Move closer to an item.');return false;}return arena.command('pickup',id||target.id);},setAvatarColor(color){pilot.setColor(color);avatarPreview?.setColor(color);},exitHome(){const leaving=leaveArena(true);saveAdventure();sim.state.started=false;sim.state.autoRun=false;ui.showEntry();return leaving;},openArena(){return arenaUI.play();},leaveArena(){return leaveArena();},start(){sound.enable();sim.state.started=true;saveAdventure();},build(type){sound.enable();if(arena?.active){creations.cancel();return arena.command(type==='foot'?'exit':'build',type);}if(!sim.state.building){creations.cancel();readyModel?.dispose();readyModel=null;}return sim.build(type);},action(){sound.enable();if(arena?.active)arena.command('fire');else sim.action(input?.read());},jump(){sound.enable();if(arena?.active)arena.command('jump');else sim.jump();},voice(){if(!sim.state.started||sim.state.paused||arena?.snapshot?.round?.status==='finished')return;sound.enable();voice.start();},describe(prompt,timing=null){if(arena?.active&&arena.snapshot?.round?.status==='finished'){ui.toast('The next round starts after the scoreboard.');return false;}speechTiming=timing;sound.enable();if(!sim.state.started){ui.toast('Start the adventure first.');return false;}return creations.generate(prompt);},cancelDesign(){buildTiming=null;speechTiming=null;creations.cancel();if(readyModel){readyModel.dispose();readyModel=null;}},recent:()=>recentCreations,saved:()=>adventure.available,rebuild(index){const b=recentCreations[index];if(!b)return;if(sim.state.building){ui.toast('Let these bricks finish assembling, then choose your saved creation.');return;}creations.cancel();buildTiming={startedAt:performance.now(),requestMs:0,saved:true,assembled:false};speechTiming=null;try{queueBlueprint(b);}catch(e){ui.designError(e.message);}},sound:()=>sound.toggle(),pause(paused){sim.state.paused=paused;input?.clear();if(paused)voice?.stop();},respawn(){if(arena?.active){ui.toast('Arena respawns happen automatically after 12 seconds.');return;}sim.respawn();},};
 ui=createUI(actions);avatarPreview=createAvatarPreview(document.querySelector('#avatar-preview'),ui.playerColor());pilot.setColor(ui.playerColor());voice=createVoice({onCommand:actions.describe,onState:ui.voiceState,onNotice:ui.toast,onFallback:ui.voiceFallback});
 creations=createCreationService({onState:ui.generationState,onReady(blueprint,prompt,timing){buildTiming={...timing,...speechTiming,assembled:false};queueBlueprint(blueprint);adventure.remember(blueprint);saveAdventure();ui.connectionVerified();},onError:message=>ui.designError(message)});
 creations.status().then(ui.connectionState);
 arenaView=createArenaView(scene,camera);
 function returnToExplore(){if(!arenaMode)return;arenaMode=false;arenaView.clear();arenaWorld?.dispose();arenaWorld=null;world=practiceWorld;world.root.visible=true;if(practicePose)Object.assign(sim.state,practicePose,{vy:0,jumpRemaining:0,grounded:false});practicePose=null;sim.state.arena=false;sim.state.paused=false;sim.state.autoRun=false;sim.state.building=null;sim.state.custom=null;sim.returnToFoot();updateMode('foot');actor.visible=true;placedModels.forEach(p=>p.model.group.visible=true);world.setDestroyed(Object.keys(sim.state.destroyed||{}));input?.clear();}
 async function leaveArena(home=false){creations.cancel();readyModel?.dispose();readyModel=null;voice.stop();buildTiming=null;speechTiming=null;const leaving=arena.leave();returnToExplore();input?.clear();arenaUI.reset();ui.resetPlayUI();ui.update(sim.state);if(!home){document.querySelector('#open-arena').focus();ui.toast('Back in Practice. Your island progress is saved on this device.');}await leaving;}
 arena=createArenaClient({onStatus:value=>arenaUI?.setStatus(value),onSnapshot:s=>{const map=arenaMap(s);if(!arenaWorld||arenaWorld.mapId!==map.id){arenaWorld?.dispose();arenaWorld=createWorld(scene,map.id);world=arenaWorld;practiceWorld.root.visible=false;arenaView.clear();input?.clear();cameraTarget.set(arena.self.x,arena.self.y+1.5,arena.self.z);}world.setDestroyed(Object.keys(s.destroyed));},onError:(message,status)=>arenaUI?.error(message,status),onEvent(e,self){const p=arena.snapshot?.players.find(p=>p.id===e.player);const local=arena.self,near=e.player===self||e.by===self||!local||Math.hypot((e.x??p?.x??0)-local.x,(e.y??p?.y??0)-local.y,(e.z??p?.z??0)-local.z)<35;const play=type=>{if(near)sound.play(type);};arenaView.effect({...e,x:e.x??p?.x,y:e.y??(p?.y||0)+1,z:e.z??p?.z});if(e.type==='round-started'||e.type==='round-ended'){input?.clear();voice.stop();creations.cancel();arenaView.clear();}if(e.type==='attack-preview'||(!e.predicted&&['shot','swing'].includes(e.type)))play(['punch','blade','knife','hammer'].includes(e.weapon)?'swing':e.weapon==='flame'?'flame':'shoot');if(e.type==='hit'){play('hit');if(e.by===self)ui.toast('Hit · '+e.amount,700);}if(e.type==='blocked')play('block');if(e.type==='respawn')play('respawn');if(['break','crash','ko'].includes(e.type))play(e.type==='ko'?'defeat':'break');if(e.type==='built'){if(e.player===self)ui.buildComplete();if(e.player===self&&buildTiming){buildTiming.usableMs=performance.now()-buildTiming.startedAt;buildTiming.assembled=true;}play('mode');if(e.player===self)ui.toast(e.name+' ready. '+(e.placed?'Placed nearby.':'→ attacks, ↑ jumps or rises, ↓ lowers, G drops your item, T picks up, and ← starts speech.'),5000);}if(e.type==='notice'&&e.player===self)ui.toast(e.text,5500);if(e.type==='ko')ui.toast(e.killer+' knocked out '+e.name+'.',3500);if(e.type==='crash'&&e.player===self)ui.toast('Your creation broke apart! You’re back on foot.',4500);if(e.type==='pickup'&&e.player===self){play('target');ui.toast(e.pickup==='health'?'Health restored!':e.pickup==='defense'?'Defense aura — 10 seconds!':'Double speed — 10 seconds!',4000);}}});
 arenaUI=createArenaUI({pickup:actions.pickup,getPlayerName:ui.playerName,leave:leaveArena,exitHome:actions.exitHome,openCollection:()=>ui.openMenu('collection'),toast:ui.toast,async join(name,room){const returnPose={x:sim.state.x,y:sim.state.y,z:sim.state.z,yaw:sim.state.yaw};creations.cancel();voice.stop();input?.clear();const ok=await arena.join(name,room,ui.playerColor());if(!ok)return false;arenaView.clear();if(!arenaMode){practicePose=returnPose;arenaMode=true;}restoreAssembly();assembly=null;for(const m of [activeGenerated,pendingGenerated,readyModel])m?.dispose();activeGenerated=pendingGenerated=readyModel=null;sim.state.building=null;sim.state.custom=null;sim.state.arena=true;sim.state.paused=false;sim.state.autoRun=false;projectiles.forEach(p=>p.mesh.removeFromParent());projectiles.length=0;placedModels.forEach(p=>p.model.group.visible=false);actor.visible=false;ui.toast('Arena joined. Hold → to punch. Speak a creation and watch for supply drops.',6500);return true;}});

 input=createInput({onPickup:actions.pickup,onDrop:actions.drop,onAction:actions.action,onJump:actions.jump,onPause:()=>ui.toggleMenu('pause'),onMic:actions.voice,onHotkeys:()=>ui.toggleMenu('hotkeys'),getState:controlsState});
 window.addEventListener('pagehide',()=>{arena.leave();saveAdventure();creations.cancel();voice.stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.state.started){saveAdventure();sim.state.autoRun=false;ui.openMenu('pause');}});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();sim.state.paused=true;fatal('3D graphics were interrupted. Tap Try again to rebuild the island.');});
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
 const frame=(time)=>{
  const dt=previousTime?Math.min((time-previousTime)/1000,.08):1/60;previousTime=time;const s=sim.state;input.update(dt);
  if(!arenaMode&&readyModel&&s.started&&!s.paused&&!s.building){try{sim.buildCustom({blueprint:readyModel.blueprint,dimensions:readyModel.size.toArray()});}catch(e){readyModel?.dispose();readyModel=null;ui.designError(e.message);}}
  if(arenaMode){const blocked=s.paused||!!document.querySelector('dialog[open]'),p=arena.tick(dt,blocked?{}:input.read());if(p){Object.assign(s,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,speed:p.speed,vertical:p.vertical,mode:p.kit.mode,custom:null,building:null,arena:true,time:arena.serverTime()/1000});}arenaView.update(arena.snapshot,p,arena.blueprints,dt,arena.serverTime(),{showGuide:!blocked&&!arena.stale});if(p?.building&&!s.paused){snapClock+=dt;if(snapClock>.12){sound.play('snap');snapClock=0;}}actor.visible=false;}else{accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps<5){sim.update(1/60,input.read());accumulator-=1/60;steps++;}}
  actor.position.set(s.x,s.y,s.z);actor.rotation.y=s.yaw;
  const running=s.speed>1&&s.mode!=='car'&&s.mode!=='plane'&&!s.paused;
  if(s.mode==='foot'||s.mode==='bow'||s.mode==='sword'){
   pilot.group.position.y=0;
   pilot.legs[0].rotation.x=running?Math.sin(s.time*12)*.64:0;pilot.legs[1].rotation.x=running?-Math.sin(s.time*12)*.64:0;
   pilot.arms[0].rotation.x=s.mode==='bow'?-1.15:running?-Math.sin(s.time*12)*.52:0;
   pilot.arms[1].rotation.x=running?Math.sin(s.time*12)*.52:0;
   if(s.mode==='sword'){equipment.sword.group.rotation.x=.35+Math.sin(s.actionTime/.4*Math.PI)*-1.6;equipment.sword.group.rotation.z=.15+Math.sin(s.actionTime/.4*Math.PI)*1.4;}
  }else{pilot.arms[0].rotation.x=-.78;pilot.arms[1].rotation.x=-.78;}
  if(s.building&&assembly){
   const progress=s.building.time/s.building.duration;
   assembly.parts.forEach((p,i)=>{const t=Math.max(0,Math.min(1,(progress-p.delay)/(1-p.delay))),ease=1-Math.pow(1-t,3);p.mesh.position.lerpVectors(p.start,p.end,ease);p.mesh.rotation.set(p.rotation.x+(1-ease)*Math.PI,p.rotation.y+(1-ease)*Math.PI*2,p.rotation.z);p.mesh.scale.copy(p.scale).multiplyScalar(.55+.45*ease);});
   pilot.arms[0].rotation.x=-1.3+Math.sin(s.time*20)*.5;pilot.arms[1].rotation.x=-1.3-Math.sin(s.time*20)*.5;
   if(!s.paused){snapClock+=dt;if(snapClock>.12){sound.play('snap');snapClock=0;}}
  }
  if(pendingGenerated&&s.building?.custom){if(!s.paused){snapClock+=dt;if(snapClock>.12){sound.play('snap');snapClock=0;}}pendingGenerated.update(s.time,s.building.time/s.building.duration,s.speed/10);pilot.arms[0].rotation.x=-1.3+Math.sin(s.time*20)*.5;pilot.arms[1].rotation.x=-1.3-Math.sin(s.time*20)*.5;}
  if(!poseKit||poseBlueprint!==s.custom?.blueprint||poseMode!==s.mode){poseBlueprint=s.custom?.blueprint;poseMode=s.mode;poseKit=makeKit(s.custom?'generated':s.mode,poseBlueprint);}const aim=input.read(),heldKit=poseKit;if(!s.building)poseWeaponHands(pilot,heldKit,aim.weaponPitch,Math.sin(s.actionTime/.4*Math.PI));if(s.mode==='bow'&&!s.custom)equipment.bow.group.rotation.set(-aim.weaponPitch,0,0,'YXZ');
  if(activeGenerated){activeGenerated.update(s.time,1,s.speed/10,s.actionTime);if(s.custom?.blueprint.movement==='carry'){if(s.custom.blueprint.ability==='pulse')activeGenerated.group.rotation.set(-aim.weaponPitch,0,0,'YXZ');else activeGenerated.group.rotation.set(...meleeRotation(Math.sin(s.actionTime/.4*Math.PI),heldKit.stats.weapon));gripOffset.copy(activeGenerated.grip).applyQuaternion(activeGenerated.group.quaternion);activeGenerated.group.position.set(...weaponGrip(heldKit)).sub(gripOffset);}}
  const practiceAim=!arenaMode&&s.started&&!s.building&&heldKit.stats.projectileSpeed>0?sim.aim(heldKit,practiceShot&&s.time<practiceShot.until?practiceShot.aimCorrection:undefined):null;
  if(practiceAim){poseRangedModel(activeGenerated||equipment[s.mode],{...s,kit:heldKit},practiceAim);}
  practiceAimGuide.update(practiceAim&&!s.paused&&!document.querySelector('dialog[open]')?practiceAim.path:null,camera);
  if(!s.paused&&!arenaMode)placedModels.forEach(p=>p.model.update(s.time,1,0));
  equipment.car.wheels.forEach(w=>w.rotation.x+=s.mode==='car'&&!s.paused?s.speed*dt*1.8:0);
  if(s.mode==='plane'&&!s.paused){equipment.plane.prop.rotation.z+=dt*(12+s.speed*2);equipment.plane.group.rotation.x=0;equipment.plane.group.rotation.z=0;}
  if(!s.paused){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.mesh.scale.setScalar(Math.min(1,p.life*3));if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
   for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life+=dt;const t=Math.min(1,p.life/p.duration);p.mesh.position.lerpVectors(p.from,p.to,t);p.mesh.lookAt(p.to);if(t===1){if(p.id!==null)sim.hitTarget(p.id);if(p.impact)makeBurst(p.to,p.color||C.yellow,16);scene.remove(p.mesh);projectiles.splice(i,1);}}
   world.rings.forEach((g,i)=>{if(g.visible)g.children[0].rotation.z+=dt*.12;});
  }
  if(!s.started){const a=time*.000026;desiredCamera.set(24+Math.sin(a)*3,22,42+Math.cos(a)*2);focus.set(-3,1,3);camera.position.lerp(desiredCamera,.025);cameraTarget.lerp(focus,.035);}
  else{const rig=gameCamera(s,arenaMode?arena.self?.kit:heldKit,{yaw:input.yaw,pitch:input.pitch},camera.aspect,camera.fov,innerWidth<650&&innerHeight>innerWidth);desiredCamera.set(rig.position.x,rig.position.y,rig.position.z);cameraTarget.set(rig.target.x,rig.target.y,rig.target.z);}
  if(s.started){const next=followCamera(camera.position,desiredCamera,dt);camera.position.set(next.x,next.y,next.z);}
  world.updateCamera(camera.position,{x:s.x,y:s.y+1.5,z:s.z},dt);
  camera.lookAt(cameraTarget);sun.position.set(s.x-28,50,s.z+24);sun.target.position.set(s.x,0,s.z);sun.target.updateMatrixWorld();
  const goal=s.started&&!arenaMode?navigationGoal(s):null;guide.visible=!!goal;if(goal){guide.position.set(goal.x,(goal.y||0)+.7,goal.z);guide.rotation.y=s.time*.5;}
  renderer.render(scene,camera);
  uiTime+=dt;if(uiTime>.1){ui.update(s,input.yaw);arenaUI.update(arena);uiTime=0;}
  frameCount++;frameCost+=dt;if(frameCount===240){if(frameCost/240>.032&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);}frameCount=0;frameCost=0;}
 };
 document.querySelector('#boot').style.display='none';ui.update(sim.state);renderer.setAnimationLoop(frame);
 // Optional browser tool support shares the same actions as the on-screen controls.
 if(document.modelContext?.registerTool){const lifecycle=new AbortController();for(const tool of [
  {name:'read_game_state',title:'Read Brickwild state',description:'Read current creation and island challenge progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){const s=sim.state;return {started:s.started,paused:s.paused,mode:s.mode,creation:s.custom?.blueprint.name??BUILDS[s.mode].name,generationTiming:buildTiming,designing:creations.pending,building:s.building?.custom?.blueprint.name??s.building?.mode??null,bricks:s.bricks,progress:{gates:s.gates.length,rings:s.rings.length,targets:s.targets.length,crates:s.crates.length}};}},
  {name:'generate_brick_creation',title:'Design a new brick creation',description:'Use OpenAI to design a new 3D brick model from a free-form description. Returns after the model is generated and queued for assembly in the running game. Uses the connected API account.',inputSchema:{type:'object',properties:{description:{type:'string',minLength:2,maxLength:360}},required:['description'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){if(!input||typeof input.description!=='string')throw new Error('Describe your creation.');if(!sim.state.started||sim.state.paused)throw new Error('Start or resume the adventure first.');const generated=await actions.describe(input.description);return {generated:!!generated,stage:generated?'queued_for_assembly':'not_generated'};}},
  {name:'start_brick_build',title:'Start a brick creation',description:'Begin assembling a car, plane, bow, or sword in the running game. Construction takes about two seconds.',inputSchema:{type:'object',properties:{creation:{type:'string',enum:['car','plane','bow','sword','foot']}},required:['creation'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!Object.hasOwn(BUILDS,input.creation))throw new Error('Choose car, plane, bow, sword, or foot.');if(!sim.state.started||sim.state.paused)throw new Error('Start or resume the game first.');const accepted=actions.build(input.creation);return {accepted,building:sim.state.building?.mode??null,mode:sim.state.mode};}}
 ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
}
