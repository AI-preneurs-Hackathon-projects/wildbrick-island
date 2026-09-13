import {slideMove,supportHeight} from './movement-blocking.js';
// Shared deterministic movement: direct horizontal input, supported ground motion,
// and a ballistic jump. Flying mounts retain explicit rise/lower and hover.
export const MOVE_DT=1/60;
export const JUMP_HEIGHT=2,GRAVITY=20,JUMP_SPEED=Math.sqrt(2*GRAVITY*JUMP_HEIGHT),JUMP_SECONDS=2*JUMP_SPEED/GRAVITY;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function startJump(p,mounted=false){
 if(mounted||p.jumpRemaining>0||p.grounded===false||(p.grounded===undefined&&p.y>.002))return false;
 p.jumpBase=p.y;p.jumpRemaining=JUMP_SECONDS;p.vy=JUMP_SPEED;p.grounded=false;return true;
}
export function moveDirect(p,input,dt,{speed,mounted=false,flying=false,limit=53,height=35,shape={radius:.45,height:2.5},boxes=[]}){
 const previous={x:p.x,y:p.y,z:p.z};
 let x=input.x||0,z=input.z||0;const length=Math.hypot(x,z);
 if(length<.06){x=0;z=0;}else if(length>1){x/=length;z/=length;}
 const yaw=input.cameraYaw||0,dx=Math.sin(yaw)*z-Math.cos(yaw)*x,dz=Math.cos(yaw)*z+Math.sin(yaw)*x;
 p.speed=Math.hypot(x,z)*speed;p.vertical=0;
 if(p.speed>0){p.yaw=Math.atan2(dx,dz);p.x=clamp(p.x+dx*speed*dt,-limit,limit);p.z=clamp(p.z+dz*speed*dt,-limit,limit);}
 shape={...shape,yaw:p.yaw};
 if(flying){
  p.jumpRemaining=0;p.vy=0;p.vertical=((input.up?1:0)-(input.down?1:0))*10;p.y=clamp(p.y+p.vertical*dt,0,height);
  Object.assign(p,slideMove(previous,p,shape,boxes));p.flightAltitude=p.y;p.grounded=false;
 }else{
  // Resolve horizontal motion at the current height before testing support. The
  // sweep then resolves ascending ceilings and descending top contacts.
  const horizontal=slideMove(previous,{x:p.x,y:previous.y,z:p.z},shape,boxes);p.x=horizontal.x;p.z=horizontal.z;
  const support=supportHeight(p,shape,boxes),supported=Math.abs(previous.y-support)<.002&&!(p.vy>0);
  p.grounded=supported;if(supported){p.y=support;p.vy=0;p.jumpRemaining=0;}
  if(input.jump)startJump(p,mounted);
  if(!p.grounded){const velocity=Number.isFinite(p.vy)?p.vy:0,desired={x:p.x,y:p.y+velocity*dt-GRAVITY*dt*dt/2,z:p.z};p.vy=velocity-GRAVITY*dt;
   const landed=slideMove({x:p.x,y:previous.y,z:p.z},desired,shape,boxes);p.y=landed.y;
   if(velocity>0&&landed.y<desired.y-1e-6){p.vy=0;p.jumpRemaining=0;}
   const floor=supportHeight(p,shape,boxes);if(p.vy<=0&&p.y<=floor+.002){p.y=floor;p.vy=0;p.grounded=true;p.jumpRemaining=0;}else if(p.jumpRemaining>0)p.jumpRemaining=Math.max(.001,p.jumpRemaining-dt);
  }
  p.vertical=(p.y-previous.y)/Math.max(dt,1e-6);
 }
 p.speed=Math.hypot(p.x-previous.x,p.z-previous.z)/Math.max(dt,1e-6);
 p.autoRun=false;
}
