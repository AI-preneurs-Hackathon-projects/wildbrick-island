import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRealtimeArenaClient} from '../public/realtime-arena-client.js';
import {createArenaClient} from '../public/arena-client.js';
import {joinPlayer,newRoom,roomSnapshot} from '../public/arena-core.js';

class MemoryStorage {
  constructor(){this.values=new Map();}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}

const joins=[];
class FakeSocket {
  static OPEN=1;
  constructor(){this.readyState=FakeSocket.OPEN;this.bufferedAmount=0;queueMicrotask(()=>this.onopen?.());}
  send(raw){const packet=JSON.parse(raw);if(packet.type==='authenticate')return queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'authenticated'})}));if(packet.type==='join'){joins.push(packet);const room=newRoom(1000,'client-test'),player=joinPlayer(room,'trusted-player','Tester',1000);player.motion={version:2,frame:0,at:1000};const credential=packet.resume;return queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'joined',requestId:packet.requestId,room:packet.room,session:credential.session,token:credential.token,snapshot:roomSnapshot(room,player.id)})}));}if(packet.type==='leave')return queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'result',requestId:packet.requestId})}));}
  close(){if(this.readyState!==FakeSocket.OPEN)return;this.readyState=3;queueMicrotask(()=>this.onclose?.());}
}

const storage=new MemoryStorage(),runtime={WebSocket:FakeSocket,resumeStorage:storage,baseUrl:'https://brickwild.test',getTicket:async()=>({enabled:true,transport:'realtime-v1',url:'wss://arena.test'})};
const first=createRealtimeArenaClient({},runtime);
assert.equal(await first.join('Tester','KEEP01','#ffcf55',false),true);
const persisted=joins[0].resume;
first.tick(1/60,{});

// A page refresh creates a new client but keeps sessionStorage in the tab.
const refreshed=createRealtimeArenaClient({},runtime);
assert.equal(await refreshed.join('Tester','KEEP01','#ffcf55',false),true);
assert.deepEqual(joins[1].resume,persisted,'refresh reuses the authenticated seat credential');
await refreshed.leave();
assert.equal(storage.getItem('brickwild.arena.resume.v1:KEEP01'),null,'explicit leave clears the refresh credential');
await first.leave();

const main=fs.readFileSync(new URL('../public/main.js',import.meta.url),'utf8');
assert.doesNotMatch(main,/pagehide[^\n]*arena\.leave\(/,'page refresh is not sent as an explicit Arena leave');

class ClosingSocket {
 static OPEN=1;
 constructor(){this.readyState=ClosingSocket.OPEN;queueMicrotask(()=>this.onopen?.());}
 send(raw){if(JSON.parse(raw).type==='authenticate')queueMicrotask(()=>this.onclose?.());}
 close(){this.readyState=3;}
}
let fallbackResume=null;
const knownResume={session:'10000000-0000-4000-8000-000000000001',token:'1'.repeat(64)},fallbackStorage=new MemoryStorage();
fallbackStorage.setItem('brickwild.arena.resume.v1:FALL01',JSON.stringify(knownResume));
const fallbackRoom=newRoom(2000,'fallback-test'),fallbackPlayer=joinPlayer(fallbackRoom,'fallback-player','Fallback',2000);
fallbackPlayer.motion={version:1,frame:0,credit:6,at:2000};
const fallbackErrors=[];
const fallback=createArenaClient({onError:error=>fallbackErrors.push(error)}, {realtime:true,WebSocket:ClosingSocket,resumeStorage:fallbackStorage,baseUrl:'https://brickwild.test',setTimer:()=>0,clearTimer(){},fetcher:async(path,options)=>{
 const body=JSON.parse(options.body||'{}');
 if(path==='/api/arena/realtime-ticket')return Response.json({enabled:true,transport:'realtime-v1',url:'wss://arena.test',ticket:'ticket'});
 if(path==='/api/arena/join'){fallbackResume=body.resume;return Response.json({room:'FALL01',session:body.resume.session,token:body.resume.token,snapshot:roomSnapshot(fallbackRoom,fallbackPlayer.id)});}
 throw Error('Unexpected fallback request: '+path);
}});
assert.equal(await fallback.join('Fallback','FALL01','#ffcf55',true),true,'a closed realtime handshake falls back to HTTP');
assert.deepEqual(fallbackResume,knownResume,'HTTP fallback reuses the realtime join proof');
assert.deepEqual(fallbackErrors,[],'the recoverable realtime close is not shown to the player');
assert.equal(fallback.active,true);
console.log('Realtime Arena client: refresh resume, explicit-leave cleanup and closed-handshake HTTP fallback passed.');
