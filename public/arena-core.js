import {solveWeaponAim} from './aiming.js';
import {bounds,solidBoxes,projectileContact} from './shot-geometry.js';
export {solidBoxes} from './shot-geometry.js';
import {weaponAim} from './weapon-aim.js';
import {movementShape,isMovementBlocker,canFit,overlapsBody} from './movement-blocking.js';
import {moveDirect,startJump,MOVE_DT} from './movement.js';
import {newMotion,frameInput,validFrames,MAX_MOVE_FRAMES} from './movement-stream.js';
import {segmentBox} from './geometry.js';
export {segmentBox} from './geometry.js';
import {creationStats,clamp} from './combat.js';
import {blueprintMetrics} from './blueprint-metrics.js';
import {SUPPORT_DROPS} from './supply-catalog.js';
import {arenaMap,MAP_CYCLE,mapForRound,nextMap} from './map-catalog.js';
export const DEFAULT_ARENA="ISLAND",RESPAWN_MS=12000,INPUT_STALE_MS=750,ROUND_MS=5*60*1000,INTERMISSION_MS=15000,READY_GRACE_MS=5000,READY_COUNTDOWN_MS=3000;
export function makeKit(mode='foot',blueprint=null){const metrics=blueprint?blueprintMetrics(blueprint):null,stats=creationStats(blueprint||mode,metrics?.size);
 let muzzle=blueprint?.traits?metrics.normalize(blueprint.traits.emitter):[0,Math.max(1.4,stats.collision[1]*.65),stats.collision[2]/2+.15];
 // Clamp normalized model coordinates before translating to the stored hand grip.
 // Model bounds do not include the hand offset. Clamping after translation
 // lowered valid handheld emitters while the rendered geometry stayed in place.
 muzzle=muzzle.map((v,i)=>clamp(v,i===1?.2:-(metrics?.size[i]||stats.collision[i])/2-.8,i===1?(metrics?.size[1]||stats.collision[1])+.8:(metrics?.size[i]||stats.collision[i])/2+.8));
 if(!stats.mounted&&blueprint){const grip=metrics.normalize([0,0,0]);muzzle=muzzle.map((v,i)=>v-grip[i]+[.76,1.1,.3][i]);}
 if(!blueprint&&mode==='bow')muzzle=[-.72,1.26,1.48];
 return {placementSize:blueprint?.movement==='static'?metrics.size:null,id:mode,name:stats.name,blueprintId:blueprint?mode:null,mode:mode==='foot'&&!blueprint?'foot':stats.mounted?(stats.movement==='fly'?'plane':'car'):stats.weapon==='none'?'foot':['blade','knife','hammer','punch'].includes(stats.weapon)?'sword':'bow',stats,muzzle,color:blueprint?.palette?.[0]||'#ffcf55'};}
function newMatch(){return {roundNumber:1,complete:false,rounds:[],totals:{}};}
function newRound(id,time,status='active',mapId=mapForRound(id)){return {id,mapId,status,startsAt:status==='active'?time:null,endsAt:status==='active'?time+ROUND_MS:null,lobbyEndsAt:null,results:[],intermissionEndsAt:null,readyBy:{}};}
function ensureRound(room){room.match??=newMatch();if(!room.round)room.round=newRound(1,room.time);const r=room.round;if(!MAP_CYCLE.includes(r.mapId))r.mapId='island';delete r.scores;delete r.previousResults;r.readyBy??={};if(r.status==='finished'&&!room.match.complete&&!r.intermissionEndsAt)r.intermissionEndsAt=r.endsAt+INTERMISSION_MS;for(const p of Object.values(room.players))if(p.roundId===undefined)p.roundId=r.id;return r;}
function readiness(room,now=room.time){const round=ensureRound(room),eligible=round.status==='finished'&&!room.match.complete?Object.values(room.players).filter(p=>p.roundId===round.id&&now-p.lastSeen<=READY_GRACE_MS).map(p=>p.id):[],ready=eligible.filter(id=>round.readyBy[id]===round.id);return {roundId:round.id,eligible,ready,eligibleCount:eligible.length,readyCount:ready.length,allReady:eligible.length>=2&&ready.length===eligible.length};}
export function readyForNextRound(room,id,roundId,now=room.time){const round=ensureRound(room),p=room.players[id];if(!p)throw Object.assign(Error('Your arena session expired. Join again.'),{status:410});if(room.match.complete)throw Object.assign(Error('This match is complete. Exit the Arena to start a new game.'),{status:409});if(round.status!=='finished'||round.id!==roundId||p.roundId!==round.id)throw Object.assign(Error('That Ready request belongs to an earlier round.'),{status:409});room.time=Math.max(room.time,now);p.lastSeen=room.time;round.readyBy[id]=round.id;const state=readiness(room,room.time);if(state.allReady)round.intermissionEndsAt=Math.min(round.intermissionEndsAt,room.time+READY_COUNTDOWN_MS);return state;}
function resetMotion(p,now){if(p.motion)p.motion=p.motion.version===2?{version:2,frame:0,at:now}:newMotion(now);}
function roundScores(room){const round=ensureRound(room);return Object.values(room.players).filter(p=>p.roundId===round.id&&room.time-p.lastSeen<=20000).map(p=>({id:p.id,name:p.name,kills:p.kills,deaths:p.deaths})).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));}
function finishRound(room){const round=ensureRound(room);if(round.status!=='active')return;round.results=roundScores(room);const match=room.match;match.rounds.push({number:match.roundNumber,mapId:round.mapId,results:structuredClone(round.results)});for(const score of round.results){const total=match.totals[score.id]??={id:score.id,name:score.name,kills:0,deaths:0};total.name=score.name;total.kills+=score.kills;total.deaths+=score.deaths;}match.complete=match.roundNumber>=3;round.status='finished';round.intermissionEndsAt=match.complete?null:round.endsAt+INTERMISSION_MS;room.projectiles=[];room.items=[];room.placed=[];for(const p of Object.values(room.players)){p.input={};p.melee=null;p.building=null;p.kit=makeKit();p.mountHealth=0;p.speed=0;p.vertical=0;}event(room,'round-ended',{round:round.id});}
function restartRound(room,id){const old=ensureRound(room);if(old.status!=='finished'||old.id!==id||room.match.complete)return;room.match.roundNumber++;room.round=newRound(old.id+1,room.time,Object.keys(room.players).length?'active':'waiting',nextMap(old.mapId));room.projectiles=[];room.drops=[];room.items=[];room.placed=[];room.damage={};room.destroyed={};room.events=[];room.nextDrop=room.time+4000;room.dropIndex=0;
 for(const p of Object.values(room.players)){const kit=makeKit();const [x,z]=safeSpawn(room,p.id,kit);Object.assign(p,{x,y:0,z,yaw:Math.PI,roundId:room.round.id,kit,kills:0,deaths:0,health:100,mountHealth:kit.stats.mountMax,respawnAt:0,protectedUntil:room.time+3000,defenseUntil:0,speedUntil:0,heat:0,overheatedUntil:0,nextShot:0,buildReadyAt:room.time,building:null,melee:null,input:{},inputAt:0,speed:0,vertical:0,vy:0,grounded:kit.stats.movement!=='fly',jumpRemaining:0,aimPitch:0});p.spawnSerial=(p.spawnSerial||0)+1;resetMotion(p,room.time);}
 event(room,'round-started',{round:room.round.id,mapId:room.round.mapId});}
export function newRoom(now=Date.now(),epoch='local'){return {match:newMatch(),round:newRound(1,now,'waiting'),host:null,epoch,revision:0,time:now,players:{},projectiles:[],drops:[],items:[],damage:{},destroyed:{},placed:[],events:[],eventId:0,nextDrop:now+4000,dropIndex:0,seed:734159};}
function event(room,type,data={}){const e={id:++room.eventId,type,time:room.time,...data};room.events.push(e);while(room.events.length>Math.min(8192,Math.max(512,Object.keys(room.players).length*64))||room.events[0]?.time<room.time-5000)room.events.shift();return e;}
function safeSpawn(room,id,kit=makeKit()){const spawns=arenaMap(room).spawns,shape=movementShape(kit.stats),boxes=movementBoxes(room);let best=null,bestScore=-Infinity;for(const [x,z] of spawns){if(Math.abs(x)+shape.radius>53||Math.abs(z)+shape.radius>53||!canFit({x,y:0,z},shape,boxes))continue;const score=Math.min(200,...Object.values(room.players).filter(p=>p.id!==id&&p.health>0).map(p=>Math.hypot(p.x-x,p.z-z)));if(score>bestScore){best=[x,z];bestScore=score;}}if(best)return best;
 // Large saved mounts may need an open position between the preferred pads.
 for(let x=-40;x<=40;x+=4)for(let z=-40;z<=40;z+=4)if(canFit({x,y:0,z},shape,boxes))return [x,z];
 throw Error('This map has no safe spawn for the equipped creation.');}
function resetCompletedMatch(room,now){if(!room.match.complete||Object.keys(room.players).length)return;const nextId=room.round.id+1;room.match=newMatch();room.round=newRound(nextId,now,'waiting','island');room.host=null;room.items=[];room.drops=[];room.placed=[];room.destroyed={};room.damage={};room.events=[];room.nextDrop=now+4000;room.dropIndex=0;}
function createPlayer(room,id,name,now){const [x,z]=safeSpawn(room,id),kit=makeKit();const p={roundId:room.round.status==='active'?room.round.id:null,id,name,x,y:0,z,yaw:Math.PI,speed:0,vertical:0,flightAltitude:12,health:100,mountHealth:0,kit,building:null,kills:0,deaths:0,respawnAt:0,protectedUntil:now+3000,defenseUntil:0,speedUntil:0,lastSeen:now,input:{},inputAt:now,lastSeq:0,lastCommand:0,nextShot:0,heat:0,overheatedUntil:0,buildReadyAt:0,actionAt:0};room.players[id]=p;event(room,'join',{player:id,name});return p;}
// Direct simulation fixtures may still start a round immediately. Production joins
// use queuePlayer and wait for the arena creator to start the match.
export function addPlayer(room,id,name,now=room.time){ensureRound(room);resetCompletedMatch(room,now);const round=ensureRound(room);if(round.status==='waiting')room.round=newRound(round.id,now,'active',round.mapId);return createPlayer(room,id,name,now);}
export function queuePlayer(room,id,name,now=room.time){ensureRound(room);resetCompletedMatch(room,now);const round=ensureRound(room);if(round.status!=='waiting')throw Object.assign(Error('This match is already in progress. Join after the current game ends.'),{status:409});const p=createPlayer(room,id,name,now);room.host??=id;round.lobbyEndsAt=null;return p;}
// Public rooms admit late arrivals instead of stranding a refreshed or returning
// player outside an active match. Active-round arrivals spawn on foot with the
// same protection as a round start; intermission arrivals join the next round.
export function joinPlayer(room,id,name,now=room.time){ensureRound(room);resetCompletedMatch(room,now);const round=ensureRound(room),p=createPlayer(room,id,name,now);if(round.status==='waiting'){room.host??=id;round.lobbyEndsAt=null;}return p;}
export function startRoom(room,id,now=room.time){const round=ensureRound(room);if(round.status!=='waiting')throw Object.assign(Error('This game has already started.'),{status:409});if(room.host!==id)throw Object.assign(Error('Only the arena creator can start the game.'),{status:403});if(!Object.keys(room.players).length)throw Object.assign(Error('Invite a player before starting.'),{status:409});room.time=Math.max(room.time,now);round.status='active';round.startsAt=room.time;round.endsAt=room.time+ROUND_MS;round.lobbyEndsAt=null;for(const p of Object.values(room.players)){p.roundId=round.id;p.input={};p.inputAt=0;p.protectedUntil=room.time+3000;p.buildReadyAt=room.time;p.spawnSerial=(p.spawnSerial||0)+1;resetMotion(p,room.time);}event(room,'round-started',{round:round.id,mapId:round.mapId});return round;}
export function removePlayer(room,id){if(room.players[id]){event(room,'leave',{player:id,name:room.players[id].name});delete room.players[id];if(room.round?.status==='waiting'&&room.host===id)room.host=Object.keys(room.players)[0]||null;}}
export function cleanInput(raw={}){const number=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):0;return {x:number(raw.x,-1,1),z:number(raw.z,-1,1),cameraYaw:number(raw.cameraYaw,-10000,10000),weaponPitch:0,up:raw.up===true,down:raw.down===true,sprint:raw.sprint===true,fire:raw.fire===true,jump:raw.jump===true};}
export function movementBoxes(room){const boxes=[];for(const e of arenaMap(room).entities)if(isMovementBlocker(e)&&!room.destroyed?.[e.id])boxes.push(...e.boxes);for(const e of room.placed||[])if(!room.destroyed?.[e.id])boxes.push({...e,y:e.h/2});return boxes;}
function destroyCover(room,e,amount,source){if(e.hp<=0)return false;room.damage[e.id]=(room.damage[e.id]||0)+amount;if(room.damage[e.id]<e.hp)return false;room.destroyed[e.id]=room.time+60000;delete room.damage[e.id];event(room,'break',{entity:e.id,by:source,color:e.color||'#ffcf55',x:e.boxes?.[0]?.x??e.x,y:e.boxes?.[0]?.y??e.h/2,z:e.boxes?.[0]?.z??e.z});return true;}
function dismount(room,p,crashed=false){const old=p.kit.name;p.kit=makeKit();p.mountHealth=0;p.building=null;p.speed=0;p.vertical=0;p.jumpRemaining=0;p.vy=0;p.grounded=false;p.heat=0;p.melee=null;event(room,crashed?'crash':'dismount',{player:p.id,name:old,x:p.x,y:p.y+1,z:p.z});}
function dropItem(room,p){
 if(p.building){event(room,'notice',{player:p.id,text:'Let your creation finish assembling before dropping it.'});return;}
 if(p.kit.id==='foot')return;
 room.items??=[];if(room.items.length>=64){event(room,'notice',{player:p.id,text:'There are too many dropped items here. Pick one up before dropping another.'});return;}
 let y=0;for(const {box:b} of solidBoxes(room))if(b.y+b.h/2<=p.y+.1&&Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2)y=Math.max(y,b.y+b.h/2);
 const e=event(room,'item-dropped',{player:p.id,name:p.kit.name,x:p.x,y,z:p.z});room.items.push({id:'item:'+e.id,kit:p.kit,mountHealth:p.mountHealth,heat:p.heat,overheatedUntil:p.overheatedUntil,nextShot:p.nextShot,x:p.x,y,z:p.z,yaw:p.yaw});dismount(room,p);
}
export function nearbyItem(room,p){
 if(!p||p.health<=0||p.building||room.round?.status==='finished')return null;
 const from={x:p.x,y:p.y+1,z:p.z},boxes=solidBoxes(room);return (room.items||[]).filter(item=>Math.hypot(item.x-p.x,item.z-p.z)<3&&Math.abs(item.y-p.y)<2.5&&!boxes.some(({box})=>segmentBox(from,{x:item.x,y:item.y+.6,z:item.z},box))).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;
}
function pickupItem(room,p,id){
 const item=(room.items||[]).find(item=>item.id===id);if(!item||nearbyItem({...room,items:[item]},p)!==item)return;
 if(p.kit.id!=='foot'){event(room,'notice',{player:p.id,text:'Press Enter to drop your current item before picking this one up.'});return;}
 const shape=movementShape(item.kit.stats);if(Math.abs(p.x)+shape.radius>53||Math.abs(p.z)+shape.radius>53||!canFit(p,shape,movementBoxes(room))){event(room,'notice',{player:p.id,text:'Move into open space beside the item to pick it up.'});return;}
 p.kit=item.kit;p.mountHealth=item.mountHealth;p.melee=null;p.speed=0;p.vertical=0;p.vy=0;p.jumpRemaining=0;p.grounded=false;p.heat=item.heat||0;p.overheatedUntil=item.overheatedUntil||0;p.nextShot=Math.max(p.nextShot,item.nextShot||0);
 room.items=room.items.filter(d=>d.id!==id);event(room,'item-picked-up',{player:p.id,name:item.kit.name,x:item.x,y:item.y,z:item.z});
}
export function hurt(room,p,amount,source,impact={}){if(ensureRound(room).status!=='active'||p.health<=0||room.time<p.protectedUntil)return false;amount*=1-p.kit.stats.armor;if(room.time<p.defenseUntil)amount*=.45;let remaining=amount;
 if(p.mountHealth>0){const absorbed=Math.min(p.mountHealth,remaining);p.mountHealth-=absorbed;remaining-=absorbed;if(p.mountHealth<=0)dismount(room,p,true);}
 p.health=Math.max(0,p.health-remaining);event(room,'hit',{player:p.id,by:source,amount:Math.round(amount),health:Math.ceil(p.health),mount:Math.ceil(p.mountHealth),x:p.x,y:p.y+1.4,z:p.z,...impact});
 if(p.health===0){p.deaths++;p.respawnAt=room.time+RESPAWN_MS;p.building=null;p.melee=null;p.speed=0;p.input={};const killer=room.players[source];if(killer&&killer.id!==p.id)killer.kills++;event(room,'ko',{player:p.id,name:p.name,by:killer?.id||null,killer:killer?.name||'The island'});}return true;
}
function respawn(room,p){const [x,z]=safeSpawn(room,p.id);Object.assign(p,{x,y:0,z,yaw:Math.PI,speed:0,vertical:0,health:100,mountHealth:0,kit:makeKit(),building:null,respawnAt:0,protectedUntil:room.time+3000,defenseUntil:0,speedUntil:0,heat:0,buildReadyAt:room.time+1500,input:{},inputAt:0});p.spawnSerial=(p.spawnSerial||0)+1;p.jumpRemaining=0;p.vy=0;p.grounded=true;resetMotion(p,room.time);event(room,'respawn',{player:p.id,x,z});}
function movePlayer(room,p,dt,input){
 const k=p.kit.stats,speed=k.speed*(room.time<p.speedUntil?2:1)*(input.sprint&&!k.mounted?1.35:1);
 moveDirect(p,input,dt,{speed,mounted:k.mounted,flying:k.movement==='fly'&&k.mounted,limit:53,height:36,shape:movementShape(k),boxes:movementBoxes(room)});
}
function applyFrames(room,p,packet,now){
 if(p.motion?.version!==1||packet.motionEpoch!==(p.spawnSerial||0)||!validFrames(packet.frames))return;
 const m=p.motion;m.credit=Math.min(MAX_MOVE_FRAMES,m.credit+Math.max(0,now-m.at)/1000/MOVE_DT);m.at=now;
 for(const frame of packet.frames){if(frame[0]<=m.frame)continue;if(frame[0]!==m.frame+1||m.credit+1e-7<1)break;
  if(p.health>0)movePlayer(room,p,MOVE_DT,frameInput(frame));m.credit=Math.max(0,m.credit-1);m.frame=frame[0];
 }
}
export function predictPlayer(p,input,dt,worldState){if(worldState.round?.status==='finished'||p.health<=0)return;const world={...worldState,preview:true,players:{[p.id]:p},events:[],eventId:0,damage:{...worldState.damage},destroyed:{...worldState.destroyed}},controls=cleanInput(input);for(let left=Math.min(.1,dt);left>1e-8;){const step=Math.min(left,1/30);movePlayer(world,p,step,controls);left-=step;world.time+=step*1000;}}
function rand(room){let n=room.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;room.seed=n>>>0;return room.seed/4294967296;}
// A pure status query for local diagnostics; no extra network events or telemetry.
export function attackBlockReason(room,p){
 if(room.round?.status!=='active')return 'round';if(p.health<=0)return 'dead';if(p.building)return 'building';if(!p.kit.stats.damage)return 'unarmed';
 if(room.time<p.protectedUntil)return 'protection';if(room.time<p.overheatedUntil)return 'heat';if(room.time<p.nextShot)return 'cooldown';return null;
}
function resolveProjectileContact(room,b,from,to,hit){
 const point={x:from.x+(to.x-from.x)*hit.t,y:from.y+(to.y-from.y)*hit.t,z:from.z+(to.z-from.z)*hit.t,attack:b.id,color:b.color};
 if(hit.player){if(!hurt(room,hit.player,b.damage,b.owner,point))event(room,'blocked',{player:hit.player.id,by:b.owner,...point});}
 else{if(hit.entity)destroyCover(room,hit.entity,b.damage,b.owner);event(room,'impact',{...point,by:b.owner,entity:hit.entity?.id||'ground'});}
}
function shoot(room,p,input,commandId=null,aimSolver=solveWeaponAim){const k=p.kit.stats;ensureRound(room);if(attackBlockReason(room,p))return;
 p.nextShot=room.time+k.interval*1000;p.actionAt=room.time;p.actionYaw=p.yaw;
 if(k.weapon==='automatic'){p.heat+=.115;if(p.heat>=1){p.overheatedUntil=room.time+2200;p.heat=1;}}
 let {yaw,pitch}=weaponAim(p);
 if(k.projectileSpeed===0){const attack=event(room,'swing',{player:p.id,x:p.x,y:p.y+1.3,z:p.z,yaw,weapon:k.weapon,commandId,kitId:p.kit.id,roundId:room.round.id,spawnSerial:p.spawnSerial||0});p.melee={at:room.time+(k.windup||.18)*1000,yaw,kit:p.kit.id,damage:k.damage,range:k.range,attack:attack.id};return;}

 const solution=aimSolver(room,p),{anchor,muzzle:from}=solution;
 yaw=solution.yaw+(rand(room)-.5)*k.spread;pitch=(rand(room)-.5)*k.spread*.7;
 // Bound each shooter's outstanding work without deleting another player's shots.
 if(room.projectiles.filter(b=>b.owner===p.id).length>=24||room.projectiles.length>=2048){event(room,'notice',{player:p.id,text:'The arena has a lot of projectiles. Try attacking again shortly.'});return;}
 const id=++room.eventId,projectile={id,owner:p.id,born:room.time,...from,vx:Math.sin(yaw)*Math.cos(pitch)*k.projectileSpeed,vy:Math.sin(pitch)*k.projectileSpeed,vz:Math.cos(yaw)*Math.cos(pitch)*k.projectileSpeed,damage:k.damage,weapon:k.weapon,color:k.weapon==='flame'?'#ff7836':p.kit.color,expires:room.time+k.range/k.projectileSpeed*1000,range:k.range};
 const contact=solution.launchContact;
 // Immediate contact has no live projectile. Replay starts at the body so the
 // visible trace travels toward the contact instead of backwards from the muzzle.
 const visible={...projectile,...(contact?anchor:from)};
 event(room,'shot',{player:p.id,commandId,weapon:k.weapon,yaw,pitch,aimYaw:solution.yaw,aimCorrection:solution.correction,roundId:room.round.id,spawnSerial:p.spawnSerial||0,kitId:p.kit.id,muzzle:{...from},x:visible.x,y:visible.y,z:visible.z,projectile:visible});
 if(contact)resolveProjectileContact(room,projectile,anchor,from,contact);else room.projectiles.push(projectile);
}
function resolveMelee(room,p){
 const m=p.melee;if(!m||room.time<m.at)return;p.melee=null;
 if(p.health<=0||p.building||p.kit.id!==m.kit)return;
 const from={x:p.x,y:p.y+1.3,z:p.z};let victim=null,point=null,nearest=m.range;const boxes=solidBoxes(room);
 for(const q of Object.values(room.players)){if(q.id===p.id||q.health<=0)continue;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);
  // Undefined facing at an identical center is explicit contact. Every separated
  // center still obeys the existing forward cone and foot-altitude limit.
  if(Math.abs(q.y-p.y)>1.8||(d>1e-9&&(dx*Math.sin(m.yaw)+dz*Math.cos(m.yaw))/d<.45))continue;
  const bb=bounds(q),to={x:clamp(p.x,q.x-bb.hx,q.x+bb.hx),y:clamp(from.y,q.y,q.y+bb.h),z:clamp(p.z,q.z-bb.hz,q.z+bb.hz)},reach=Math.hypot(to.x-from.x,to.z-from.z);
  if(reach>=nearest||boxes.some(({box})=>segmentBox(from,to,box)))continue;victim=q;point={...to,attack:m.attack};nearest=reach;}
 if(victim){if(!hurt(room,victim,m.damage,p.id,point))event(room,'blocked',{player:victim.id,by:p.id,...point});return;}
 const end={x:from.x+Math.sin(m.yaw)*m.range,y:from.y,z:from.z+Math.cos(m.yaw)*m.range};let cover=null;for(const item of boxes){const hit=segmentBox(from,end,item.box);if(hit&&(!cover||hit.t<cover.t))cover={...item,...hit};}
 if(cover){destroyCover(room,cover.entity,m.damage,p.id);event(room,'impact',{x:from.x+(end.x-from.x)*cover.t,y:from.y,z:from.z+(end.z-from.z)*cover.t});}
}
function finishBuild(room,p){const kit=p.building.kit;p.building=null;
 if(kit.placementSize){const [w,h,d]=kit.placementSize;let spot=null;for(let radius=Math.max(w,d)/2+3;radius<16&&!spot;radius+=2)for(let i=0;i<16;i++){const a=p.yaw+i*Math.PI/8,x=p.x+Math.sin(a)*radius,z=p.z+Math.cos(a)*radius;if(Math.abs(x)+w/2>51||Math.abs(z)+d/2>51)continue;const candidate={x,y:h/2,z,w,h,d};if(solidBoxes(room).some(({box:b})=>Math.abs(x-b.x)<(w+b.w)/2+.5&&Math.abs(z-b.z)<(d+b.d)/2+.5&&Math.abs(h/2-b.y)<(h+b.h)/2+.5))continue;if(Object.values(room.players).some(q=>Math.abs(x-q.x)<w/2+3&&Math.abs(z-q.z)<d/2+3))continue;spot=candidate;break;}
  if(!spot){event(room,'notice',{player:p.id,text:'Move into open space to place that creation.'});return;}
  const owned=room.placed.filter(e=>e.owner===p.id);if(owned.length>=2)room.placed=room.placed.filter(e=>e.id!==owned[0].id);const id='placed:'+p.id+':'+room.eventId;room.placed.push({...spot,id,owner:p.id,blueprintId:kit.blueprintId,hp:260,color:kit.color});event(room,'built',{player:p.id,kit:kit.id,name:kit.name,placed:true});return;
 }
 if(!canFit(p,movementShape(kit.stats),movementBoxes(room))){event(room,'notice',{player:p.id,text:'Move into open space, then rebuild your saved creation. Your position is unchanged.'});return;}
 if(p.kit.id!=='foot'&&(room.items||[]).length<64){const dropped=event(room,'item-dropped',{player:p.id,name:p.kit.name,x:p.x,y:p.y,z:p.z});room.items??=[];room.items.push({id:'item:'+dropped.id,kit:p.kit,mountHealth:p.mountHealth,heat:p.heat,overheatedUntil:p.overheatedUntil,nextShot:p.nextShot,x:p.x,y:p.y,z:p.z,yaw:p.yaw});}
 p.kit=kit;p.mountHealth=kit.stats.mountMax;p.vertical=0;p.flightAltitude=p.y;p.jumpRemaining=0;p.vy=0;p.grounded=false;event(room,'built',{player:p.id,kit:kit.id,name:kit.name});
}
function spawnDrop(room){
 const type=SUPPORT_DROPS[room.dropIndex++%SUPPORT_DROPS.length];
 const shape=movementShape(makeKit().stats),boxes=movementBoxes(room);
 const DROP_POINTS=arenaMap(room).dropPoints;
 const point=DROP_POINTS.map((_,offset)=>DROP_POINTS[(room.dropIndex-1+offset)%DROP_POINTS.length]).find(([x,z])=>canFit({x,y:0,z},shape,boxes));
 room.nextDrop=room.time+12000;if(!point)return;
 const [x,z]=point;room.drops.push({id:'drop:'+room.dropIndex,type,x,z,born:room.time,lands:room.time+5500,expires:room.time+45000});if(room.drops.length>6)room.drops.shift();
}
export function nearbyPickup(room,p){
 if(!p||p.health<=0||p.building||room.round?.status==='finished')return null;
 const item=nearbyItem(room,p),supplies=(room.drops||[]).filter(d=>SUPPORT_DROPS.includes(d.type)&&room.time>=d.lands&&room.time<d.expires&&p.y<2.5&&Math.hypot(p.x-d.x,p.z-d.z)<2.3&&!solidBoxes(room).some(({box})=>segmentBox({x:p.x,y:p.y+1,z:p.z},{x:d.x,y:.6,z:d.z},box)));
 const options=[...(item?[{...item,kind:'item',name:item.kit.name}]:[]),...supplies.map(d=>({...d,kind:'supply',name:d.type==='health'?'Health':d.type==='defense'?'Defense aura':'Speed boost'}))];
 return options.sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0]||null;
}
function collectPickup(room,p,id){
 const drop=(room.drops||[]).find(d=>d.id===id);
 if(!drop){pickupItem(room,p,id);return;}
 if(!nearbyPickup({...room,items:[],drops:[drop]},p))return;
 if(drop.type==='health')p.health=100;if(drop.type==='defense')p.defenseUntil=room.time+10000;if(drop.type==='speed')p.speedUntil=room.time+10000;
 event(room,'pickup',{player:p.id,pickup:drop.type,x:drop.x,y:1,z:drop.z});room.drops=room.drops.filter(d=>d.id!==id);
}

function step(room,dt){
 room.drops=room.drops.filter(d=>SUPPORT_DROPS.includes(d.type)&&room.time<d.expires);
 for(const [id,until] of Object.entries(room.destroyed))if(until<=room.time){const entity=arenaMap(room).entities.find(e=>e.id===id)||room.placed.find(e=>e.id===id);const boxes=entity?.boxes||[entity&&{...entity,y:entity.h/2}].filter(Boolean);if(entity&&isMovementBlocker(entity)&&Object.values(room.players).some(p=>p.health>0&&boxes.some(b=>overlapsBody(p,movementShape(p.kit.stats),b)))){room.destroyed[id]=room.time+1000;continue;}delete room.destroyed[id];event(room,'restore',{entity:id});}
 for(const p of Object.values(room.players)){if(room.time-p.lastSeen>20000){removePlayer(room,p.id);continue;}if(p.health<=0){if(room.time>=p.respawnAt)respawn(room,p);continue;}p.heat=Math.max(0,p.heat-dt*.13);if(p.building&&room.time>=p.building.ends)finishBuild(room,p);const input=room.time-p.inputAt<INPUT_STALE_MS?p.input:{};if(!p.motion||p.motion.version===2)movePlayer(room,p,dt,input);if(input.fire)shoot(room,p,input);resolveMelee(room,p);for(const drop of [...room.drops])if(Math.hypot(p.x-drop.x,p.z-drop.z)<1.2)collectPickup(room,p,drop.id);}
 const boxes=solidBoxes(room);for(let i=room.projectiles.length-1;i>=0;i--){const b=room.projectiles[i],travel=Math.min(dt,Math.max(0,(b.expires-room.time+dt*1000)/1000)),end={x:b.x+b.vx*travel,y:b.y+b.vy*travel,z:b.z+b.vz*travel},hit=projectileContact(room,b,b,end,boxes);
  if(hit){resolveProjectileContact(room,b,b,end,hit);room.projectiles.splice(i,1);}else if(room.time>=b.expires){event(room,'shot-end',{...end,attack:b.id});room.projectiles.splice(i,1);}else Object.assign(b,end);
 }
 if(room.time>=room.nextDrop)spawnDrop(room);

}
export function advanceRoom(room,now){ensureRound(room);now=Math.max(room.time,now);
 for(const p of Object.values(room.players))if(now-p.lastSeen>20000)removePlayer(room,p.id);
 while(room.time<now){const round=room.round;
  if(round.status==='waiting'){room.time=now;break;}
  if(round.status==='finished'){if(room.match.complete){room.time=now;break;}const boundary=round.intermissionEndsAt;if(now<boundary){room.time=now;break;}room.time=Math.max(room.time,boundary);restartRound(room,round.id);continue;}
  const until=Math.min(now,round.endsAt);let elapsed=Math.max(0,until-room.time);if(elapsed>1000){room.time=until-1000;elapsed=1000;}while(elapsed>1e-7){const ms=Math.min(1000/30,elapsed);room.time+=ms;step(room,ms/1000);elapsed-=ms;}room.time=until;if(now>=round.endsAt)finishRound(room);
 }
 // Also transition when a request arrives at the exact intermission boundary.
 if(room.round.status==='finished'&&!room.match.complete&&now>=room.round.intermissionEndsAt){room.time=room.round.intermissionEndsAt;restartRound(room,room.round.id);room.time=now;}
 return room;}
export function applyInput(room,id,packet,now,kit=null,aimSolver=solveWeaponAim){const p=room.players[id];if(!p)throw Object.assign(Error('Your arena session expired. Join again.'),{status:410});p.lastSeen=now;if(!Number.isSafeInteger(packet.seq)||packet.seq<=p.lastSeq)return;p.lastSeq=packet.seq;if(p.motion&&Number.isSafeInteger(packet.motionEpoch)&&packet.motionEpoch!==(p.spawnSerial||0)){if(Number.isSafeInteger(packet.command?.id))p.lastCommand=Math.max(p.lastCommand,packet.command.id);return;}const round=ensureRound(room);if(packet.roundId!==undefined&&packet.roundId!==round.id){if(Number.isSafeInteger(packet.command?.id))p.lastCommand=Math.max(p.lastCommand,packet.command.id);return;}if(round.status!=='active'){const c=packet.command;if(c&&Number.isSafeInteger(c.id)&&c.id>p.lastCommand){p.lastCommand=c.id;}p.input={};return;}p.input=cleanInput(packet.input);p.aimPitch=weaponAim(p,p.input.weaponPitch).pitch;p.inputAt=now;applyFrames(room,p,packet,now);
 // A fresh held-fire update must not depend on another request arriving before
 // it expires. Attempt once at the current authoritative pose/time; never replay
 // a skipped firing window or turn a retried command into a new held attack.
 if(!packet.command&&p.input.fire)shoot(room,p,p.input,null,aimSolver);
 const command=packet.command;if(!command||!Number.isSafeInteger(command.id)||command.id<=p.lastCommand)return;p.lastCommand=command.id;if(p.health<=0)return;
 if(command.type==='fire')shoot(room,p,p.input,command.id,aimSolver);
 if(command.type==='jump')startJump(p,p.kit.stats.mounted);
 if(command.type==='exit'){dropItem(room,p);return;}
 if(command.type==='pickup'){collectPickup(room,p,command.mode);return;}
 if(command.type==='cancel-build'){if(p.building){p.building=null;p.buildReadyAt=now;event(room,'build-canceled',{player:p.id});}return;}
 if(command.type==='build'&&kit&&!p.building&&now>=p.buildReadyAt){p.melee=null;p.building={kit,starts:now,ends:now+1200};p.buildReadyAt=now+10000;event(room,'build',{player:p.id,kit:kit.id});}
}
export function roomSnapshot(room,self,afterEvent=0){ensureRound(room);return {round:room.round,match:room.match,readiness:readiness(room),host:room.host,epoch:room.epoch,revision:room.revision,time:room.time,self,players:Object.values(room.players).map(({input,inputAt,lastSeen,...p})=>p),projectiles:room.projectiles,drops:room.drops,items:room.items||[],destroyed:room.destroyed,damage:room.damage,placed:room.placed,eventCursor:room.eventId,events:room.events.filter(e=>e.id>(Number.isSafeInteger(afterEvent)&&afterEvent>=0?afterEvent:0)),leaderboard:room.round.status==='finished'?room.round.results:roundScores(room)};}
