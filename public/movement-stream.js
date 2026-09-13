// Compact bounded input frames. The server computes positions; clients never
// send coordinates. A frame is [sequence, strafe, forward, camera, aim, flags].
export const MAX_MOVE_FRAMES=90;
export function packFrame(id,i){return [id,i.x||0,i.z||0,i.cameraYaw||0,i.weaponPitch||0,(i.sprint?1:0)|(i.up?2:0)|(i.down?4:0)|(i.fire?8:0)|(i.jump?16:0)];}
export function frameInput(f){return {x:f[1],z:f[2],cameraYaw:f[3],weaponPitch:f[4],sprint:!!(f[5]&1),up:!!(f[5]&2),down:!!(f[5]&4),fire:!!(f[5]&8),jump:!!(f[5]&16)};}
export function validFrames(frames){return Array.isArray(frames)&&frames.length<=MAX_MOVE_FRAMES&&frames.every((f,i)=>Array.isArray(f)&&f.length===6&&f.every(Number.isFinite)&&Number.isSafeInteger(f[0])&&f[0]>0&&f[0]<=1e12&&(!i||f[0]===frames[i-1][0]+1)&&Math.abs(f[1])<=1&&Math.abs(f[2])<=1&&Math.abs(f[3])<=10000&&Math.abs(f[4])<=.75&&Number.isInteger(f[5])&&f[5]>=0&&f[5]<=31);}
export function newMotion(now){return {version:1,frame:0,credit:6,at:now};}
