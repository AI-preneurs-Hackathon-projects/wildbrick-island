import {solveWeaponAim} from './aiming.js';
import {MAP_CYCLE} from './map-catalog.js';
import {weaponAim} from './weapon-aim.js';
import {createMotionView} from './motion-view.js';
import {predictPlayer,cleanInput} from './arena-core.js?v=41';
import {MOVE_DT,startJump} from './movement.js';
import {validateBlueprint} from './blueprint.js';
import {SUPPLY_BLUEPRINTS} from './supply-catalog.js';

const SEND_MS=50,REQUEST_TIMEOUT_MS=5000,MAX_PENDING_INPUTS=64;
const safeJson=value=>{const text=JSON.stringify(value);if(text.length>110000)throw Object.assign(Error('That Arena action is too large.'),{status:413});return text;};

export function createRealtimeArenaClient({onSnapshot=()=>{},onStatus=()=>{},onEvent=()=>{},onError=()=>{}}={},runtime={}){
 const clock=runtime.clock||(()=>performance.now()),setTimer=runtime.setTimer||setTimeout,clearTimer=runtime.clearTimer||clearTimeout,Socket=runtime.WebSocket||globalThis.WebSocket,getTicket=runtime.getTicket;
 let resumeStorage=runtime.resumeStorage;try{resumeStorage??=globalThis.sessionStorage;}catch{}
 let roomCode=null,credentials=null,joinTicket=null,joinArgs=null,socket=null,snapshot=null,self=null,sendTimer=null,reconnectTimer=null,closed=true,joining=false,connected=false,requestId=0,seq=0,commandId=0,commands=[],pendingInputs=[],input={},revision=-1,lastEvent=0,lastSuccess=0,lastPacketAt=0,motionEpoch=0,accumulator=0,reconnectAttempt=0,lifecycle=0,previewAt=-Infinity;
 const requests=new Map(),predictedCommands=new Set(),blueprints=new Map(SUPPLY_BLUEPRINTS),loading=new Set(),view=createMotionView();
 const resumeKey=room=>`brickwild.arena.resume.v1:${room}`;
 const validResume=value=>value&&/^[a-f0-9-]{36}$/.test(value.session||'')&&/^[a-f0-9]{64}$/.test(value.token||'');
 function savedResume(room){try{const value=JSON.parse(resumeStorage?.getItem(resumeKey(room))||'null');return validResume(value)?value:null;}catch{return null;}}
 function saveResume(room,value){if(!validResume(value))return;try{resumeStorage?.setItem(resumeKey(room),JSON.stringify(value));}catch{}}
 function forgetResume(room){try{resumeStorage?.removeItem(resumeKey(room));}catch{}}

 function requestHttp(path){return fetch(path,{cache:'no-store',credentials:'same-origin'}).then(async response=>{let data;try{data=await response.json();}catch{throw Error('The Arena server returned an invalid response.');}if(!response.ok)throw Object.assign(Error(data.error||'The Arena request failed.'),{status:response.status});return data;});}
 function fetchBlueprint(id){if(!id||blueprints.has(id)||loading.has(id))return;loading.add(id);const generation=lifecycle;requestHttp('/api/arena/blueprint?id='+encodeURIComponent(id)).then(data=>{if(generation===lifecycle&&!closed)blueprints.set(id,validateBlueprint(data.blueprint));}).catch(error=>{if(generation===lifecycle&&!closed)onError(error.message,error.status);}).finally(()=>loading.delete(id));}
 function clearScheduled(){clearTimer(sendTimer);clearTimer(reconnectTimer);sendTimer=reconnectTimer=null;}
 function rejectRequests(error){for(const pending of requests.values()){clearTimer(pending.timer);pending.reject(error);}requests.clear();}
 function send(message){if(!socket||socket.readyState!==Socket.OPEN)return false;try{socket.send(safeJson(message));return true;}catch(error){onError(error.message,error.status);return false;}}
 function ask(type,extra={}){const id=++requestId;return new Promise((resolve,reject)=>{const timer=setTimer(()=>{requests.delete(id);reject(Object.assign(Error('The Arena did not confirm that action in time.'),{code:'timeout'}));},REQUEST_TIMEOUT_MS);requests.set(id,{resolve,reject,timer});if(!send({type,requestId:id,...extra})){clearTimer(timer);requests.delete(id);reject(Object.assign(Error('The Arena is reconnecting.'),{code:'offline'}));}});}
 function settle(message){const pending=requests.get(message.requestId);if(!pending)return false;clearTimer(pending.timer);requests.delete(message.requestId);if(message.type==='error')pending.reject(Object.assign(Error(message.message||'The Arena action failed.'),{status:message.status}));else pending.resolve(message);return true;}

 function accept(next,{full=false}={}){
  if(!next||!Number.isSafeInteger(next.revision)||(!full&&next.revision<=revision))return;
  if(!full&&snapshot&&snapshot.epoch!==next.epoch)throw Object.assign(Error('This arena has ended. Join again to continue.'),{status:410});
  if(next.round?.mapId&&!MAP_CYCLE.includes(next.round.mapId))throw Object.assign(Error('A new Arena map is available. Refresh the Site to continue.'),{status:410});
  const authoritative=structuredClone(next.players.find(player=>player.id===next.self)||null);
  if(!authoritative||authoritative.motion?.version!==2)throw Object.assign(Error('Your realtime Arena seat expired. Join again to continue.'),{status:410});
  const discontinuity=full||!self||motionEpoch!==(authoritative.spawnSerial||0)||snapshot?.round?.id!==next.round?.id||self.kit.id!==authoritative.kit.id||(self.health<=0)!==(authoritative.health<=0);
  if(discontinuity){input={};commands=[];pendingInputs=[];predictedCommands.clear();accumulator=0;motionEpoch=authoritative.spawnSerial||0;view.reset();}
  pendingInputs=pendingInputs.filter(packet=>packet.seq>authoritative.lastSeq);
  self=authoritative;snapshot=next;revision=next.revision;seq=Math.max(seq,self.lastSeq);commandId=Math.max(commandId,self.lastCommand);commands=commands.filter(command=>command.id>self.lastCommand);lastSuccess=clock();
  // Reapply only locally sent inputs the authority has not acknowledged. Each
  // packet covers one 20 Hz send interval; render cadence never changes speed.
  for(const packet of pendingInputs)predictPlayer(self,packet.input,packet.durationMs/1000,{...next,time:next.time,preview:true});
  if(commands.some(command=>command.type==='jump'))startJump(self,self.kit.stats.mounted);
  view.accept(self,{teleport:discontinuity});
  for(const player of next.players){fetchBlueprint(player.kit.blueprintId);fetchBlueprint(player.building?.kit.blueprintId);}for(const placed of next.placed||[])fetchBlueprint(placed.blueprintId);for(const item of next.items||[])fetchBlueprint(item.kit.blueprintId);
  onSnapshot(next);
  if(lastEvent===0)lastEvent=next.eventCursor??Math.max(0,...next.events.map(event=>event.id));
  for(const event of next.events)if(event.id>lastEvent){onEvent({...event,predicted:event.player===next.self&&['shot','swing'].includes(event.type)&&predictedCommands.delete(event.commandId)},next.self);lastEvent=event.id;}
  lastEvent=Math.max(lastEvent,next.eventCursor||0);connected=true;reconnectAttempt=0;onStatus('online');
 }

 function scheduleSend(delay=SEND_MS){clearTimer(sendTimer);if(!closed&&connected)sendTimer=setTimer(sendInput,delay);}
 function sendInput(){
  if(closed||!connected)return;const command=commands[0],now=clock(),packet={type:'input',seq:++seq,input:{...input},afterEvent:lastEvent,motionEpoch,roundId:snapshot?.round?.id};
  if(command){packet.command={id:command.id,type:command.type,mode:command.mode,roundId:command.roundId};if(command.blueprint)packet.blueprint=command.blueprint;}
  if(send(packet)){const durationMs=lastPacketAt?Math.max(0,Math.min(SEND_MS,now-lastPacketAt)):0;lastPacketAt=now;pendingInputs.push({seq:packet.seq,input:packet.input,durationMs});if(pendingInputs.length>MAX_PENDING_INPUTS)pendingInputs.splice(0,pendingInputs.length-MAX_PENDING_INPUTS);}
  scheduleSend();
 }
 function reconnect(){clearTimer(reconnectTimer);if(closed||!joinArgs)return;const delay=Math.min(8000,250*2**Math.min(5,reconnectAttempt++))*(.8+Math.random()*.4);reconnectTimer=setTimer(()=>connect(true).catch(error=>{if(closed)return;if(error.status===401||error.status===410){closed=true;connected=false;onStatus('expired');onError(error.message,error.status);return;}onStatus('reconnecting');reconnect();}),delay);}
 function socketUrl(value){const url=new URL(value,runtime.baseUrl||globalThis.location?.href||'http://127.0.0.1');if(!['ws:','wss:'].includes(url.protocol))throw Error('The Arena realtime URL is invalid.');return url.href;}
 async function connect(resuming=false,initialTicket=null){
  const generation=lifecycle,ticket=initialTicket||await getTicket(roomCode,joinArgs.create);if(generation!==lifecycle||closed)return false;
  if(ticket?.enabled!==true||ticket.transport!=='realtime-v1')throw Object.assign(Error('This room is pinned to realtime Arena, but realtime admission is disabled.'),{status:503});
  return await new Promise((resolve,reject)=>{
   let joined=false,auth=false,guard;const ws=new Socket(socketUrl(ticket.url));socket=ws;
   const fail=error=>{clearTimer(guard);if(socket===ws)socket=null;try{ws.close();}catch{}reject(error);};
   guard=setTimer(()=>fail(Object.assign(Error('The Arena realtime handshake timed out.'),{code:'timeout'})),REQUEST_TIMEOUT_MS);
   ws.onopen=()=>send({type:'authenticate',ticket:ticket.ticket});
   ws.onmessage=event=>{let message;try{message=JSON.parse(event.data);}catch{return fail(Error('The Arena sent an invalid realtime message.'));}
    try{
     if(message.type==='authenticated'&&!auth){auth=true;const resume=credentials||joinTicket;send({type:'join',requestId:++requestId,name:joinArgs.name,room:roomCode,create:joinArgs.create,avatarColor:joinArgs.avatarColor,resume,motionVersion:2,mapVersion:1});return;}
     if(message.type==='joined'&&!joined){joined=true;clearTimer(guard);credentials={session:message.session,token:message.token};joinTicket=credentials;saveResume(roomCode,credentials);accept(message.snapshot,{full:true});scheduleSend(0);resolve(true);return;}
     if(message.type==='snapshot'){accept(message.snapshot);return;}
     if(message.type==='result'||message.type==='error'){
      if(!joined&&message.type==='error')return fail(Object.assign(Error(message.message||'The Arena join failed.'),{status:message.status}));
      if(!settle(message)&&message.type==='error'){if(Number.isSafeInteger(message.commandId)){commands=commands.filter(command=>command.id!==message.commandId);predictedCommands.delete(message.commandId);}if([401,410].includes(message.status)){closed=true;connected=false;credentials=null;joinTicket=null;forgetResume(roomCode);onStatus('expired');}onError(message.message,message.status);}if(message.snapshot)accept(message.snapshot);return;
     }
    }catch(error){if(joined&&[401,410].includes(error.status)){closed=true;connected=false;credentials=null;joinTicket=null;onStatus('expired');onError(error.message,error.status);}fail(error);}
   };
   ws.onerror=()=>{};
   ws.onclose=()=>{if(socket===ws){socket=null;connected=false;clearTimer(sendTimer);rejectRequests(Object.assign(Error('The Arena connection closed.'),{code:'offline'}));if(!closed){onStatus('reconnecting');reconnect();}}if(!joined)reject(Object.assign(Error('The Arena connection closed before joining.'),{code:'offline'}));};
  });
 }
 async function join(name,room,avatarColor,create=false,ticket){
  if(joining)return false;joining=true;lifecycle++;closed=false;connected=false;clearScheduled();rejectRequests(Error('Arena join replaced.'));const nextRoom=String(room||'').trim().toUpperCase();if(roomCode!==nextRoom){credentials=null;joinTicket=null;}roomCode=nextRoom;joinArgs={name,avatarColor,create};joinTicket=credentials||joinTicket||savedResume(roomCode)||{session:crypto.randomUUID(),token:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};credentials=null;snapshot=null;self=null;revision=-1;lastEvent=0;seq=0;commandId=0;commands=[];pendingInputs=[];input={};accumulator=0;motionEpoch=0;view.reset();onStatus('joining');
  lastPacketAt=0;previewAt=-Infinity;try{return await connect(false,ticket);}catch(error){closed=true;connected=false;if([401,410].includes(error.status)){joinTicket=null;forgetResume(roomCode);}try{socket?.close();}catch{}socket=null;onStatus('offline');onError(error.message,error.status);return false;}finally{joining=false;}
 }
 async function start(){if(!connected||snapshot?.round?.status!=='waiting')return false;try{const result=await ask('start');if(result.snapshot)accept(result.snapshot);return true;}catch(error){onError(error.message,error.status);return false;}}
 async function ready(){if(!connected||snapshot?.round?.status!=='finished'||snapshot?.match?.complete)return false;try{const result=await ask('ready',{roundId:snapshot.round.id});if(result.snapshot)accept(result.snapshot);return true;}catch(error){onError(error.message,error.status);return false;}}
 async function leave(){lifecycle++;closed=true;joining=false;clearScheduled();const ws=socket,leavingRoom=roomCode;try{if(connected)await ask('leave');}catch{}finally{forgetResume(leavingRoom);connected=false;credentials=null;joinTicket=null;joinArgs=null;socket=null;try{ws?.close(1000,'left');}catch{}rejectRequests(Error('Arena left.'));snapshot=null;self=null;commands=[];pendingInputs=[];input={};lastPacketAt=0;previewAt=-Infinity;view.reset();onStatus('offline');}}
 function command(type,mode,blueprint){if(!connected||!self||snapshot?.round?.status!=='active'||self.health<=0)return false;if(type==='restart')return false;if(type==='jump'){if(self.kit.stats.mounted||self.jumpRemaining>0||self.grounded===false)return false;}if(type==='build'&&(self.building||serverTime()<self.buildReadyAt)){onError(self.building?'Let these bricks finish assembling.':`Next build in ${Math.ceil((self.buildReadyAt-serverTime())/1000)}s.`);return false;}if(commands.length>=4)return false;const id=++commandId;commands.push({id,type,mode,blueprint,roundId:snapshot.round?.id});if(type==='fire')previewAttack(id);if(type==='jump')startJump(self,false);sendInput();return true;}
 function previewAttack(id){const time=serverTime(),kit=self?.kit.stats;if(!kit||clock()-lastSuccess>=1000||self.health<=0||self.building||!kit.damage||time<self.protectedUntil||time<self.overheatedUntil||clock()-previewAt<kit.interval*1000)return;previewAt=clock();predictedCommands.add(id);while(predictedCommands.size>64)predictedCommands.delete(predictedCommands.values().next().value);const pose=view.state||self,aim=solveWeaponAim(snapshot,pose);onEvent({type:'attack-preview',commandId:id,player:self.id,weapon:kit.weapon,yaw:aim.yaw,pitch:0,origin:aim.launchContact?aim.anchor:aim.muzzle,muzzle:aim.muzzle,aimYaw:aim.yaw,aimCorrection:aim.correction,roundId:snapshot.round?.id,spawnSerial:pose.spawnSerial||0,kitId:pose.kit.id,time},self.id);}
 function serverTime(){return snapshot?snapshot.time+Math.min(1000,clock()-lastSuccess):Date.now();}
 function tick(dt,newInput){
  if(snapshot?.round?.status!=='active')newInput={};const previous=input,pressed=newInput.fire===true&&!previous.fire;input=cleanInput(newInput);if(pressed)command('fire');const fresh=connected&&clock()-lastSuccess<1000;
  if(self&&snapshot&&fresh&&snapshot.round?.status==='active'){
   accumulator=Math.min(.1,accumulator+Math.max(0,dt));while(accumulator+1e-8>=MOVE_DT){predictPlayer(self,input,MOVE_DT,{...snapshot,time:serverTime(),preview:true});accumulator-=MOVE_DT;}
  }else{accumulator=0;if(self){self.speed=0;self.vertical=0;}}
  const moving=Math.hypot(input.x,input.z)>.06||input.up||input.down,pose=self?view.update(self,fresh?dt:0,{correct:!!moving&&fresh}):null;if(pose)pose.aimPitch=weaponAim(pose,input.weaponPitch).pitch;return pose;
 }
 return {join,start,ready,leave,tick,command,getTicket,blueprints,get room(){return roomCode;},get active(){return !!snapshot&&!!self&&!closed;},get connected(){return connected;},get self(){return view.state||self;},get snapshot(){return snapshot;},get stale(){return !connected||clock()-lastSuccess>1000;},serverTime};
}
