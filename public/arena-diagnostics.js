// Explicit opt-in only: no network, console logging, game-state mutation or raw payloads.
// Percentiles describe the last capacity samples; counts/max cover the capture lifetime.
const METRICS=['requestMs','snapshotGapMs','snapshotAgeMs','pendingFrames','ackAdvance','correctionM','tickGapMs','frameGapMs','longTaskMs','geometries','textures','drawCalls'];
const EVENTS=['request-start','request-end','snapshot','tick','status','frame','long-task','resources','visibility','context-lost','context-restored'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function createArenaDiagnostics({capacity=2048}={}){
 if(!Number.isInteger(capacity)||capacity<1||capacity>16384)throw RangeError('Diagnostic capacity must be 1–16384');
 const startedAt=new Date().toISOString(),series=new Map(),counts=Object.fromEntries(EVENTS.map(key=>[key,0]));
 const failures=Array(6).fill(0),statuses=Array(5).fill(0),prediction=Array(6).fill(0),http=Array(600).fill(0);
 let active=true,inFlight=0,maxInFlight=0,status=null,lastTick=null,lastFrame=null;
 let longTaskSupported=null,lastReason=null,eventCursor=0;const recentEvents=new Array(capacity);
 function event(type,at,code,status){if(finite(at))recentEvents[eventCursor++%capacity]={type,at,code,...(Number.isInteger(status)?{status}:{} )};}
 function sample(name,value){
  if(!active||!METRICS.includes(name)||!finite(value)||value<0)return;
  let s=series.get(name);if(!s){s={values:new Float64Array(capacity),count:0,max:0};series.set(name,s);}
  s.values[s.count%capacity]=value;s.count++;s.max=Math.max(s.max,value);
 }
 function record(type,data={}){
  if(!active||!EVENTS.includes(type))return;counts[type]++;
  if(type==='request-start'){inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);}
  if(type==='request-end'){inFlight=Math.max(0,inFlight-1);sample('requestMs',data.duration);if(Number.isInteger(data.failure)&&data.failure>=0&&data.failure<failures.length){failures[data.failure]++;if(data.failure)event('request-failure',data.at,data.failure,data.status);}if(Number.isInteger(data.status)&&data.status>=0&&data.status<600)http[data.status]++;}
  if(type==='snapshot'){sample('snapshotGapMs',data.gap);sample('ackAdvance',data.ackAdvance);sample('correctionM',data.correction);}
  if(type==='tick'){
   if(finite(data.at)){if(lastTick!==null)sample('tickGapMs',data.at-lastTick);lastTick=data.at;}
   sample('snapshotAgeMs',data.age);sample('pendingFrames',data.pending);
   if(Number.isInteger(data.reason)&&data.reason>=0&&data.reason<prediction.length){prediction[data.reason]++;if(lastReason!==data.reason)event('prediction',data.at,data.reason);lastReason=data.reason;}
  }
  if(type==='status'&&Number.isInteger(data.code)&&data.code>=0&&data.code<statuses.length){
   if(status!==data.code){statuses[data.code]++;event('status',data.at,data.code);}status=data.code;if(data.code===0||data.code===1)lastTick=null;
  }
  if(type==='frame'&&finite(data.at)){if(lastFrame!==null)sample('frameGapMs',data.at-lastFrame);lastFrame=data.at;}
  if(type==='long-task')sample('longTaskMs',data.duration);
  if(type==='visibility'||type==='context-lost'||type==='context-restored')event(type,data.at,type==='visibility'?(data.hidden?1:0):0);
  if(type==='resources')for(const key of ['geometries','textures','drawCalls'])sample(key,data[key]);
 }
 function exportCapture(){
  const metrics={};for(const [key,s]of series){const values=Array.from(s.values.slice(0,Math.min(capacity,s.count))).sort((a,b)=>a-b),q=p=>values[Math.max(0,Math.ceil(values.length*p)-1)];metrics[key]={count:s.count,retained:values.length,p50:q(.5),p95:q(.95),p99:q(.99),windowMax:values.at(-1),lifetimeMax:s.max};}
  return {version:1,startedAt,capacity,active,longTaskSupported,recentEvents:Array.from({length:Math.min(eventCursor,capacity)},(_,i)=>({...recentEvents[(Math.max(0,eventCursor-capacity)+i)%capacity]})),metrics,events:{...counts},inFlight,maxInFlight,requestFailures:failures.slice(),statusTransitions:statuses.slice(),predictionReasons:prediction.slice(),httpStatuses:Object.fromEntries(http.flatMap((count,code)=>count?[[code,count]]:[]))};
 }
 // Optional browser sampler, independent of the game loop. No GPU-time claim.
 // Resource sampling is explicit so callers can choose sparse checkpoints.
 const disposers=new Set();
 function observeBrowser(target=globalThis,canvas=null){
  if(!active)return ()=>{};
  // Reattachment replaces the old sampler instead of accumulating observers.
  for(const dispose of disposers)dispose();
  let disposed=false,raf=null,observer=null;
  const frame=at=>{if(disposed)return;record('frame',{at});raf=target.requestAnimationFrame(frame);};
  const at=()=>target.performance?.now()??0,visibility=()=>record('visibility',{at:at(),hidden:!!target.document?.hidden}),lost=()=>record('context-lost',{at:at()}),restored=()=>record('context-restored',{at:at()});
  longTaskSupported=!!target.PerformanceObserver?.supportedEntryTypes?.includes('longtask');
  if(longTaskSupported)try{observer=new target.PerformanceObserver(list=>{if(!disposed)for(const entry of list.getEntries())record('long-task',{duration:entry.duration});});observer.observe({type:'longtask'});}catch{longTaskSupported=false;observer?.disconnect();observer=null;}
  target.document?.addEventListener('visibilitychange',visibility);
  canvas?.addEventListener('webglcontextlost',lost);canvas?.addEventListener('webglcontextrestored',restored);
  raf=target.requestAnimationFrame(frame);
  const dispose=()=>{if(disposed)return;disposed=true;target.cancelAnimationFrame(raf);observer?.disconnect();target.document?.removeEventListener('visibilitychange',visibility);canvas?.removeEventListener('webglcontextlost',lost);canvas?.removeEventListener('webglcontextrestored',restored);disposers.delete(dispose);lastFrame=null;};
  disposers.add(dispose);return dispose;
 }
 return {record,export:exportCapture,observeBrowser,stop(){for(const dispose of disposers)dispose();active=false;}};
}
