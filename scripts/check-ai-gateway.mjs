import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker/index.js';
import {createGatewayWorker} from '../server/ai-gateway.js';
import {BLUEPRINT_SCHEMA} from '../public/blueprint.js';
const key = 'synthetic-gateway-key';
const env = {AI_GATEWAY_API_KEY:key};
let groups=0;
async function check(name, fn) { await fn(); console.log('PASS '+name); groups++; }
const request = (path, body, headers={}) => new Request('https://game.test'+path, {method:body===undefined?'GET':'POST', headers:{Origin:'https://game.test','Content-Type':'application/json','oai-authenticated-user-id':crypto.randomUUID(),...headers}, body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});
const fixture={version:1,name:'Test tower',description:'A toy tower.',movement:'static',ability:'none',palette:['#28734f'],seat:[0,0,0],joints:[],parts:Array.from({length:10},(_,i)=>({shape:'box',position:[0,.5+i*.4,0],size:[.8,.5,.7],rotation:[0,0,0],color:0,joint:-1,studs:true}))};
await check('Sites and Arena dispatch preserve original environment and transport',async()=>{
  let calls=0;const original={fetch(req,e,c){calls++; assert.ok(e===env||!e.AI_GATEWAY_API_KEY);return Response.json({untouched:true});}};
  const adapted=createGatewayWorker(original,{fetchImpl(){throw Error('unexpected network');}});
  assert.equal((await adapted.fetch(request('/api/arena/sync'),env,{})).status,200);
  assert.equal((await adapted.fetch(request('/api/generate',{prompt:'a tower'}),{},{})).status,200);
  assert.equal(calls,2);
});
await check('real generation handler preserves schema, reasoning, instructions and model routing',async()=>{
  let calls=0;const adapted=createGatewayWorker(worker,{fetchImpl:async(url,init)=>{
    calls++; assert.equal(url,'https://ai-gateway.vercel.sh/v1/responses');assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.redirect,'error');
    const sent=JSON.parse(init.body);assert.equal(sent.model,'openai/gpt-5.4');assert.equal(sent.input,'a green toy tower');assert.equal(sent.store,false);assert.equal(sent.reasoning.effort,'low');assert.ok(sent.instructions.length>100);assert.deepEqual(sent.text.format.schema,BLUEPRINT_SCHEMA);
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});
  }});
  const response=await adapted.fetch(request('/api/generate',{prompt:'a green toy tower'}),env,{});
  assert.equal(response.status,200);assert.equal((await response.json()).blueprint.name,fixture.name);assert.equal(calls,1);
});
await check('configuration checks make no network calls and expose no secrets',async()=>{
  const adapted=createGatewayWorker(worker,{fetchImpl(){throw Error('unexpected network');}});
  for(const path of ['/api/generation-status','/api/transcription-status']) {
    const response=await adapted.fetch(request(path),{...env,DB:{prepare(){}}},{});assert.deepEqual(await response.json(),{configured:true});
  }
});
await check('readiness authenticates before catalog and never returns credit balances',async()=>{
  for(const status of [200,401,403]) {
    let calls=0;const adapted=createGatewayWorker(worker,{fetchImpl:async(url,init)=>{calls++;assert.equal(init.headers.Authorization,'Bearer '+key);
      if(url.endsWith('/credits'))return Response.json({balance:'100',total_used:'0'},{status});
      assert.equal(url,'https://ai-gateway.vercel.sh/v1/models');return Response.json({data:[{id:'openai/gpt-5.4'}]});
    }});
    const result=await (await adapted.fetch(request('/api/generation-status?verify=1'),env,{})).json();
    assert.equal(result.reachable,status===200);assert.equal(calls,status===200?2:1);assert.ok(!JSON.stringify(result).includes(key));assert.ok(!('balance' in result));
  }
});
await check('real voice handler preserves admission and translates both accepted audio containers',async()=>{
  for(const mediaType of ['audio/webm','audio/mp4']) {
    const db=new DatabaseSync(':memory:');for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+name,'utf8'));
    const DB={prepare(sql){return {bind(...args){return {async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};},async first(){return db.prepare(sql).get(...args)||null;}};}};}};
    const bytes=Buffer.alloc(32);bytes.set(mediaType==='audio/webm'?[0x1a,0x45,0xdf,0xa3]:[0,0,0,24,102,116,121,112]);
    let calls=0;const adapted=createGatewayWorker(worker,{fetchImpl:async(url,init)=>{
      calls++;assert.equal(url,'https://ai-gateway.vercel.sh/v4/ai/transcription-model');assert.equal(init.headers['ai-model-id'],'openai/gpt-4o-mini-transcribe');assert.equal(init.headers['ai-transcription-model-specification-version'],'4');assert.equal(init.headers['ai-gateway-protocol-version'],'0.0.1');assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.redirect,'error');
      assert.deepEqual(JSON.parse(init.body),{audio:bytes.toString('base64'),mediaType});return Response.json({text:'a green toy tower',segments:[],durationInSeconds:1});
    }});
    const make=()=>new Request('https://game.test/api/transcribe',{method:'POST',headers:{Origin:'https://game.test','oai-authenticated-user-id':'test-player','Content-Type':mediaType,'X-Voice-Attempt':attempt},body:bytes});
    const attempt=crypto.randomUUID();
    try {const response=await adapted.fetch(make(),{...env,DB},{});assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:'a green toy tower'});assert.equal((await adapted.fetch(make(),{...env,DB},{})).status,409);assert.equal(calls,1);assert.equal(db.prepare('SELECT expires_at FROM generation_requests').get().expires_at,0);}finally{db.close();}
  }
});
await check('generation provider errors are sanitized and never retried',async()=>{
  let calls=0;const adapted=createGatewayWorker(worker,{fetchImpl:async()=>{calls++;return new Response('private upstream detail',{status:429});}});
  const response=await adapted.fetch(request('/api/generate',{prompt:'a green tower'}),env,{});assert.equal(response.status,429);assert.doesNotMatch(await response.text(),/synthetic-gateway|private upstream/);assert.equal(calls,1);
});
console.log(`${groups} Gateway adapter groups passed; mocked AI only, no paid requests.`);
