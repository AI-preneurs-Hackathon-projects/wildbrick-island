import {creationPrompt} from '../public/blueprint.js';

export const TRANSCRIPTION_LIMITS=Object.freeze({bytes:4*1024*1024,uploadMs:30000,upstreamMs:30000,responseBytes:8192});
const MODEL='gpt-4o-mini-transcribe',UPSTREAM='https://api.openai.com/v1/audio/transcriptions';
const reply=(status,code,error)=>Response.json({code,error},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Configuration readiness only: no provider request, admission or database write.
export function transcriptionStatus(request,env){
 if(!request.headers.get('oai-authenticated-user-id'))return reply(401,'unauthenticated','Sign in to use recorded voice.');
 if(request.method!=='GET')return reply(405,'method','Use GET to check recorded voice.');
 const origin=new URL(request.url).origin;
 if((request.headers.get('origin')&&request.headers.get('origin')!==origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,'origin','Open Brickwild to record an idea.');
 return Response.json({configured:!!env.OPENAI_API_KEY&&env.OPENAI_TRANSCRIPTION_MODEL===MODEL&&typeof env.DB?.prepare==='function'},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
class Rejection extends Error{constructor(status,code,message){super(message);Object.assign(this,{status,code});}}

async function readBytes(body,max,signal){
 const reader=body?.getReader();if(!reader)throw new Rejection(400,'invalid_audio','Record some audio first.');
 const chunks=[];let size=0;const abort=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{while(true){if(signal.aborted){await reader.cancel();throw new Error('aborted');}const {done,value}=await reader.read();if(signal.aborted)throw new Error('aborted');if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Rejection(413,'too_large','The recording is too large.');}chunks.push(value);}}
 finally{signal.removeEventListener('abort',abort);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function audioType(header){const parts=(header||'').toLowerCase().split(';').map(x=>x.trim());if(!['audio/webm','audio/mp4'].includes(parts[0]))return null;if(parts.slice(1).some(p=>!/^codecs="?[a-z0-9., -]+"?$/.test(p)))return null;return parts[0];}
function containerMatches(bytes,type){
 // Reject empty/obviously mislabeled input before a paid request. Full codec and
 // container decoding belongs to the provider; a header is not proof of audio.
 if(bytes.length<16)return false;
 if(type==='audio/webm')return [0x1a,0x45,0xdf,0xa3].every((b,i)=>bytes[i]===b);
 return String.fromCharCode(...bytes.slice(4,8))==='ftyp'&&new DataView(bytes.buffer).getUint32(0)>=8;
}
async function admission(db,principal,attempt){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([principal,attempt]))),id='voice-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),now=Date.now();
 // Same table, limits and lease as reserveGeneration. OR IGNORE on the existing
 // primary key makes same-attempt admission atomic across Worker isolates.
 await db.prepare('DELETE FROM generation_requests WHERE started_at < ? AND expires_at < ?').bind(now-60000,now).run();
 const result=await db.prepare(`INSERT OR IGNORE INTO generation_requests (id, principal, started_at, expires_at)
 SELECT ?, ?, ?, ? WHERE
 (SELECT COUNT(*) FROM generation_requests WHERE expires_at > ?) < 4 AND
 (SELECT COUNT(*) FROM generation_requests WHERE started_at > ?) < 30 AND
 (SELECT COUNT(*) FROM generation_requests WHERE principal = ? AND started_at > ?) < 8`).bind(id,principal,now,now+95000,now,now-60000,principal,now-60000).run();
 if(result.meta.changes!==1){const duplicate=await db.prepare('SELECT id FROM generation_requests WHERE id = ?').bind(id).first();throw new Rejection(duplicate?409:429,duplicate?'duplicate':'busy',duplicate?'This recording was already submitted.':'Voice is busy. Wait a minute before trying again.');}
 return ()=>db.prepare('UPDATE generation_requests SET expires_at = 0 WHERE id = ?').bind(id).run();
}
export async function handleTranscription(request,env,upstream=fetch,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const url=new URL(request.url),principal=request.headers.get('oai-authenticated-user-id');
 if(!principal)return reply(401,'unauthenticated','Sign in to use recorded voice.');
 if(request.method!=='POST')return reply(405,'method','Use the Record action.');
 if((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,'origin','Open Brickwild to record an idea.');
 const type=audioType(request.headers.get('content-type'));if(!type)return reply(415,'format','Record WebM or MP4 audio.');
 const attempt=request.headers.get('x-voice-attempt');if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(attempt||'')||url.search)return reply(400,'attempt','Start a new recording from the game.');
 if(Number(request.headers.get('content-length'))>TRANSCRIPTION_LIMITS.bytes)return reply(413,'too_large','The recording is too large.');
 if(!env.OPENAI_API_KEY||env.OPENAI_TRANSCRIPTION_MODEL!==MODEL)return reply(503,'unavailable','Recorded voice is not configured. Ask the owner to enable transcription.');
 if(!env.DB?.prepare)return reply(503,'unavailable','Voice admission is unavailable. Try again later.');
 const controller=new AbortController(),abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
 let timer=setTimer(abort,TRANSCRIPTION_LIMITS.uploadMs),release;
 try{
  const bytes=await readBytes(request.body,TRANSCRIPTION_LIMITS.bytes,controller.signal);
  if(!containerMatches(bytes,type))throw new Rejection(400,'invalid_audio','No usable audio was recorded.');
  try{release=await admission(env.DB,principal,attempt);}catch(e){if(e instanceof Rejection)throw e;throw new Rejection(503,'unavailable','Voice admission is unavailable. Try again later.');}
  if(controller.signal.aborted)throw new Error('aborted');
  clearTimer(timer);timer=setTimer(abort,TRANSCRIPTION_LIMITS.upstreamMs);
  const form=new FormData();form.set('file',new Blob([bytes],{type}),'recording.'+(type==='audio/webm'?'webm':'mp4'));form.set('model',MODEL);form.set('response_format','json');
  // No retries. An abort may stop delivery, but cannot promise billing reversal.
  const response=await upstream(UPSTREAM,{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:form,signal:controller.signal});
  if(controller.signal.aborted)throw new Error('aborted');
  if(!response.ok){await response.body?.cancel();throw new Rejection(response.status===429?429:502,response.status===429?'busy':'upstream','Transcription is unavailable. Try again when ready.');}
  let text;try{const data=JSON.parse(new TextDecoder().decode(await readBytes(response.body,TRANSCRIPTION_LIMITS.responseBytes,controller.signal)));text=creationPrompt(data.text);}catch(e){if(controller.signal.aborted)throw e;throw new Rejection(422,'invalid_transcript','Use a description between 2 and 360 characters. Record again or type an idea.');}
  if(controller.signal.aborted)throw new Error('aborted');
  return Response.json({text},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){if(controller.signal.aborted)return reply(504,'timeout','Transcription was canceled or took too long. No retry was sent.');if(e instanceof Rejection)return reply(e.status,e.code,e.message);return reply(502,'upstream','Transcription was interrupted. No retry was sent.');}
 finally{clearTimer(timer);request.signal.removeEventListener('abort',abort);await release?.().catch(()=>{});}
}
