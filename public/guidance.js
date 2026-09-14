import {bindingLabel} from './action-bindings.js';
import {GATES,RINGS,TARGETS,CRATES} from './rules.js';
const routes={car:{items:GATES,done:'gates',name:'Mint gate',goal:'Drive through mint gates'},plane:{items:RINGS,done:'rings',name:'Sky ring',goal:'Fly through golden rings'},bow:{items:TARGETS,done:'targets',name:'Striped target',goal:'Face striped targets and shoot'},sword:{items:CRATES,done:'crates',name:'Purple crate',goal:'Get close to purple crates and swing'}};
export function navigationGoal(s){
 const b=s.custom?.blueprint;
 let type=s.mode==='plane'&&s.rings.length<5?'plane':s.mode==='car'&&s.gates.length<4?'car':b?.ability==='pulse'?'bow':b?.ability==='swing'?'sword':b?.movement==='carry'?'foot':s.mode;
 if(!routes[type]||s[routes[type].done].length===routes[type].items.length)type=['car','plane','bow','sword'].find(k=>s[routes[k].done].length<routes[k].items.length);
 const route=routes[type];if(!route)return null;
 const remaining=route.items.map((p,id)=>({...p,id})).filter(p=>!s[route.done].includes(p.id));
 if(!remaining.length)return null;
 const target=remaining.sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z))[0];
 return {...target,type,title:route.goal,name:`${route.name} ${target.id+1}`,total:route.items.length,done:s[route.done].length,distance:Math.round(Math.hypot(target.x-s.x,target.z-s.z)),bearing:Math.atan2(target.x-s.x,target.z-s.z)};
}
export function creationControls(s){
 const b=s.custom?.blueprint;
 const move=s.mode==='plane'?`WASD to move · hold ↑ to go up, ${bindingLabel('lower')} to go down · release to hover`:s.mode==='car'?b?.movement==='walk'?'Move to ride your creature':'Move to drive':b?.movement==='carry'?'Move to explore with your creation':'Move to explore · Shift to run';
 const ability=b?.ability==='pulse'?'Cast / →: aim at striped targets':b?.ability==='swing'?'Swing / →: smash nearby purple crates':!b&&s.mode==='bow'?'Shoot / →: aim at striped targets':!b&&s.mode==='sword'?'Swing / →: smash nearby purple crates':s.mode==='foot'?'Jump / ↑ or Space':s.mode==='car'?'Boost / →':'';
 return [move,ability,(s.mode!=='foot'||b)?`${bindingLabel('drop')} to drop / dismount`:''].filter(Boolean).join(' · ');
}
