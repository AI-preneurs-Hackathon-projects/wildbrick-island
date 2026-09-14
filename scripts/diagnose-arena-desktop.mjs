// Optional Playwright diagnostic; install/provide Playwright outside release deps.
// PLAYWRIGHT_MODULE may be an absolute file URL to an existing installation.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.STABILITY_ORIGIN||'http://127.0.0.1:5194';
const output=process.env.STABILITY_OUTPUT||'/private/tmp/brickwild-stability-session/desktop';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader']});
const results=[],errors=[],failures=[];
try{
 const runs=process.env.STABILITY_BASELINE?[{version:'baseline',latency:100},{version:'candidate',latency:100},{version:'baseline',latency:1600},{version:'candidate',latency:1600}]:[{version:'disabled',latency:100},{version:'enabled',latency:100}];
 for(const run of runs){
  const enabled=run.version!=='disabled';run.heldFire=process.env.STABILITY_HELD_FIRE==='1';
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failures.push({url:r.url(),reason:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  if(run.version==='baseline')await page.route(origin+'/**',async r=>{const pathname=decodeURIComponent(new URL(r.request().url()).pathname),file=path.resolve(process.env.STABILITY_BASELINE,'public','.'+pathname);if(!file.startsWith(path.resolve(process.env.STABILITY_BASELINE,'public')+'/'))return r.fulfill({status:404,body:'Outside frozen public tree'});try{const body=await fs.readFile(file);return r.fulfill({body,contentType:pathname.endsWith('.js')?'text/javascript':undefined});}catch{return r.fulfill({status:404,body:'Missing frozen baseline asset'});}});
  await page.route('**/api/**',r=>r.abort());
  const fixture=(await fs.readFile(new URL('./lib/performance-fixture.mjs',import.meta.url),'utf8')).replaceAll('../../public/','/');
  await page.route('**/__performance-fixture.js',r=>r.fulfill({contentType:'text/javascript',body:fixture}));
  await page.route('**/__stability',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Local Arena diagnostics</title><style>body{margin:0}aside{position:absolute;top:12px;left:12px;background:white;padding:12px;font:16px sans-serif}</style></head><body><aside>Local two-client diagnostic · in-memory transport · 1440×900</aside></body></html>'}));
  await page.goto(origin+'/__stability');
  const result=await page.evaluate(async ({enabled,run})=>{
   const THREE=await import('/vendor/three.module.js'),{createArenaView}=await import('/arena-view.js'),{createArenaDiagnostics}=await import('/arena-diagnostics.js'),{performanceFixture}=await import('/__performance-fixture.js');
   let seed=452067;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const ds=[createArenaDiagnostics({capacity:256}),createArenaDiagnostics({capacity:256})],browserCapture=createArenaDiagnostics({capacity:256});
   const scene=new THREE.Scene();scene.background=new THREE.Color('#b9d9ed');scene.add(new THREE.HemisphereLight(0xffffff,0x556644,3));
   const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(10,20,20);scene.add(light);
   const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:'#8fa873'}));ground.rotation.x=-Math.PI/2;ground.position.z=10;ground.position.y=-.02;scene.add(ground);
   const camera=new THREE.PerspectiveCamera(45,1440/900,.1,200);camera.position.set(11,14,29);camera.lookAt(0,1,10);
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1440,900);document.body.append(renderer.domElement);
   const view=createArenaView(scene,camera),events={};let attachmentSamples=0,maxAttachmentError=0,heldPhase=false,heldPhaseShots=0,heldPhaseAttachmentSamples=0;
   const {weaponMuzzle}=await import('/weapon-aim.js'),{solveWeaponAim}=await import('/aiming.js');
   const n=performanceFixture({latency:run.latency,diagnostics:enabled?ds:[],onEvent:(index,e)=>{if(index===0){view.effect(e);events[e.type]=(events[e.type]||0)+1;if(heldPhase&&e.type==='shot')heldPhaseShots++;}}});await n.start();n.room.players[n.clients[1].snapshot.self].x=6;await n.advance(220);
   const stop=browserCapture.observeBrowser(window,renderer.domElement);
   const frames=run.heldFire?1320:960;for(let frame=0;frame<frames;frame++){
    await new Promise(requestAnimationFrame);if(frame===480)n.clients.forEach(c=>c.command('build','bow'));heldPhase=run.heldFire&&frame>=960&&frame<1260;const z=frame<900||heldPhase?(Math.floor(frame/60)%2?-.6:.6):0,fire=heldPhase||frame>600&&frame<900&&frame%60===1;await n.step([{z,fire},{z,fire}]);
    view.update(n.clients[0].snapshot,n.clients[0].self,n.clients[0].blueprints,1/60,n.clients[0].serverTime());renderer.render(scene,camera);
    const p=n.clients[0].self,actor=scene.getObjectByName('arena-player:'+p.id),flash=actor?.getObjectByName('muzzle-flash');
    if(flash?.visible){const aim=solveWeaponAim(n.clients[0].snapshot,p),expected=weaponMuzzle({kit:p.kit,x:0,y:0,z:0,yaw:0},{yaw:aim.correction});maxAttachmentError=Math.max(maxAttachmentError,Math.hypot(flash.position.x-expected.x,flash.position.y-expected.y,flash.position.z-expected.z));attachmentSamples++;if(heldPhase)heldPhaseAttachmentSamples++;}
    if(frame%60===0)browserCapture.record('resources',{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls});
   }
   const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');stop();
   const result={...run,enabled,frames,heldPhaseShots,heldPhaseAttachmentSamples,attachmentSamples,maxAttachmentError,viewport:[innerWidth,innerHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',browser:browserCapture.export(),clockDomains:{browser:'performance.now milliseconds',clients:'synthetic fixture milliseconds; no UTC mapping'},diagnostics:ds.map(d=>d.export()),events,stats:n.stats};
   // Preserve pixels for the screenshot, then explicitly release the fixture.
   window.finishFixture=async()=>{await n.leave();view.clear();ground.geometry.dispose();ground.material.dispose();renderer.dispose();ds.forEach(d=>d.stop());browserCapture.stop();return n.resources;};return result;
  },{enabled,run});
  await page.screenshot({path:output+'/'+run.version+'-'+run.latency+'.png'});result.resourcesAfterLeave=await page.evaluate(()=>window.finishFixture());assert.equal(result.resourcesAfterLeave.timers,0);assert.ok(result.events.shot>0);assert.ok(result.attachmentSamples>0);assert.ok(result.maxAttachmentError<1e-7);results.push(result);await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
}finally{await browser.close();await fs.writeFile(output+'/results.json',JSON.stringify({scope:'Sequential desktop 1440×900 SwiftShader synthetic scene; 960 frames per tap run or 1320 with the added held-fire phase, two moving/firing clients, in-process transport. Not a hardware or hosted benchmark.',results,errors,failures},null,2)+'\n');}
console.log(JSON.stringify({output,frames:results.map(r=>r.browser.metrics.frameGapMs),errors,failures},null,2));
