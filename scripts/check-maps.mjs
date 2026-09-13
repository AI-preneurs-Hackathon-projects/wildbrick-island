import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import {createArenaView} from '../public/arena-view.js';
import {arenaStore} from '../worker/arena-store.js';
import {handleArenaAPI} from '../worker/arena-api.js';
import * as THREE from '../public/vendor/three.module.js';
import {MAP_CYCLE,arenaMap,getMap,mapForRound} from '../public/map-catalog.js';
import {newRoom,addPlayer,advanceRoom,roomSnapshot,makeKit,movementBoxes,solidBoxes,predictPlayer,applyInput,ROUND_MS,INTERMISSION_MS} from '../public/arena-core.js';
import {canFit,isMovementBlocker,movementShape,slideMove} from '../public/movement-blocking.js';
import {moveDirect,MOVE_DT} from '../public/movement.js';
import {newMotion,packFrame} from '../public/movement-stream.js';
import {createArenaClient} from '../public/arena-client.js';
import {createWorld} from '../public/world.js';

let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
const pose=p=>({x:p.x,y:p.y,z:p.z});
function keepAlive(room,at){for(const p of Object.values(room.players))p.lastSeen=at;}
function endRound(room){keepAlive(room,room.round.endsAt);advanceRoom(room,room.round.endsAt);}
function nextRound(room){endRound(room);const at=room.round.intermissionEndsAt;keepAlive(room,at);advanceRoom(room,at);}
function fixture(mapId='island'){const room=newRoom(100000,'map-tests');room.round.mapId=mapId;const player=addPlayer(room,'a','Builder');player.motion=newMotion(room.time);return {room,player};}
const footShape=movementShape(makeKit('foot').stats);

await check('the server cycles original → beach → mountain → original only after the complete automatic intermission',()=>{
 assert.deepEqual(MAP_CYCLE,['island','beach','mountain']);
 assert.deepEqual([1,2,3,4,5,6].map(mapForRound),['island','beach','mountain','island','beach','mountain']);
 const {room,player}=fixture();
 for(const expected of ['beach','mountain','island']){
  const previous=arenaMap(room).id,id=room.round.id;
  assert.equal(room.round.endsAt-room.round.startsAt,ROUND_MS);
  endRound(room);assert.equal(room.round.status,'finished');assert.equal(arenaMap(room).id,previous);
  const boundary=room.round.intermissionEndsAt;assert.equal(boundary-room.round.endsAt,INTERMISSION_MS);
  keepAlive(room,boundary);advanceRoom(room,boundary-1);assert.equal(arenaMap(room).id,previous);assert.equal(room.round.status,'finished');
  advanceRoom(room,boundary);assert.equal(room.round.id,id+1);assert.equal(room.round.status,'active');assert.equal(arenaMap(room).id,expected);assert.equal(room.round.startsAt,boundary);
  const serial=player.spawnSerial;advanceRoom(room,boundary);assert.equal(player.spawnSerial,serial,'duplicate boundary requests must not restart twice');
 }
});

await check('late joiners, independent snapshots and persisted reconnects agree on the current authoritative map',()=>{
 const {room,player}=fixture();
 for(const expected of MAP_CYCLE){
  assert.equal(arenaMap(room).id,expected);
  const late=addPlayer(room,'late-'+expected,'Late builder');
  const first=structuredClone(roomSnapshot(room,player.id)),second=structuredClone(roomSnapshot(room,late.id));
  assert.equal(first.round.mapId,expected);assert.deepEqual(first.round,second.round);assert.deepEqual(movementBoxes(first),movementBoxes(second));
  const persisted=JSON.parse(JSON.stringify(room));advanceRoom(persisted,persisted.time+1);
  assert.equal(arenaMap(roomSnapshot(persisted,player.id)).id,expected);
  endRound(room);const spectator=addPlayer(room,'spectator-'+expected,'Spectator');assert.equal(spectator.roundId,null);
  assert.equal(roomSnapshot(room,spectator.id).round.mapId,expected);assert.equal(roomSnapshot(room,spectator.id).round.status,'finished');
  nextRound(room);assert.equal(spectator.roundId,room.round.id);
 }
});

await check('legacy persisted rooms retain their original map until a boundary, then start the new cycle without relocating early',()=>{
 for(const oldId of [1,8,23]){
  const {room,player}=fixture();room.round.id=oldId;player.roundId=oldId;delete room.round.mapId;delete room.round.mapOffset;
  const before=pose(player),persisted=JSON.parse(JSON.stringify(room));
  assert.equal(arenaMap(persisted).id,'island');assert.equal(roomSnapshot(persisted,player.id).round.mapId,'island');
  advanceRoom(persisted,persisted.time+1);assert.deepEqual(pose(persisted.players[player.id]),before);
  nextRound(persisted);assert.equal(arenaMap(persisted).id,'beach');nextRound(persisted);assert.equal(arenaMap(persisted).id,'mountain');
 }
 assert.equal(getMap('unknown-old-map').id,'island');
});

await check('new maps clear all old-map combat and creation state and reposition every loadout at a fitting spawn',()=>{
 const {room,player}=fixture();
 const dragon=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;
 const players=[player,...['car','plane','dragon'].map((mode,i)=>{const p=addPlayer(room,'mount-'+i,mode);p.kit=mode==='dragon'?makeKit('saved-dragon',dragon):makeKit(mode);p.motion=newMotion(room.time);return p;})];
 for(const p of players){p.avatarColor='#76b9ff';p.kills=7;p.deaths=3;p.spawnSerial=4;p.motion.frame=51;Object.assign(p,{x:52,y:18,z:52,speed:12,vertical:9,vy:5,jumpRemaining:.2});}
 const identity=new Map(players.map(p=>[p.id,{name:p.name,kit:structuredClone(p.kit),avatarColor:p.avatarColor}]));
 for(const expected of ['beach','mountain','island']){
  endRound(room);
  const oldEntity=arenaMap(room).entities.find(e=>e.hp>0),oldEvent=room.eventId;
  room.destroyed={[oldEntity.id]:room.time+60000};room.damage={[oldEntity.id]:17};
  room.placed=[{id:'placed:old-map',x:0,z:0,w:4,h:3,d:4,hp:90,owner:player.id}];
  room.projectiles=[{id:'old-projectile',owner:player.id}];room.drops=[{id:'old-drop',type:'health'}];
  room.events.push({id:++room.eventId,type:'impact',entity:oldEntity.id,time:room.time});
  const serials=new Map(players.map(p=>[p.id,p.spawnSerial]));
  nextRound(room);assert.equal(arenaMap(room).id,expected);
  for(const key of ['projectiles','drops','placed'])assert.deepEqual(room[key],[],key);
  assert.deepEqual(room.destroyed,{});assert.deepEqual(room.damage,{});
  assert.ok(room.events.every(e=>e.type==='round-started'&&e.id>oldEvent),'old hit/break/creation events must not replay on the new map');
  const map=arenaMap(room),boxes=movementBoxes(room);
  for(const p of players){
   assert.deepEqual({name:p.name,kit:p.kit,avatarColor:p.avatarColor},identity.get(p.id));
   assert.ok(map.spawns.some(([x,z])=>p.x===x&&p.z===z),`${expected}: ${p.id} uses a map spawn`);
   assert.ok(canFit(p,movementShape(p.kit.stats),boxes),`${expected}: ${p.kit.name} spawn overlaps cover`);
   assert.equal(p.y,0);assert.equal(p.kills,0);assert.equal(p.deaths,0);assert.equal(p.spawnSerial,serials.get(p.id)+1);assert.equal(p.motion.frame,0);assert.equal(p.speed,0);assert.equal(p.vertical,0);assert.equal(p.vy,0);assert.equal(p.jumpRemaining,0);
  }
  const before=pose(player);applyInput(room,player.id,{seq:player.lastSeq+1,roundId:room.round.id-1,motionEpoch:player.spawnSerial-1,frames:[packFrame(52,{z:1})],input:{fire:true},command:{id:99,type:'fire'}},room.time);
  assert.deepEqual(pose(player),before);assert.equal(room.projectiles.length,0);
 }
});

await check('movement, projectile cover and support drops use only the selected map descriptor',()=>{
 for(const mapId of MAP_CYCLE){
  const {room}=fixture(mapId),map=getMap(mapId),ids=new Set(map.entities.map(e=>e.id));
  assert.equal(ids.size,map.entities.length,'map entity IDs must be unique');
  assert.deepEqual(movementBoxes(room),map.entities.filter(isMovementBlocker).flatMap(e=>e.boxes));
  assert.equal(solidBoxes(room).length,map.entities.reduce((sum,e)=>sum+e.boxes.length,0));
  assert.ok(solidBoxes(room).every(({entity})=>ids.has(entity.id)));
  const cover=map.entities.find(e=>e.hp>0&&isMovementBlocker(e));room.destroyed[cover.id]=room.time+60000;
  assert.ok(solidBoxes(room).every(({entity})=>entity.id!==cover.id));assert.equal(movementBoxes(room).length,map.entities.filter(e=>isMovementBlocker(e)&&e.id!==cover.id).flatMap(e=>e.boxes).length);
  advanceRoom(room,room.time+4001);assert.equal(room.drops.length,1,`${mapId} offers a valid support drop`);
  for(const d of room.drops){assert.ok(map.dropPoints.some(([x,z])=>d.x===x&&d.z===z));assert.ok(canFit({x:d.x,y:0,z:d.z},footShape,movementBoxes(room)));assert.ok(['health','speed','defense'].includes(d.type));}
 }
});

await check('small loose ground squares can be crossed without jumping in both prediction and authoritative motion',()=>{
 for(const mapId of MAP_CYCLE){
  const {room,player}=fixture(mapId),map=getMap(mapId),loose=map.entities.filter(e=>e.kind==='loose');
  const decorations=[...loose,...(map.pieces||[]).filter(b=>b.h<.3&&b.w<=2&&b.d<=2&&b.w/b.d>.5&&b.w/b.d<2).map((b,i)=>({id:'painted-tile:'+i,boxes:[b]}))];assert.ok(decorations.length>0,mapId);
  assert.ok(loose.every(e=>!isMovementBlocker(e)&&e.boxes.every(b=>b.h<.3)),'only the low decorative squares are exempt');
  const boxes=movementBoxes(room);let crossed=0;
  for(const e of decorations){
   const b=e.boxes[0],distance=b.w/2+footShape.radius+.25,start={x:b.x-distance,y:0,z:b.z},end={x:b.x+distance,y:0,z:b.z};
   if(!canFit(start,footShape,boxes)||!canFit(end,footShape,boxes))continue;
   if(Math.abs(slideMove(start,end,footShape,boxes).x-end.x)>1e-8)continue;
   Object.assign(player,{...start,yaw:Math.PI/2,vy:0,grounded:true,jumpRemaining:0});delete player.motion;
   const prediction=structuredClone(player),steps=Math.ceil(2*distance/(player.kit.stats.speed*MOVE_DT));
   for(let i=0;i<steps;i++){
    const input={z:1,cameraYaw:Math.PI/2};predictPlayer(prediction,input,MOVE_DT,room);
    applyInput(room,player.id,{seq:player.lastSeq+1,input},room.time);advanceRoom(room,room.time+1000*MOVE_DT);
    for(const key of ['x','y','z'])assert.ok(Math.abs(player[key]-prediction[key])<1e-6,`${mapId}: prediction/server ${key}`);
    assert.equal(player.y,0,'walking over decoration must not need or imply a jump');
   }
   assert.ok(player.x>b.x+b.w/2,`${mapId}: failed to cross ${e.id}`);crossed++;if(crossed===3)break;
  }
  assert.ok(crossed>0,`${mapId}: at least one actual square has an accessible crossing`);
 }
});

await check('the beach and mountain central routes admit continuous on-foot, car and flight traversal',()=>{
 for(const [mapId,z] of [['beach',9],['mountain',0]])for(const mode of ['foot','car','plane']){
  const {room,player}=fixture(mapId),y=mode==='plane'?20:0;
  Object.assign(player,{kit:makeKit(mode),x:-43,y,z,yaw:Math.PI/2,vy:0,jumpRemaining:0,grounded:mode!=='plane'});
  const shape=movementShape(player.kit.stats),boxes=movementBoxes(room);assert.ok(canFit(player,shape,boxes),`${mapId}/${mode}: route entrance must fit`);
  for(let i=0;i<1200;i++){
   predictPlayer(player,player.x<42?{z:1,cameraYaw:Math.PI/2}:{},MOVE_DT,{...room,time:room.time+i*1000*MOVE_DT});
   assert.ok(Math.abs(player.y-y)<1e-8,`${mapId}/${mode}: route does not require a jump or unexpected altitude change`);
   assert.ok(Math.abs(player.z-z)<1e-8,`${mapId}/${mode}: straight route does not require a detour`);
  }
  assert.ok(player.x+43>=84,`${mapId}/${mode}: traveled only ${(player.x+43).toFixed(2)}m of the central route`);
  assert.ok(canFit(player,shape,boxes),`${mapId}/${mode}: exit remains clear`);
 }
});

await check('substantial colored props still stop horizontal motion and support landing on top in every map',()=>{
 for(const mapId of MAP_CYCLE){
  const map=getMap(mapId),substantial=map.entities.filter(e=>e.kind!=='loose'&&e.boxes.some(b=>b.h>=1));assert.ok(substantial.length>5,mapId);
  for(const e of substantial){assert.equal(isMovementBlocker(e),true,e.id);const b=e.boxes.find(b=>b.h>=1),c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0),distance=b.w/2+footShape.radius+1,y=Math.max(0,b.y-b.h/2+.001);
   const start={x:b.x-distance*c,y,z:b.z+distance*s},end={x:b.x+distance*c,y,z:b.z-distance*s};
   const stopped=slideMove(start,end,footShape,[b]);assert.ok((stopped.x-b.x)*c-(stopped.z-b.z)*s<0,e.id);assert.ok(canFit(stopped,footShape,[b]));
  }
  const boxes=map.entities.filter(isMovementBlocker).flatMap(e=>e.boxes),candidates=boxes.filter(b=>b.w>1&&b.d>1&&b.y+b.h/2<8);
  const support=candidates.find(b=>canFit({x:b.x,y:b.y+b.h/2,z:b.z},footShape,boxes));assert.ok(support,`${mapId}: has an exposed prop top`);
  const p={x:support.x,y:support.y+support.h/2+1,z:support.z,vy:0};
  for(let i=0;i<120;i++)moveDirect(p,{},MOVE_DT,{speed:7,shape:footShape,boxes});
  assert.ok(Math.abs(p.y-(support.y+support.h/2))<1e-8);assert.equal(p.grounded,true);
 }
});

await check('sky ring apertures remain traversable while their actual rim remains solid',()=>{
 let total=0;
 for(const mapId of MAP_CYCLE){
  for(const ring of getMap(mapId).entities.filter(e=>e.kind==='ring')){
   const b=ring.boxes,center={x:b.reduce((n,v)=>n+v.x,0)/b.length,y:b.reduce((n,v)=>n+v.y,0)/b.length,z:b.reduce((n,v)=>n+v.z,0)/b.length},yaw=b[0].yaw||0,dx=Math.sin(yaw)*3,dz=Math.cos(yaw)*3;
   const shape=movementShape(makeKit('plane').stats),start={x:center.x-dx,y:center.y-shape.height/2,z:center.z-dz,yaw},end={x:center.x+dx,y:start.y,z:center.z+dz};
   assert.deepEqual(slideMove(start,end,shape,b),end,`${mapId}: ${ring.id} aperture`);
   assert.ok(!canFit({x:b[0].x,y:b[0].y,z:b[0].z},footShape,b),'rim is still physical');total++;
  }
 }
 assert.ok(total>0);
});

await check('a live client discards queued old-map prediction, loads the authoritative map and a reconnect joins that same map',async()=>{
 const {room,player}=fixture();let now=room.time,timerId=0;const timers=new Map(),packets=[],errors=[];
 const runtime={clock:()=>now,setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async(path,options)=>{
  const packet=options.body?JSON.parse(options.body):{};packets.push({path,packet});room.revision++;
  if(path.endsWith('/sync'))applyInput(room,player.id,packet,room.time);
  const snapshot=structuredClone(roomSnapshot(room,player.id));
  return {ok:true,status:200,json:async()=>path.endsWith('/join')?{room:'ISLAND',session:player.id,token:'fixture',snapshot}:path.endsWith('/leave')?{}:{snapshot}};
 }};
 const client=createArenaClient({onError:e=>errors.push(e)},runtime);assert.equal(await client.join('Builder'),true);
 client.tick(MOVE_DT,{z:1});const oldPose=pose(client.self);client.command('fire');
 nextRound(room);now=room.time;const spawn=pose(player),sync=[...timers].find(([,t])=>t.ms<1000);assert.ok(sync);timers.delete(sync[0]);await sync[1].fn();
 assert.equal(client.snapshot.round.mapId,'beach');assert.deepEqual(pose(client.self),spawn);assert.notDeepEqual(spawn,oldPose);assert.equal(client.self.motion.frame,0);
 client.tick(MOVE_DT,{});const following=[...timers].find(([,t])=>t.ms<1000);timers.delete(following[0]);await following[1].fn();
 const packet=packets.filter(p=>p.path.endsWith('/sync')).at(-1).packet;assert.equal(packet.motionEpoch,player.spawnSerial);assert.equal(packet.roundId,room.round.id);assert.ok(packet.frames.every(f=>f[0]===1));assert.equal(packet.command,undefined,'old-map attack commands must not replay');
 const reconnected=createArenaClient({},runtime);assert.equal(await reconnected.join('Builder'),true);assert.equal(reconnected.snapshot.round.mapId,client.snapshot.round.mapId);assert.deepEqual(pose(reconnected.self),pose(player));
 await client.leave();await reconnected.leave();assert.deepEqual(errors,[]);
});

await check('map preparation precedes new-map events so a delayed transition retains the confirmed punch animation',async()=>{
 const dom=new JSDOM(''),previousDocument=globalThis.document;globalThis.document=dom.window.document;
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
 const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),{room,player}=fixture();
 const rival=addPlayer(room,'rival','Rival');rival.motion=newMotion(room.time);
 let now=room.time,timerId=0,mapId=null;const timers=new Map(),order=[];
 const runtime={clock:()=>now,setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async path=>{
  room.revision++;const snapshot=structuredClone(roomSnapshot(room,player.id));
  return {ok:true,status:200,json:async()=>path.endsWith('/join')?{room:'ISLAND',session:player.id,token:'fixture',snapshot}:path.endsWith('/leave')?{}:{snapshot}};
 }};
 const client=createArenaClient({onSnapshot:s=>{order.push('snapshot:'+s.round.mapId);if(mapId!==s.round.mapId){mapId=s.round.mapId;view.clear();}},onEvent:e=>{order.push('event:'+e.type);if(e.type==='round-started'||e.type==='round-ended')view.clear();else view.effect(e);}},runtime);
 try{
  assert.equal(await client.join('Builder'),true);view.update(client.snapshot,client.self,client.blueprints,MOVE_DT,room.time);order.length=0;
  nextRound(room);const arrivedAt=room.time+4000;keepAlive(room,arrivedAt);advanceRoom(room,arrivedAt);now=room.time;
  applyInput(room,rival.id,{seq:1,roundId:room.round.id,command:{id:1,type:'fire'}},room.time);
  assert.ok(room.events.some(e=>e.type==='swing'&&e.player===rival.id));
  const sync=[...timers].find(([,t])=>t.ms<1000);timers.delete(sync[0]);await sync[1].fn();
  assert.equal(order[0],'snapshot:beach','world clearing must happen before delivering this map’s events');assert.ok(order.includes('event:swing'));
  view.update(client.snapshot,client.self,client.blueprints,MOVE_DT,room.time+130);
  const arm=scene.getObjectByName('arena-player:'+rival.id).getObjectByName('right-arm');assert.ok(arm.rotation.x< -1,'the confirmed new-map punch survives world clearing');
 }finally{await client.leave();view.clear();dom.window.close();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

await check('an old-round build response cannot replace the retained model cache, and a later accepted build loads server-identified geometry',async()=>{
 const retained=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;
 const proposed=JSON.parse(fs.readFileSync(new URL('../validation/live/octopus.json',import.meta.url))).blueprint;
 const {room,player}=fixture();player.kit=makeKit('saved-dragon',retained);
 let now=room.time,timerId=0,crossBoundary=true;const timers=new Map(),requests=[],errors=[],saved=new Map([['saved-dragon',retained]]);
 const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
 const runtime={clock:()=>now,setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async(path,options)=>{
  const packet=options.body?JSON.parse(options.body):{};requests.push({path,packet});
  if(path.includes('/blueprint')){const id=new URL(path,'https://fixture.test').searchParams.get('id');assert.ok(saved.has(id),'only server-identified models are requested');return {ok:true,status:200,json:async()=>({blueprint:structuredClone(saved.get(id))})};}
  if(path.endsWith('/build')){
   if(crossBoundary){nextRound(room);now=room.time;crossBoundary=false;}
   else saved.set('accepted-octopus',proposed);
   applyInput(room,player.id,packet,room.time,makeKit('accepted-octopus',proposed));
  }else if(path.endsWith('/sync'))applyInput(room,player.id,packet,room.time);
  room.revision++;const snapshot=structuredClone(roomSnapshot(room,player.id));
  return {ok:true,status:200,json:async()=>path.endsWith('/join')?{room:'ISLAND',session:player.id,token:'fixture',snapshot}:path.endsWith('/leave')?{}:{snapshot}};
 }};
 const client=createArenaClient({onError:e=>errors.push(e)},runtime);
 const sync=async()=>{const pending=[...timers].find(([,t])=>t.ms<1000);assert.ok(pending);timers.delete(pending[0]);await pending[1].fn();await flush();};
 try{
  assert.equal(await client.join('Builder'),true);await flush();const originalCache=structuredClone(client.blueprints.get('saved-dragon'));assert.equal(originalCache.name,retained.name);
  assert.equal(client.command('build','generated',proposed),true);await sync();
  assert.equal(room.round.mapId,'beach');assert.equal(player.kit.id,'saved-dragon');assert.equal(player.building,null,'the old-round build command was rejected');
  assert.equal(client.self.kit.id,'saved-dragon');assert.deepEqual(client.blueprints.get('saved-dragon'),originalCache,'unaccepted octopus must not overwrite the retained dragon model');
  assert.equal(requests.filter(r=>r.path.includes('/blueprint')).length,1,'preserved cached loadout needs no duplicate fetch');
  assert.equal(client.command('build','generated',proposed),true);await sync();
  assert.equal(player.building.kit.id,'accepted-octopus');assert.equal(client.blueprints.get('accepted-octopus').name,proposed.name);
  assert.deepEqual(client.blueprints.get('saved-dragon'),originalCache);assert.deepEqual(requests.filter(r=>r.path.includes('/blueprint')).map(r=>new URL(r.path,'https://fixture.test').searchParams.get('id')),['saved-dragon','accepted-octopus']);
  const at=room.time+1300;keepAlive(room,at);advanceRoom(room,at);now=room.time;await sync();assert.equal(player.kit.id,'accepted-octopus');assert.equal(client.self.kit.id,'accepted-octopus');assert.equal(client.blueprints.get(client.self.kit.blueprintId).name,proposed.name);assert.deepEqual(errors,[]);
 }finally{await client.leave();}
});

await check('replacing all three rendered worlds removes old geometry and preserves unrelated scene objects',()=>{
 const scene=new THREE.Scene(),retained=new THREE.Group();scene.add(retained);
 for(const id of [...MAP_CYCLE,'island']){
  const world=createWorld(scene,id),map=getMap(id);
  assert.ok(scene.children.length>1);assert.ok(world.entityGroups.size>0);assert.equal(typeof world.dispose,'function');
  const ids=new Set(map.entities.map(e=>e.id));assert.ok(world.obstacles.every(b=>ids.has(b.id)));assert.equal(world.obstacles.length,map.entities.flatMap(e=>e.boxes).length);
  assert.deepEqual(world.obstacles.filter(isMovementBlocker).map(({x,y,z,w,h,d,yaw})=>({x,y,z,w,h,d,yaw})),map.entities.filter(isMovementBlocker).flatMap(e=>e.boxes).map(({x,y,z,w,h,d,yaw})=>({x,y,z,w,h,d,yaw})));
  world.setDestroyed([map.entities.find(e=>e.hp>0).id]);world.setDestroyed([]);world.dispose();assert.deepEqual(scene.children,[retained]);
 }
});
await check('SQLite-backed API rejects stale map clients before movement or attacks and accepts updated reconnects and late joins',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  for(const name of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  const DB={prepare(sql){return {bind(...args){return {async first(){await Promise.resolve();return sqlite.prepare(sql).get(...args)||null;},async run(){await Promise.resolve();const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};}};}};
  const api=(path,body,principal='fixture-owner')=>handleArenaAPI(new Request('https://brickwild.test/api/arena/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://brickwild.test','oai-authenticated-user-id':principal},body:JSON.stringify(body)}),{DB});
  const initial=await api('join',{name:'Legacy',room:'MAPTEST',motionVersion:1});assert.equal(initial.status,200);
  const joined=await initial.json(),credentials={session:joined.session,token:joined.token};assert.equal(joined.snapshot.round.mapId,'island');
  const store=arenaStore(DB);await store.mutate('MAPTEST',r=>{r.round.status='finished';r.round.intermissionEndsAt=r.time-1;});
  const refresh=await api('sync',{...credentials,seq:1,mapVersion:1,input:{}});assert.equal(refresh.status,200);const beach=(await refresh.json()).snapshot;assert.equal(beach.round.mapId,'beach');
  const readRoom=()=>JSON.parse(sqlite.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').get('MAPTEST').snapshot);
  const before=readRoom(),player=before.players[joined.snapshot.self];
  for(const command of [{id:1,type:'fire'},{id:2,type:'build',mode:'plane'}]){
   const stale=await api('sync',{...credentials,seq:2,roundId:beach.round.id,motionEpoch:player.spawnSerial,frames:[packFrame(1,{z:1})],input:{z:1,fire:true},command});
   assert.equal(stale.status,410);assert.match((await stale.json()).error,/refresh/i);
   const after=readRoom();assert.deepEqual(after.players,before.players,'rejected stale client cannot move, attack, change health or start building');assert.deepEqual(after.damage,before.damage);assert.deepEqual(after.projectiles,before.projectiles);
  }
  const sessions=sqlite.prepare('SELECT COUNT(*) AS count FROM arena_sessions').get().count;
  const oldJoin=await api('join',{name:'Old late join',room:'MAPTEST',motionVersion:1},'old-late');assert.equal(oldJoin.status,410);assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM arena_sessions').get().count,sessions,'rejected joins do not leak a reserved session');
  const reconnect=await api('join',{name:'Refreshed',room:'MAPTEST',motionVersion:1,mapVersion:1,resume:credentials});assert.equal(reconnect.status,200);
  const resumed=await reconnect.json();assert.equal(resumed.snapshot.self,joined.snapshot.self);assert.equal(resumed.snapshot.round.mapId,'beach');
  const late=await api('join',{name:'Current late join',room:'MAPTEST',motionVersion:1,mapVersion:1},'new-late');assert.equal(late.status,200);
  const current=await late.json();assert.equal(current.snapshot.round.mapId,'beach');assert.equal(current.snapshot.round.endsAt,resumed.snapshot.round.endsAt);
  assert.ok(current.snapshot.players.some(p=>p.id===resumed.snapshot.self));
  await api('leave',credentials);await api('leave',{session:current.session,token:current.token},'new-late');
 }finally{sqlite.close();}
});
console.log(`\n${checks} map rotation, collision, client transition, rendering and SQLite API checks passed.`);
