// Local-only, two actual clients against one in-memory authoritative core.
// Does not emulate HTTP, authentication, D1, GPU time or production capacity.
import {createArenaClient} from '../../public/arena-client.js';
import {newRoom,addPlayer,advanceRoom,applyInput,roomSnapshot,makeKit} from '../../public/arena-core.js';
import {newMotion} from '../../public/movement-stream.js';
import {WORLD_ENTITIES} from '../../public/world-data.js';
import {MOVE_DT} from '../../public/movement.js';

const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
export function performanceFixture({latency=100,clientFactory=createArenaClient,diagnostics=[],onPacket=()=>{},onOutcome=()=>{},onEvent=()=>{}}={}){
 let now=100000,id=0,joins=0,maxTimers=0;
 const timers=new Map(),room=newRoom(now,'local-performance'),stats=[0,1].map(()=>({ticks:0,movingTicks:0,zeroMovement:0,staleStops:0,statuses:[],requests:0,inFlight:0,maxInFlight:0,rounds:0}));
 room.nextDrop=1e15;for(const e of WORLD_ENTITIES)room.destroyed[e.id]=1e15;
 const setTimer=(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+ms});maxTimers=Math.max(maxTimers,timers.size);return key;};
 const clearTimer=key=>timers.delete(key);
 const faults=[null,null];
 const clients=[0,1].map(index=>clientFactory({onStatus:status=>{const s=stats[index].statuses;if(s.at(-1)!==status)s.push(status);},onEvent:e=>{if(e.type==='round-started')stats[index].rounds++;onEvent(index,e);}},{diagnostics:diagnostics[index],clock:()=>now,setTimer,clearTimer,fetcher:(path,options)=>{
  const packet=JSON.parse(options.body||'{}'),s=stats[index],fault=faults[index];faults[index]=null;
  const kind=path.split('/').at(-1);s.requests++;s.inFlight++;s.maxInFlight=Math.max(s.maxInFlight,s.inFlight);
  // Deliberately exclude join tickets, credentials, names and blueprint bodies.
  onPacket({index,at:now,kind,seq:packet.seq,frames:packet.frames,command:packet.command,input:packet.input});
  return new Promise((resolve,reject)=>{
   setTimer(()=>{
    let status=fault?.status||200,data={};advanceRoom(room,now);
    try{
     if(fault?.network)throw Error('Synthetic network failure');
     if(status!==200)data={error:'Synthetic request failure'};
     else if(kind==='join'){
      const player=addPlayer(room,'fixture-'+(++joins),'Local peer '+index,now);player.motion=newMotion(now);
      Object.assign(player,{x:index?1.7:0,z:10,yaw:index?Math.PI:0,protectedUntil:0});
      room.revision++;data={room:'LOCAL',session:player.id,token:'local-only',snapshot:structuredClone(roomSnapshot(room,player.id))};
     }else if(kind==='leave')delete room.players[packet.session];
     else{applyInput(room,packet.session,packet,now,packet.command?.type==='build'?makeKit(packet.command.mode):null);room.revision++;data={snapshot:structuredClone(roomSnapshot(room,packet.session,packet.afterEvent))};}
    }catch(e){if(fault?.network){setTimer(()=>{s.inFlight--;reject(e);},latency/2);return;}status=e.status||500;data={error:'Synthetic core rejection'};}
    setTimer(()=>{s.inFlight--;resolve({ok:status===200,status,json:async()=>data});},latency/2);
   },latency/2);
  });
 }}));
 async function advance(ms){const end=now+ms;while(true){let next;for(const [key,t]of timers)if(t.at<=end&&(!next||t.at<next.t.at))next={key,t};if(!next)break;now=next.t.at;timers.delete(next.key);next.t.fn();await flush();}now=end;await flush();}
 async function join(index){const pending=clients[index].join('Local peer '+index,'LOCAL');await advance(latency+1);if(!await pending)throw Error('Fixture join failed');}
 async function start(){await join(0);await join(1);}
 async function step(inputs=[{z:1},{z:1}],ms=MOVE_DT*1000){
  await advance(ms);
  for(let i=0;i<2;i++){
   const client=clients[i],before=client.self&&{x:client.self.x,y:client.self.y,z:client.self.z},p=client.tick(ms/1000,inputs[i]),s=stats[i];s.ticks++;
   if(before&&p&&(inputs[i].x||inputs[i].z)&&p.health>0&&client.snapshot?.round?.status!=='finished'){
    s.movingTicks++;if(Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)<1e-9){s.zeroMovement++;if(client.stale)s.staleStops++;}
   }
   onOutcome({index:i,at:now,pose:p&&{x:p.x,y:p.y,z:p.z,yaw:p.yaw,health:p.health,kit:p.kit.id},revision:client.snapshot?.revision,round:client.snapshot?.round?.id});
  }
 }
 async function leave(){const pending=clients.map(c=>c.leave());await advance(latency+1);await Promise.all(pending);await advance(13000);}
 return {clients,room,stats,start,join,step,advance,leave,fault:(index,fault)=>faults[index]=fault,get now(){return now;},get resources(){return {timers:timers.size,maxTimers,players:Object.keys(room.players).length};}};
}
