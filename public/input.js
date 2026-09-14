// Left hand: WASD/Shift and Q/E camera. Right hand: arrow actions.
export function createInput({onBuild,onAction,onJump,onPause,onMic,onHotkeys=()=>{},onPickup=()=>false,onHome,getState}){
 const keys=new Set(),stick={x:0,z:0};let yaw=Math.PI,pitch=.46,drag=null,joyPointer=null,up=false,down=false,fire=false,fireTap=false,fireFrame=false;
 const scene=document.querySelector('#scene'),joy=document.querySelector('#joystick'),knob=document.querySelector('#joy-knob');
 const typing=el=>el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el?.isContentEditable;
 const blocked=()=>!getState().started||getState().paused||!!document.querySelector('dialog[open]');
 function clear(){keys.clear();stick.x=stick.z=0;up=down=fire=fireTap=fireFrame=false;drag=null;joyPointer=null;knob.style.transform='translate(0,0)';}
 window.addEventListener('keydown',e=>{
  if(typing(e.target)||e.ctrlKey||e.metaKey||e.altKey||!getState().started)return;
  const code=e.code,menu=document.querySelector('dialog[open]');
  if(!e.repeat&&(!menu||menu.id==='menu')&&['KeyH','Escape','KeyP'].includes(code)){
   e.preventDefault();clear();if(code==='KeyH')onHotkeys();else onPause();return;
  }
  if(blocked())return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Backspace'].includes(code))e.preventDefault();
  if(e.repeat)return;keys.add(code);
  if(code==='ArrowLeft'){onMic();return;}
  if(code==='ArrowDown'&&onPickup()){keys.delete(code);return;}
  if(['ArrowUp','Space'].includes(code)&&getState().mode!=='plane')onJump();
  if(code==='ArrowRight'){if(getState().arena)fireTap=true;else onAction();}
  if(code==='Backspace')onBuild('foot');

 });
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 scene.addEventListener('pointerdown',e=>{if(drag||blocked())return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};scene.setPointerCapture(e.pointerId);});
 scene.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(-.75,Math.min(.92,pitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;});
 const endDrag=e=>{if(drag?.id===e.pointerId)drag=null;};scene.addEventListener('pointerup',endDrag);scene.addEventListener('pointercancel',endDrag);scene.addEventListener('lostpointercapture',endDrag);
 function moveJoy(e){const rect=joy.getBoundingClientRect(),radius=rect.width*.33,dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,len=Math.hypot(dx,dy),factor=len>radius?radius/len:1;stick.x=dx*factor/radius;stick.z=-dy*factor/radius;knob.style.transform=`translate(${dx*factor}px,${dy*factor}px)`;}
 joy.addEventListener('pointerdown',e=>{if(joyPointer!==null||blocked())return;e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});joy.addEventListener('pointermove',e=>{if(joyPointer===e.pointerId){e.preventDefault();moveJoy(e);}});
 const endJoy=e=>{if(joyPointer!==e.pointerId)return;joyPointer=null;stick.x=stick.z=0;knob.style.transform='translate(0,0)';};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);joy.addEventListener('lostpointercapture',endJoy);
 for(const [id,which] of [['ascend','up'],['descend','down']]){const el=document.getElementById(id);const set=v=>{if(which==='up')up=v;else down=v;};el.addEventListener('pointerdown',e=>{if(blocked())return;e.preventDefault();if(which==='down'&&onPickup())return;el.setPointerCapture(e.pointerId);set(true);});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>set(false));}
 const attack=document.getElementById('action');attack.addEventListener('pointerdown',e=>{if(blocked()||!getState().arena)return;e.preventDefault();attack.setPointerCapture(e.pointerId);fire=true;fireTap=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])attack.addEventListener(event,()=>fire=false);
 function update(dt){fireFrame=fireTap;fireTap=false;if(blocked()){fireFrame=false;return;}const step=Math.min(.1,dt);yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*1.8*step;}
 return {clear,update,get yaw(){return yaw;},get pitch(){return pitch;},read(){return {x:stick.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z:stick.z+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),cameraYaw:yaw,weaponPitch:0,fire:fire||fireFrame||keys.has('ArrowRight'),up:up||keys.has('ArrowUp')||keys.has('Space'),down:down||keys.has('ArrowDown'),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')};}};
}
