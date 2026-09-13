import {creationPrompt,validateBlueprint} from './blueprint.js';
export function createCreationService({onState,onReady,onError,timeoutMs=95000}){
 let current=null;let serial=0,lastTiming=null;
 async function generate(text){
  let prompt;try{prompt=creationPrompt(text);}catch(e){onError(e.message);return false;}
  if(current){onError('One idea at a time. Cancel the current design to change it.');return false;}
  const started=performance.now(),controller=new AbortController(),id=++serial;current={controller,id,prompt};onState({status:'designing',prompt});const timeout=setTimeout(()=>controller.abort('timeout'),timeoutMs);
  try{const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt}),signal:controller.signal});let payload;try{payload=await res.json();}catch{throw new Error('The generation service did not respond. Please try again.');}if(!res.ok)throw new Error(payload.error||'Your creation could not be generated. Try again.');const responseMs=performance.now()-started,validationAt=performance.now(),blueprint=validateBlueprint(payload.blueprint);lastTiming={requestMs:responseMs,validationMs:performance.now()-validationAt,server:payload.generation,startedAt:started};if(current?.id!==id)return false;await onReady(blueprint,prompt,lastTiming);return true;
  }catch(e){if(current?.id===id){onError(controller.signal.aborted?'The design took too long. Try a simpler idea.':e?.message||'The connection was interrupted. Please try again.');}return false;
  }finally{clearTimeout(timeout);if(current?.id===id){current=null;onState({status:'idle'});}}
 }
 function cancel(){if(!current)return;const old=current;current=null;serial++;old.controller.abort();onState({status:'idle'});}
 return {generate,cancel,get lastTiming(){return lastTiming;},get pending(){return !!current;},async status(){try{const response=await fetch('/api/generation-status');if(!response.ok)return false;const d=await response.json();return d.configured===true;}catch{return false;}}};
}
