// Wiring and scene data only. The no-op renderer produces NO WebGL pixels.
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import config from '../vite.config.js';
const root=new URL('../',import.meta.url).href;
let middleware;config.plugins[0].configureServer({middlewares:{use(fn){middleware=fn;}}});
async function route(url){let body,status;await middleware({url},{writeHead(s){status=s;},end(s){body=s;}},()=>{throw Error('missing route '+url);});assert.equal(status,200);return String(body);}
const html=await route('/__combat'),fixtureModule=await route('/__combat-fixtures.js'),dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),saved=(await import(dataUrl(fixtureModule))).default;
assert.deepEqual(Object.keys(saved),['armed-car','octopus','dragon']);
const dom=new JSDOM(html);Object.assign(globalThis,{window:dom.window,document:dom.window.document,innerWidth:1280,innerHeight:800,HTMLInputElement:dom.window.HTMLInputElement,HTMLTextAreaElement:dom.window.HTMLTextAreaElement});dom.window.HTMLElement.prototype.setPointerCapture=function(){};dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
globalThis.NoPixelRenderer=class{constructor(){this.domElement=document.createElement('canvas');}setSize(){}setClearColor(){}render(scene){globalThis.harnessScene=scene;}};
let source=html.split('<script type="module">')[1].split('</script>')[0];source=source.replace("import saved from '/__combat-fixtures.js';",'const saved='+JSON.stringify(saved)+';').replace("'/__hammer-fixture.js'",JSON.stringify(root+'validation/hammer-fixture.js')).replace(/from '\/([^']+)'/g,(_,path)=>'from '+JSON.stringify(root+'public/'+path)).replace('new THREE.WebGLRenderer(', 'new globalThis.NoPixelRenderer(');
await import(dataUrl(source));
const el=id=>document.getElementById(id),set=(id,value)=>{el(id).value=value;el(id).onchange?.();},click=id=>el(id).click();
const result=()=>{const text=el('status').textContent;return {text,health:Number(text.match(/Target health \/ mount: ([\d.]+)/)?.[1]),hits:Number(text.match(/Confirmed hits \/ blocked: (\d+)/)?.[1]),blocked:Number(text.match(/Confirmed hits \/ blocked: \d+ \/ (\d+)/)?.[1]),angle:Number(text.match(/Base correction: ([-\d.]+)/)?.[1])};};
const fire=()=>{click('fire');for(let i=0;i<12;i++)click('advance');return result();};
set('weapon','pulse');set('target','normal');set('facing','0');
for(const policy of ['fixed','converged'])for(const d of ['2','5','10','20']){set('aim-policy',policy);set('distance',d);const r=fire();assert.equal(r.hits,policy==='fixed'?0:1,`${policy} ${d}: ${r.text}`);assert.equal(r.health,policy==='fixed'?100:85.6);}
set('aim-policy','converged');set('distance','5');
for(const side of ['left','right']){set('emitter-offset',side);const r=fire();assert.equal(r.hits,0);assert.equal(Math.abs(r.angle),15);}
set('emitter-offset','mirror');assert.equal(fire().hits,1);set('emitter-offset','saved');
for(const scenario of ['axis-cover','ray-cover','cover','after','protected']){set('target',scenario);const r=fire();assert.equal(r.hits,['axis-cover','after'].includes(scenario)?1:0);assert.equal(r.blocked,scenario==='protected'?1:0);}
set('target','ray-cover');click('toggle-cover');assert.equal(fire().hits,1);
set('target','normal');click('move-target');assert.ok(result().angle<5);click('move-target');assert.ok(result().angle>5);
for(const camera of ['0','1.57079632679','3.14159265359']){set('orbit',camera);click('reset');assert.equal(fire().hits,1);}
for(const origin of ['fresh','legacy']){set('weapon','octopus-carry');set('kit-origin',origin);assert.equal(fire().hits,1);}click('rebuild');assert.equal(el('kit-origin').value,'fresh');assert.equal(fire().hits,1);
for(const weapon of ['rover','octopus','dragon']){set('weapon',weapon);assert.equal(result().angle,0);assert.equal(fire().hits,1);}
set('weapon','octopus-carry');set('display-actor','remote');const actor=globalThis.harnessScene.getObjectByName('arena-player:p'),model=actor.getObjectByName('creation'),before=model.position.clone();click('remote-step');assert.ok(model.position.distanceTo(before)<1e-7);set('display-actor','local');click('old-ack');assert.ok(Math.abs(globalThis.harnessScene.getObjectByName('arena-player:p').getObjectByName('creation').rotation.y*180/Math.PI-2.27506)<.001);
set('weapon','dragon');el('enable-input').checked=true;el('enable-input').onchange();click('lift-shooter');const key=code=>{window.dispatchEvent(new window.KeyboardEvent('keydown',{code}));},up=code=>window.dispatchEvent(new window.KeyboardEvent('keyup',{code}));key('ArrowDown');click('advance');assert.match(result().text,/Shooter height \/ kit: 5\.20 \/ harness/);key('Enter');up('Enter');assert.match(result().text,/Recoverable items: 1/);up('ArrowDown');for(let i=0;i<12;i++)click('advance');assert.match(result().text,/Shooter height \/ kit: 0\.00 \/ foot/);key('Enter');up('Enter');assert.match(result().text,/Recoverable items: 0/);assert.match(result().text,/Shooter height \/ kit: 0\.00 \/ harness/);
el('enable-input').checked=false;set('target-defense','default');for(const [weapon,oldHits,hits,ms] of [['foot',7,5,2130],['sword',4,3,1420],['knife',7,6,1780],['hammer',3,2,1330]]){set('weapon',weapon);set('balance-rules','baseline');click('run-ko');assert.match(result().text,new RegExp('Contact KO hits / elapsed ms: '+oldHits+' / '));set('balance-rules','candidate');click('run-ko');assert.match(result().text,new RegExp('Contact KO hits / elapsed ms: '+hits+' / '+ms));assert.equal(result().health,0);}
console.log('PASS fixture route, 28 original harness cases, 2 presentation cases, 4 control cases and 8 melee-balance cases: fixed/converged pulse at 2/5/10/20m, cap saturation, mirrored origin, both cover paths, protection, focus transitions, camera orbit, legacy rebuild and mounted fixed barrels. No-op renderer: NO pixels or hosted multiplayer evidence.');
dom.window.close();delete globalThis.NoPixelRenderer;delete globalThis.harnessScene;
