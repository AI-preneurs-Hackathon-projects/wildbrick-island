// Local-only real clients against an in-memory authoritative core. Virtual fetch
// models cancellation and response loss; it is not HTTP, authentication or D1.
import {createArenaClient} from '../../public/arena-client.js';
import * as defaultCore from '../../public/arena-core.js';
import {newMotion,frameInput} from '../../public/movement-stream.js';
import {WORLD_ENTITIES} from '../../public/world-data.js';
import {MOVE_DT} from '../../public/movement.js';

const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const remember=(set,value)=>{set.add(value);if(set.size>8192)set.delete(set.values().next().value);};
export function performanceFixture({latency=100,delays,seed=452067,clientFactory=createArenaClient,core=defaultCore,diagnostics=[],measureClient=false,onPacket=()=>{},onOutcome=()=>{},onEvent=()=>{},setupPlayer=()=>{}}={}){
 let now=100000,id=0,joins=0,maxTimers=0;
 const randomStates=[seed>>>0,(seed^0x9e3779b9)>>>0];
 const {newRoom,addPlayer,advanceRoom,applyInput,roomSnapshot,makeKit,predictPlayer}=core;
 const tickets=new Map(),timers=new Map(),room=newRoom(now,'local-performance'),stats=[0,1].map(()=>({ticks:0,movingTicks:0,zeroMovement:0,staleStops:0,statuses:[],requests:0,inFlight:0,maxInFlight:0,rounds:0,stopCount:0,stopMs:0,longestStopMs:0,pendingMax:0,ackAdvance:0,acceptedFrames:0,acceptedTravelM:0,displayedTravelM:0,releaseOvershootM:0,driftMaxM:0,correctionMaxM:0,correctionP95M:0,syncInFlight:0,maxSyncInFlight:0,mutations:0,aborted:0,lostResponses:0,lateResponses:0,oldACKs:0,shots:0,duplicateShots:0,commandPackets:0,commandOverlap:0,commandAck:0,commandShots:0,duplicateCommandShots:0,authoritativeShots:0,authoritativeCommandShots:0,authoritativeDuplicateCommandShots:0,movementReplayErrorM:0}));
 const metricState=stats.map(()=>({stop:0,corrections:[],correctionCursor:0,shots:new Set(),shotCommands:new Set(),authoritativeEvents:new Set(),authoritativeCommands:new Set(),flights:new Set(),ack:0,spawn:null,playerId:null}));
 room.nextDrop=1e15;for(const e of WORLD_ENTITIES)room.destroyed[e.id]=1e15;
 const setTimer=(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+Math.max(0,ms)});maxTimers=Math.max(maxTimers,timers.size);return key;};
 const clearTimer=key=>timers.delete(key),faults=[[],[]];
 function network(index,kind,request){const random=()=>((randomStates[index]=(Math.imul(randomStates[index],1664525)+1013904223)>>>0)/4294967296);const rtt=Array.isArray(latency)?latency[index]:latency;const d=delays?.({index,kind,request,now,random})||{};return {up:d.up??rtt/2,down:d.down??rtt/2};}
 const clients=[0,1].map(index=>clientFactory({onStatus:status=>{const s=stats[index].statuses;if(s.at(-1)!==status){s.push(status);if(s.length>128)s.shift();}},onEvent:e=>{if(e.type==='round-started')stats[index].rounds++;if(e.type==='shot'&&e.player===metricState[index].playerId){const m=metricState[index],key=e.id;if(m.shots.has(key))stats[index].duplicateShots++;else{remember(m.shots,key);stats[index].shots++;}if(Number.isSafeInteger(e.commandId)){if(m.shotCommands.has(e.commandId))stats[index].duplicateCommandShots++;else{remember(m.shotCommands,e.commandId);stats[index].commandShots++;}}}onEvent(index,e);}},{diagnostics:measureClient?{record(type,data){const s=stats[index],m=metricState[index];if(type==='tick')s.pendingMax=Math.max(s.pendingMax,data.pending||0);if(type==='snapshot'&&Number.isFinite(data.correction)){s.correctionMaxM=Math.max(s.correctionMaxM,data.correction);m.corrections[m.correctionCursor++%8192]=data.correction;const sorted=m.corrections.slice().sort((a,b)=>a-b);s.correctionP95M=sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)];}try{diagnostics[index]?.record(type,data);}catch{}}}:diagnostics[index],clock:()=>now,setTimer,clearTimer,fetcher:(path,options)=>{
  const packet=JSON.parse(options.body||'{}'),s=stats[index],kind=path.split('/').at(-1),fault=faults[index].shift(),d=network(index,kind,s.requests+1),sync=kind==='sync'||kind==='build';
  // A command may follow one older movement request; nothing may follow a pending command.
  const flight={command:!!packet.command||!!packet.input?.fire};if(sync){if((flight.command&&metricState[index].flights.size>1)||[...metricState[index].flights].some(f=>f.command))s.commandOverlap++;metricState[index].flights.add(flight);}
  s.requests++;s.inFlight++;s.maxInFlight=Math.max(s.maxInFlight,s.inFlight);if(sync){s.syncInFlight++;s.maxSyncInFlight=Math.max(s.maxSyncInFlight,s.syncInFlight);}if(packet.command)s.commandPackets++;
  onPacket({index,at:now,kind,seq:packet.seq,frames:packet.frames,command:packet.command,input:packet.input});
  return new Promise((resolve,reject)=>{
   let settled=false,accepted=false,upTimer=null,downTimer=null;
   const finish=(error,data,status=200)=>{if(settled)return;settled=true;options.signal?.removeEventListener('abort',abort);s.inFlight--;if(sync){s.syncInFlight--;metricState[index].flights.delete(flight);}if(error)reject(error);else resolve({ok:status===200,status,json:async()=>data});};
   const abort=()=>{s.aborted++;if(!accepted&&!fault?.acceptAfterAbort)clearTimer(upTimer);if(downTimer!==null)clearTimer(downTimer);finish(options.signal.reason||new DOMException('Canceled','AbortError'));};
   options.signal?.addEventListener('abort',abort,{once:true});
   if(options.signal?.aborted){abort();return;}
   upTimer=setTimer(()=>{
    let status=fault?.status||200,data={};advanceRoom(room,now);collectAuthoritativeEvents();
    try{
     if(fault?.network)throw Error('Synthetic network failure before acceptance');
     if(status!==200)data={error:'Synthetic request failure'};
     else if(kind==='join'){
      const player=addPlayer(room,'fixture-'+(++joins),'Local peer '+index,now);player.motion=newMotion(now);metricState[index].playerId=player.id;if(packet.resume?.session)tickets.set(packet.resume.session,player.id);
      Object.assign(player,{x:index?1.7:0,z:10,yaw:index?Math.PI:0,protectedUntil:0});setupPlayer(index,player,room);
      room.revision++;data={room:'LOCAL',session:player.id,token:'local-only',snapshot:structuredClone(roomSnapshot(room,player.id))};
     }else if(kind==='leave')delete room.players[tickets.get(packet.session)||packet.session];
     else{
      const before=structuredClone(room.players[packet.session]);applyInput(room,packet.session,packet,now,packet.command?.type==='build'?makeKit(packet.command.mode):null);s.mutations++;
      const after=room.players[packet.session];if(before?.motion&&after?.motion&&before.spawnSerial===after.spawnSerial){const first=before.motion.frame,last=after.motion.frame;s.acceptedFrames+=Math.max(0,last-first);const replay=structuredClone(before);for(const frame of packet.frames||[])if(frame[0]>first&&frame[0]<=last){const prior={...replay};predictPlayer(replay,frameInput(frame),MOVE_DT,{...room,preview:true});s.acceptedTravelM+=distance(prior,replay);}s.movementReplayErrorM=Math.max(s.movementReplayErrorM,distance(replay,after));}
      room.revision++;data={snapshot:structuredClone(roomSnapshot(room,packet.session,packet.afterEvent))};
     }
     accepted=status===200;collectAuthoritativeEvents();
    }catch(e){if(fault?.network){downTimer=setTimer(()=>finish(e),d.down);return;}status=e.status||500;data={error:'Synthetic core rejection'};}
    if(fault?.lostResponse&&accepted){s.lostResponses++;return;} // Remains pending until the real client timeout aborts.
    downTimer=setTimer(()=>{if(settled){s.lateResponses++;return;}const p=data.snapshot?.players.find(p=>p.id===data.snapshot.self),m=metricState[index];if(p){s.commandAck=Math.max(s.commandAck,p.lastCommand||0);if(m.spawn!==p.spawnSerial){m.spawn=p.spawnSerial;m.ack=0;}if(p.motion.frame<m.ack)s.oldACKs++;s.ackAdvance+=Math.max(0,p.motion.frame-m.ack);m.ack=Math.max(m.ack,p.motion.frame);}finish(null,data,status);},fault?.responseDelay??d.down);
   },fault?.requestDelay??d.up);
  });
 }}));
 function collectAuthoritativeEvents(){for(const e of room.events){if(e.type!=='shot')continue;const index=metricState.findIndex(m=>m.playerId===e.player);if(index<0)continue;const m=metricState[index],s=stats[index];if(m.authoritativeEvents.has(e.id))continue;remember(m.authoritativeEvents,e.id);s.authoritativeShots++;if(Number.isSafeInteger(e.commandId)){if(m.authoritativeCommands.has(e.commandId))s.authoritativeDuplicateCommandShots++;else{remember(m.authoritativeCommands,e.commandId);s.authoritativeCommandShots++;}}}}
 async function advance(ms){const end=now+ms;while(true){let next;for(const [key,t]of timers)if(t.at<=end&&(!next||t.at<next.t.at))next={key,t};if(!next)break;now=next.t.at;timers.delete(next.key);next.t.fn();await flush();}now=end;await flush();}
 async function settle(promise,budget=30000){let done=false,value,error;promise.then(v=>{done=true;value=v;},e=>{done=true;error=e;});for(let left=budget;!done&&left>0;left-=10)await advance(Math.min(10,left));if(!done)throw Error('Fixture did not settle within bounded virtual deadline');if(error)throw error;return value;}
 async function join(index){const pending=clients[index].join('Local peer '+index,'LOCAL');if(!delays&&!Array.isArray(latency)){await advance(latency+1);if(!await pending)throw Error('Fixture join failed');}else if(!await settle(pending))throw Error('Fixture join failed');}
 async function start(){await join(0);await join(1);}
 async function step(inputs=[{z:1},{z:1}],ms=MOVE_DT*1000){
  const beforeStep=clients.map(client=>client.self&&{x:client.self.x,y:client.self.y,z:client.self.z,spawn:client.self.spawnSerial,round:client.snapshot?.round?.id});
  await advance(ms);
  for(let i=0;i<2;i++){
   const client=clients[i],before=beforeStep[i],p=client.tick(ms/1000,inputs[i]),s=stats[i],m=metricState[i],authoritative=room.players[m.playerId];s.ticks++;
   if(before&&p){const travel=distance(p,before),eligible=before.spawn===p.spawnSerial&&before.round===client.snapshot?.round?.id&&p.health>0&&authoritative?.health>0&&room.round.status==='active'&&client.snapshot?.round?.status==='active';if(eligible)s.displayedTravelM+=travel;if(eligible&&(inputs[i].x||inputs[i].z)){
    s.movingTicks++;if(travel<1e-9){s.zeroMovement++;s.stopMs+=ms;if(!m.stop)s.stopCount++;m.stop+=ms;s.longestStopMs=Math.max(s.longestStopMs,m.stop);if(client.stale)s.staleStops++;}else m.stop=0;
   }else{m.stop=0;if(eligible&&!inputs[i].up&&!inputs[i].down)s.releaseOvershootM+=travel;}if(authoritative&&eligible)s.driftMaxM=Math.max(s.driftMaxM,distance(p,authoritative));}
   onOutcome({index:i,at:now,pose:p&&{x:p.x,y:p.y,z:p.z,yaw:p.yaw,health:p.health,kit:p.kit.id},revision:client.snapshot?.revision,round:client.snapshot?.round?.id});
  }
 }
 async function leave(){const pending=clients.map(c=>c.leave());if(!delays&&!Array.isArray(latency)){await advance(latency+1);await settle(Promise.all(pending));}else await settle(Promise.all(pending));await advance(13000);}
 return {clients,room,stats,start,join,step,advance,settle,leave,fault:(index,fault)=>faults[index].push(fault),clearFaults:index=>{faults[index]=[];},get now(){return now;},get resources(){return {timers:timers.size,maxTimers,players:Object.keys(room.players).length};}};
}
