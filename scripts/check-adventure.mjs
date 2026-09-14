import assert from 'node:assert/strict';
import {createAdventure} from '../public/adventure.js';
import {createState} from '../public/rules.js';
import {navigationGoal,creationControls} from '../public/guidance.js';
import {createCreationService} from '../public/creation-service.js';
import {createGeneratedModel} from '../public/generated-model.js';
import {createSimulation} from '../public/simulation.js';
import {createVoice} from '../public/ui.js';
import {handleAPI} from '../worker/index.js';
import {validateBlueprint} from '../public/blueprint.js';
import * as THREE from '../public/vendor/three.module.js';
let checks=0;
const check=async(label,run)=>{await run();checks++;console.log('PASS '+label);};
// Synthetic geometry is used only by checks, never served as a generated creation.
const fixture={version:1,name:'Asymmetric test wand',description:'A test carried object.',movement:'carry',ability:'pulse',palette:['#873ce2','#ffe599'],seat:[0,0,0],joints:[],parts:Array.from({length:8},(_,i)=>({shape:'box',position:[i*.2,.4+i*.3,0],size:[.3,.4,.3],rotation:[0,0,0],color:i%2,joint:-1,studs:true}))};
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
const request=(body,extra={})=>new Request('https://brickwild.test/api/generate',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://brickwild.test','CF-Connecting-IP':extra.ip||'test-adventure'},body:JSON.stringify(body),signal:extra.signal});
const env={OPENAI_API_KEY:'test-not-a-real-key'};
await check('saved adventures restore exact rewards and deduplicate rebuilds',()=>{
 const storage=memory(),a=createAdventure(storage),state=createState();Object.assign(state,{gates:[0,1,2,3],rings:[0,1,2,3,4],targets:[0,1,2],crates:[0,1,2],built:['car','plane','bow','sword']});
 a.remember(fixture);a.remember(fixture);assert.equal(a.creations.length,1);assert.equal(a.save(state),true);
 const restored=createState(),b=createAdventure(storage);b.restore(restored);assert.equal(restored.bricks,226);assert.equal(restored.won,true);assert.equal(restored.started,false);assert.equal(restored.mode,'foot');assert.equal(b.creations[0].name,fixture.name);
});
await check('tampered saves cannot inject geometry, rewards, duplicate objectives or invalid IDs',()=>{
 const storage=memory();storage.setItem('brickwild.adventure.v1',JSON.stringify({version:1,progress:{gates:[0,0,99,-1,1.5],bricks:99999,built:['car','javascript']},creations:[{...fixture,script:'bad'},fixture]}));
 const a=createAdventure(storage),state=createState();a.restore(state);assert.equal(state.bricks,15);assert.deepEqual(state.gates,[0]);assert.deepEqual(state.built,['car']);assert.equal(a.creations.length,1);
 const denied=createAdventure({getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}});denied.remember(fixture);assert.equal(denied.save(state),false);assert.equal(denied.creations.length,1);
});
await check('creation-aware guidance advances through suitable activities',()=>{
 const s=createState();s.mode='plane';s.custom={blueprint:{...fixture,movement:'fly'}};assert.equal(navigationGoal(s).type,'plane');s.rings=[0,1,2,3,4];assert.equal(navigationGoal(s).type,'bow');assert.match(creationControls(s),/Cast \/ →/);
 s.mode='car';s.custom={blueprint:{...fixture,movement:'drive',ability:'none'}};assert.equal(navigationGoal(s).type,'car');s.gates=[0,1,2,3];assert.equal(navigationGoal(s).type,'bow');
 s.targets=[0,1,2];s.crates=[0,1,2];assert.equal(navigationGoal(s),null);
});
await check('normalized carried geometry keeps the authored grip at the moving hand',()=>{
 const model=createGeneratedModel(fixture),hand=new THREE.Vector3(.76,1.1,.3);model.group.rotation.z=-.8;const offset=model.grip.clone().applyQuaternion(model.group.quaternion);model.group.position.copy(hand).sub(offset);model.group.updateMatrixWorld();assert.ok(model.grip.clone().applyMatrix4(model.group.matrixWorld).distanceTo(hand)<1e-6);model.dispose();
});
await check('equipment can jump without losing its ability; invalid hits grant nothing',async()=>{
 const sim=await createSimulation([],()=>{});sim.state.started=true;sim.buildCustom({blueprint:fixture,dimensions:[1,2,1]});for(let i=0;i<180;i++)sim.update(1/60,{});sim.jump();for(let i=0;i<12;i++)sim.update(1/60,{});assert.ok(sim.state.y>.5);assert.equal(sim.state.custom.blueprint.ability,'pulse');for(const id of [-1,3,99,null,1.5])sim.hitTarget(id);assert.equal(sim.state.bricks,0);sim.dispose();
});
await check('out-of-order cancelled generation cannot replace the newer result',async()=>{
 const original=globalThis.fetch,pending=[],ready=[];globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
 try{const s=createCreationService({onReady:b=>ready.push(b.name),onState(){},onError(){}});const first=s.generate('old idea');s.cancel();const second=s.generate('new idea');pending[1](Response.json({blueprint:{...fixture,name:'New idea'}}));assert.equal(await second,true);pending[0](Response.json({blueprint:fixture}));assert.equal(await first,false);assert.deepEqual(ready,['New idea']);}finally{globalThis.fetch=original;}
});
await check('timeout abort reasons always produce useful error feedback',async()=>{
 const original=globalThis.fetch,errors=[];globalThis.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason)));
 try{const s=createCreationService({timeoutMs:5,onReady(){assert.fail('Timed-out response');},onState(){},onError:e=>errors.push(e)});await s.generate('a new idea');assert.match(errors[0],/too long/);assert.equal(s.pending,false);}finally{globalThis.fetch=original;}
});
await check('voice joins final segments and ignores callbacks from cancelled sessions',()=>{
 const all=[],heard=[];globalThis.window={SpeechRecognition:class{constructor(){all.push(this);}start(){this.onstart();}abort(){}}};
 try{const voice=createVoice({onCommand:t=>heard.push(t),onState(){},onNotice(){}});voice.start();voice.stop();voice.start();const segment=t=>Object.assign([{transcript:t}],{isFinal:true});all[0].onresult({results:[segment('old idea')]});all[0].onend();all[1].onresult({results:[segment('a purple mechanical octopus'),segment('with eight arms on wheels')]});all[1].onend();all[1].onend();assert.deepEqual(heard,['a purple mechanical octopus with eight arms on wheels']);}finally{delete globalThis.window;}
});
await check('chunked request bodies are capped before OpenAI is called',async()=>{
 let called=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2049));controller.close();}});
 const req=new Request('https://brickwild.test/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'});assert.equal((await handleAPI(req,env,()=>{called=true;})).status,413);assert.equal(called,false);
 for(const input of [null,[],123,'prompt'])assert.equal((await handleAPI(request(input),env,()=>{called=true;})).status,400);assert.equal(called,false);
});
await check('server bounds simultaneous designs and propagates cancellation upstream',async()=>{
 const a=new AbortController(),b=new AbortController();let calls=0;
 const upstream=(_,options)=>new Promise((resolve,reject)=>{calls++;options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));});
 const first=handleAPI(request({prompt:'first idea'},{signal:a.signal,ip:'a'}),env,upstream),second=handleAPI(request({prompt:'second idea'},{signal:b.signal,ip:'b'}),env,upstream);
 for(let i=0;i<30&&calls<2;i++)await new Promise(resolve=>setTimeout(resolve,1));assert.equal(calls,2);
 try{const busy=await handleAPI(request({prompt:'third idea'}),env,upstream);assert.equal(busy.status,429);assert.equal((await busy.json()).code,'busy');}finally{a.abort();b.abort();}
 assert.equal((await first).status,504);assert.equal((await second).status,504);
 const subsequent=await handleAPI(request({prompt:'after cancelling'}),env,async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture)}]}]}));assert.equal(subsequent.status,200);
});
await check('a retry supersedes only the same player’s stuck design',async()=>{
 const firstAbort=new AbortController();let calls=0;
 const upstream=(_,options)=>{calls++;if(calls===1)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});};
 const first=handleAPI(request({prompt:'stuck idea'},{signal:firstAbort.signal,ip:'same-player'}),env,upstream);for(let i=0;i<30&&calls<1;i++)await new Promise(resolve=>setTimeout(resolve,1));
 const retry=await handleAPI(request({prompt:'replacement idea'},{ip:'same-player'}),env,upstream);assert.equal(retry.status,200);assert.equal((await first).status,504);assert.equal(calls,2);
});
await check('connection verification checks model access without exposing credentials',async()=>{
 let urlSeen;const r=await handleAPI(new Request('https://brickwild.test/api/generation-status?verify=1'),env,async(url,options)=>{urlSeen=url;assert.equal(options.method,undefined);return Response.json({id:'gpt-5.4'});});const d=await r.json();assert.equal(d.reachable,true);assert.ok(urlSeen.endsWith('/models/gpt-5.4'));assert.ok(!JSON.stringify(d).includes(env.OPENAI_API_KEY));
 const denied=await handleAPI(new Request('https://brickwild.test/api/generation-status?verify=1'),env,async()=>new Response('',{status:401}));assert.equal((await denied.json()).code,'invalid_key');
 const generated=await handleAPI(request({prompt:'a small purple wand'},{ip:'non-reasoning'}),{...env,OPENAI_MODEL:'gpt-4.1-mini'},async(url,options)=>{assert.equal(JSON.parse(options.body).reasoning,undefined);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});});assert.equal(generated.status,200);
});
await check('denied or unsupported voice leads to typed input without submitting audio text',()=>{
 let recognizer;const fallback=[],heard=[];globalThis.window={SpeechRecognition:class{constructor(){recognizer=this;}start(){}abort(){}}};
 try{const v=createVoice({onCommand:t=>heard.push(t),onState(){},onNotice(){},onFallback:t=>fallback.push(t)});v.start();recognizer.onerror({error:'not-allowed'});recognizer.onend();assert.equal(fallback.length,1);assert.equal(heard.length,0);delete window.SpeechRecognition;const unsupported=createVoice({onCommand(){assert.fail();},onState(){},onNotice(){},onFallback:t=>fallback.push(t)});unsupported.start();assert.equal(fallback.length,2);}finally{delete globalThis.window;}
});
await check('root-coordinate blueprints preserve resting parts and rotate about their authored pivot',()=>{
 const b={...structuredClone(fixture),version:2,movement:'drive',seat:[0,1,0],joints:[{parent:-1,pivot:[-1,.5,0],axis:'z',motion:'flap',amplitude:90,phase:0}],parts:Array.from({length:32},(_,i)=>({shape:'box',position:i===0?[-2,.5,0]:[0,.5,0],size:[1,1,1],rotation:[0,0,0],color:0,joint:i===0?0:-1,studs:false}))};
 assert.throws(()=>validateBlueprint({...b,joints:[...b.joints,{...b.joints[0],parent:0}]}));
 const rig=createGeneratedModel(b),flat=createGeneratedModel({...b,parts:b.parts.map(p=>({...p,joint:-1}))}),m=new THREE.Matrix4(),n=new THREE.Matrix4();
 for(let i=0;i<32;i++){rig.group.children[0].getMatrixAt(i,m);flat.group.children[0].getMatrixAt(i,n);assert.deepEqual(m.elements,n.elements);}
 rig.update(Math.PI/12,1,1);rig.group.children[0].getMatrixAt(0,m);const center=new THREE.Vector3().setFromMatrixPosition(m);assert.ok(center.distanceTo(new THREE.Vector3(0,-.5,0))<1e-6);
 assert.deepEqual(rig.size.toArray(),flat.size.toArray());rig.dispose();flat.dispose();
});
await check('mounted rider rests on solid geometry and generated wheels rotate about their axle',()=>{
 const b={...structuredClone(fixture),version:2,movement:'drive',seat:[0,1,0],joints:[{parent:-1,pivot:[2,.4,0],axis:'x',motion:'spin',amplitude:0,phase:0}],parts:Array.from({length:32},(_,i)=>i===0?{shape:'cylinder',position:[2,.4,0],size:[.8,.25,.8],rotation:[90,0,0],color:0,joint:0,studs:false}:{shape:'box',position:[0,.75,0],size:[2,1.5,2],rotation:[0,0,0],color:0,joint:-1,studs:false})};
 const model=createGeneratedModel(b);assert.ok(Math.abs(model.seat.y-1.5)<1e-6);model.update(.7,1,1);const wheel=model.group.children.find(m=>m.geometry.type==='CylinderGeometry'),matrix=new THREE.Matrix4();wheel.getMatrixAt(0,matrix);const axle=new THREE.Vector3().setFromMatrixColumn(matrix,1).normalize();assert.ok(Math.abs(axle.x)>0.999);assert.ok(Math.abs(axle.y)<1e-6&&Math.abs(axle.z)<1e-6);model.dispose();
});
console.log(`\n${checks} adventure checks passed. These are automated checks with synthetic fixtures, not browser or live OpenAI tests.`);
