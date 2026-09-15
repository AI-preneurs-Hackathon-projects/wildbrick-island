import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createRealtimeTicket} from '../server/realtime-ticket.js';
import {createLocalRealtimeDb} from '../realtime/local-db.js';
import {RealtimeRoomStore} from '../realtime/room-store.js';
import {RedisArenaBridge} from '../realtime/redis-bridge.js';

class FakeRedisBackend {
  constructor(){this.values=new Map();this.streams=new Map();this.sequence=0;this.waiters=new Set();}
  wake(){for(const wake of this.waiters)wake();this.waiters.clear();}
}

class FakeRedis {
  constructor(backend=new FakeRedisBackend()){this.backend=backend;this.closed=false;}
  duplicate(){return new FakeRedis(this.backend);}
  async get(key){const item=this.backend.values.get(key);if(!item||item.expires<=Date.now()){this.backend.values.delete(key);return null;}return item.value;}
  async set(key,value,...args){if(args.includes('NX')&&await this.get(key))return null;const px=args.indexOf('PX'),ttl=px>=0?Number(args[px+1]):60000;this.backend.values.set(key,{value,expires:Date.now()+ttl});return 'OK';}
  async eval(script,_count,key,token,ttl){const item=this.backend.values.get(key);if(!item||item.value!==token||item.expires<=Date.now())return 0;if(script.includes("redis.call('del'")){this.backend.values.delete(key);return 1;}item.expires=Date.now()+Number(ttl);return 1;}
  async pexpire(){return 1;}
  async xadd(key,...args){const id=`${++this.backend.sequence}-0`,fieldStart=args.indexOf('*')+1,flat=args.slice(fieldStart);const stream=this.backend.streams.get(key)||[];stream.push([id,flat]);const maxIndex=args.indexOf('~'),limit=maxIndex>=0?Number(args[maxIndex+1]):Infinity;if(stream.length>limit*1.2)stream.splice(0,stream.length-limit);this.backend.streams.set(key,stream);this.backend.wake();return id;}
  async xrevrange(key,_max,_min,_count,_one){const stream=this.backend.streams.get(key)||[];return stream.length?[stream.at(-1)]:[];}
  async xread(...args){const key=args.at(-2),cursor=args.at(-1),read=()=>{const entries=(this.backend.streams.get(key)||[]).filter(([id])=>Number(id.split('-')[0])>Number(cursor.split('-')[0]));return entries.length?[[key,entries]]:null;};let found=read();if(found)return found;await new Promise(resolve=>{const timer=setTimeout(()=>{this.backend.waiters.delete(wake);resolve();},50),wake=()=>{clearTimeout(timer);resolve();};this.backend.waiters.add(wake);});return read();}
  async quit(){this.closed=true;this.backend.wake();return 'OK';}
}

class MockSocket extends EventEmitter {
  constructor(){super();this.readyState=WebSocket.OPEN;this.bufferedAmount=0;this.messages=[];this.waiters=[];}
  send(data){this.messages.push(JSON.parse(String(data)));for(const wake of this.waiters.splice(0))wake();}
  close(code=1000,reason=''){if(this.readyState===WebSocket.CLOSED)return;this.readyState=WebSocket.CLOSED;queueMicrotask(()=>this.emit('close',code,Buffer.from(reason)));for(const wake of this.waiters.splice(0))wake();}
  client(message){this.emit('message',Buffer.from(JSON.stringify(message)),false);}
  async waitFor(predicate,timeout=3000){const started=Date.now();while(Date.now()-started<timeout){const index=this.messages.findIndex(predicate);if(index>=0)return this.messages.splice(index,1)[0];await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const index=this.waiters.indexOf(wake);if(index>=0)this.waiters.splice(index,1);reject(new Error('timeout'));},100),wake=()=>{clearTimeout(timer);resolve();};this.waiters.push(wake);}).catch(()=>{});}throw new Error('Timed out waiting for bridged message');}
}

const origin='https://brickwild.test',secret='vercel-redis-bridge-secret-'.repeat(2),local=createLocalRealtimeDb(),redis=new FakeRedis(),now=Date.now,namespace='brickwild:preview-fixture';
const firstBridge=new RedisArenaBridge({redis:redis.duplicate(),store:new RealtimeRoomStore(local.db,{ownerId:'vercel:first'}),ticketSecret:secret,instanceId:'first',namespace,now,ownerMaxAgeMs:1_000});
const secondBridge=new RedisArenaBridge({redis:redis.duplicate(),store:new RealtimeRoomStore(local.db,{ownerId:'vercel:second'}),ticketSecret:secret,instanceId:'second',namespace,now});
const ticket=(principal,create)=>createRealtimeTicket({principal,room:'VR01',create,origin,secret,jti:randomUUID()}).ticket;
const connect=async(bridge,principal,create,resume)=>{const socket=new MockSocket();bridge.register(socket,origin);socket.client({type:'authenticate',ticket:ticket(principal,create)});await socket.waitFor(message=>message.type==='authenticated');socket.client({type:'join',requestId:1,name:principal,room:'VR01',create,avatarColor:'#ffcf55',resume,motionVersion:2,mapVersion:1});const joined=await socket.waitFor(message=>message.type==='joined');return {socket,joined};};
const waitFor=async predicate=>{for(let attempt=0;attempt<300;attempt++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Timed out waiting for bridge lifecycle');};

try{
  const first=await connect(firstBridge,'test:first',true),second=await connect(secondBridge,'test:second',false);
  const inputStream=redis.backend.streams.get(`${namespace}:VR01:input`),firstEnvelope=JSON.parse(inputStream[0][1][1]);
  assert.equal(firstEnvelope.raw.includes('authenticate'),true,'fixture captures the relayed admission envelope');
  await firstBridge.processEnvelope('VR01',firstEnvelope);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(first.socket.messages.some(message=>message.type==='error'),false,'a replayed Redis envelope is discarded before protocol authority');
  first.socket.client({type:'start',requestId:2});
  await first.socket.waitFor(message=>message.type==='result'&&message.requestId===2);
  const before=second.joined.snapshot.players.find(player=>player.id===first.joined.snapshot.self);
  first.socket.client({type:'input',seq:1,roundId:1,input:{z:1,cameraYaw:0},afterEvent:0});
  const moved=await second.socket.waitFor(message=>{if(message.type!=='snapshot')return false;const player=message.snapshot.players.find(player=>player.id===first.joined.snapshot.self);return player?.lastSeq===1&&Math.hypot(player.x-before.x,player.z-before.z)>.01;});
  const after=moved.snapshot.players.find(player=>player.id===first.joined.snapshot.self);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.01,'one fenced owner advances input relayed from another Function instance');
  assert.equal(firstBridge.owners.size+secondBridge.owners.size,1,'Redis lease elects exactly one room owner');
  assert.ok(firstBridge.owners.get('VR01').releaseTimer,'the Vercel owner has a proactive lifecycle release timer');
  assert.ok([...redis.backend.values.keys(),...redis.backend.streams.keys()].every(key=>key.startsWith(`${namespace}:`)),'every relay key is isolated under the configured preview namespace');
  assert.throws(()=>new RedisArenaBridge({redis,store:new RealtimeRoomStore(local.db),ticketSecret:secret,namespace:'unsafe namespace'}),/namespace/,'unsafe namespaces are rejected before Redis use');
  assert.equal(moved.snapshot.round.status,'active');
  await waitFor(async()=>firstBridge.owners.size===0&&(await firstBridge.store.roomRow('VR01')).owner_id===null);
  const resumed=await connect(secondBridge,'test:first',true,{session:first.joined.session,token:first.joined.token});
  assert.equal(resumed.joined.snapshot.self,first.joined.snapshot.self,'a live relay takes over the released room with a full resumed seat');
  assert.equal(secondBridge.owners.size,1,'the replacement relay becomes the single owner');
  console.log('Vercel Redis bridge: cross-instance join, single-owner election, deduplication, owner lifecycle handoff, 20 Hz snapshot fanout, and movement passed.');
}finally{await Promise.all([firstBridge.close(),secondBridge.close()]);local.close();}
