import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {createInput} from '../public/input.js';
import {gameCamera} from '../public/game-camera.js';

function fixture(){
 const dom=new JSDOM('<div id="scene"></div><div id="joystick"></div><div id="joy-knob"></div><button id="ascend"></button><button id="descend"></button><button id="action"></button><input id="text"><div id="edit" contenteditable="true" tabindex="0"></div><dialog id="menu"></dialog>');
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 const state={started:true,paused:false,health:100,roundFinished:false,arena:true,mode:'foot'},calls=[];
 const input=createInput({getState:()=>state,onAction:()=>calls.push('attack'),onDrop:()=>calls.push('drop'),onPickup:()=>calls.push('pickup'),onJump:()=>calls.push('jump'),onMic:()=>calls.push('speak')});
 const key=(type,code,target=window)=>{const e=new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true});target.dispatchEvent(e);return e;};
 const frames=(count=10)=>{for(let i=0;i<count;i++)input.update(1/60);};
 return {dom,state,input,calls,key,frames,close:()=>dom.window.close()};
}

test('R/F move the camera rig in opposite directions, independently of weapon aim',()=>{
 const f=fixture();try{
  const player={x:4,y:0,z:6,mode:'foot'},camera=()=>gameCamera(player,null,{yaw:f.input.yaw,pitch:f.input.pitch},16/9);
  const before=camera(),pitch=f.input.pitch,yaw=f.input.yaw;
  assert.equal(f.key('keydown','KeyR').defaultPrevented,true);f.frames();
  assert.ok(f.input.pitch<pitch);assert.ok(camera().position.y<before.position.y);
  f.key('keyup','KeyR');f.key('keydown','KeyF');f.frames(20);
  assert.ok(f.input.pitch>pitch);assert.ok(camera().position.y>before.position.y);
  assert.equal(f.input.yaw,yaw);assert.equal(f.input.read().weaponPitch,0);
  assert.deepEqual(f.calls,[]);assert.equal(f.input.read().up,false);assert.equal(f.input.read().down,false);
 }finally{f.close();}
});

test('long camera holds stay within the existing drag limits and recover immediately on reversal',()=>{
 const f=fixture();try{
  f.key('keydown','KeyR');f.frames(600);assert.equal(f.input.pitch,-.75);
  f.key('keyup','KeyR');f.key('keydown','KeyF');f.frames(1);assert.ok(f.input.pitch>-.75);
  f.frames(600);assert.equal(f.input.pitch,.92);
  f.key('keyup','KeyF');f.key('keydown','KeyR');f.frames(1);assert.ok(f.input.pitch<.92);
  assert.equal(f.input.read().weaponPitch,0);
 }finally{f.close();}
});

test('key release, explicit clearing and window blur stop camera movement without a stuck hold',()=>{
 const f=fixture();try{
  for(const release of [()=>f.key('keyup','KeyR'),()=>f.input.clear(),()=>window.dispatchEvent(new window.Event('blur'))]){
   f.key('keydown','KeyR');f.frames(2);release();const stopped=f.input.pitch;f.frames(20);assert.equal(f.input.pitch,stopped);
  }
  f.key('keydown','KeyR');f.key('keydown','KeyF');const pitch=f.input.pitch;f.frames();assert.equal(f.input.pitch,pitch);
 }finally{f.close();}
});

test('typing, editable content, dialogs and IME block camera controls and discard an earlier hold',()=>{
 const f=fixture();try{
  const cases=[
   [()=>document.getElementById('text').focus(),()=>document.activeElement.blur()],
   [()=>document.getElementById('edit').focus(),()=>document.activeElement.blur()],
   [()=>document.getElementById('menu').setAttribute('open',''),()=>document.getElementById('menu').removeAttribute('open')],
   [()=>document.dispatchEvent(new window.CompositionEvent('compositionstart')),()=>document.dispatchEvent(new window.CompositionEvent('compositionend'))]
  ];
  for(const [block,unblock] of cases){
   f.key('keydown','KeyR');block();const pitch=f.input.pitch;
   f.key('keydown','KeyF',document.activeElement);f.frames();assert.equal(f.input.pitch,pitch);
   unblock();f.frames();assert.equal(f.input.pitch,pitch);
  }
 }finally{f.close();}
});

test('pause, KO, completed rounds and inactive play block and release camera controls',()=>{
 const f=fixture();try{
  for(const [name,value] of [['paused',true],['health',0],['roundFinished',true],['started',false]]){
   f.key('keydown','KeyR');const old=f.state[name],pitch=f.input.pitch;f.state[name]=value;
   f.frames();f.key('keydown','KeyF');f.frames();assert.equal(f.input.pitch,pitch,name);
   f.state[name]=old;f.frames();assert.equal(f.input.pitch,pitch,`${name} clears held input`);
  }
 }finally{f.close();}
});

test('Q/E orbit still works while R/F pitch and movement/fire remain independent',()=>{
 const f=fixture();try{
  const yaw=f.input.yaw,pitch=f.input.pitch;f.key('keydown','KeyQ');f.key('keydown','KeyR');f.key('keydown','KeyW');f.key('keydown','ArrowRight');f.frames(4);
  assert.ok(f.input.yaw>yaw);assert.ok(f.input.pitch<pitch);
  assert.equal(f.input.read().z,1);assert.equal(f.input.read().fire,true);assert.equal(f.input.read().weaponPitch,0);
  f.key('keyup','KeyQ');f.key('keyup','KeyR');f.key('keydown','KeyE');f.frames(8);assert.ok(f.input.yaw<yaw);
  f.key('keyup','KeyE');const stopped=f.input.yaw;f.frames();assert.equal(f.input.yaw,stopped);
 }finally{f.close();}
});
