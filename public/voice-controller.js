import {creationPrompt} from './blueprint.js';

export const VOICE_LIMITS=Object.freeze({recordMs:30000,bytes:4*1024*1024,transcribeMs:30000,startMs:8000,stopMs:4000,permissionMs:30000});
// Only containers accepted by the server/provider. Ogg-only browsers get an honest error.
export const RECORDING_TYPES=Object.freeze(['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4']);
export function recordingType(Recorder){try{return RECORDING_TYPES.find(t=>Recorder?.isTypeSupported?.(t))||null;}catch{return null;}}
const container=t=>String(t||'').split(';')[0].trim().toLowerCase();

// All browser effects are owned by one attempt. Injected platform objects are for
// isolated tests; the production UI always uses the same-origin fetch below.
export function createVoice({onCommand,onState=()=>{},onNotice=()=>{},onFallback=()=>{},platform={}}){
 const browser=globalThis.window||globalThis;
 const Recognition=platform.Recognition===undefined?(browser.SpeechRecognition||browser.webkitSpeechRecognition):platform.Recognition;
 const Recorder=platform.MediaRecorder===undefined?browser.MediaRecorder:platform.MediaRecorder;
 const media=platform.mediaDevices||globalThis.navigator?.mediaDevices;
 const send=platform.fetch||globalThis.fetch,now=platform.now||(()=>performance.now());
 const later=platform.setTimeout||setTimeout,clear=platform.clearTimeout||clearTimeout;
 let serial=0,current=null,state='idle',preferRecording=false;
 const alive=a=>current===a&&a.id===serial;
 function notify(s,text){state=s;onState(s,text);}
 function timer(a,name,ms,fn){clear(a.timers.get(name));a.timers.set(name,later(()=>{a.timers.delete(name);if(alive(a))fn();},ms));}
 function clearTimer(a,name){clear(a.timers.get(name));a.timers.delete(name);}
 function tracks(a){for(const t of a.stream?.getTracks()||[]){t.onended=null;t.onmute=null;try{t.stop();}catch{}}a.stream=null;}
 function cleanup(a){
  for(const t of a.timers.values())clear(t);a.timers.clear();a.abort?.abort();
  try{a.recognition?.abort();}catch{}
  if(a.recorder){a.recorder.ondataavailable=a.recorder.onstop=a.recorder.onerror=null;try{if(a.recorder.state!=='inactive')a.recorder.stop();}catch{}}
  tracks(a);a.chunks=[];a.final='';
 }
 function retire(a){if(!alive(a))return false;current=null;serial++;cleanup(a);return true;}
 function stop(){const a=current;if(a)retire(a);else serial++;notify('canceled','Voice canceled.');}
 function begin(route){if(current)retire(current);const a={id:++serial,route,timers:new Map(),chunks:[],bytes:0,final:'',finalAt:0,stopping:false};current=a;return a;}
 function offer(message,draft='',available=true){preferRecording=true;notify('error',message);onNotice(message,6000);onFallback(message,{draft,canRecord:available&&!!media?.getUserMedia&&!!recordingType(Recorder)});}
 function fail(a,message,draft='',available=true){if(retire(a))offer(message,draft,available);}
 function complete(a,text){
  if(!alive(a))return;
  let prompt;try{prompt=creationPrompt(text);}catch{fail(a,'Use 2–360 characters. Record again or edit your description.',typeof text==='string'?text:'');return;}
  const timing={speechCompletionMs:a.finalAt?now()-a.finalAt:null,voiceRoute:a.route};
  retire(a);const completedSerial=serial;notify('ready',`“${prompt}”`);
  // A synchronous transition/cancel from the presentation callback also wins.
  if(serial===completedSerial)onCommand(prompt,timing);
 }
 function finishNative(a){if(a.final)complete(a,a.final);else fail(a,'No speech was captured. Record instead or type an idea.');}
 function stopCapture(a){
  if(!alive(a)||a.stopping)return;a.stopping=true;clearTimer(a,'duration');clearTimer(a,'tick');clearTimer(a,'startup');notify('stopping','Finishing your recording…');
  timer(a,'stop',VOICE_LIMITS.stopMs,()=>a.route==='native'?finishNative(a):fail(a,'The microphone could not finish. Record again when ready.'));
  try{if(a.route==='native')a.recognition.stop();else {a.recorder.stop();tracks(a);}}catch{fail(a,'The microphone could not finish. Record again when ready.');}
 }
 function start(){
  if(current){if(['listening','recording'].includes(state))stopCapture(current);else if(['checking','requesting-permission'].includes(state))stop();return;}
  if(preferRecording||!Recognition){offer('Record your idea instead, or type it.');return;}
  const a=begin('native');notify('requesting-permission','Starting speech…');
  timer(a,'startup',VOICE_LIMITS.startMs,()=>fail(a,'Speech did not start. Record instead or type an idea.'));
  try{
   const r=a.recognition=new Recognition();r.lang='en-US';r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
   r.onstart=()=>{if(!alive(a))return;clearTimer(a,'startup');notify('listening','Listening… press ← to finish');timer(a,'duration',VOICE_LIMITS.recordMs,()=>stopCapture(a));};
   r.onresult=e=>{if(!alive(a))return;const final=[],heard=[];for(const result of Array.from(e.results||[])){const text=result[0]?.transcript;if(typeof text!=='string')continue;heard.push(text);if(result.isFinal)final.push(text);}a.final=final.join(' ').trim();if(a.final)a.finalAt=now();onState(state,`“${heard.join(' ')}”`);};
   r.onerror=e=>{if(!alive(a))return;if(a.final){complete(a,a.final);return;}if(e.error==='aborted'){stop();return;}const message=e.error==='not-allowed'?'Microphone access is blocked. Check browser settings before trying again, or type an idea.':e.error==='no-speech'?'No speech was captured. Record instead or type an idea.':'Browser speech is unavailable. Record instead or type an idea.';fail(a,message);};
   r.onend=()=>{if(alive(a))finishNative(a);};r.start();
  }catch{fail(a,'Browser speech could not start. Record instead or type an idea.');}
 }
 async function upload(a,blob){
  if(!alive(a))return;notify('transcribing','Turning your recording into words…');a.abort=new AbortController();
  timer(a,'upload',VOICE_LIMITS.transcribeMs,()=>fail(a,'Transcription took too long. No automatic retry was sent. Record again when ready.'));
  try{
   const response=await send('/api/transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type,'X-Voice-Attempt':globalThis.crypto.randomUUID()},body:blob,signal:a.abort.signal});
   if(!alive(a))return;const data=await response.json();if(!alive(a))return;
   if(!response.ok){const messages={unavailable:'Recorded voice is not configured here. Ask the owner to enable it, or type an idea.',unauthenticated:'Sign in to use recorded voice.',busy:'Voice is busy. Wait a minute before recording again.',duplicate:'This recording was already submitted. No retry was sent.',invalid_transcript:'The words need editing. Use 2–360 characters, or record again.'};fail(a,messages[data.code]||'The recording could not be transcribed. No automatic retry was sent.');return;}
   complete(a,data.text);
  }catch{if(alive(a))fail(a,'The recording could not be transcribed. No automatic retry was sent.');}
 }
 // This method must only be called by the explicit Record action next to the
 // audio-upload notice. Preference never silently grants recording/upload consent.
 async function record(){
  if(current)return;preferRecording=true;const a=begin('recorded'),mime=recordingType(Recorder);
  if(!mime||!media?.getUserMedia){fail(a,'Recording is unavailable in this browser. Type an idea or try another browser.');return;}
  notify('checking','Checking recorded voice…');if(!alive(a))return;a.abort=new AbortController();
  timer(a,'availability',VOICE_LIMITS.startMs,()=>fail(a,'Could not check recorded voice. Try Speak again later, or type an idea.','',false));
  try{
   const response=await send('/api/transcription-status',{method:'GET',credentials:'same-origin',cache:'no-store',signal:a.abort.signal});
   if(!alive(a))return;const status=await response.json();if(!alive(a))return;
   if(!response.ok||status.configured!==true){fail(a,response.status===401?'Sign in to use recorded voice.':'Recorded voice is unavailable here. Type an idea, or try Speak again after the owner enables it.','',false);return;}
  }catch{if(alive(a))fail(a,'Could not check recorded voice. Try Speak again later, or type an idea.','',false);return;}
  clearTimer(a,'availability');
  notify('requesting-permission','Allow microphone access to record.');if(!alive(a))return;
  timer(a,'permission',VOICE_LIMITS.permissionMs,()=>fail(a,'Microphone permission is still pending. Cancel the browser prompt or try again when ready.'));
  try{
   const stream=await media.getUserMedia({audio:true});
   if(!alive(a)){for(const t of stream.getTracks())t.stop();return;}a.stream=stream;clearTimer(a,'permission');
   if(!stream.getAudioTracks().length){fail(a,'No microphone is available. Connect one or type an idea.');return;}
   for(const t of stream.getTracks()){t.onended=()=>fail(a,'The microphone disconnected. Record again when ready.');t.onmute=()=>fail(a,'The microphone stopped supplying audio. Record again when ready.');}
   const r=a.recorder=new Recorder(stream,{mimeType:mime,audioBitsPerSecond:64000});
   r.ondataavailable=e=>{if(!alive(a)||a.uploading||!e.data?.size)return;if(e.data.type){if(!['audio/webm','audio/mp4'].includes(container(e.data.type))||(a.chunkType&&container(a.chunkType)!==container(e.data.type))){fail(a,'The recording format changed. Try another browser or type an idea.');return;}a.chunkType=e.data.type;}a.bytes+=e.data.size;if(a.bytes>VOICE_LIMITS.bytes){fail(a,'That recording is too large. Try a shorter idea.');return;}a.chunks.push(e.data);};
   r.onerror=()=>fail(a,'The microphone could not record. Check it and try again when ready.');
   r.onstop=()=>{if(!alive(a)||a.uploading)return;if(!a.stopping){fail(a,'Recording stopped unexpectedly. Record again when ready.');return;}clearTimer(a,'stop');tracks(a);const type=a.chunkType||r.mimeType;if(!a.bytes||!['audio/webm','audio/mp4'].includes(container(type))){fail(a,'No usable audio was recorded. Record again or type an idea.');return;}a.uploading=true;const blob=new Blob(a.chunks,{type});a.chunks=[];upload(a,blob);};
   r.start(250);if(!alive(a))return;a.started=now();notify('recording','Recording… 30s left · ← finishes');
   const tick=()=>{onState('recording',`Recording… ${Math.max(0,Math.ceil((VOICE_LIMITS.recordMs-(now()-a.started))/1000))}s left · ← finishes`);timer(a,'tick',1000,tick);};timer(a,'tick',1000,tick);timer(a,'duration',VOICE_LIMITS.recordMs,()=>stopCapture(a));
  }catch(e){if(alive(a))fail(a,e?.name==='NotAllowedError'?'Microphone access is blocked. Check browser settings before trying again, or type an idea.':'The microphone could not start. Check it and try again when ready.');}
 }
 const hide=()=>stop();browser.addEventListener?.('pagehide',hide);
 return {start,stop,record,get state(){return state;},dispose(){stop();browser.removeEventListener?.('pagehide',hide);}};
}
