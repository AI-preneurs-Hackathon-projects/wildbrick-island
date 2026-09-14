// Isolated localhost HTTP adapter: actual fetch, AbortSignal and authoritative core.
// No Worker, authentication service, build reservation, database or hosted traffic.
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';
import {createArenaClient} from '../../public/arena-client.js';
import * as defaultCore from '../../public/arena-core.js';
import {newMotion} from '../../public/movement-stream.js';
import {WORLD_ENTITIES} from '../../public/world-data.js';

export async function arenaHttpFixture({clientFactory=createArenaClient,core=defaultCore,latency=1600,diagnostics=[],onEvent=()=>{}}={}){
 const origin=performance.now(),now=()=>100000+performance.now()-origin;
 const room=core.newRoom(now(),'local-http'),serverTimers=new Set(),clientTimers=new Set(),sockets=new Set(),faults=[[],[]];
 const stats=[0,1].map(()=>({requests:0,syncInFlight:0,maxSyncInFlight:0,mutations:0,acceptedFrames:0,abortedResponses:0,lostResponses:0,lateResponses:0,commandPackets:0,oldSeqRejected:0,commandEffects:{}}));
 let joins=0,requests=0,maxRequests=0,eventCursor=0;const owners=new Map();
 room.nextDrop=1e15;for(const e of WORLD_ENTITIES)room.destroyed[e.id]=1e15;
 function later(fn,ms){const t=setTimeout(()=>{serverTimers.delete(t);fn();},ms);serverTimers.add(t);return t;}
 const timer=(fn,ms)=>{const t=setTimeout(()=>{clientTimers.delete(t);fn();},ms);clientTimers.add(t);return t;};
 const clear=t=>{clearTimeout(t);clientTimers.delete(t);};
 const server=http.createServer(async(req,res)=>{
  const index=Number(req.headers['x-local-peer']),s=stats[index];if(!s){res.writeHead(400).end();return;}
  let text='';for await(const chunk of req){text+=chunk;if(text.length>100000){res.writeHead(413).end();return;}}
  const packet=JSON.parse(text||'{}'),kind=req.url.split('/').at(-1),sync=kind==='sync'||kind==='build',fault=sync?faults[index].shift():null;
  const rtt=Array.isArray(latency)?latency[index]:latency;
  s.requests++;requests++;maxRequests=Math.max(maxRequests,requests);if(sync){s.syncInFlight++;s.maxSyncInFlight=Math.max(s.maxSyncInFlight,s.syncInFlight);}if(packet.command)s.commandPackets++;
  let ended=false;const done=()=>{if(ended)return;ended=true;requests--;if(sync)s.syncInFlight--;};res.on('close',()=>{if(!res.writableEnded)s.abortedResponses++;done();});res.on('finish',done);
  later(()=>{
   let code=fault?.status||200,data={};core.advanceRoom(room,now());
   try{
    if(code!==200)data={error:'Local injected status'};
    else if(kind==='join'){
     const p=core.addPlayer(room,'http-'+(++joins),'Local peer',now());p.motion=newMotion(now());owners.set(p.id,index);Object.assign(p,{x:index?6:0,z:10,yaw:0,protectedUntil:0});room.revision++;
     data={room:'LOCAL',session:p.id,token:'local-only',snapshot:structuredClone(core.roomSnapshot(room,p.id))};
    }else if(kind==='leave')core.removePlayer(room,packet.session);
    else{
     const p=room.players[packet.session],before=p?.motion?.frame||0,spawn=p?.spawnSerial;
     if(p&&packet.seq<=p.lastSeq)s.oldSeqRejected++;
     core.applyInput(room,packet.session,packet,now(),packet.command?.type==='build'?core.makeKit(packet.command.mode):null);s.mutations++;
     if(p&&spawn===p.spawnSerial)s.acceptedFrames+=p.motion.frame-before;
     room.revision++;data={snapshot:structuredClone(core.roomSnapshot(room,packet.session,packet.afterEvent))};
    }
   }catch(e){code=e.status||500;data={error:'Local authoritative rejection'};}
   for(const e of room.events)if(e.id>eventCursor){const owner=owners.get(e.player);if(owner!==undefined&&e.commandId&&['shot','swing'].includes(e.type)){const effects=stats[owner].commandEffects;effects[e.commandId]=(effects[e.commandId]||0)+1;}eventCursor=Math.max(eventCursor,e.id);}
   if(fault?.loseAfterAccept&&code===200){s.lostResponses++;res.destroy();return;}
   // The mutation has already committed. Client cancellation cannot roll it back.
   const delay=fault?.responseDelay??rtt/2;
   later(()=>{if(res.destroyed){s.lateResponses++;return;}res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data));},delay);
  },fault?.requestDelay??rtt/2);
 });
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const clients=[0,1].map(index=>clientFactory({onEvent:e=>onEvent(index,e)},{diagnostics:diagnostics[index],clock:now,setTimer:timer,clearTimer:clear,fetcher:(path,options)=>fetch(url+path,{...options,headers:{...options.headers,'x-local-peer':String(index)}})}));
 async function join(index){if(!await clients[index].join('Local peer','LOCAL'))throw Error('Local HTTP join failed');}
 async function start(){await join(0);await join(1);}
 async function step(inputs,ms){clients.forEach((c,i)=>c.tick(ms/1000,inputs[i]));}
 async function leave(){await Promise.all(clients.map(c=>c.leave()));const end=performance.now()+15000;while((serverTimers.size||clientTimers.size||requests)&&performance.now()<end)await sleep(20);await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});for(let i=0;sockets.size&&i<100;i++)await sleep(10);}
 return {clients,room,stats,start,join,step,leave,advance:sleep,fault:(i,f)=>faults[i].push(f),get now(){return now();},get resources(){return {timers:serverTimers.size+clientTimers.size,serverTimers:serverTimers.size,clientTimers:clientTimers.size,requests,maxRequests,sockets:sockets.size,players:Object.keys(room.players).length};}};
}
