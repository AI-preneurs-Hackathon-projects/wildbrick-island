import {solveWeaponAim} from './aiming.js';
import {MAP_CYCLE} from './map-catalog.js';
import {weaponAim} from './weapon-aim.js';
import {createMotionView} from './motion-view.js';
import {predictPlayer,cleanInput} from './arena-core.js?v=41';
import {MOVE_DT} from './movement.js';
import {packFrame,frameInput,MAX_MOVE_FRAMES} from './movement-stream.js';
import {validateBlueprint} from './blueprint.js';
import {SUPPLY_BLUEPRINTS} from './supply-catalog.js';
import {createRealtimeArenaClient} from './realtime-arena-client.js';
export function createHttpArenaClient({onSnapshot=()=>{},onStatus=()=>{},onEvent=()=>{},onError=()=>{}}={},runtime={}){
 const fetcher=runtime.fetcher||globalThis.fetch,clock=runtime.clock||(()=>performance.now()),setTimer=runtime.setTimer||setTimeout,clearTimer=runtime.clearTimer||clearTimeout;
 let roomCode=null,credentials=null,snapshot=null,self=null,timer=null,seq=0,commandId=0,commands=[],input={},joining=false,closed=false,lastEvent=0,revision=-1,lastSuccess=0,inFlight=false,readyPending=null,epoch=null,lifecycle=0;
 let previewAt=-Infinity,fireHeldAt=0,joinTicket=null;
 let frames=[],nextFrame=0,motionEpoch=0,accumulator=0,jumpQueued=false;
 // Match each local preview to its exact acknowledgement, even after a retry.
 const predictedCommands=new Set();
 const blueprints=new Map(SUPPLY_BLUEPRINTS),loading=new Set(),view=createMotionView();
 async function request(path,body){const abort=new AbortController(),timeout=setTimer(()=>abort.abort(new DOMException('Arena request timed out','TimeoutError')),12000);try{const r=await fetcher(path,{keepalive:path.endsWith('/leave'),method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal,cache:'no-store'});let d;try{d=await r.json();}catch{throw Object.assign(Error('The Arena server returned an invalid response. Try joining again.'),{status:r.status});}if(!r.ok){const e=Error(d.error||'The arena could not connect.');e.status=r.status;throw e;}return d;}catch(e){if(abort.signal.aborted)throw Object.assign(Error('The Arena connection timed out. Please try Join Arena again; your retry will reuse the same player.'),{code:'timeout'});if(e.name==='AbortError')throw Object.assign(Error('The Arena connection was interrupted. Please try Join Arena again.'),{code:'canceled'});throw e;}finally{clearTimer(timeout);}}
 function fetchBlueprint(id){if(!id||blueprints.has(id)||loading.has(id))return;loading.add(id);const current=lifecycle;request('/api/arena/blueprint?id='+encodeURIComponent(id)).then(d=>{if(current===lifecycle&&!closed)blueprints.set(id,validateBlueprint(d.blueprint));}).catch(e=>{if(current===lifecycle&&!closed)onError(e.message,e.status);}).finally(()=>loading.delete(id));}
 function accept(s){
  if(!credentials)return;if(epoch!==null&&epoch!==s.epoch)throw Object.assign(Error('This arena has ended. Your position is held; join again to continue.'),{status:410});
  if(s.revision<=revision)return;if(s.round?.mapId&&!MAP_CYCLE.includes(s.round.mapId))throw Object.assign(Error('A new Arena map is available. Refresh the Site to continue.'),{status:410});
  const authoritative=structuredClone(s.players.find(p=>p.id===s.self)||null);
  if(!authoritative||authoritative.motion?.version!==1)throw Object.assign(Error('Your arena seat expired. Your position is held; join again to continue.'),{status:410});
  const teleport=!self||motionEpoch!==(authoritative.spawnSerial||0);
  if(teleport){previewAt=-Infinity;input={};commands=[];predictedCommands.clear();frames=[];nextFrame=authoritative.motion.frame;accumulator=0;jumpQueued=false;motionEpoch=authoritative.spawnSerial||0;}
  else{frames=frames.filter(f=>f[0]>authoritative.motion.frame);nextFrame=Math.max(nextFrame,authoritative.motion.frame);}
  epoch=s.epoch;revision=s.revision;snapshot=s;self=authoritative;
  seq=Math.max(seq,self.lastSeq);commandId=Math.max(commandId,self.lastCommand);commands=commands.filter(c=>c.id>self.lastCommand);lastSuccess=clock();
  // Replay only movement the server has not acknowledged. No RTT extrapolation,
  // server position replacement, or automatic relocation on loadout changes.
  for(const frame of frames)predictPlayer(self,frameInput(frame),MOVE_DT,{...s,time:s.time,preview:true});
  view.accept(self,{teleport});
  for(const p of s.players){fetchBlueprint(p.kit.blueprintId);fetchBlueprint(p.building?.kit.blueprintId);}for(const p of s.placed||[])fetchBlueprint(p.blueprintId);for(const item of s.items||[])fetchBlueprint(item.kit.blueprintId);
  // Install the authoritative world before playing events from that world.
  onSnapshot(s);
  if(lastEvent===0)lastEvent=s.eventCursor??Math.max(0,...s.events.map(e=>e.id));for(const e of s.events)if(e.id>lastEvent){onEvent({...e,predicted:e.player===s.self&&['shot','swing'].includes(e.type)&&predictedCommands.delete(e.commandId)},s.self);lastEvent=e.id;}lastEvent=Math.max(lastEvent,s.eventCursor||0);
  onStatus('online');
 }
 function schedule(delay=0){clearTimer(timer);if(credentials&&!closed)timer=setTimer(sync,delay);}
 async function sync(){if(!credentials||closed||inFlight)return;inFlight=true;const sentAt=clock(),current=credentials,command=commands[0],packet={...current,mapVersion:1,seq:++seq,input:{...input,fire:input.fire&&clock()-fireHeldAt>=Math.max(180,(self?.kit.stats.interval||.5)*1000)},afterEvent:lastEvent,frames:frames.slice(),motionEpoch,roundId:snapshot?.round?.id,command:command?{id:command.id,type:command.type,mode:command.mode,roundId:command.roundId}:undefined};if(command?.blueprint)packet.blueprint=command.blueprint;
  try{const result=await request(command?.blueprint?'/api/arena/build':'/api/arena/sync',packet);if(current!==credentials)return;
   // A rejected old-round build must never replace the retained kit's model.
   // accept() fetches unknown blueprints by their authoritative server IDs.
   // Pace from request start, not response arrival: no extra network-idle gap.
   accept(result.snapshot);schedule(Math.max(0,100-(clock()-sentAt)));}
  catch(e){if(current!==credentials)return;if(e.status===400||e.status===413){if(command)commands=commands.filter(c=>c.id!==command.id);onError(e.message,e.status);schedule(600);}else if([401,410].includes(e.status)){credentials=null;input={};jumpQueued=false;accumulator=0;clearTimer(timer);onStatus('expired');onError(e.message,e.status);}else{onStatus('reconnecting');schedule(e.status===429?1500:650);}}
  finally{inFlight=false;if(current!==credentials&&credentials&&!closed)schedule();}
 }
 async function join(name,room,avatarColor,create=false){
  if(joining)return false;joining=true;const generation=++lifecycle;joinTicket=credentials||joinTicket||{session:crypto.randomUUID(),token:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')};const ticket=joinTicket;credentials=null;clearTimer(timer);closed=false;onStatus('joining');
  try{
   if(generation!==lifecycle)return false;
   const result=await request('/api/arena/join',{name,room,create,avatarColor,motionVersion:1,mapVersion:1,resume:ticket});
   if(generation!==lifecycle){request('/api/arena/leave',{session:result.session,token:result.token}).catch(()=>{});return false;}
   view.reset();self=null;snapshot=null;commands=[];predictedCommands.clear();previewAt=-Infinity;seq=0;commandId=0;revision=-1;lastEvent=0;epoch=null;frames=[];nextFrame=0;accumulator=0;jumpQueued=false;input={};
   roomCode=result.room;credentials={session:result.session,token:result.token};accept(result.snapshot);schedule();return true;
  }catch(e){if(generation===lifecycle){credentials=null;onStatus('offline');onError(e.message,e.status);}return false;}finally{if(generation===lifecycle)joining=false;}
 }
 async function start(){if(!credentials||snapshot?.round?.status!=='waiting')return false;try{const result=await request('/api/arena/start',credentials);accept(result.snapshot);schedule(0);return true;}catch(e){onError(e.message,e.status);return false;}}
 async function ready(){if(!credentials||snapshot?.round?.status!=='finished'||snapshot?.match?.complete)return false;if(readyPending)return readyPending;readyPending=(async()=>{const current=credentials;clearTimer(timer);while(inFlight&&current===credentials)await new Promise(resolve=>setTimer(resolve,10));if(current!==credentials||snapshot?.round?.status!=='finished'||snapshot?.match?.complete){readyPending=null;return false;}clearTimer(timer);inFlight=true;try{const result=await request('/api/arena/ready',{...current,roundId:snapshot.round.id});if(current!==credentials)return false;accept(result.snapshot);return true;}catch(e){if(current===credentials)onError(e.message,e.status);return false;}finally{inFlight=false;readyPending=null;if(current===credentials)schedule(0);}})();return readyPending;}
 async function leave(){lifecycle++;joining=false;closed=true;clearTimer(timer);const old=credentials||joinTicket;joinTicket=null;credentials=null;self=null;snapshot=null;view.reset();commands=[];predictedCommands.clear();frames=[];accumulator=0;jumpQueued=false;input={};onStatus('offline');if(old)try{await request('/api/arena/leave',old);}catch{} }
 function command(type,mode,blueprint){if(!credentials){if(self)onError('Your position is held. Open Arena and join again to continue.');return false;}if(!self)return false;if(type==='restart')return false;if(snapshot?.round?.status!=='active'||self.health<=0)return false;if(type==='jump'){if(self.kit.stats.mounted||self.jumpRemaining>0)return false;jumpQueued=true;return true;}if(type==='build'&&(self.building||serverTime()<self.buildReadyAt)){onError(self.building?'Let these bricks finish assembling.':`Next build in ${Math.ceil((self.buildReadyAt-serverTime())/1000)}s.`);return false;}if(commands.length>=4)return false;const id=++commandId;commands.push({id,type,mode,blueprint});if(type==='fire')previewAttack(id);schedule(0);return true;}
 function previewAttack(id){const time=serverTime(),k=self?.kit.stats;if(!k||clock()-lastSuccess>=1000||self.health<=0||self.building||!k.damage||time<self.protectedUntil||time<self.overheatedUntil||clock()-previewAt<k.interval*1000)return;previewAt=clock();predictedCommands.add(id);while(predictedCommands.size>64)predictedCommands.delete(predictedCommands.values().next().value);const pose=view.state||self,aim=solveWeaponAim(snapshot,pose);onEvent({type:'attack-preview',commandId:id,player:self.id,weapon:k.weapon,yaw:aim.yaw,pitch:0,origin:aim.launchContact?aim.anchor:aim.muzzle,muzzle:aim.muzzle,aimYaw:aim.yaw,aimCorrection:aim.correction,roundId:snapshot.round?.id,spawnSerial:pose.spawnSerial||0,kitId:pose.kit.id,time},self.id);}

 function serverTime(){return snapshot?snapshot.time+Math.min(1000,clock()-lastSuccess):Date.now();}
 function tick(dt,newInput){
  if(snapshot?.round?.status!=='active')newInput={};const pressed=newInput.fire===true&&!input.fire;input=cleanInput(newInput);if(pressed){fireHeldAt=clock();command('fire');}const fresh=credentials&&clock()-lastSuccess<1000;
  if(self&&snapshot&&fresh&&snapshot.round?.status==='active'){
   accumulator=Math.min(.1,accumulator+Math.max(0,dt));
   while(accumulator+1e-8>=MOVE_DT&&frames.length<MAX_MOVE_FRAMES){
    const frame=packFrame(++nextFrame,{...input,jump:jumpQueued});jumpQueued=false;frames.push(frame);predictPlayer(self,frameInput(frame),MOVE_DT,{...snapshot,time:serverTime(),preview:true});accumulator-=MOVE_DT;
   }
   if(frames.length===MAX_MOVE_FRAMES)accumulator=0;
  }else{accumulator=0;jumpQueued=false;if(self){self.speed=0;self.vertical=0;}if(credentials&&clock()-lastSuccess>2500)onStatus('reconnecting');}
  const moving=Math.hypot(input.x,input.z)>.06||input.up||input.down;
  // Keep the last displayed pose when offline, and never pull an idle player
  // across the map to hide a network correction. Correct gradually while moving.
  const pose=self?view.update(self,fresh?dt:0,{correct:!!moving&&!!fresh}):null;if(pose){pose.aimPitch=weaponAim(pose,input.weaponPitch).pitch;}return pose;
 }
 return {join,start,ready,leave,tick,command,blueprints,get room(){return roomCode;},get active(){return !!snapshot&&!!self&&!closed;},get connected(){return !!credentials;},get self(){return view.state||self;},get snapshot(){return snapshot;},get stale(){return !credentials||clock()-lastSuccess>1000;},serverTime};
}

// Production opts into transport discovery explicitly from main.js. Existing
// fixtures keep exercising the recoverable HTTP implementation unless they ask
// for realtime, so rollback remains a small server flag rather than a second
// authority racing an already-open room.
export function createArenaClient(callbacks={},runtime={}){
 const http=createHttpArenaClient(callbacks,runtime);
 if(runtime.realtime!==true)return http;
 const fetcher=runtime.fetcher||globalThis.fetch;
 const realtime=createRealtimeArenaClient(callbacks,{...runtime,async getTicket(room,create){
  const response=await fetcher('/api/arena/realtime-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room,create}),cache:'no-store',credentials:'same-origin'});
  let data;try{data=await response.json();}catch{throw Object.assign(Error('The Arena transport returned an invalid response.'),{status:response.status});}
  if(!response.ok)throw Object.assign(Error(data.error||'The Arena transport is unavailable.'),{status:response.status});
  return data;
 }});
 let selected=null;
 async function join(name,room,color,create=false){
  let ticket;try{ticket=await realtime.getTicket(room,create);}catch(error){callbacks.onStatus?.('offline');callbacks.onError?.(error.message,error.status);return false;}
  if(ticket?.enabled===false){selected=http;return http.join(name,room,color,create);}
  if(ticket?.enabled!==true||ticket.transport!=='realtime-v1'){callbacks.onStatus?.('offline');callbacks.onError?.('The Arena transport configuration is incomplete.',503);return false;}
  selected=realtime;return realtime.join(name,room,color,create,ticket);
 }
 const call=(name,...args)=>selected?.[name]?.(...args)??false;
 return {join,start:(...a)=>call('start',...a),ready:(...a)=>call('ready',...a),leave:(...a)=>call('leave',...a),tick:(...a)=>call('tick',...a),command:(...a)=>call('command',...a),get blueprints(){return selected?.blueprints||http.blueprints;},get room(){return selected?.room||null;},get active(){return !!selected?.active;},get connected(){return !!selected?.connected;},get self(){return selected?.self||null;},get snapshot(){return selected?.snapshot||null;},get stale(){return selected?selected.stale:true;},serverTime(){return selected?.serverTime?.()||Date.now();}};
}
