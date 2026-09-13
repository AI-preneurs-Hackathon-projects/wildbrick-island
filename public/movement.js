import {slideMove} from './movement-blocking.js';
// Direct controls shared by local play, prediction and the server. No forces,
// gravity, inertia, automatic takeoff, collision response or bouncing.
export const MOVE_DT=1/60;
export const JUMP_SECONDS=.64;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function startJump(p,mounted=false){
 if(mounted||p.jumpRemaining>0)return false;
 p.jumpBase=p.y;p.jumpRemaining=JUMP_SECONDS;return true;
}
export function moveDirect(p,input,dt,{speed,mounted=false,flying=false,limit=53,height=35,shape={radius:.45,height:2.5},boxes=[]}){
 const previous={x:p.x,y:p.y,z:p.z};
 let x=input.x||0,z=input.z||0;const length=Math.hypot(x,z);
 if(length<.06){x=0;z=0;}else if(length>1){x/=length;z/=length;}
 const yaw=input.cameraYaw||0,dx=Math.sin(yaw)*z-Math.cos(yaw)*x,dz=Math.cos(yaw)*z+Math.sin(yaw)*x;
 p.speed=Math.hypot(x,z)*speed;p.vertical=0;
 if(p.speed>0){p.yaw=Math.atan2(dx,dz);p.x=clamp(p.x+dx*speed*dt,-limit,limit);p.z=clamp(p.z+dz*speed*dt,-limit,limit);}
 if(flying){
  p.jumpRemaining=0;p.vertical=((input.up?1:0)-(input.down?1:0))*10;
  p.y=clamp(p.y+p.vertical*dt,0,height);p.flightAltitude=p.y;
 }else{
  if(input.down&&!(p.jumpRemaining>0))p.y=Math.max(0,p.y-10*dt);
  if(input.jump)startJump(p,mounted);
  if(p.jumpRemaining>0){
   p.jumpRemaining=Math.max(0,p.jumpRemaining-dt);const t=1-p.jumpRemaining/JUMP_SECONDS;
   p.y=(p.jumpBase||0)+1.25*(t<.5?t*2:(1-t)*2);
   if(p.jumpRemaining<1e-8){p.jumpRemaining=0;p.y=p.jumpBase||0;}
  }
 }
 if(boxes.length){const limited=slideMove(previous,p,shape,boxes);Object.assign(p,limited);p.speed=Math.hypot(p.x-previous.x,p.z-previous.z)/Math.max(dt,1e-6);}
 p.autoRun=false;
}
