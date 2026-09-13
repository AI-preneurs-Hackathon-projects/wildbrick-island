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
import {newRoom,addPlayer,makeKit,roomSnapshot,advanceRoom,applyInput} from '../public/arena-core.js';
import {box} from '../public/models.js';
import {SUPPORT_DROPS} from '../public/supply-catalog.js';
const dom=new JSDOM('<div id="scene"></div><div id="ui"></div>',{url:'https://brickwild.test/?arena=TEST'});
for(const k of ['window','document','location','HTMLInputElement','HTMLTextAreaElement','localStorage'])globalThis[k]=dom.window[k];
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};dom.window.HTMLElement.prototype.setPointerCapture=function(){};
// Canvas stand-in validates data binding and scene lifecycle; it is not WebGL QA.
dom.window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillText(){}});
let checks=0;function check(name,fn){fn();console.log('PASS '+name);checks++;}
const state=createState();state.started=true;let leaves=0,joins=0,fires=0,jumps=0,mics=0,imagines=0,exits=0;const builds=[];
const actions={state:()=>state,start(){state.started=true;},openArena(){joins++;},recent:()=>[],saved:()=>true,build(){},action(){fires++;},jump(){jumps++;},voice(){},sound(){},auto(){},pause(v){state.paused=v;input.clear();},respawn(){},cancelDesign(){},exitHome(){state.started=false;ui.showEntry();leaves++;state.arena=false;arenaUI.reset();ui.resetPlayUI();ui.update(state);}};
localStorage.setItem('brickwild-tour-v1','seen');
const ui=createUI(actions),arenaUI=createArenaUI({getPlayerName:ui.playerName,join:async()=>true,leave(){},toast(){}}),input=createInput({onBuild:mode=>{builds.push(mode);if(mode==='foot')exits++;},onAction:actions.action,onJump:actions.jump,onPause(){ui.toggleMenu('pause');},onMic(){mics++;},onImagine(){imagines++;ui.openMenu('imagine');},onHotkeys(){ui.toggleMenu('hotkeys');},onHome(){},getState:()=>state});
document.querySelector('#player-name').value='Builder';
const key=(type,code,extra={})=>window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,...extra}));
check('R/F tilts weapons without moving the camera, and camera orbit keeps that tilt',()=>{input.clear();const viewPitch=input.pitch;key('keydown','KeyR');input.update(.1);assert.ok(input.read().weaponPitch>0);assert.equal(input.pitch,viewPitch);key('keyup','KeyR');const tilt=input.read().weaponPitch;key('keydown','KeyE');input.update(.1);assert.equal(input.read().weaponPitch,tilt);input.clear();});
check('arena entry and health/leaderboard UI bind the joined room and escape names',()=>{document.querySelector('#start').click();assert.equal(joins,1);const r=newRoom(),p=addPlayer(r,'a','<img src=x>');p.health=44;p.kit=makeKit('car');p.mountHealth=100;const client={self:p,snapshot:roomSnapshot(r,p.id),active:true,room:'REAL',serverTime:()=>r.time};ui.update(state);arenaUI.update(client);assert.equal(document.querySelector('#arena-room'),null);assert.ok(document.querySelector('#explore-start'));arenaUI.update(client);assert.match(document.querySelector('#objective-title').textContent,/Wildbrick Island/);assert.equal(document.querySelector('#arena-health').textContent,'44');assert.equal(document.querySelector('#arena-ranks img'),null);const board=document.querySelector('#arena-board');assert.equal(board.open,true);assert.equal(board.querySelector('button'),null);board.open=false;arenaUI.update(client);assert.equal(board.open,false);board.open=true;assert.equal(document.querySelector('#action').classList.contains('hidden'),true);p.kit=makeKit();p.health=0;p.respawnAt=r.time+12000;arenaUI.update(client);assert.match(document.querySelector('#arena-respawn').textContent,/12/);arenaUI.error('Sign in',401);assert.equal(document.querySelector('#arena-sign-in').classList.contains('hidden'),false);assert.equal(document.querySelector('#arena-sign-in').target,'_top');document.querySelector('#arena-lobby').close();});
check('arena keyboard and held touch attack remain separate from jump and movement',()=>{state.arena=true;state.mode='foot';key('keydown','ArrowRight');assert.equal(input.read().fire,true);key('keyup','ArrowRight');assert.equal(input.read().fire,false);assert.equal(fires,0);key('keydown','Space');assert.equal(jumps,1);key('keyup','Space');key('keydown','KeyW');const action=document.querySelector('#action'),down=new window.Event('pointerdown',{cancelable:true});Object.assign(down,{pointerId:7});action.dispatchEvent(down);assert.equal(input.read().fire,true);assert.equal(input.read().z,1);action.dispatchEvent(new window.Event('pointercancel'));assert.equal(input.read().fire,false);input.clear();assert.equal(input.read().z,0);});
check('camera drag changes view without changing weapon tilt',()=>{const tilt=input.read().weaponPitch;const scene=document.querySelector('#scene');const pointer=(type,x,y)=>{const e=new window.Event(type);Object.assign(e,{pointerId:8,clientX:x,clientY:y});scene.dispatchEvent(e);};pointer('pointerdown',0,300);pointer('pointermove',0,-300);assert.equal(input.read().weaponPitch,tilt);assert.equal(input.pitch,.17);pointer('pointermove',0,1000);assert.equal(input.read().weaponPitch,tilt);assert.equal(input.pitch,.92);pointer('pointerup',0,1000);});
check('remote originals and generated creations assemble and dispose without destroying shared world geometry',()=>{const scene=new THREE.Scene(),world=createWorld(scene),view=createArenaView(scene,new THREE.PerspectiveCamera()),r=newRoom(),p=addPlayer(r,'a','Alpha'),q=addPlayer(r,'b','Beta'),b=JSON.parse(fs.readFileSync(new URL('../validation/live/dragon.json',import.meta.url))).blueprint;const cache=new Map([['dragon',b]]);p.kit=makeKit('plane');q.kit=makeKit('dragon',b);q.building={kit:makeKit('car'),starts:r.time,ends:r.time+2800};view.update(roomSnapshot(r,'a'),p,cache,1/60,r.time+1000);scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));const holder=new THREE.Group(),shared=box(holder,0,0,0,1,1,1,0xffffff).geometry;let disposed=0;shared.addEventListener('dispose',()=>disposed++);view.effect({type:'break',x:1,y:1,z:1});view.update(roomSnapshot(r,'a'),p,cache,2,r.time+2000);view.clear();assert.equal(disposed,0);world.setDestroyed(['house:0','tree:inner:0']);world.setDestroyed([]);});
check('only health, defense and speed parachutes are rendered, including with legacy snapshots',()=>{
 const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),r=newRoom(),p=addPlayer(r,'p','Collector');
 r.drops=[...SUPPORT_DROPS,'equipment'].map((type,i)=>({id:'supply:'+i,type,equipment:'supply:rover',x:i*5,z:0,born:r.time,lands:r.time+5500,expires:r.time+45000}));view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time);
 assert.equal(scene.getObjectByName('airdrop:supply:3'),undefined);const drop=scene.getObjectByName('airdrop:supply:1');assert.ok(drop.userData.canopy.visible);const height=drop.position.y;view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+5600);assert.ok(drop.position.y<height);assert.equal(drop.userData.canopy.visible,false);view.clear();assert.equal(scene.getObjectByName('airdrop:supply:1'),undefined);
});
check('camera obstruction fades only the landmark without moving the camera',()=>{const scene=new THREE.Scene(),world=createWorld(scene),camera={x:-17,y:3,z:-23},focus={x:-17,y:2,z:-9};const before={...camera};for(let i=0;i<50;i++)world.updateCamera(camera,focus,1/60);const house=world.entityGroups.get('house:0');let faded=false;house.traverse(m=>{if(m.isMesh&&m.material.opacity<.3)faded=true;});assert.ok(faded);assert.deepEqual(camera,before);world.updateCamera({x:0,y:4,z:5},{x:0,y:1,z:0},1);house.traverse(m=>{if(m.isMesh)assert.equal(m.material.opacity,1);});});
check('arrow actions combine movement, attack and speech without moving the camera',()=>{
 input.clear();state.arena=true;state.mode='foot';
 key('keydown','KeyW');key('keydown','ArrowRight');key('keydown','ArrowLeft');key('keydown','ArrowLeft',{repeat:true});
 assert.equal(input.read().z,1);assert.equal(input.read().fire,true);assert.equal(mics,1);
 key('keyup','ArrowLeft');key('keydown','ArrowLeft');assert.equal(mics,2);
 const beforeJump=jumps;key('keydown','ArrowUp');assert.equal(jumps,beforeJump+1);
 input.clear();state.mode='plane';key('keydown','ArrowUp');assert.equal(input.read().up,true);assert.equal(jumps,beforeJump+1);key('keyup','ArrowUp');key('keydown','ArrowDown');assert.equal(input.read().down,true);
 input.clear();const yaw=input.yaw;key('keydown','KeyE');input.update(.1);assert.ok(input.yaw<yaw);assert.equal(exits,0);key('keyup','KeyE');key('keydown','Backspace');assert.equal(exits,1);
 key('keydown','Enter');assert.equal(imagines,0);assert.equal(document.querySelector('#menu').open,false);key('keyup','Enter');input.clear();const currentYaw=input.yaw;key('keydown','ArrowRight');input.update(.1);assert.equal(input.yaw,currentYaw);input.clear();key('keydown','KeyR');input.update(.1);assert.equal(input.read().fire,false);input.clear();
 assert.equal(document.querySelector('#mic kbd').textContent,'←');assert.equal(document.querySelector('#imagine'),null);assert.equal(document.querySelector('#arena-crosshair'),null);
});
check('Hotkeys opens and closes by button, H and Escape; presets are absent',()=>{
 input.clear();assert.equal(document.querySelectorAll('[data-build]').length,0);assert.equal(document.querySelector('#help span').textContent,'Help');
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
check('empty-handed punching animates arms; a confirmed hit flashes and flinches without displacement',()=>{
 const scene=new THREE.Scene(),view=createArenaView(scene,new THREE.PerspectiveCamera()),r=newRoom(),p=addPlayer(r,'p','Puncher');p.y=1.3;p.yaw=.87;
 view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time);const actor=scene.children[0].children[0],creation=actor.getObjectByName('creation');assert.equal(creation.children.length,0);
 for(let i=0;i<120;i++)view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time);const facing=actor.rotation.y;
 const arm=actor.children[0].children.find(c=>c.position.x===-.68);const rest=arm.rotation.x;
 view.effect({type:'attack-preview',player:p.id,weapon:'punch',yaw:0,time:r.time});view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+130);assert.ok(arm.rotation.x<rest-1);assert.ok(Math.abs(actor.rotation.y-facing)<1e-9);
 const position=actor.position.clone();view.effect({type:'hit',player:p.id,x:p.x,y:p.y+1.3,z:p.z,time:r.time+130});view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+160);assert.ok(actor.children[0].rotation.x<0);assert.deepEqual(actor.position,position);
 let flash=false;actor.children[0].traverse(m=>{if(m.material?.emissiveIntensity>0)flash=true;});assert.ok(flash);
 p.kit=makeKit('sword');view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+170);view.effect({type:'swing',player:p.id,weapon:'blade',yaw:0});view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+300);assert.ok(actor.getObjectByName('creation').rotation.x<-.5);
 p.kit=makeKit('bow');view.update(roomSnapshot(r,p.id),p,new Map(),1/60,r.time+700);scene.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(actor.getObjectByName('creation')).min.y>=p.y);view.clear();
});
check('first play shows three illustrated cards; Skip saves once and Help reopens them',()=>{
 localStorage.removeItem('brickwild-tour-v1');ui.showEntry();const before=joins;document.querySelector('#start').click();const tour=document.querySelector('#tutorial');assert.ok(tour.open);assert.equal(joins,before);assert.match(tour.textContent,/Move and look/);assert.match(tour.querySelector('img').src,/move.png/);
 document.querySelector('#tour-next').click();assert.match(tour.textContent,/Speak it/);document.querySelector('#tour-next').click();assert.match(tour.textContent,/Refuel/);document.querySelector('#tour-next').click();assert.equal(joins,before+1);assert.equal(tour.open,false);assert.equal(localStorage.getItem('brickwild-tour-v1'),'seen');
 ui.showEntry();document.querySelector('#start').click();assert.equal(joins,before+2);assert.equal(tour.open,false);ui.openMenu('hotkeys');document.querySelector('#tour-again').click();assert.ok(tour.open);document.querySelector('#tour-skip').click();assert.equal(tour.open,false);globalThis.matchMedia=()=>({matches:true});ui.openTour();assert.match(tour.textContent,/left joystick/);assert.doesNotMatch(tour.textContent,/WASD/);document.querySelector('#tour-skip').click();delete globalThis.matchMedia;assert.equal(state.paused,false);
 ui.openMenu('hotkeys');document.querySelector('#type-fallback').click();assert.equal(document.activeElement,document.querySelector('#creation-description'));ui.closeMenu();
});
check('Enter starts once, advances the tour and resumes; text entry and repeat stay safe',()=>{
 ui.showEntry();state.started=false;localStorage.removeItem('brickwild-tour-v1');const before=joins;
 key('keydown','Enter',{ctrlKey:true});key('keydown','Enter',{repeat:true});assert.equal(state.started,false);
 const field=document.createElement('textarea');document.body.append(field);field.dispatchEvent(new window.KeyboardEvent('keydown',{code:'Enter',bubbles:true}));field.remove();assert.equal(state.started,false);
 key('keydown','Enter');assert.equal(state.started,true);assert.equal(joins,before);assert.ok(document.querySelector('#tutorial').open);
 key('keydown','Enter',{repeat:true});assert.match(document.querySelector('#tutorial').textContent,/1 \/ 3/);
 for(let i=0;i<3;i++)key('keydown','NumpadEnter');assert.equal(joins,before+1);assert.equal(document.querySelector('#tutorial').open,false);
 key('keydown','Enter');assert.equal(joins,before+1);state.arena=true;key('keydown','Escape');assert.ok(document.querySelector('#menu').open);key('keydown','Enter');assert.equal(document.querySelector('#menu').open,false);
 assert.match(document.querySelector('.move-hint').textContent,/R \/ F weapon tilt/);
});
check('pause menu exits to home without a standalone Arena exit',()=>{
 ui.openMenu('hotkeys');assert.equal(document.querySelector('#exit-home'),null);ui.closeMenu();const before=leaves;key('keydown','Escape');assert.ok(document.querySelector('#exit-home'));document.querySelector('#exit-home').click();assert.equal(leaves,before+1);assert.equal(document.querySelector('#menu').open,false);assert.equal(document.querySelector('#intro').classList.contains('hidden'),false);
 document.querySelector('#start').click();key('keydown','Enter');assert.equal(document.querySelector('#intro').classList.contains('hidden'),true);state.arena=true;
});
check('round countdown, final scoreboard and restart stay in Arena without losing last results',()=>{
 const r=newRoom(),p=addPlayer(r,'p','<script>');p.kills=5;p.deaths=2;let restarts=0;const client={self:p,snapshot:roomSnapshot(r,p.id),active:true,serverTime:()=>r.time};arenaUI.setStatus('online');arenaUI.update(client);assert.match(document.querySelector('#arena-round-clock').textContent,/5:00/);p.lastSeen=r.round.endsAt;advanceRoom(r,r.round.endsAt);client.snapshot=roomSnapshot(r,p.id);arenaUI.update(client);assert.equal(document.querySelector('#arena-results').classList.contains('hidden'),false);assert.equal(document.querySelector('#arena-final-ranks script'),null);assert.equal(document.querySelector('#action').classList.contains('hidden'),true);assert.equal(document.querySelector('#mic').disabled,true);assert.equal(document.querySelector('#arena-restart').disabled,false);applyInput(r,p.id,{seq:1,roundId:1,command:{id:1,type:'restart',roundId:1}},r.time);client.snapshot=roomSnapshot(r,p.id);arenaUI.update(client);assert.match(document.querySelector('#arena-round-clock').textContent,/5:00.*Round 2/);assert.equal(document.querySelector('#arena-results').classList.contains('hidden'),true);assert.match(document.querySelector('#arena-previous-ranks').textContent,/5/);assert.equal(document.querySelector('#mic').disabled,false);assert.equal(client.self.id,'p');
});
check('expired arena keeps vitals, exposes Rejoin, and retains a touch Lower control after dismount',()=>{
 const r=newRoom(),p=addPlayer(r,'p','Held');Object.assign(p,{x:21,y:8,z:19,health:76});const client={self:p,snapshot:roomSnapshot(r,p.id),active:true,room:'HOLD',serverTime:()=>r.time};
 arenaUI.setStatus('expired');arenaUI.error('Your position is held. Join again.',410);assert.equal(document.querySelector('#arena-lobby').open,true);document.querySelector('#arena-lobby').close();arenaUI.update(client);
 assert.equal(document.querySelector('#arena-health').textContent,'76');assert.match(document.querySelector('#arena-network').textContent,/position held/);assert.equal(document.querySelector('#open-arena').textContent,'Rejoin');assert.equal(document.querySelector('#open-arena').style.display,'inline-flex');
 assert.equal(document.querySelector('#flight-controls').classList.contains('hidden'),false);assert.equal(document.querySelector('#ascend').classList.contains('hidden'),true);assert.equal(document.querySelector('#autorun'),null);
 const down=new window.Event('pointerdown',{cancelable:true});Object.assign(down,{pointerId:12});document.querySelector('#descend').dispatchEvent(down);assert.equal(input.read().down,true);document.querySelector('#descend').dispatchEvent(new window.Event('pointerup'));assert.equal(input.read().down,false);
});
dom.window.close();for(const k of ['window','document','location','HTMLInputElement','HTMLTextAreaElement','localStorage'])delete globalThis[k];
console.log(`\n${checks} arena DOM/scene checks passed. No browser rendering, microphone or real multitouch claim.`);
