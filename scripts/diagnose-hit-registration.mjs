// Isolated fixture output only. Never connects to a Site or records player data.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.BRICKWILD_SOURCE_ROOT||new URL('..',import.meta.url).pathname;
const core=await import(pathToFileURL(path.join(root,'public/arena-core.js')));
const {WORLD_ENTITIES}=await import(pathToFileURL(path.join(root,'public/world-data.js')));
const results=[];
for(const [name,weapon,target,z,block] of [
 ['bow point blank','bow','foot',.9],['bow one metre','bow','foot',1],
 ['punch exact overlap','foot','foot',0],['punch nearby','foot','foot',.1],
 ['punch car surface','foot','car',4],['ordinary miss','foot','foot',8],
 ['shooter protection','bow','foot',.9,'protection'],['cooldown','bow','foot',.9,'cooldown'],
 ['heat','bow','foot',.9,'heat'],['target protection','bow','foot',.9,'target']]){
 const r=core.newRoom(100000),p=core.addPlayer(r,'p','Shooter'),q=core.addPlayer(r,'q','Target');
 for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;r.nextDrop=1e12;
 Object.assign(p,{x:0,y:0,z:0,yaw:0,protectedUntil:0,kit:core.makeKit(weapon)});
 Object.assign(q,{x:0,y:0,z,yaw:0,protectedUntil:0,kit:core.makeKit(target)});q.mountHealth=q.kit.stats.mountMax;
 if(block==='protection')p.protectedUntil=r.time+3000;if(block==='cooldown')p.nextShot=r.time+1000;if(block==='heat')p.overheatedUntil=r.time+1000;if(block==='target')q.protectedUntil=r.time+3000;
 const rejection=core.attackBlockReason?.(r,p)??null,before=q.health+q.mountHealth;
 core.applyInput(r,p.id,{seq:1,command:{id:1,type:'fire'}},r.time);core.advanceRoom(r,r.time+300);
 const accepted=r.events.some(e=>['swing','shot'].includes(e.type)),contact=r.events.find(e=>['hit','blocked','impact'].includes(e.type));
 results.push({case:name,accepted,rejection,outcome:contact?.type||(accepted?'miss':'rejected'),damage:Number((before-q.health-q.mountHealth).toFixed(3)),contacts:r.events.filter(e=>['hit','blocked','impact'].includes(e.type)).length});
}
console.log(JSON.stringify(results,null,2));
