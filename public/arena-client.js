import {createMotionView} from './motion-view.js';
import {predictPlayer,cleanInput} from './arena-core.js';
import {MOVE_DT} from './movement.js';
import {packFrame,frameInput,MAX_MOVE_FRAMES} from './movement-stream.js';
import {validateBlueprint} from './blueprint.js';
export function createArenaClient({onSnapshot=()=>{},onStatus=()=>{},onEvent=()=>{},onError=()=>{}}={},runtime={}){
 const fetcher=runtime.fetcher||globalThis.fetch,clock=runtime.clock||(()=>performance.now()),setTimer=runtime.setTimer||setTimeout,clearTimer=runtime.clearTimer||clearTimeout;
 let roomCode=null,credentials=null,snapshot=null,self=null,timer=null,seq=0,commandId=0,commands=[],input={},joining=false,closed=false,lastEvent=0,revision=-1,lastSuccess=0,inFlight=false,epoch=null,lifecycle=0;
 let frames=[],nextFrame=0,motionEpoch=0,accumulator=0,jumpQueued=false;
 const blueprints=new Map(),loading=new Set(),view=createMotionView();
 async function request(path,body){const abort=new AbortController(),timeout=setTimer(()=>abort.abort(),12000);try{const r=await fetcher(path,{keepalive:path.endsWith('/leave'),method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:abort.signal,cache:'no-store'});let d;try{d=await r.json();}catch{throw Error('The arena did not respond. Reconnecting…');}if(!r.ok){const e=Error(d.error||'The arena could not connect.');e.status=r.status;throw e;}return d;}finally{clearTimer(timeout);}}
 function fetchBlueprint(id){if(!id||blueprints.has(id)||loading.has(id))return;loading.add(id);request('/api/arena/blueprint?id='+encodeURIComponent(id)).then(d=>blueprints.set(id,validateBlueprint(d.blueprint))).catch(e=>onError(e.message,e.status)).finally(()=>loading.delete(id));}
 function accept(s){
  if(!credentials)return;if(epoch!==null&&epoch!==s.epoch)throw Object.assign(Error('This arena has ended. Your position is held; join again to continue.'),{status:410});
  if(s.revision<=revision)return;
  const authoritative=structuredClone(s.players.find(p=>p.id===s.self)||null);
  if(!authoritative||authoritative.motion?.version!==1)throw Object.assign(Error('Your arena seat expired. Your position is held; join again to continue.'),{status:410});
  const teleport=!self||motionEpoch!==(authoritative.spawnSerial||0);
  if(teleport){frames=[];nextFrame=authoritative.motion.frame;accumulator=0;jumpQueued=false;motionEpoch=authoritative.spawnSerial||0;}
  else{frames=frames.filter(f=>f[0]>authoritative.motion.frame);nextFrame=Math.max(nextFrame,authoritative.motion.frame);}
  epoch=s.epoch;revision=s.revision;snapshot=s;self=authoritative;
  seq=Math.max(seq,self.lastSeq);commandId=Math.max(commandId,self.lastCommand);commands=commands.filter(c=>c.id>self.lastCommand);lastSuccess=clock();
  // Replay only movement the server has not acknowledged. No RTT extrapolation,
  // server position replacement, or automatic relocation on loadout changes.
  for(const frame of frames)predictPlayer(self,frameInput(frame),MOVE_DT,{...s,time:s.time,preview:true});
  view.accept(self,{teleport});
  for(const p of s.players){fetchBlueprint(p.kit.blueprintId);fetchBlueprint(p.building?.kit.blueprintId);}for(const p of s.placed||[])fetchBlueprint(p.blueprintId);
  if(lastEvent===0)lastEvent=Math.max(0,...s.events.map(e=>e.id));for(const e of s.events)if(e.id>lastEvent){onEvent(e,s.self);lastEvent=e.id;}
  onSnapshot(s);onStatus('online');
 }
 function schedule(delay=120){clearTimer(timer);if(credentials&&!closed)timer=setTimer(sync,delay);}
 async function sync(){if(!credentials||closed||inFlight)return;inFlight=true;const current=credentials,command=commands[0],packet={...current,seq:++seq,input,frames:frames.slice(),motionEpoch,command:command?{id:command.id,type:command.type,mode:command.mode}:undefined};if(command?.blueprint)packet.blueprint=command.blueprint;
  try{const result=await request(command?.blueprint?'/api/arena/build':'/api/arena/sync',packet);if(current!==credentials)return;accept(result.snapshot);schedule();}
  catch(e){if(current!==credentials)return;if(e.status===400||e.status===413){if(command)commands=commands.filter(c=>c.id!==command.id);onError(e.message,e.status);schedule(600);}else if([401,410].includes(e.status)){credentials=null;input={};jumpQueued=false;accumulator=0;clearTimer(timer);onStatus('expired');onError(e.message,e.status);}else{onStatus('reconnecting');schedule(e.status===429?1500:650);}}
  finally{inFlight=false;if(current!==credentials&&credentials&&!closed)schedule();}
 }
 async function join(name,room){
  if(joining)return false;joining=true;const generation=++lifecycle,old=credentials;credentials=null;clearTimer(timer);closed=false;onStatus('joining');
  try{
   if(old)try{await request('/api/arena/leave',old);}catch{}
   if(generation!==lifecycle)return false;
   const result=await request('/api/arena/join',{name,room,motionVersion:1});
   if(generation!==lifecycle){request('/api/arena/leave',{session:result.session,token:result.token}).catch(()=>{});return false;}
   view.reset();self=null;snapshot=null;commands=[];seq=0;commandId=0;revision=-1;lastEvent=0;epoch=null;frames=[];nextFrame=0;accumulator=0;jumpQueued=false;input={};
   roomCode=result.room;credentials={session:result.session,token:result.token};accept(result.snapshot);schedule();return true;
  }catch(e){if(generation===lifecycle){credentials=null;onStatus('offline');onError(e.message,e.status);}return false;}finally{joining=false;}
 }
 async function leave(){lifecycle++;closed=true;clearTimer(timer);const old=credentials;credentials=null;self=null;snapshot=null;view.reset();commands=[];frames=[];accumulator=0;jumpQueued=false;input={};onStatus('offline');if(old)try{await request('/api/arena/leave',old);}catch{} }
 function command(type,mode,blueprint){if(!credentials){if(self)onError('Your position is held. Open Arena and join again to continue.');return false;}if(!self||self.health<=0)return false;if(type==='jump'){if(self.kit.stats.mounted||self.jumpRemaining>0)return false;jumpQueued=true;return true;}if(type==='build'&&(self.building||serverTime()<self.buildReadyAt)){onError(self.building?'Let these bricks finish assembling.':`Next build in ${Math.ceil((self.buildReadyAt-serverTime())/1000)}s.`);return false;}if(commands.length>=4)return false;commands.push({id:++commandId,type,mode,blueprint});schedule(0);return true;}
 function serverTime(){return snapshot?snapshot.time+Math.min(1000,clock()-lastSuccess):Date.now();}
 function tick(dt,newInput){
  input=cleanInput(newInput);const fresh=credentials&&clock()-lastSuccess<1000;
  if(self&&snapshot&&fresh){
   accumulator=Math.min(.1,accumulator+Math.max(0,dt));
   while(accumulator+1e-8>=MOVE_DT&&frames.length<MAX_MOVE_FRAMES){
    const frame=packFrame(++nextFrame,{...input,jump:jumpQueued});jumpQueued=false;frames.push(frame);predictPlayer(self,frameInput(frame),MOVE_DT,{...snapshot,time:serverTime(),preview:true});accumulator-=MOVE_DT;
   }
   if(frames.length===MAX_MOVE_FRAMES)accumulator=0;
  }else{accumulator=0;jumpQueued=false;if(self){self.speed=0;self.vertical=0;}if(credentials&&clock()-lastSuccess>2500)onStatus('reconnecting');}
  const moving=Math.hypot(input.x,input.z)>.06||input.up||input.down;
  // Keep the last displayed pose when offline, and never pull an idle player
  // across the map to hide a network correction. Correct gradually while moving.
  return self?view.update(self,fresh?dt:0,{correct:!!moving&&!!fresh}):null;
 }
 return {join,leave,tick,command,blueprints,get room(){return roomCode;},get active(){return !!snapshot&&!!self&&!closed;},get connected(){return !!credentials;},get self(){return view.state||self;},get snapshot(){return snapshot;},get stale(){return !credentials||clock()-lastSuccess>1000;},serverTime};
}
