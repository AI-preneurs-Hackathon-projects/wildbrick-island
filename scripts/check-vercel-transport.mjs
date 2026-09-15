import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createNodeHandler} from '../server/node-handler.js';
import {config} from '../api/handler.js';
assert.equal(config.helpers,false,'Vercel must preserve raw audio streams');

const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
const received = deferred(), canceled = deferred(), finished = deferred();
let normalSignal, normalUrl, observed, abortCount = 0;
const transport = createNodeHandler(async request => {
  const url = new URL(request.url);
  const bytes = await request.arrayBuffer();
  if (url.pathname === '/api/generate') {
    observed = {url, body: Buffer.from(bytes).toString()};
    received.resolve();
    await new Promise(resolve => request.signal.addEventListener('abort', () => {
      abortCount++; canceled.resolve(); resolve();
    }, {once:true}));
    return Response.json({canceled:true});
  }
  normalSignal = request.signal; normalUrl = url;
  return new Response(bytes, {headers:{'content-type':'application/octet-stream'}});
});
const server = http.createServer(async (req,res) => {
  const abortListeners = req.listenerCount('aborted'), closeListeners = res.listenerCount('close');
  await transport(req,res);
  assert.equal(req.listenerCount('aborted'),abortListeners);
  assert.equal(res.listenerCount('close'),closeListeners);
  if(req.url.includes('generate')) finished.resolve();
});
server.listen(0,'127.0.0.1'); await once(server,'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let guard;
try {
  const binary = Uint8Array.from([0,255,128,13,10,65]);
  const echo = await fetch(base+'/api/echo',{method:'POST',body:binary});
  assert.deepEqual(new Uint8Array(await echo.arrayBuffer()),binary);
  assert.equal(normalSignal.aborted,false,'normal completion must not abort work');
  const rewriteEcho = await fetch(base+'/api/transcribe?route=transcribe&path=transcribe',{method:'POST',body:binary});
  assert.deepEqual(new Uint8Array(await rewriteEcho.arrayBuffer()),binary);
  assert.equal(normalUrl.pathname,'/api/transcribe');
  assert.equal(normalUrl.search,'');
  const extra = await fetch(base+'/api/transcribe?route=transcribe&path=transcribe&unexpected=1',{method:'POST',body:binary});
  await extra.arrayBuffer(); assert.equal(normalUrl.search,'?unexpected=1');
  const client = http.request(base+'/api/handler?route=generate',{method:'POST',headers:{'content-type':'application/json'} });
  client.on('error',()=>{});
  client.end('{"prompt":"toy"}');
  await Promise.race([received.promise, new Promise((_,reject)=>guard=setTimeout(()=>reject(Error('Request did not arrive')),3000))]);
  clearTimeout(guard);
  client.destroy();
  await Promise.race([Promise.all([canceled.promise,finished.promise]),new Promise((_,reject)=>guard=setTimeout(()=>reject(Error('Disconnect did not propagate')),3000))]);
  clearTimeout(guard);
  assert.equal(abortCount,1);
  assert.equal(observed.url.pathname,'/api/generate');
  assert.equal(observed.url.search,'');
  assert.equal(observed.body,'{"prompt":"toy"}');
  console.log('Vercel Node transport: real HTTP disconnect after full upload aborts work; normal binary bodies, routing and listener cleanup pass.');
} finally {
  clearTimeout(guard);
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
