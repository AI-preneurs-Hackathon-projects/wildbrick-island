// One camera rig for Practice and Arena. Camera look never changes weapon aim.
export function gameCamera(p,kit,{yaw,pitch},aspect,fov=48,narrow=false){
 const mounted=kit?.stats.mounted,collision=kit?.stats.collision||[1,2.4,1],height=mounted?collision[1]+1.6:2.4;
 const base=p.mode==='plane'?21:p.mode==='car'?15:narrow?15:12,angle=2*Math.atan(Math.tan(fov*Math.PI/360)*Math.min(1,aspect));
 const fit=mounted?Math.max(collision[0],height,collision[2])*.7/Math.tan(angle/2):0,distance=Math.max(base,Math.min(38,fit)),focusHeight=Math.max(1.1,height*.48);
 const position={x:p.x-Math.sin(yaw)*distance,y:p.y+focusHeight+1.2+distance*Math.sin(Math.max(0,pitch)),z:p.z-Math.cos(yaw)*distance};
 const target={x:p.x,y:p.y+focusHeight+Math.tan(Math.max(0,-pitch))*(distance+12),z:p.z};return {position,target};
}
