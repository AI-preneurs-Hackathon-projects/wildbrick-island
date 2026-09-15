import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRealtimeArenaClient} from '../public/realtime-arena-client.js';
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
console.log('Realtime Arena client: same-tab refresh resume and explicit-leave cleanup passed.');
