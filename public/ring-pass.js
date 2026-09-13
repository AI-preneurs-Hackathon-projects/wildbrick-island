import {RING_RADIUS} from './world-data.js';
import {RINGS} from './rules.js';
// Score a crossing of the open ring plane in either direction, never proximity.
export function passedRing(from,to,index,height){const p=RINGS[index],next=RINGS[(index+1)%RINGS.length],yaw=Math.atan2(next.x-p.x,next.z-p.z),s=Math.sin(yaw),c=Math.cos(yaw),local=q=>({x:(q.x-p.x)*c-(q.z-p.z)*s,y:q.y+height/2-p.y,z:(q.x-p.x)*s+(q.z-p.z)*c}),a=local(from),b=local(to),travel=b.z-a.z;if(Math.abs(travel)<1e-9||a.z*b.z>0)return false;const t=-a.z/travel,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;return Math.hypot(x,y)<RING_RADIUS-.55;}
