import {moveDirect,startJump,MOVE_DT} from './movement.js';
import {newMotion,frameInput,validFrames,MAX_MOVE_FRAMES} from './movement-stream.js';
import {segmentBox} from './geometry.js';
export {segmentBox} from './geometry.js';
import {creationStats,clamp} from './combat.js';
import {blueprintMetrics} from './blueprint-metrics.js';
import {WORLD_ENTITIES,WORLD_BY_ID,SPAWNS,DROP_POINTS} from './world-data.js';
export const DEFAULT_ARENA="ISLAND",RESPAWN_MS=12000,INPUT_STALE_MS=750;
export function makeKit(mode='foot',blueprint=null){const metrics=blueprint?blueprintMetrics(blueprint):null,stats=creationStats(blueprint||mode,metrics?.size);let muzzle=blueprint?.traits?metrics.normalize(blueprint.traits.emitter):[0,Math.max(1.4,stats.collision[1]*.65),stats.collision[2]/2+.15];if(!stats.mounted&&blueprint){const grip=metrics.normalize([0,0,0]);muzzle=muzzle.map((v,i)=>v-grip[i]+[.76,1.1,.3][i]);}muzzle=muzzle.map((v,i)=>clamp(v,i===1?.2:-(metrics?.size[i]||stats.collision[i])/2-.8,i===1?(metrics?.size[1]||stats.collision[1])+.8:(metrics?.size[i]||stats.collision[i])/2+.8));return {placementSize:blueprint?.movement==='static'?metrics.size:null,id:mode,name:stats.name,blueprintId:blueprint?mode:null,mode:mode==='foot'&&!blueprint?'foot':stats.mounted?(stats.movement==='fly'?'plane':'car'):stats.weapon==='none'?'foot':['blade','knife','hammer'].includes(stats.weapon)?'sword':'bow',stats,muzzle,color:blueprint?.palette?.[0]||'#ffcf55'};}
export function newRoom(now=Date.now(),epoch='local'){return {epoch,revision:0,time:now,players:{},projectiles:[],drops:[],damage:{},destroyed:{},placed:[],events:[],eventId:0,nextDrop:now+4000,dropIndex:0,seed:734159};}
function event(room,type,data={}){const e={id:++room.eventId,type,time:room.time,...data};room.events.push(e);while(room.events.length>512||room.events[0]?.time<room.time-5000)room.events.shift();return e;}
function safeSpawn(room,id){let best=SPAWNS[0],bestScore=-Infinity;for(const [x,z] of SPAWNS){const score=Math.min(200,...Object.values(room.players).filter(p=>p.id!==id&&p.health>0).map(p=>Math.hypot(p.x-x,p.z-z)));if(score>bestScore){best=[x,z];bestScore=score;}}return best;}
export function addPlayer(room,id,name,now=room.time){const [x,z]=safeSpawn(room,id),kit=makeKit();const p={id,name,x,y:0,z,yaw:Math.PI,speed:0,vertical:0,flightAltitude:12,health:100,mountHealth:0,kit,building:null,kills:0,deaths:0,respawnAt:0,protectedUntil:now+3000,defenseUntil:0,speedUntil:0,lastSeen:now,input:{},inputAt:now,lastSeq:0,lastCommand:0,nextShot:0,heat:0,overheatedUntil:0,buildReadyAt:0,actionAt:0};room.players[id]=p;event(room,'join',{player:id,name});return p;}
export function removePlayer(room,id){if(room.players[id]){event(room,'leave',{player:id,name:room.players[id].name});delete room.players[id];}}
export function cleanInput(raw={}){const number=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):0;return {x:number(raw.x,-1,1),z:number(raw.z,-1,1),cameraYaw:number(raw.cameraYaw,-10000,10000),aimPitch:number(raw.aimPitch,-.75,.75),up:raw.up===true,down:raw.down===true,sprint:raw.sprint===true,fire:raw.fire===true,jump:raw.jump===true};}
function bounds(p){const [w,h,d]=p.kit.stats.collision,yaw=p.kit.stats.mounted?p.yaw:0,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));return {hx:(w*c+d*s)/2,hy:h/2,hz:(d*c+w*s)/2,h};}
export function solidBoxes(room){const list=[];for(const e of WORLD_ENTITIES)if(!room.destroyed[e.id])for(const box of e.boxes)list.push({entity:e,box});for(const e of room.placed||[])if(!room.destroyed[e.id])list.push({entity:e,box:{x:e.x,y:e.h/2,z:e.z,w:e.w,h:e.h,d:e.d}});return list;}
function destroyCover(room,e,amount,source){if(e.hp<=0)return false;room.damage[e.id]=(room.damage[e.id]||0)+amount;if(room.damage[e.id]<e.hp)return false;room.destroyed[e.id]=room.time+60000;delete room.damage[e.id];event(room,'break',{entity:e.id,by:source,color:e.color||'#ffcf55',x:e.boxes?.[0]?.x??e.x,y:e.boxes?.[0]?.y??e.h/2,z:e.boxes?.[0]?.z??e.z});return true;}
function dismount(room,p,crashed=false){const old=p.kit.name;p.kit=makeKit();p.mountHealth=0;p.building=null;p.speed=0;p.vertical=0;p.jumpRemaining=0;p.heat=0;event(room,crashed?'crash':'dismount',{player:p.id,name:old,x:p.x,y:p.y+1,z:p.z});}
export function hurt(room,p,amount,source){if(p.health<=0||room.time<p.protectedUntil)return false;amount*=1-p.kit.stats.armor;if(room.time<p.defenseUntil)amount*=.45;let remaining=amount;
 if(p.mountHealth>0){const absorbed=Math.min(p.mountHealth,remaining);p.mountHealth-=absorbed;remaining-=absorbed;if(p.mountHealth<=0)dismount(room,p,true);}
 p.health=Math.max(0,p.health-remaining);event(room,'hit',{player:p.id,by:source,amount:Math.round(amount),health:Math.ceil(p.health),mount:Math.ceil(p.mountHealth),x:p.x,y:p.y+1.4,z:p.z});
 if(p.health===0){p.deaths++;p.respawnAt=room.time+RESPAWN_MS;p.building=null;p.speed=0;p.input={};const killer=room.players[source];if(killer&&killer.id!==p.id)killer.kills++;event(room,'ko',{player:p.id,name:p.name,by:killer?.id||null,killer:killer?.name||'The island'});}return true;
}
function respawn(room,p){const [x,z]=safeSpawn(room,p.id);Object.assign(p,{x,y:0,z,yaw:Math.PI,speed:0,vertical:0,health:100,mountHealth:0,kit:makeKit(),building:null,respawnAt:0,protectedUntil:room.time+3000,defenseUntil:0,speedUntil:0,heat:0,buildReadyAt:room.time+1500,input:{},inputAt:0});p.spawnSerial=(p.spawnSerial||0)+1;p.jumpRemaining=0;if(p.motion)p.motion=newMotion(room.time);event(room,'respawn',{player:p.id,x,z});}
function movePlayer(room,p,dt,input){
 const k=p.kit.stats,speed=k.speed*(room.time<p.speedUntil?2:1)*(input.sprint&&!k.mounted?1.35:1);
 moveDirect(p,input,dt,{speed,mounted:k.mounted,flying:k.movement==='fly'&&k.mounted,limit:53,height:36});
}
function applyFrames(room,p,packet,now){
 if(!p.motion||packet.motionEpoch!==(p.spawnSerial||0)||!validFrames(packet.frames))return;
 const m=p.motion;m.credit=Math.min(MAX_MOVE_FRAMES,m.credit+Math.max(0,now-m.at)/1000/MOVE_DT);m.at=now;
 for(const frame of packet.frames){if(frame[0]<=m.frame)continue;if(frame[0]!==m.frame+1||m.credit+1e-7<1)break;
  if(p.health>0)movePlayer(room,p,MOVE_DT,frameInput(frame));m.credit=Math.max(0,m.credit-1);m.frame=frame[0];
 }
}
export function predictPlayer(p,input,dt,worldState){if(p.health<=0)return;const world={...worldState,preview:true,players:{[p.id]:p},events:[],eventId:0,damage:{...worldState.damage},destroyed:{...worldState.destroyed}},controls=cleanInput(input);for(let left=Math.min(.1,dt);left>1e-8;){const step=Math.min(left,1/30);movePlayer(world,p,step,controls);left-=step;world.time+=step*1000;}}
function rand(room){let n=room.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;room.seed=n>>>0;return room.seed/4294967296;}
function shoot(room,p,input){const k=p.kit.stats;if(p.health<=0||p.building||!k.damage||room.time<p.nextShot||room.time<p.overheatedUntil||room.time<p.protectedUntil)return;
 p.nextShot=room.time+k.interval*1000;p.actionAt=room.time;
 if(k.weapon==='automatic'){p.heat+=.115;if(p.heat>=1){p.overheatedUntil=room.time+2200;p.heat=1;}}
 let yaw=input.cameraYaw??p.yaw,pitch=input.aimPitch||0;const dir={x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)},anchor={x:p.x,y:p.y+Math.max(1.2,k.collision[1]*.6),z:p.z};
 // Gentle assisted aiming includes airborne opponents, with world cover still traced.
 let target=null,best=.94;for(const enemy of Object.values(room.players)){if(enemy.id===p.id||enemy.health<=0)continue;const v={x:enemy.x-anchor.x,y:enemy.y+enemy.kit.stats.collision[1]*.5-anchor.y,z:enemy.z-anchor.z},d=Math.hypot(v.x,v.y,v.z),dot=(v.x*dir.x+v.y*dir.y+v.z*dir.z)/d;if(d<k.range&&dot>best){best=dot;target={v,d};}}
 if(target){yaw=Math.atan2(target.v.x,target.v.z);pitch=Math.asin(target.v.y/target.d);}
 if(k.projectileSpeed===0){let victim=null,bestDist=k.range;for(const other of Object.values(room.players)){if(other.id===p.id||other.health<=0)continue;const dx=other.x-p.x,dz=other.z-p.z,d=Math.hypot(dx,dz),dy=Math.abs(other.y-p.y);if(d<bestDist&&dy<3&&(dx*Math.sin(yaw)+dz*Math.cos(yaw))/Math.max(.01,d)>.1){const end={x:other.x,y:other.y+1,z:other.z};if(!solidBoxes(room).some(({box})=>segmentBox(anchor,end,box))) {victim=other;bestDist=d;}}}if(victim)hurt(room,victim,k.damage,p.id);const end={x:anchor.x+Math.sin(yaw)*k.range,y:anchor.y,z:anchor.z+Math.cos(yaw)*k.range};let cover=null;for(const item of solidBoxes(room)){const hit=segmentBox(anchor,end,item.box,[.25,.3,.25]);if(hit&&(!cover||hit.t<cover.t))cover={...item,...hit};}if(cover&&!victim)destroyCover(room,cover.entity,k.damage,p.id);event(room,'swing',{player:p.id,x:p.x,y:p.y+1,z:p.z,weapon:k.weapon});return;}
 yaw+=(rand(room)-.5)*k.spread;pitch+=(rand(room)-.5)*k.spread*.7;
 const m=p.kit.muzzle||[0,1.4,1],from={x:p.x+Math.cos(p.yaw)*m[0]+Math.sin(p.yaw)*m[2],y:p.y+Math.max(.4,m[1]),z:p.z-Math.sin(p.yaw)*m[0]+Math.cos(p.yaw)*m[2]};
 let obstruction=1;for(const {box} of solidBoxes(room)){const hit=segmentBox(anchor,from,box);if(hit)obstruction=Math.min(obstruction,Math.max(0,hit.t-.02));}for(const key of ['x','y','z'])from[key]=anchor[key]+(from[key]-anchor[key])*obstruction;
 const id=++room.eventId;room.projectiles.push({id,owner:p.id,...from,vx:Math.sin(yaw)*Math.cos(pitch)*k.projectileSpeed,vy:Math.sin(pitch)*k.projectileSpeed,vz:Math.cos(yaw)*Math.cos(pitch)*k.projectileSpeed,damage:k.damage,weapon:k.weapon,color:k.weapon==='flame'?'#ff7836':p.kit.color,expires:room.time+k.range/k.projectileSpeed*1000,range:k.range});if(room.projectiles.length>160)room.projectiles.shift();event(room,'shot',{player:p.id,weapon:k.weapon,...from});
}
function finishBuild(room,p){const kit=p.building.kit;p.building=null;
 if(kit.placementSize){const [w,h,d]=kit.placementSize;let spot=null;for(let radius=Math.max(w,d)/2+3;radius<16&&!spot;radius+=2)for(let i=0;i<16;i++){const a=p.yaw+i*Math.PI/8,x=p.x+Math.sin(a)*radius,z=p.z+Math.cos(a)*radius;if(Math.abs(x)+w/2>51||Math.abs(z)+d/2>51)continue;const candidate={x,y:h/2,z,w,h,d};if(solidBoxes(room).some(({box:b})=>Math.abs(x-b.x)<(w+b.w)/2+.5&&Math.abs(z-b.z)<(d+b.d)/2+.5&&Math.abs(h/2-b.y)<(h+b.h)/2+.5))continue;if(Object.values(room.players).some(q=>Math.abs(x-q.x)<w/2+3&&Math.abs(z-q.z)<d/2+3))continue;spot=candidate;break;}
  if(!spot){event(room,'notice',{player:p.id,text:'Move into open space to place that creation.'});return;}
  const owned=room.placed.filter(e=>e.owner===p.id);if(owned.length>=2)room.placed=room.placed.filter(e=>e.id!==owned[0].id);const id='placed:'+p.id+':'+room.eventId;room.placed.push({...spot,id,owner:p.id,blueprintId:kit.blueprintId,hp:260,color:kit.color});event(room,'built',{player:p.id,kit:kit.id,name:kit.name,placed:true});return;
 }
 p.kit=kit;p.mountHealth=kit.stats.mountMax;p.vertical=0;p.flightAltitude=p.y;p.jumpRemaining=0;event(room,'built',{player:p.id,kit:kit.id,name:kit.name});
}
function step(room,dt){
 for(const [id,until] of Object.entries(room.destroyed))if(until<=room.time){delete room.destroyed[id];event(room,'restore',{entity:id});}
 for(const p of Object.values(room.players)){if(room.time-p.lastSeen>20000){removePlayer(room,p.id);continue;}if(p.health<=0){if(room.time>=p.respawnAt)respawn(room,p);continue;}p.heat=Math.max(0,p.heat-dt*.13);if(p.building&&room.time>=p.building.ends)finishBuild(room,p);const input=room.time-p.inputAt<INPUT_STALE_MS?p.input:{};if(!p.motion)movePlayer(room,p,dt,input);if(input.fire)shoot(room,p,input);}
 const players=Object.values(room.players);
 const boxes=solidBoxes(room);for(let i=room.projectiles.length-1;i>=0;i--){const b=room.projectiles[i],end={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};let hit=null;
  for(const {entity,box} of boxes){if(room.destroyed[entity.id])continue;const h=segmentBox(b,end,box);if(h&&(!hit||h.t<hit.t))hit={...h,entity};}
  for(const p of Object.values(room.players)){if(p.id===b.owner||p.health<=0)continue;const bb=bounds(p),h=segmentBox(b,end,{x:p.x,y:p.y+bb.hy,z:p.z,w:bb.hx*2,h:bb.h,d:bb.hz*2},b.weapon==='flame'?[.45,.45,.45]:[.12,.12,.12]);if(h&&(!hit||h.t<hit.t))hit={...h,player:p};}
  if(hit){if(hit.player)hurt(room,hit.player,b.damage,b.owner);else destroyCover(room,hit.entity,b.damage,b.owner);event(room,'impact',{x:b.x+(end.x-b.x)*hit.t,y:b.y+(end.y-b.y)*hit.t,z:b.z+(end.z-b.z)*hit.t,color:b.color});room.projectiles.splice(i,1);}else if(room.time>=b.expires||end.y<0)room.projectiles.splice(i,1);else Object.assign(b,end);
 }
 if(room.time>=room.nextDrop){const i=room.dropIndex++,[x,z]=DROP_POINTS[i%DROP_POINTS.length];room.drops.push({id:'drop:'+i,type:['health','defense','speed'][i%3],x,z,born:room.time,lands:room.time+5500,expires:room.time+45000});room.nextDrop=room.time+12000;if(room.drops.length>6)room.drops.shift();}
 for(let i=room.drops.length-1;i>=0;i--){const d=room.drops[i];if(room.time>d.expires){room.drops.splice(i,1);continue;}if(room.time<d.lands)continue;const p=players.find(p=>p.health>0&&p.y<2.5&&Math.hypot(p.x-d.x,p.z-d.z)<2.3);if(p){if(d.type==='health')p.health=100;if(d.type==='defense')p.defenseUntil=room.time+10000;if(d.type==='speed')p.speedUntil=room.time+10000;event(room,'pickup',{player:p.id,pickup:d.type,x:d.x,y:1,z:d.z});room.drops.splice(i,1);}}
}
export function advanceRoom(room,now){now=Math.max(room.time,now);let elapsed=Math.max(0,now-room.time);if(elapsed>1000){room.time=now-1000;elapsed=1000;}while(elapsed>0){const ms=Math.min(1000/30,elapsed);room.time+=ms;step(room,ms/1000);elapsed-=ms;}room.time=now;return room;}
export function applyInput(room,id,packet,now,kit=null){const p=room.players[id];if(!p)throw Object.assign(Error('Your arena session expired. Join again.'),{status:410});p.lastSeen=now;if(!Number.isSafeInteger(packet.seq)||packet.seq<=p.lastSeq)return;p.lastSeq=packet.seq;p.input=cleanInput(packet.input);p.inputAt=now;applyFrames(room,p,packet,now);
 const command=packet.command;if(!command||!Number.isSafeInteger(command.id)||command.id<=p.lastCommand)return;p.lastCommand=command.id;if(p.health<=0)return;
 if(command.type==='fire')shoot(room,p,p.input);
 if(command.type==='jump')startJump(p,p.kit.stats.mounted);
 if(command.type==='exit'){dismount(room,p);return;}
 if(command.type==='build'&&kit&&!p.building&&now>=p.buildReadyAt){p.building={kit,starts:now,ends:now+2800};p.buildReadyAt=now+10000;event(room,'build',{player:p.id,kit:kit.id});}
}
export function roomSnapshot(room,self){return {epoch:room.epoch,revision:room.revision,time:room.time,self,players:Object.values(room.players).map(({input,inputAt,lastSeen,...p})=>p),projectiles:room.projectiles,drops:room.drops,destroyed:room.destroyed,damage:room.damage,placed:room.placed,events:room.events,leaderboard:Object.values(room.players).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths).map(p=>({id:p.id,name:p.name,kills:p.kills,deaths:p.deaths}))};}
