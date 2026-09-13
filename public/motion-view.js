// Network correction is presentation only. Never feed this position to the server.
export function createMotionView(){
 let shown=null,offset={x:0,y:0,z:0};
 function reset(){shown=null;offset={x:0,y:0,z:0};}
 function accept(next,{teleport=false}={}){
  const snap=!shown||teleport||shown.id!==next.id;
  if(snap){shown={...next};offset={x:0,y:0,z:0};}
  else{offset={x:shown.x-next.x,y:shown.y-next.y,z:shown.z-next.z};shown={...next,x:shown.x,y:shown.y,z:shown.z};}
 }
 function update(next,dt,{correct=true}={}){if(!shown)accept(next);const length=Math.hypot(offset.x,offset.y,offset.z),limit=Math.max(2,next.speed*.55)*dt,decay=Math.min(1-Math.exp(-dt*12),length>0?limit/length:1),f=correct?1-decay:1;for(const key of ['x','y','z'])offset[key]*=f;if(next.grounded)offset.y=0;shown={...next,x:next.x+offset.x,y:Math.max(0,next.y+offset.y),z:next.z+offset.z,yaw:next.yaw};return shown;}
 return {accept,update,reset,get state(){return shown;}};
}
