import {solveWeaponAim,weaponPath} from './aiming.js';
import {poseRangedModel,createWeaponGuide} from './aim-presentation.js';
import {createBrickCollapse} from './brick-collapse.js';
import {poseWeaponHands} from './weapon-pose.js';
import {weaponGrip,weaponMuzzle,equippedAim} from './weapon-aim.js';
import {projectileContact} from './shot-geometry.js';
import {createShotPlayback} from './shot-playback.js';
import {solidBoxes} from './arena-core.js';
import {remoteMotionTarget} from './remote-motion.js';
import {avatarColor} from './avatar-colors.js';
import {combatPose,meleeRotation} from './combat-pose.js';
import {SUPPLY_BLUEPRINTS,SUPPORT_DROPS} from './supply-catalog.js';
import {segmentBox} from './geometry.js';
import * as THREE from './vendor/three.module.js';
import {character,car,plane,bow,sword,box,brick,material,C} from './models.js';
import {createGeneratedModel} from './generated-model.js';
const colors=['#ff784f','#65d8cc','#aa87ff','#f4cd52','#76b9ff','#ff89bc','#b4df6a','#f59f68'];
const shotGeo=new THREE.SphereGeometry(.14,7,5),fireGeo=new THREE.SphereGeometry(.28,8,6),auraGeo=new THREE.SphereGeometry(1,14,10);
function disposeOriginal(g){g.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material?.userData.arenaOwned)o.material.dispose();});g.removeFromParent();}
export function createArenaView(scene,camera){
 const playback=createShotPlayback();const root=new THREE.Group();root.visible=false;scene.add(root);const guide=createWeaponGuide(scene);const collapse=createBrickCollapse(root);const actors=new Map(),shots=new Map(),drops=new Map(),placed=new Map(),items=new Map(),effects=[];let viewTime=0,worldSnapshot=null,worldBoxes=[];const attacks=new Map(),reactions=new Map();
 function kitModel(kit,cache){if(kit.blueprintId){const blueprint=cache.get(kit.blueprintId)||SUPPLY_BLUEPRINTS.get(kit.blueprintId);if(!blueprint)return null;try{return createGeneratedModel(blueprint);}catch{return null;}}const model=kit.id==='foot'?{group:new THREE.Group()}:({car,plane,bow,sword}[kit.mode]||(()=>({group:new THREE.Group()})))();const parts=model.group.children.map((mesh,i)=>({mesh,end:mesh.position.clone(),rotation:mesh.quaternion.clone(),scale:mesh.scale.clone(),delay:i/model.group.children.length*.55,index:i}));return {...model,assemble(progress){for(const p of parts){const t=THREE.MathUtils.clamp((progress-p.delay)/(1-p.delay),0,1),ease=1-Math.pow(1-t,3),angle=p.index*2.399;p.mesh.position.set(Math.sin(angle)*(3+p.index%3),2.5+p.index%5*.4,Math.cos(angle)*(3+p.index%3)).lerp(p.end,ease);p.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),(1-ease)*Math.PI*2).multiply(p.rotation);p.mesh.scale.copy(p.scale).multiplyScalar(.4+.6*ease);}},dispose(){disposeOriginal(model.group);}};}
 function createActor(p,i){const g=new THREE.Group(),pilot=character(avatarColor(p.avatarColor)),canvas=document.createElement('canvas');canvas.width=256;canvas.height=100;const texture=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));label.scale.set(3.7,1.45,1);label.renderOrder=5;const aura=new THREE.Mesh(auraGeo,new THREE.MeshBasicMaterial({color:colors[i%colors.length],transparent:true,opacity:.16,wireframe:true,depthWrite:false}));pilot.group.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.userData.arenaOwned=true;}});
 const arc=new THREE.Mesh(new THREE.RingGeometry(.8,1,16,1,-.8,1.6),new THREE.MeshBasicMaterial({color:0xfff3d4,side:THREE.DoubleSide,transparent:true,opacity:.6,depthWrite:false}));arc.rotation.x=-Math.PI/2;arc.rotation.z=Math.PI/2;arc.position.set(0,1.4,.6);arc.visible=false;
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),new THREE.MeshBasicMaterial({color:0xffcf55,transparent:true,opacity:.95,depthWrite:false}));flash.visible=false;flash.name='muzzle-flash';
 g.name='arena-player:'+p.id;g.add(pilot.group,aura,label);root.add(g);const a={g,pilot,label,canvas,texture,aura,arc,flash,model:null,modelId:null,pending:null,pendingId:null,lastLabel:'',position:new THREE.Vector3(p.x,p.y,p.z),motionCorrection:null};g.add(arc,flash);actors.set(p.id,a);return a;}
 function renderKit(a,p,cache,time,solution){
  const {yaw:aimYaw,pitch:aimPitch}=solution;const action=attacks.get(p.id),elapsed=action?(time-action.time)/1000:100,pose=combatPose(p.kit.stats.weapon,elapsed),strike=pose.strike;
if(a.modelId!==p.kit.id||(!a.model&&p.kit.blueprintId&&cache.has(p.kit.blueprintId))){a.model?.dispose();a.model=kitModel(p.kit,cache);a.modelId=p.kit.id;if(a.model){a.model.group.name='creation';a.g.add(a.model.group);}}
  const model=a.model;if(model){model.update?.(time/1000,1,p.speed/12);model.wheels?.forEach(w=>w.rotation.x=time/1000*p.speed);if(model.prop)model.prop.rotation.z=time/65;const carry=!p.kit.stats.mounted;if(carry&&p.kit.blueprintId){if(p.kit.stats.projectileSpeed>0)model.group.rotation.set(-aimPitch,aimYaw-p.yaw,0,'YXZ');else model.group.rotation.set(...meleeRotation(strike,p.kit.stats.weapon));model.group.position.set(...weaponGrip(p.kit)).sub(model.grip.clone().applyQuaternion(model.group.quaternion));}else if(p.kit.mode==='bow'&&p.kit.id!=='foot'){model.group.position.set(...weaponGrip(p.kit));model.group.rotation.set(-aimPitch,aimYaw-p.yaw,0,'YXZ');}else if(p.kit.mode==='sword'){model.group.position.set(-.81,1.06,.37);model.group.rotation.set(-strike*1.6,0,.15+strike*1.3);}}
  if(model&&p.kit.stats.projectileSpeed>0&&!p.kit.stats.mounted){poseRangedModel(model,p,solution);}
  a.pilot.group.scale.setScalar(p.kit.stats.mounted?.7:1);if(p.kit.stats.mounted){const seat=model?.seat||new THREE.Vector3(0,p.kit.mode==='plane'?1.55:1.33,-.5);a.pilot.group.position.copy(seat);a.pilot.group.position.y-=.48;a.pilot.legs.forEach(l=>l.rotation.x=-1.45);}else{a.pilot.group.position.set(0,0,0);a.pilot.legs.forEach((l,i)=>l.rotation.x=Math.sin(time/85+i*Math.PI)*Math.min(.65,p.speed/12));}a.pilot.arms.forEach((arm,i)=>arm.rotation.x=p.building?-1.3+Math.sin(time/50+i)*.4:-Math.sin(time/85+i*Math.PI)*Math.min(.4,p.speed/14));
  if(!p.building&&pose.active){a.pilot.arms.forEach((arm,i)=>{arm.rotation.x=p.kit.stats.weapon==='punch'?(i===0?-.35-strike*1.65:-.65):-.9-strike*.55;arm.position.z=i===0?strike*.5:0;});}else a.pilot.arms.forEach(arm=>arm.position.z=0);
  if(!p.building)poseWeaponHands(a.pilot,p.kit,aimPitch,strike);
  a.arc.visible=pose.active&&p.kit.stats.projectileSpeed===0&&p.kit.stats.weapon!=='hammer';a.arc.scale.setScalar(p.kit.stats.weapon==='punch'?1:1.7);a.arc.material.opacity=strike*.65;
  a.flash.visible=elapsed>=0&&elapsed<(p.kit.stats.weapon==='flame'?.17:.12)&&p.kit.stats.projectileSpeed>0;
  if(a.flash.visible){const from=weaponMuzzle({kit:p.kit,x:0,y:0,z:0,yaw:0},{yaw:solution.correction});a.flash.position.set(from.x,from.y,from.z);const flame=p.kit.stats.weapon==='flame';a.flash.scale.set(flame?2:1,flame?2:1,flame?5:1.8);a.flash.rotation.set(0,solution.correction,0,'YXZ');a.flash.material.color.set(flame?0xff7836:0xffed9a);}

  const reaction=reactions.get(p.id),recoil=reaction?Math.max(0,1-(time-reaction.time)/350):0;
  a.pilot.group.rotation.x=-recoil*.25;a.pilot.group.rotation.z=recoil*.16;
  a.pilot.group.traverse(m=>{if(m.isMesh&&m.material.emissive){m.material.emissive.set(reaction?.type==='blocked'?0x339eff:0xffc27a);m.material.emissiveIntensity=recoil*1.6;}});
  if(p.building){const id=p.building.kit.id;if(a.pendingId!==id||(!a.pending&&cache.has(id))){a.pending?.dispose();a.pending=kitModel(p.building.kit,cache);a.pendingId=id;if(a.pending)a.g.add(a.pending.group);}if(a.pending){const progress=THREE.MathUtils.clamp((time-p.building.starts)/(p.building.ends-p.building.starts),0,1);if(a.pending.update)a.pending.update(time/1000,progress,p.speed/12);else a.pending.assemble(progress);}}else if(a.pending){a.pending.dispose();a.pending=null;a.pendingId=null;}
 }
 function createDrop(d){
  const g=new THREE.Group(),color=d.type==='health'?0xec6556:d.type==='defense'?0x5fc9eb:0xf6cd45;g.name='airdrop:'+d.id;
  brick(g,0,0,0,1.25,1.1,1.25,color);box(g,0,.57,0,.26,.05,1.1,C.cream);box(g,0,.57,0,1.1,.05,.26,C.cream);
  const canopy=new THREE.Group();for(let i=-2;i<=2;i++)brick(canopy,i*.48,2.6-Math.abs(i)*.17,0,.5,.15,1.9,i%2?C.cream:color,false);for(const x of [-.55,.55])box(canopy,x,1.4,0,.04,2,.04,C.cream);g.add(canopy);g.userData.canopy=canopy;root.add(g);return g;
 }
 function removeDrop(g){disposeOriginal(g);}
 function update(snapshot,local,cache,dt,time,options={}){viewTime=time;root.visible=!!snapshot;guide.clear();if(!snapshot)return;const boxes=snapshot===worldSnapshot?worldBoxes:(worldSnapshot=snapshot,worldBoxes=solidBoxes(snapshot)),live=new Set();snapshot.players.forEach((remote,i)=>{const p=remote.id===snapshot.self&&local?local:remote;live.add(p.id);const a=actors.get(p.id)||createActor(p,i);if(p.health>0&&a.dead)collapse.fade(p.id);const dying=p.health<=0&&!a.dead;a.g.visible=true;const motion=p.id===snapshot.self?null:remoteMotionTarget(a.motion,p,snapshot,dt,boxes,time);if(motion)a.motion=motion.state;const target=new THREE.Vector3(motion?.x??p.x,motion?.y??p.y,motion?.z??p.z),correction=a.position.distanceTo(target),snap=p.id===snapshot.self||motion?.snap||correction>2.5;if(snap){a.motionCorrection=null;a.position.copy(target);}else{if(motion?.newSample&&!a.motionCorrection&&correction>.01)a.motionCorrection={offset:a.position.clone().sub(target),ends:time+100};a.position.copy(target);if(a.motionCorrection){const remaining=Math.max(0,(a.motionCorrection.ends-time)/100);a.position.addScaledVector(a.motionCorrection.offset,remaining);if(remaining<=0)a.motionCorrection=null;}}a.g.position.copy(a.position);a.g.rotation.y=p.id===snapshot.self?p.yaw:(motion?.yaw??p.yaw);const own=p.id===snapshot.self;if(own||a.aimSnapshot!==snapshot||a.aimFixed!==options.fixedAim){a.aim=solveWeaponAim(snapshot,p,{boxes,fixed:options.fixedAim});a.aimSnapshot=snapshot;a.aimFixed=options.fixedAim;}a.bodyYaw=p.yaw;a.roundId=snapshot.round?.id;a.spawnSerial=p.spawnSerial||0;
   let action=attacks.get(p.id);if(action&&((action.kitId&&action.kitId!==p.kit.id)||(action.roundId!==undefined&&action.roundId!==a.roundId)||(action.spawnSerial!==undefined&&action.spawnSerial!==a.spawnSerial)||p.health<=0||snapshot.round?.status==='finished')){attacks.delete(p.id);action=null;}
   const held=action&&time<action.poseUntil&&action.kitId===p.kit.id,display=equippedAim(p,a.aim,held?action.correction:a.aim.correction);
   renderKit(a,p,cache,time,display);if(own&&options.showGuide!==false&&p.health>0&&!p.building&&snapshot.round?.status!=='finished'&&a.aim.active){display.launchContact=projectileContact(snapshot,{owner:p.id,weapon:p.kit.stats.weapon},display.anchor,display.muzzle,boxes,p.yaw);guide.update(weaponPath(snapshot,p,display,boxes),camera);}
   if(dying)collapse.scatter(p.id,a.pilot.group);a.dead=p.health<=0;a.g.visible=!a.dead;
   const height=Math.max(3,p.kit.stats.collision[1]+1.8);a.label.position.set(0,height,0);a.label.visible=p.id!==snapshot.self;const label=[p.name,Math.ceil(p.health),Math.ceil(p.mountHealth),p.kills].join(':');if(label!==a.lastLabel){a.lastLabel=label;const ctx=a.canvas.getContext('2d');ctx.clearRect(0,0,256,100);ctx.fillStyle='#16392e';ctx.fillRect(0,0,256,100);ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fffaf0';ctx.fillText(p.name,128,30,238);ctx.fillStyle='#40594f';ctx.fillRect(12,44,232,17);ctx.fillStyle='#81de86';ctx.fillRect(12,44,232*p.health/100,17);if(p.mountHealth>0){ctx.fillStyle='#73caff';ctx.fillRect(12,70,232*p.mountHealth/Math.max(1,p.kit.stats.mountMax),10);}a.texture.needsUpdate=true;}a.aura.visible=time<p.defenseUntil||time<p.protectedUntil||(p.kit.stats.mountMax>0&&!p.kit.stats.mounted);a.aura.material.opacity=reactions.has(p.id)&&time-reactions.get(p.id).time<350?.5:.14;a.aura.position.y=p.kit.stats.collision[1]/2;a.aura.scale.set(Math.max(1,p.kit.stats.collision[0]/2+.3),p.kit.stats.collision[1]/2+.3,Math.max(1,p.kit.stats.collision[2]/2+.3));a.aura.rotation.y=time/1700;
  });for(const [id,a]of actors)if(!live.has(id)){collapse.fade(id);a.model?.dispose();a.pending?.dispose();disposeOriginal(a.pilot.group);a.texture.dispose();a.label.material.dispose();a.aura.material.dispose();a.arc.geometry.dispose();a.arc.material.dispose();a.flash.geometry.dispose();a.flash.material.dispose();a.g.removeFromParent();attacks.delete(id);reactions.delete(id);actors.delete(id);}
  collapse.update(dt,boxes.map(item=>item.box));
  for(const b of snapshot.projectiles)playback.add(b);
  for(const impact of playback.update(dt,boxes.map(item=>item.box)))effect({...impact,played:true});
  for(const [id,b] of playback.shots){let m=shots.get(id);if(!m){m=new THREE.Mesh(b.weapon==='flame'?fireGeo:shotGeo,new THREE.MeshBasicMaterial({color:['automatic','bow'].includes(b.weapon)?'#ffed9a':b.color||'#ffcf55',toneMapped:false}));m.name='projectile:'+id;shots.set(id,m);root.add(m);}m.position.set(b.position.x,b.position.y,b.position.z);m.scale.set(b.weapon==='flame'?2:1.2,b.weapon==='flame'?2:1.2,b.weapon==='flame'?3:7);const direction=b.terminal?{x:b.stop.x-b.origin.x,y:b.stop.y-b.origin.y,z:b.stop.z-b.origin.z}:{x:b.vx,y:b.vy,z:b.vz};if(Math.hypot(direction.x,direction.y,direction.z)>1e-9)m.lookAt(m.position.x+direction.x,m.position.y+direction.y,m.position.z+direction.z);}
  for(const [id,m]of shots)if(!playback.shots.has(id)){m.removeFromParent();m.material.dispose();shots.delete(id);}
  const liveDrops=new Set();for(const d of snapshot.drops.filter(d=>SUPPORT_DROPS.includes(d.type))){liveDrops.add(d.id);let g=drops.get(d.id);if(!g){g=createDrop(d,cache);drops.set(d.id,g);}const remaining=Math.max(0,(d.lands-time)/(d.lands-d.born));g.position.set(d.x,.8+remaining*22,d.z);g.rotation.y=time/1700;g.userData.canopy.visible=remaining>0;

  }
  for(const [id,g]of drops)if(!liveDrops.has(id)){removeDrop(g);drops.delete(id);}
  const liveItems=new Set();for(const item of snapshot.items||[]){liveItems.add(item.id);let model=items.get(item.id);if(!model){model=kitModel(item.kit,cache);if(!model)continue;model.group.name='dropped:'+item.id;root.add(model.group);items.set(item.id,model);}model.update?.(time/1000,1,0);model.group.position.set(item.x,item.y,item.z);model.group.rotation.set(0,item.yaw,0);}
  for(const [id,model] of items)if(!liveItems.has(id)){model.dispose();items.delete(id);}
  const livePlaced=new Set();for(const p of snapshot.placed||[]){livePlaced.add(p.id);let model=placed.get(p.id);if(!model&&cache.has(p.blueprintId)){try{model=createGeneratedModel(cache.get(p.blueprintId));}catch{continue;}model.group.position.set(p.x,0,p.z);root.add(model.group);placed.set(p.id,model);}if(model){model.group.visible=!snapshot.destroyed[p.id];model.update(time/1000);const obscures=local&&segmentBox({x:local.x,y:local.y+1.4,z:local.z},camera.position,{...p,y:p.h/2});model.group.traverse(m=>{if(m.isMesh){m.material.transparent=!!obscures;m.material.opacity=obscures?.18:1;m.material.depthWrite=!obscures;}});}}for(const [id,m]of placed)if(!livePlaced.has(id)){m.dispose();placed.delete(id);}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.mesh.scale.setScalar(Math.max(0,e.life/.4));if(e.life<=0){e.mesh.geometry.dispose();if(e.ownedMaterial)e.mesh.material.dispose();e.mesh.removeFromParent();effects.splice(i,1);}}
 }
 function effect(e){
  if(e.type==='shot'&&e.projectile)playback.add(e.projectile);
  if(!e.played&&e.attack!==undefined&&['hit','blocked','impact','shot-end'].includes(e.type)&&playback.contact(e))return;
  if(['attack-preview','shot','swing'].includes(e.type)){
   const old=attacks.get(e.player),actor=actors.get(e.player),preview=e.type==='attack-preview';
   // Historical shots always entered playback above. Only the matching current
   // command can confirm an equipped pose; an older ACK cannot borrow its clock.
   const match=old&&old.commandId===e.commandId&&old.kitId===e.kitId&&old.roundId===e.roundId&&old.spawnSerial===e.spawnSerial;
   if(e.predicted&&(!match||!old.preview))return;
   if(!e.predicted&&old&&((e.commandId!=null&&old.commandId!=null&&e.commandId<=old.commandId)||e.time<old.eventTime))return;
   const time=e.predicted?old.time:viewTime||e.time,correction=e.aimCorrection??Math.atan2(Math.sin((e.aimYaw??e.yaw??0)-(actor?.bodyYaw||0)),Math.cos((e.aimYaw??e.yaw??0)-(actor?.bodyYaw||0)));
   attacks.set(e.player,{time,eventTime:e.time,commandId:e.commandId,preview,roundId:e.roundId,spawnSerial:e.spawnSerial,weapon:e.weapon,yaw:e.yaw??0,pitch:e.pitch||0,correction,kitId:e.kitId,poseUntil:e.muzzle?time+100:0});return;
  }
  if(['hit','blocked'].includes(e.type))reactions.set(e.player,{time:viewTime||e.time,type:e.type});
  if(['round-ended','round-started','ko','leave'].includes(e.type)){guide.clear();if(e.type.startsWith('round-'))attacks.clear();else attacks.delete(e.player);}
  if(e.type==='respawn'){collapse.fade(e.player);reactions.delete(e.player);attacks.delete(e.player);}
  if(!['break','crash','hit','blocked','pickup','impact','respawn'].includes(e.type))return;
  if(['hit','blocked','impact'].includes(e.type)){const marker=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),new THREE.MeshBasicMaterial({color:e.type==='blocked'?0x72caff:0xfff3d4,toneMapped:false,transparent:true,opacity:.9}));marker.name='impact:'+String(e.attack??'melee');marker.position.set(e.x??0,e.y??1,e.z??0);root.add(marker);effects.push({mesh:marker,life:.4,ownedMaterial:true});}
  const amount=['break','crash','ko'].includes(e.type)?24:e.type==='hit'?12:6;
  const color=e.type==='blocked'?0x72caff:e.type==='respawn'?0x81de86:e.type==='hit'?0xfff3d4:e.color||C.yellow;
  for(let i=0;i<amount&&effects.length<160;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.22),material(color)),angle=i*2.399;mesh.position.set((e.x??0)+Math.sin(angle)*.45,(e.y??1)+(i%4)*.12,(e.z??0)+Math.cos(angle)*.45);root.add(mesh);effects.push({mesh,life:.4});}
 }
 function clear(){collapse.clear();playback.clear();update({players:[],projectiles:[],drops:[],placed:[],destroyed:{}},null,new Map(),0,0);root.visible=false;for(const e of effects){e.mesh.geometry.dispose();if(e.ownedMaterial)e.mesh.material.dispose();e.mesh.removeFromParent();}effects.length=0;attacks.clear();reactions.clear();}
 return {update,effect,clear};
}
