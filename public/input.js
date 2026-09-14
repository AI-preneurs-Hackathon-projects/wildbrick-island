import {ACTION_BINDINGS,keyAction,typingTarget,gameplayBlocked} from './action-bindings.js';
// Left hand: WASD/Shift and Q/E/R/F camera. Right hand: arrow actions.
export function createInput({onBuild,onDrop=()=>onBuild?.('foot'),onAction=()=>{},onJump=()=>{},onPause=()=>{},onMic=()=>{},onHotkeys=()=>{},onControls=()=>{},onCollection=()=>{},onSlot=()=>false,onPickup=()=>false,onHome,getState}){
 const keys=new Set(),touchPointers=new Map(),stick={x:0,z:0};let yaw=Math.PI,pitch=.46,drag=null,joyPointer=null,up=false,down=false,fire=false,fireTap=false,fireFrame=false,composing=false;
 const scene=document.querySelector('#scene'),joy=document.querySelector('#joystick'),knob=document.querySelector('#joy-knob');
 const typing=typingTarget;
 const blocked=()=>gameplayBlocked(getState())||composing||typing(document.activeElement)||!!document.querySelector('dialog[open]');
 function clear(){keys.clear();touchPointers.clear();stick.x=stick.z=0;up=down=fire=fireTap=fireFrame=false;drag=null;joyPointer=null;knob.style.transform='translate(0,0)';}
 window.addEventListener('keydown',e=>{
  const option=['AltLeft','AltRight'].includes(e.code);if(option&&!e.repeat&&!typing(e.target)&&!e.isComposing&&e.keyCode!==229&&!composing&&!e.ctrlKey&&!e.metaKey&&getState().started&&!document.querySelector('dialog[open]')){e.preventDefault();clear();onControls();return;}
  if(typing(e.target)||e.isComposing||e.keyCode===229||composing||e.ctrlKey||e.metaKey||e.altKey||!getState().started){clear();return;}
  const code=e.code,action=keyAction(code),menu=document.querySelector('dialog[open]'),slot=ACTION_BINDINGS[action]?.slot;
  if(Number.isInteger(slot)&&!e.repeat&&menu?.id==='menu'&&menu.dataset.mode==='collection'){e.preventDefault();clear();onSlot(slot);return;}
  if(!e.repeat&&(!menu||menu.id==='menu')&&['KeyH','Escape','KeyP'].includes(code)){
   e.preventDefault();clear();if(code==='KeyH')onHotkeys();else onPause();return;
  }
  if(blocked()){clear();return;}
  if(action)e.preventDefault();
  if(e.repeat||keys.has(code))return;keys.add(code);
  if(Number.isInteger(slot)){onSlot(slot);return;}
  if(action==='collection'){onCollection();return;}
  if(action==='speak'){onMic();return;}
  if(action==='drop'||action==='pickup'){const state=getState();if(!state.building)(state.carrying??(state.mode!=='foot'||!!state.custom)?onDrop:onPickup)();return;}
  if(action==='rise'&&getState().mode!=='plane')onJump();
  if(action==='attack'){if(getState().arena)fireTap=true;else onAction();}

 });
 document.addEventListener('compositionstart',()=>{composing=true;clear();});document.addEventListener('compositionend',()=>{composing=false;clear();});document.addEventListener('focusin',e=>{if(typing(e.target))clear();});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 scene.addEventListener('pointerdown',e=>{if(drag||blocked())return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};scene.setPointerCapture(e.pointerId);});
 scene.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(-.75,Math.min(.92,pitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;});
 const endDrag=e=>{if(drag?.id===e.pointerId)drag=null;};scene.addEventListener('pointerup',endDrag);scene.addEventListener('pointercancel',endDrag);scene.addEventListener('lostpointercapture',endDrag);
 function moveJoy(e){const rect=joy.getBoundingClientRect(),radius=rect.width*.33,dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,len=Math.hypot(dx,dy),factor=len>radius?radius/len:1;stick.x=dx*factor/radius;stick.z=-dy*factor/radius;knob.style.transform=`translate(${dx*factor}px,${dy*factor}px)`;}
 joy.addEventListener('pointerdown',e=>{if(joyPointer!==null||blocked())return;e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});joy.addEventListener('pointermove',e=>{if(joyPointer===e.pointerId){e.preventDefault();moveJoy(e);}});
 const endJoy=e=>{if(joyPointer!==e.pointerId)return;joyPointer=null;stick.x=stick.z=0;knob.style.transform='translate(0,0)';};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);joy.addEventListener('lostpointercapture',endJoy);
 for(const [id,which] of [['ascend','up'],['descend','down']]){const el=document.getElementById(id);const set=v=>{if(which==='up')up=v;else down=v;};el.addEventListener('pointerdown',e=>{if(blocked()||touchPointers.has(which))return;e.preventDefault();touchPointers.set(which,e.pointerId);el.setPointerCapture(e.pointerId);set(true);});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(touchPointers.get(which)===e.pointerId){touchPointers.delete(which);set(false);}});}
 const attack=document.getElementById('action');attack.addEventListener('pointerdown',e=>{if(blocked()||!getState().arena)return;e.preventDefault();attack.setPointerCapture(e.pointerId);fire=true;fireTap=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])attack.addEventListener(event,()=>fire=false);
 function update(dt){fireFrame=fireTap;fireTap=false;if(blocked()){clear();return;}const step=Math.min(.1,dt);yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*1.8*step;pitch=Math.max(-.75,Math.min(.92,pitch+((keys.has('KeyF')?1:0)-(keys.has('KeyR')?1:0))*1.35*step));}
 const held=action=>ACTION_BINDINGS[action].codes.some(code=>keys.has(code));
 return {clear,update,get yaw(){return yaw;},get pitch(){return pitch;},read(){if(blocked())clear();return {x:stick.x+(held('right')?1:0)-(held('left')?1:0),z:stick.z+(held('forward')?1:0)-(held('back')?1:0),cameraYaw:yaw,weaponPitch:0,fire:fire||fireFrame||held('attack'),up:up||held('rise'),down:down||held('lower'),sprint:held('run')};}};
}
