import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVoice,VOICE_LIMITS} from '../public/voice-controller.js';
import {transcriptionStatus} from '../worker/transcription-api.js';
import worker from '../worker/index.js';

const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(options={}){
 const calls=[],states=[],offers=[],commands=[],timers=new Map(),recorders=[],recognizers=[];
 let nextTimer=0,micCalls=0,trackStops=0;
 const source={status:()=>Promise.resolve(Response.json({configured:true}))};
 class Recorder{
  static isTypeSupported(type){return type==='audio/webm';}
  constructor(_stream,{mimeType}){this.mimeType=mimeType;this.state='inactive';recorders.push(this);}
  start(){this.state='recording';calls.push('recording');}
  stop(){this.state='inactive';}
 }
 class Recognition{
  constructor(){recognizers.push(this);}
  start(){this.onstart();}
  abort(){}
  stop(){}
 }
 const voice=createVoice({onCommand:text=>commands.push(text),onState:(state,text)=>{states.push([state,text]);options.onState?.(state);},onFallback:(...args)=>offers.push(args),platform:{
  Recognition:Recognition,MediaRecorder:Recorder,
  mediaDevices:{async getUserMedia(){micCalls++;calls.push('microphone');const track={stop(){trackStops++;}};return {getTracks:()=>[track],getAudioTracks:()=>[track]};}},
  fetch(url,init){calls.push({url,init});if(url==='/api/transcription-status')return source.status();throw Error('Unexpected audio/provider request');},
  setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}
 }});
 const expire=async ms=>{const timer=[...timers].find(([,t])=>t.ms===ms);assert.ok(timer,'expected deadline registered');timers.delete(timer[0]);timer[1].fn();await flush();};
 const requests=()=>calls.filter(c=>typeof c==='object');
 const close=()=>{voice.dispose();assert.equal(timers.size,0);};
 return {voice,calls,states,offers,commands,timers,recorders,recognizers,source,expire,requests,close,get micCalls(){return micCalls;},get trackStops(){return trackStops;}};
}

test('unconfigured, unauthorized, failed and malformed status never request microphone or upload audio',async()=>{
 const responses=[()=>Response.json({configured:false}),()=>Response.json({configured:true},{status:401}),()=>Response.json({configured:true},{status:503}),()=>Response.json({}),()=>Response.json(null),()=>Response.json({configured:'true'}),()=>new Response('not JSON'),()=>{throw Error('offline');}];
 for(const response of responses){const f=fixture();try{
  f.source.status=async()=>response();await f.voice.record();
  assert.equal(f.voice.state,'error');assert.equal(f.micCalls,0);assert.equal(f.recorders.length,0);assert.equal(f.requests().length,1);
  assert.equal(f.requests()[0].url,'/api/transcription-status');assert.equal(f.offers.length,1);assert.equal(f.offers[0][1].canRecord,false);assert.equal(f.commands.length,0);assert.equal(f.timers.size,0);
 }finally{f.close();}}
});

test('configured status is fetched without cache before any permission prompt or recorder startup',async()=>{
 const f=fixture(),status=deferred();try{
  f.source.status=()=>status.promise;const pending=f.voice.record();assert.equal(f.voice.state,'checking');assert.equal(f.micCalls,0);
  const {init}=f.requests()[0];assert.equal(init.method,'GET');assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);
  status.resolve(Response.json({configured:true}));await pending;
  assert.equal(f.voice.state,'recording');assert.equal(f.micCalls,1);assert.equal(f.recorders.length,1);assert.equal(f.requests().length,1);
  assert.deepEqual(f.calls.map(c=>typeof c==='object'?c.url:c),['/api/transcription-status','microphone','recording']);
 }finally{f.close();}assert.ok(f.trackStops>0);
});

test('explicit cancellation and the Speak toggle abort pending readiness checks and ignore late availability',async()=>{
 for(const cancel of [f=>f.voice.stop(),f=>f.voice.start()]){const f=fixture(),status=deferred();try{
  f.source.status=()=>status.promise;const pending=f.voice.record();cancel(f);assert.ok(f.requests()[0].init.signal.aborted);
  status.resolve(Response.json({configured:true}));await pending;
  assert.equal(f.voice.state,'canceled');assert.equal(f.micCalls,0);assert.equal(f.commands.length,0);assert.equal(f.offers.length,0);assert.equal(f.timers.size,0);
 }finally{f.close();}}
});

test('readiness network and JSON stalls expire without microphone capture or automatic retry',async()=>{
 for(const stage of ['response','json']){const f=fixture(),pendingStatus=deferred();try{
  f.source.status=()=>stage==='response'?pendingStatus.promise:Promise.resolve({ok:true,status:200,json:()=>pendingStatus.promise});
  const pending=f.voice.record();await flush();await f.expire(VOICE_LIMITS.startMs);
  assert.equal(f.voice.state,'error');assert.ok(f.requests()[0].init.signal.aborted);assert.equal(f.micCalls,0);assert.equal(f.requests().length,1);
  pendingStatus.resolve(stage==='response'?Response.json({configured:true}):{configured:true});await pending;
  assert.equal(f.micCalls,0);assert.equal(f.requests().length,1);assert.equal(f.timers.size,0);
 }finally{f.close();}}
});

test('a late status from a canceled attempt cannot supersede a new recording attempt',async()=>{
 const f=fixture(),oldStatus=deferred(),newStatus=deferred();try{
  f.source.status=()=>oldStatus.promise;const old=f.voice.record();f.voice.stop();
  f.source.status=()=>newStatus.promise;const current=f.voice.record();oldStatus.resolve(Response.json({configured:true}));await old;
  assert.equal(f.voice.state,'checking');assert.equal(f.micCalls,0);
  newStatus.resolve(Response.json({configured:true}));await current;assert.equal(f.voice.state,'recording');assert.equal(f.micCalls,1);assert.equal(f.requests().length,2);
 }finally{f.close();}
});

test('synchronous cancellation from presentation callbacks cannot open microphone permission afterward',async()=>{
 for(const cancelAt of ['checking','requesting-permission']){
  let f;f=fixture({onState:state=>{if(state===cancelAt)f.voice.stop();}});
  try{await f.voice.record();assert.equal(f.voice.state,'canceled');assert.equal(f.micCalls,0,cancelAt);assert.equal(f.recorders.length,0);assert.equal(f.timers.size,0,cancelAt);}
  finally{f.close();}
 }
});

test('configuration can be enabled after an unavailable attempt; retry checks fresh state without a native loop',async()=>{
 const f=fixture();try{
  f.source.status=async()=>Response.json({configured:false});await f.voice.record();assert.equal(f.micCalls,0);
  f.voice.start();assert.equal(f.requests().length,1,'Speak alone never grants recording consent');assert.equal(f.recognizers.length,0);
  f.source.status=async()=>Response.json({configured:true});await f.voice.record();assert.equal(f.requests().length,2);assert.equal(f.micCalls,1);assert.equal(f.voice.state,'recording');
 }finally{f.close();}
});

test('successful native speech remains independent of recorded voice readiness',()=>{
 const f=fixture();try{
  f.source.status=()=>{throw Error('Native speech must not check server transcription');};f.voice.start();const r=f.recognizers[0];
  r.onresult({results:[Object.assign([{transcript:'a synthetic blue boat'}],{isFinal:true})]});r.onend();
  assert.deepEqual(f.commands,['a synthetic blue boat']);assert.equal(f.requests().length,0);assert.equal(f.micCalls,0);assert.equal(f.offers.length,0);
 }finally{f.close();}
});

const request=({method='GET',headers={}}={})=>new Request('https://brickwild.test/api/transcription-status',{method,headers:{'oai-authenticated-user-id':'synthetic-player',Origin:'https://brickwild.test',...headers}});
const handlers=[['endpoint',(req,env)=>transcriptionStatus(req,env)],['Worker dispatch',(req,env)=>worker.fetch(req,env,{})]];

test('readiness endpoint and actual Worker route enforce auth, method and same-origin before configuration',async()=>{
 const env=new Proxy({},{get(){throw Error('Configuration read before authorization');}});
 for(const [name,handle] of handlers)for(const [options,expected] of [[{headers:{'oai-authenticated-user-id':''}},401],[{method:'POST'},405],[{headers:{Origin:'https://other.test'}},403],[{headers:{'Sec-Fetch-Site':'cross-site'}},403]]){
  const response=await handle(request(options),env);assert.equal(response.status,expected,name);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const data=await response.json();assert.equal(typeof data.code,'string');assert.doesNotMatch(JSON.stringify(data),/synthetic-player/);
 }
});

test('readiness reports only a sanitized boolean without contacting provider or touching database',async()=>{
 let dbCalls=0,providerCalls=0;const DB={prepare(){dbCalls++;throw Error('Must not touch database');}},fetchBefore=globalThis.fetch;
 globalThis.fetch=()=>{providerCalls++;throw Error('Must not call provider');};
 try{
  const configured={OPENAI_API_KEY:'synthetic-private-key',OPENAI_TRANSCRIPTION_MODEL:'gpt-4o-mini-transcribe',DB};
  for(const [name,handle] of handlers)for(const [env,expected] of [[{},false],[{...configured,OPENAI_API_KEY:''},false],[{...configured,OPENAI_TRANSCRIPTION_MODEL:''},false],[{...configured,OPENAI_TRANSCRIPTION_MODEL:'other'},false],[{...configured,DB:undefined},false],[{...configured,DB:{prepare:true}},false],[configured,true]]){
   const response=await handle(request(),env);assert.equal(response.status,200,name);assert.deepEqual(await response.json(),{configured:expected});assert.equal(response.headers.get('cache-control'),'no-store');
  }
  assert.equal(dbCalls,0);assert.equal(providerCalls,0);
 }finally{globalThis.fetch=fetchBefore;}
});
