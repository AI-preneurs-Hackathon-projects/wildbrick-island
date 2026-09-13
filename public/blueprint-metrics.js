// Dependency-free rest bounds for server hitboxes and emitter placement.
export function blueprintMetrics(b){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const rotate=(v,deg)=>{let [x,y,z]=v;for(const i of [2,1,0]){const a=deg[i]*Math.PI/180,c=Math.cos(a),s=Math.sin(a);if(i===2)[x,y]=[x*c-y*s,x*s+y*c];if(i===1)[x,z]=[x*c+z*s,-x*s+z*c];if(i===0)[y,z]=[y*c-z*s,y*s+z*c];}return [x,y,z];};
 for(const p of b.parts){let r=p.rotation;const j=b.joints[p.joint];if(p.shape==='cylinder'&&j?.motion==='spin')r=j.axis==='x'?[0,0,-90]:j.axis==='z'?[90,0,0]:[0,0,0];
  const pos=[...p.position];if(b.version===1){let index=p.joint;while(index>=0){b.joints[index].pivot.forEach((v,i)=>pos[i]+=v);index=b.joints[index].parent;}}
  for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])rotate([x*p.size[0],y*p.size[1],z*p.size[2]],r).forEach((v,i)=>{v+=pos[i];min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});
 }
 const extent=Math.max(...max.map((v,i)=>v-min[i]));if(!Number.isFinite(extent)||extent<.1)throw Error('The model has no usable shape. Try another description.');const limit=b.movement==='carry'?2.3:b.movement==='static'?10:8,scale=Math.min(limit/extent,extent<1?2/extent:1),offset=[-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2];
 return {size:max.map((v,i)=>(v-min[i])*scale),normalize:v=>v.map((x,i)=>(x+offset[i])*scale),scale};
}
