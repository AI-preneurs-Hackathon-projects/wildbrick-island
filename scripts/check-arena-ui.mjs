import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import * as THREE from '../public/vendor/three.module.js';
import {createUI} from '../public/ui.js';
import {createInput} from '../public/input.js';
import {createArenaUI} from '../public/arena-ui.js';
import {createArenaView} from '../public/arena-view.js';
import {createWorld} from '../public/world.js';
import {createState} from '../public/rules.js';
import {newRoom,addPlayer,makeKit,roomSnapshot} from '../public/arena-core.js';
import {box} from '../public/models.js';
const dom=new JSDOM('<div id="scene"></div><div id="ui"></div>',{url:'https://brickwild.test/?arena=TEST'});
for(const k of ['window','document','location','HTMLInputElement','HTMLTextAreaElement'])globalThis[k]=dom.window[k];
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};dom.window.HTMLElement.prototype.setPointerCapture=function(){};
// Canvas stand-in validates data binding and scene lifecycle; it is not WebGL QA.
dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
let checks=0;function check(name,fn){fn();console.log('PASS '+name);checks++;}
const state=createState();state.started=true;let joins=0,fires=0,jumps=0,mics=0,imagines=0,exits=0;const builds=[];
const actions={state:()=>state,start(){},openArena(){joins++;},recent:()=>[],saved:()=>true,build(){},action(){fires++;},jump(){jumps++;},voice(){},sound(){},auto(){},pause(v){state.paused=v;input.clear();},respawn(){},cancelDesign(){},leaveArena(){}};
const ui=createUI(actions),arenaUI=createArenaUI({join:async()=>true,leave(){},toast(){}}),input=createInput({onBuild:mode=>{builds.push(mode);if(mode==='foot')exits++;},onAction:actions.action,onJump:actions.jump,onPause(){ui.toggleMenu('pause');},onMic(){mics++;},onImagine(){imagines++;ui.openMenu('imagine');},onHotkeys(){ui.toggleMenu('hotkeys');},onHome(){},getState:()=>state});
const key=(type,code,extra={})=>window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,...extra}));
check('arena entry and health/leaderboard UI bind the joined room and escape names',()=>{document.querySelector('#start').click();assert.equal(joins,1);const r=newRoom(),p=addPlayer(r,'a','<img src=x>');p.health=44;p.kit=makeKit('car');p.mountHealth=100;const client={self:p,snapshot:roomSnapshot(r,p.id),active:true,room:'REAL',serverTime:()=>r.time};ui.update(state);arenaUI.update(client);document.querySelector('#arena-room').value='WRONG';arenaUI.update(client);assert.match(document.querySelector('#objective-title').textContent,/REAL/);assert.equal(document.querySelector('#arena-health').textContent,'44');assert.equal(document.querySelector('#arena-ranks img'),null);assert.equal(document.querySelector('#action').classList.contains('hidden'),true);p.kit=makeKit();p.health=0;p.respawnAt=r.time+12000;arenaUI.update(client);assert.match(document.querySelector('#arena-respawn').textContent,/12/);arenaUI.error('Sign in',401);assert.equal(document.querySelector('#arena-sign-in').classList.contains('hidden'),false);assert.equal(document.querySelector('#arena-sign-in').target,'_top');document.querySelector('#arena-lobby').close();});
check('arena keyboard and held touch attack remain separate from jump and movement',()=>{state.arena=true;state.mode='foot';key('keydown','ArrowRight');assert.equal(input.read().fire,true);key('keyup','ArrowRight');assert.equal(input.read().fire,false);assert.equal(fires,0);key('keydown','Space');assert.equal(jumps,1);key('keyup','Space');key('keydown','KeyW');const action=document.querySelector('#action'),down=new window.Event('pointerdown',{cancelable:true});Object.assign(down,{pointerId:7});action.dispatchEvent(down);assert.equal(input.read().fire,true);assert.equal(input.read().z,1);action.dispatchEvent(new window.Event('pointercancel'));assert.equal(input.read().fire,false);input.clear();assert.equal(input.read().z,0);});
check('camera drag reaches the full upward and downward arena aim range',()=>{const scene=document.querySelector('#scene');const pointer=(type,x,y)=>{const e=new window.Event(type);Object.assign(e,{pointerId:8,clientX:x,clientY:y});scene.dispatchEvent(e);};pointer('pointerdown',0,300);pointer('pointermove',0,-300);assert.equal(input.read().aimPitch,.75);pointer('pointermove',0,1000);assert.equal(input.read().aimPitch,-.75);pointer('pointerup',0,1000);});
check('remote originals and generated creations assemble and dispose without destroying shared world geometry',()=>{const scene=new THREE.Scene(),world=createWorld(scene),view=createArenaView(scene,new THREE.PerspectiveCamera()),r=newRoom(),p=addPlayer(r,'a','Alpha'),q=addPlayer(r,'b','Beta'),b=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;const cache=new Map([['dragon',b]]);p.kit=makeKit('plane');q.kit=makeKit('dragon',b);q.building={kit:makeKit('car'),starts:r.time,ends:r.time+2800};view.update(roomSnapshot(r,'a'),p,cache,1/60,r.time+1000);scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));const holder=new THREE.Group(),shared=box(holder,0,0,0,1,1,1,0xffffff).geometry;let disposed=0;shared.addEventListener('dispose',()=>disposed++);view.effect({type:'break',x:1,y:1,z:1});view.update(roomSnapshot(r,'a'),p,cache,2,r.time+2000);view.clear();assert.equal(disposed,0);world.setDestroyed(['house:0','tree:inner:0']);world.setDestroyed([]);});
check('arrow actions combine movement, attack and speech without moving the camera',()=>{
 input.clear();state.arena=true;state.mode='foot';
 key('keydown','KeyW');key('keydown','ArrowRight');key('keydown','ArrowLeft');key('keydown','ArrowLeft',{repeat:true});
 assert.equal(input.read().z,1);assert.equal(input.read().fire,true);assert.equal(mics,1);
 key('keyup','ArrowLeft');key('keydown','ArrowLeft');assert.equal(mics,2);
 const beforeJump=jumps;key('keydown','ArrowUp');assert.equal(jumps,beforeJump+1);
 input.clear();state.mode='plane';key('keydown','ArrowUp');assert.equal(input.read().up,true);assert.equal(jumps,beforeJump+1);key('keyup','ArrowUp');key('keydown','ArrowDown');assert.equal(input.read().down,true);
 input.clear();const yaw=input.yaw;key('keydown','KeyE');input.update(.1);assert.ok(input.yaw<yaw);assert.equal(exits,0);key('keyup','KeyE');key('keydown','Backspace');assert.equal(exits,1);
 key('keydown','Enter');assert.equal(imagines,1);assert.equal(document.activeElement,document.querySelector('#creation-description'));ui.closeMenu();input.clear();const currentYaw=input.yaw;key('keydown','ArrowRight');input.update(.1);assert.equal(input.yaw,currentYaw);input.clear();key('keydown','KeyR');input.update(.1);assert.equal(input.read().fire,false);input.clear();
 assert.equal(document.querySelector('#mic kbd').textContent,'←');assert.equal(document.querySelector('#imagine kbd').textContent,'↵');assert.equal(document.querySelector('#arena-crosshair'),null);
});
check('Hotkeys opens and closes by button, H and Escape; presets are absent',()=>{
 input.clear();assert.equal(document.querySelectorAll('[data-build]').length,0);assert.equal(document.querySelector('#help span').textContent,'Hotkeys');
 const before=builds.length;for(const code of ['Digit1','Digit2','Digit3','Digit4']){key('keydown',code);key('keyup',code);}assert.equal(builds.length,before);
 document.querySelector('#help').click();const menu=document.querySelector('#menu');assert.ok(menu.open);assert.ok(state.paused);assert.equal(menu.querySelectorAll('.arrow-hotkeys kbd').length,4);assert.match(menu.textContent,/Backspace/);
 key('keydown','KeyH');assert.equal(menu.open,false);assert.equal(state.paused,false);key('keydown','KeyH');assert.ok(menu.open);key('keydown','Escape');assert.equal(menu.open,false);
 document.querySelector('#help').click();document.querySelector('#close-menu').click();assert.equal(menu.open,false);assert.equal(state.paused,false);
});
check('typing, modifiers, menus and focus loss do not trigger gameplay shortcuts',()=>{
 const before=mics;key('keydown','ArrowLeft',{ctrlKey:true});assert.equal(mics,before);
 const field=document.createElement('textarea');document.body.append(field);field.dispatchEvent(new window.KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true}));assert.equal(mics,before);field.remove();
 const menu=document.querySelector('#menu');menu.open=true;key('keydown','ArrowRight');assert.equal(input.read().fire,false);menu.close();
 key('keydown','KeyW');key('keydown','ArrowRight');window.dispatchEvent(new window.Event('blur'));assert.equal(input.read().z,0);assert.equal(input.read().fire,false);
});
check('jumping unarmed players carry only a small blaster, with no bow string below their feet',()=>{
 for(const legacy of [false,true]){
  const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),room=newRoom(),p=addPlayer(room,'jump','Jumper');p.y=1.3;if(legacy)p.kit.mode='bow';
  view.update(roomSnapshot(room,p.id),p,new Map(),1/60,room.time);scene.updateMatrixWorld(true);
  const equipment=scene.children[0].children[0].children[3],bounds=new THREE.Box3().setFromObject(equipment);
  assert.equal(equipment.children.length,2);assert.ok(bounds.min.y>=p.y);assert.ok(bounds.max.y-bounds.min.y<.5);
  p.kit=makeKit('bow');view.update(roomSnapshot(room,p.id),p,new Map(),1/60,room.time);scene.updateMatrixWorld(true);
  const bow=scene.children[0].children[0].children[3];assert.ok(bow.children.length>2);assert.ok(new THREE.Box3().setFromObject(bow).min.y>=p.y);view.clear();
 }
});
check('expired arena keeps vitals, exposes Rejoin, and retains a touch Lower control after dismount',()=>{
 const r=newRoom(),p=addPlayer(r,'p','Held');Object.assign(p,{x:21,y:8,z:19,health:76});const client={self:p,snapshot:roomSnapshot(r,p.id),active:true,room:'HOLD',serverTime:()=>r.time};
 arenaUI.setStatus('expired');arenaUI.error('Your position is held. Join again.',410);assert.equal(document.querySelector('#arena-lobby').open,true);document.querySelector('#arena-lobby').close();arenaUI.update(client);
 assert.equal(document.querySelector('#arena-health').textContent,'76');assert.match(document.querySelector('#arena-network').textContent,/position held/);assert.equal(document.querySelector('#open-arena').textContent,'Rejoin');assert.equal(document.querySelector('#open-arena').style.display,'inline-flex');
 assert.equal(document.querySelector('#flight-controls').classList.contains('hidden'),false);assert.equal(document.querySelector('#ascend').classList.contains('hidden'),true);assert.equal(document.querySelector('#autorun'),null);
 const down=new window.Event('pointerdown',{cancelable:true});Object.assign(down,{pointerId:12});document.querySelector('#descend').dispatchEvent(down);assert.equal(input.read().down,true);document.querySelector('#descend').dispatchEvent(new window.Event('pointerup'));assert.equal(input.read().down,false);
});
dom.window.close();for(const k of ['window','document','location','HTMLInputElement','HTMLTextAreaElement'])delete globalThis[k];
console.log(`\n${checks} arena DOM/scene checks passed. No browser rendering, microphone or real multitouch claim.`);
