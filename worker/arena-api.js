import {avatarColor} from '../public/avatar-colors.js';
import {newMotion,validFrames} from '../public/movement-stream.js';
import {arenaStore,ArenaError,hash,nonce} from './arena-store.js';
import {addPlayer,removePlayer,applyInput,roomSnapshot,makeKit} from '../public/arena-core.js';
import {validateBlueprint} from '../public/blueprint.js';
import {SUPPLY_BLUEPRINTS} from '../public/supply-catalog.js';
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readPacket(request,max){const reader=request.body?.getReader();if(!reader)throw new ArenaError('Send an arena request.');let size=0,text='';const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ArenaError('That arena request is too large.',413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}catch(e){if(e instanceof ArenaError)throw e;throw new ArenaError('The arena request was not valid.');}finally{reader.releaseLock();}}
export async function handleArenaAPI(request,env,ctx={}){try{
 const url=new URL(request.url),principal=request.headers.get('oai-authenticated-user-id');if(!principal)return response({error:'Sign in with ChatGPT to join the arena.'},401);
 const store=arenaStore(env.DB);
 if(url.pathname==='/api/arena/blueprint'&&request.method==='GET'){const id=url.searchParams.get('id');if(SUPPLY_BLUEPRINTS.has(id))return response({blueprint:SUPPLY_BLUEPRINTS.get(id)});if(!/^[a-f0-9]{64}$/.test(id||''))throw new ArenaError('Unknown creation.');const b=await store.blueprint(id);return b?response({blueprint:b}):response({error:'Creation not found.'},404);}
 if(request.method!=='POST')return response({error:'Use an arena action.'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return response({error:'Open Brickwild to play.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'Use a game action.'},415);
 const packet=await readPacket(request,url.pathname==='/api/arena/build'?100000:url.pathname==='/api/arena/sync'?16384:4096);
 if(url.pathname==='/api/arena/join'){
  const roomId=String(packet.room||'ISLAND').trim().toUpperCase();if(!/^[A-Z0-9]{4,8}$/.test(roomId))throw new ArenaError('Use a room code with 4–8 letters or numbers.');
  const resume=packet.resume;if(resume&&(!/^[a-f0-9-]{36}$/.test(resume.session||'')||!/^[a-f0-9]{64}$/.test(resume.token||'')))throw new ArenaError('Invalid join attempt. Exit to home and try again.');
  const name=String(packet.name||'Builder').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,20)||'Builder',id=resume?.session||crypto.randomUUID(),token=resume?.token||nonce();
  // A retry proves possession of the same random token and reuses one seat.
  // Reserve durably before the room write, so a lost response is recoverable.
  const saved=await store.saveSession({id,tokenHash:await hash(token),principal,roomId,playerId:crypto.randomUUID()}),playerId=saved.player_id;
  try{const {room}=await store.mutate(roomId,async(r,t)=>{if(!await env.DB.prepare('SELECT id FROM arena_sessions WHERE id = ?').bind(id).first())throw new ArenaError('This join was canceled. Join again to continue.',410);const p=r.players[playerId]||addPlayer(r,playerId,name,t);p.lastSeen=t;p.name=name;p.avatarColor=avatarColor(packet.avatarColor);if(packet.motionVersion===1&&!p.motion)p.motion=newMotion(t);return p;});ctx.waitUntil?.(store.cleanup().catch(()=>{}));return response({session:id,token,room:roomId,snapshot:roomSnapshot(room,playerId)});}catch(e){if(!resume)await env.DB.prepare('DELETE FROM arena_sessions WHERE id = ?').bind(id).run();throw e;}

 }
 const session=await store.session(request,packet);
 if(url.pathname==='/api/arena/leave'){await env.DB.prepare('DELETE FROM arena_sessions WHERE id = ?').bind(session.id).run();await store.mutate(session.room_id,r=>removePlayer(r,session.player_id));return response({left:true});}
 if(!['/api/arena/sync','/api/arena/build'].includes(url.pathname))return response({error:'Not found.'},404);
 if(!Number.isSafeInteger(packet.seq)||packet.seq<1||packet.seq>1e12)throw new ArenaError('Invalid input sequence.');
 if(packet.frames!==undefined&&(!validFrames(packet.frames)||!Number.isSafeInteger(packet.motionEpoch)||packet.motionEpoch<0))throw new ArenaError('Invalid movement frames.');
 let kit=null;
 if(packet.command?.type==='build'){
  const mode=packet.command.mode;if(['car','plane','bow','sword','foot'].includes(mode))kit=makeKit(mode);
  else if(url.pathname==='/api/arena/build'&&packet.blueprint){let b;try{b=validateBlueprint(packet.blueprint);}catch{throw new ArenaError('That creation is invalid. Try designing it again.');}const row=await env.DB.prepare('SELECT snapshot FROM arena_rooms WHERE id = ?').bind(session.room_id).first(),p=row&&JSON.parse(row.snapshot).players[session.player_id];if(!p)throw new ArenaError('Your arena session expired. Join again.',410);if(packet.seq>p.lastSeq&&packet.command.id>p.lastCommand){if(p.health<=0||p.building||Date.now()<p.buildReadyAt)throw new ArenaError('Wait until your next build is ready.');await store.reserveBuild(session.id);kit=makeKit('pending',b);const id=await store.saveBlueprint(b);kit.id=id;kit.blueprintId=id;}}
  else throw new ArenaError('Choose a starter build or a valid creation.');
 }
 const {room}=await store.mutate(session.room_id,(r,t)=>applyInput(r,session.player_id,packet,t,kit));return response({snapshot:roomSnapshot(room,session.player_id,packet.afterEvent)});
 }catch(e){return response({error:e instanceof ArenaError||[410,422].includes(e.status)?e.message:'The shared arena could not sync. Your controls will resume when it reconnects.'},e instanceof ArenaError||[410,422].includes(e.status)?e.status:503);}}
