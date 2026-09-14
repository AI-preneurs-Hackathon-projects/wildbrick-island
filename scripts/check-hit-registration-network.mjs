// Two real Arena clients, authenticated API/session paths and isolated SQLite D1
// fixtures. Scene-graph feedback is checked; this is NOT two browser/WebGL play.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {JSDOM} from 'jsdom';
import * as THREE from '../public/vendor/three.module.js';
import {createArenaClient} from '../public/arena-client.js';
import {createArenaView} from '../public/arena-view.js';
import {makeKit,attackBlockReason,advanceRoom} from '../public/arena-core.js';
import {newMotion} from '../public/movement-stream.js';
import {WORLD_ENTITIES} from '../public/world-data.js';
import {arenaStore} from '../worker/arena-store.js';
import {handleArenaAPI} from '../worker/arena-api.js';
const dom=new JSDOM('');globalThis.document=dom.window.document;
dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
const saved=JSON.parse(fs.readFileSync(new URL('../validation/live/final-compact-none/armed-car.json',import.meta.url))).blueprint,pulse={...saved,movement:'carry',traits:{...saved.traits,weapon:'pulse'}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){const end=performance.now()+6000;while(!fn()){if(performance.now()>end)throw Error('Timed out: '+label);await wait(10);}}
for(const rtt of [50,150,300]){
 const sqlite=new DatabaseSync(':memory:');for(const name of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 let conflicts=0,shiftTarget=null;
 const DB={prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){if(conflicts&&sql.startsWith('UPDATE arena_rooms SET snapshot')){conflicts--;return {meta:{changes:0}};}const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
 const store=arenaStore(DB),read=()=>JSON.parse(sqlite.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').get('TEST').snapshot);
 const peers=[];
 function peer(user){
  const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),events=[],markers=new Map(),errors=[];
  let dropNext=false,dropped=0,fireRequests=0;
  const client=createArenaClient({onEvent:e=>{events.push(e);view.effect(e);},onError:e=>errors.push(e)},{fetcher:async(path,options)=>{
   await wait(rtt/2);const body=JSON.parse(options.body||'{}');if(body.command?.type==='fire'){fireRequests++;if(shiftTarget){const id=shiftTarget;shiftTarget=null;await store.mutate('TEST',r=>{r.players[id].z=10;});}}
   // Identity is injected ONLY at this isolated trusted test boundary. Production
   // still requires Sites authentication and verifies principal + session token.
   const response=await handleArenaAPI(new Request('https://brickwild.test'+path,{...options,headers:{...options.headers,Origin:'https://brickwild.test','oai-authenticated-user-id':user}}),{DB});
   await wait(rtt/2);if(dropNext&&body.command?.type==='fire'&&response.ok){dropNext=false;dropped++;throw Error('fixture: lost committed response');}return response;
  }});
  let previous=new Set();const timer=setInterval(()=>{client.tick(.01,{});if(!client.snapshot)return;view.update(client.snapshot,client.self,client.blueprints,.01,client.serverTime());const current=new Set();scene.traverse(o=>{if(o.name.startsWith('impact:'))current.add(o.name);});for(const id of current)if(!previous.has(id))markers.set(id,(markers.get(id)||0)+1);previous=current;},10);
  const result={client,view,scene,events,markers,errors,timer,lose:()=>dropNext=true,get dropped(){return dropped;},get fireRequests(){return fireRequests;}};peers.push(result);return result;
 }
 const a=peer('test-shooter'),b=peer('test-target');
 try{
  assert.deepEqual(await Promise.all([a.client.join('Shooter','TEST'),b.client.join('Target','TEST')]),[true,true]);
  await store.mutate('TEST',r=>{r.round.lobbyEndsAt=r.time;for(const player of Object.values(r.players))player.lastSeen=r.time+1;advanceRoom(r,r.time+1);});
  await until(()=>peers.every(p=>p.client.snapshot?.round?.status==='active'),'shared lobby countdown completed');
  const shooter=a.client.snapshot.self,target=b.client.snapshot.self;
  // Verify the actual endpoint rejects anonymous requests and crossed principals.
  assert.equal((await handleArenaAPI(new Request('https://brickwild.test/api/arena/sync',{method:'POST',body:'{}'}),{DB})).status,401);
  const session=sqlite.prepare('SELECT id FROM arena_sessions WHERE player_id = ?').get(shooter);
  assert.equal((await handleArenaAPI(new Request('https://brickwild.test/api/arena/sync',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'test-target'},body:JSON.stringify({session:session.id,token:'a'.repeat(64),seq:1})}),{DB})).status,401);
  for(const weapon of ['bow','foot','pulse']){
   if(weapon==='pulse')for(const peer of peers)peer.client.blueprints.set('fixture:pulse',pulse);
   await store.mutate('TEST',(r,t)=>{for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;r.nextDrop=t+1e9;for(const [id,z] of [[shooter,0],[target,weapon==='bow'?.9:weapon==='pulse'?5:0]]){const p=r.players[id];Object.assign(p,{x:0,y:0,z,yaw:0,health:100,mountHealth:0,kit:id===shooter&&weapon==='pulse'?makeKit('fixture:pulse',pulse):makeKit(id===shooter?weapon:'foot'),protectedUntil:0,nextShot:0,input:{},melee:null});if(weapon==='pulse')p.kit.stats.spread=0;p.spawnSerial=(p.spawnSerial||0)+1;p.motion=newMotion(t);}});
   const epoch=read().players[shooter].spawnSerial;
   await until(()=>peers.every(p=>p.client.snapshot.players.find(q=>q.id===shooter)?.spawnSerial===epoch),'fixture delivered to both clients');
   assert.equal(attackBlockReason(read(),read().players[shooter]),null);
   const before=read().eventId;if(weapon==='pulse')shiftTarget=target;conflicts=1;a.lose();const previews=a.events.filter(e=>e.type==='attack-preview').length;
   assert.equal(a.client.command('fire'),true);assert.equal(a.events.filter(e=>e.type==='attack-preview').length,previews+1,'immediate local preview');
   await until(()=>peers.every(p=>p.events.some(e=>e.id>before&&e.type==='hit'&&e.player===target)),'confirmed hit delivered to both');
   const room=read(),hits=room.events.filter(e=>e.id>before&&e.type==='hit');assert.equal(hits.length,1);const hit=hits[0];
   assert.equal(room.players[target].health,weapon==='bow'?78.4:weapon==='pulse'?85.6:75.7);assert.equal(room.players[shooter].health,100);
   await until(()=>peers.every(p=>p.markers.has('impact:'+hit.attack)),'both scene graphs display contact');
   await wait(500);
   for(const p of peers){assert.equal(p.events.filter(e=>e.id===hit.id).length,1);assert.equal(p.markers.get('impact:'+hit.attack),1);assert.equal(p.client.snapshot.players.find(q=>q.id===target).health,room.players[target].health);}
   assert.equal(read().events.filter(e=>e.id>before&&e.type==='hit').length,1);assert.equal(a.dropped,weapon==='bow'?1:weapon==='pulse'?3:2);assert.equal(conflicts,0);
   if(weapon==='pulse'){const preview=a.events.findLast(e=>e.type==='attack-preview'),shot=room.events.find(e=>e.id>before&&e.type==='shot');assert.ok(shot.aimYaw<preview.aimYaw,'server uses rival moved from 5m to 10m during request delay');assert.equal(room.players[target].z,10);}
   console.log(`PASS ${rtt}ms injected RTT ${weapon}: 2 authenticated fixture clients, CAS retry, lost response, immediate preview, 1 damage event and 1 scene-graph marker per client`);
  }
  assert.ok(a.fireRequests>=6,'all three committed fire commands retried');assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
 }finally{for(const p of peers)clearInterval(p.timer);await Promise.all(peers.map(p=>p.client.leave()));await wait(rtt+150);for(const p of peers)p.view.clear();sqlite.close();}
}
dom.window.close();delete globalThis.document;
console.log('No production requests, state resets, paid generation, browser pixels or live network measurements.');
