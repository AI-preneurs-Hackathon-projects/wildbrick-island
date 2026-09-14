// Two actual clients/core/views, shared by Node trajectory checks and desktop capture.
import {performanceFixture} from './performance-fixture.mjs';
export const remoteProfiles=[{name:'100',latency:100},{name:'variable100-300',delays:({random})=>({up:50+random()*100,down:50+random()*100})},{name:'600',latency:600},{name:'asymmetric-jitter',delays:({index,random})=>({up:(index?200:50)+random()*100,down:(index?200:50)+random()*100})},{name:'1600',latency:1600}];
const DT=1/60,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),pose=p=>({x:p.x,y:p.y,z:p.z,yaw:p.yaw}),percentile=(v,p)=>v.slice().sort((a,b)=>a-b)[Math.max(0,Math.ceil(v.length*p)-1)]||0;
export async function remoteViewFixture({core,THREE,createArenaClient,createArenaView,profile,draw=async()=>{},seconds=24}){
 const scenes=[new THREE.Scene(),new THREE.Scene()],cameras=scenes.map(()=>{const c=new THREE.PerspectiveCamera(45,720/900,.1,250);c.position.set(-6,42,50);c.lookAt(-6,0,10);return c;}),views=scenes.map((s,i)=>createArenaView(s,cameras[i],{clock:()=>n?.now||0})),rows=[[],[]],events=[{},{}],attachments=[0,0],attachmentError=[0,0],gaps=[[],[]],lastSample=[null,null],lastFrame=[null,null];
 let n;const originalRandom=Math.random;let randomSeed=452067;Math.random=()=>((randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0)/4294967296);
 try{
 n=performanceFixture({...profile,seed:452067,measureClient:true,core,clientFactory:createArenaClient,setupPlayer:(i,p)=>Object.assign(p,{x:i?8:-8,z:10,yaw:0,kit:core.makeKit('bow')}),onEvent:(i,e)=>{views[i].effect(e);events[i][e.type]=(events[i][e.type]||0)+1;}});await n.start();
 const origin=n.now,total=240+Math.round(seconds/DT);
 for(let tick=0;tick<total;tick++){
  const k=tick-240,phase=((k%480)+480)%480,moving=k>=0&&phase<420;
  // Long straight segments permit receipt-lag estimation; each cycle also turns,
  // stops and reverses. Players remain apart, avoiding incidental combat deaths.
  const inputs=[0,1].map(i=>!moving?{}:{z:(phase<180?.6:phase<300?-.6:.3)*(i?-1:1),x:phase>=300?.3:0,fire:k>=0&&phase>=60&&phase<180});
  await n.step(inputs);
  for(let i=0;i<2;i++){
   const c=n.clients[i],remote=c.snapshot.players.find(p=>p.id!==c.snapshot.self),other=n.clients[1-i];if(!remote)continue;const auth=n.room.players[remote.id];
   views[i].update(c.snapshot,c.self,c.blueprints,DT,c.serverTime());scenes[i].updateMatrixWorld(true);
   const a=scenes[i].getObjectByName('arena-player:'+remote.id),own=scenes[i].getObjectByName('arena-player:'+c.snapshot.self);
   if(dist(own.position,c.self)>1e-8)throw Error('Local presentation must remain immediate');
   const key=remote.motion?.frame;if(key!==lastFrame[i]){if(lastSample[i]!==null)gaps[i].push(n.now-lastSample[i]);lastFrame[i]=key;lastSample[i]=n.now;}
   for(const p of c.snapshot.players){const actor=scenes[i].getObjectByName('arena-player:'+p.id),flash=actor?.getObjectByName('muzzle-flash'),model=actor?.getObjectByName('creation');if(flash?.visible&&p.kit.mode==='bow'){if(!model)throw Error('Flash without equipped model');const expected=new THREE.Vector3(.13,0,.84).applyMatrix4(model.matrixWorld);attachments[i]++;attachmentError[i]=Math.max(attachmentError[i],expected.distanceTo(flash.getWorldPosition(new THREE.Vector3())));}}
   rows[i].push({t:(tick-240)*DT*1000,display:pose({...a.position,yaw:a.rotation.y}),received:pose(remote),authoritative:pose(auth),moving:!!(inputs[1-i].x||inputs[1-i].z),speed:Math.hypot(inputs[1-i].x||0,inputs[1-i].z||0)*auth.kit.stats.speed,alive:auth.health>0,local:pose(c.self),otherLocal:pose(other.self)});
  }
  await draw({scenes,cameras,views,n,tick,total});
 }
 const peers=rows.map((all,i)=>{
  const samples=all.filter(r=>r.t>=0),steps=[],changes=[],errors=[],receivedErrors=[];let previousVelocity=null,slowMs=0,maxSlow=0,slow=0;
  for(let j=1;j<samples.length;j++){const a=samples[j-1],b=samples[j],v={x:(b.display.x-a.display.x)/DT,y:(b.display.y-a.display.y)/DT,z:(b.display.z-a.display.z)/DT};if(b.moving&&b.alive){steps.push(dist(a.display,b.display));if(previousVelocity)changes.push(dist(v,previousVelocity));if(dist(a.display,b.display)<b.speed*DT*.25){slowMs+=DT*1000;slow+=DT*1000;maxSlow=Math.max(maxSlow,slow);}else slow=0;}else slow=0;previousVelocity=v;errors.push(dist(b.display,b.authoritative));receivedErrors.push(dist(b.display,b.received));}
  // Best-fit delay against the exact received target sequence, not claimed
  // end-to-end latency. Search only one second to avoid periodic path aliases.
  let lagMs=0,fit=Infinity;for(let lag=0;lag<=60;lag++){let sum=0,count=0;for(let j=240+60;j<all.length;j++){sum+=dist(all[j].display,all[j-lag].received)**2;count++;}const e=Math.sqrt(sum/count);if(e<fit){fit=e;lagMs=lag*DT*1000;}}
  return {movingMs:samples.filter(r=>r.moving&&r.alive).length*DT*1000,stepP99M:percentile(steps,.99),stepMaxM:Math.max(...steps),velocityChangeP99Mps:percentile(changes,.99),slowMs,longestSlowMs:maxSlow,receivedFitLagMs:lagMs,receivedFitRmseM:fit,authorityErrorP95M:percentile(errors,.95),authorityErrorMaxM:Math.max(...errors),receivedErrorP95M:percentile(receivedErrors,.95),sampleGapP50Ms:percentile(gaps[i],.5),sampleGapP95Ms:percentile(gaps[i],.95),attachments:attachments[i],attachmentErrorM:attachmentError[i]};
 });
 const stats=structuredClone(n.stats);await n.leave();views.forEach(v=>v.clear());return {profile:profile.name,seconds,seed:452067,timestepMs:DT*1000,peers,stats,events,resources:n.resources,trace:rows.map(r=>r.filter(x=>x.t>=0))};
 }finally{if(n)await n.leave();views.forEach(v=>v.clear());Math.random=originalRandom;}
}
