// Swept kinematic blocking only. No forces, penetration recovery, or teleport.
const SKIN=1e-5,keys=['x','y','z'];
export function movementShape(stats){const [w,h,d]=stats.collision;const radius=stats.mounted?Math.hypot(w,d)/2:.45;return {radius,height:h};}
export function isMovementBlocker(entity){return entity.blocking!==false;}
export function overlapsBody(p,shape,b){return Math.abs(p.x-b.x)<b.w/2+shape.radius-SKIN&&Math.abs(p.z-b.z)<b.d/2+shape.radius-SKIN&&p.y<b.y+b.h/2-SKIN&&p.y+shape.height>b.y-b.h/2+SKIN;}
export function canFit(p,shape,boxes){return !boxes.some(b=>overlapsBody(p,shape,b));}
function sweep(start,delta,b,shape){
 const expanded=[b.w/2+shape.radius,b.h/2+shape.height/2,b.d/2+shape.radius],center=[b.x,b.y,b.z];
 let enter=-Infinity,exit=Infinity,axis=-1;
 for(let i=0;i<3;i++){
  const a=start[keys[i]],v=delta[keys[i]],lo=center[i]-expanded[i],hi=center[i]+expanded[i];
  if(Math.abs(v)<1e-10){if(a<=lo+SKIN||a>=hi-SKIN)return null;continue;}
  let near=(lo-a)/v,far=(hi-a)/v;if(near>far)[near,far]=[far,near];
  if(near>enter){enter=near;axis=i;}exit=Math.min(exit,far);if(enter>exit)return null;
 }
 // A legacy pose already inside a blocker can leave under its own controls.
 // No overlap solver relocates it. New builds/restores never introduce overlaps.
 if(enter< -SKIN||enter>1||exit<0||axis<0)return null;
 return {t:Math.max(0,enter),axis};
}
export function slideMove(p,desired,shape,boxes){
 const pos={x:p.x,y:p.y+shape.height/2,z:p.z};let remaining={x:desired.x-p.x,y:desired.y-p.y,z:desired.z-p.z};
 for(let pass=0;pass<4;pass++){
  let first=null;for(const b of boxes){const hit=sweep(pos,remaining,b,shape);if(hit&&(!first||hit.t<first.t))first=hit;}
  if(!first){for(const k of keys)pos[k]+=remaining[k];break;}
  const travel=Math.max(0,first.t-SKIN/Math.max(1e-6,Math.hypot(...Object.values(remaining))));
  for(const k of keys){pos[k]+=remaining[k]*travel;remaining[k]*=1-travel;}
  remaining[keys[first.axis]]=0;
 }
 const result={x:pos.x,y:Math.max(0,pos.y-shape.height/2),z:pos.z};for(const k of keys)if(desired[k]>=0||k!=='y')if(Math.abs(result[k]-desired[k])<1e-9)result[k]=desired[k];return result;
}

// A foot-sized support patch allows edge landings without hovering beside walls.
export function supportHeight(p,shape,boxes){let height=0;const radius=shape.radius;for(const b of boxes){const top=b.y+b.h/2;if(top<=p.y+.002&&top>height&&Math.abs(p.x-b.x)<b.w/2+radius&&Math.abs(p.z-b.z)<b.d/2+radius)height=top;}return height;}
