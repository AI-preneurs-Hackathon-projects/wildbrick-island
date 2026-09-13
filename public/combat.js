// Semantic choices select bounded, trusted game rules. The model never sets damage.
export const WEAPONS=Object.freeze({
 none:{label:'Unarmed',damage:0,interval:.5,range:0,speed:0,spread:0},
 pulse:{label:'Pulse',damage:16,interval:.42,range:42,speed:48,spread:.015},
 flame:{label:'Fire breath',damage:7,interval:.16,range:15,speed:23,spread:.16},
 automatic:{label:'Automatic',damage:14,interval:.18,range:38,speed:68,spread:.045},
 bow:{label:'Archery',damage:24,interval:.85,range:56,speed:36,spread:0},
 blade:{label:'Sword',damage:36,interval:.62,range:3.5,speed:0,spread:0},
 knife:{label:'Knife',damage:17,interval:.32,range:2.3,speed:0,spread:0},
 hammer:{label:'Heavy smash',damage:55,interval:1.15,range:3.4,speed:0,spread:0}
});
export const TRAIT_SCHEMA={type:'object',additionalProperties:false,required:['weapon','armor','mass','emitter'],properties:{weapon:{type:'string',enum:Object.keys(WEAPONS)},armor:{type:'string',enum:['light','medium','heavy','shield']},mass:{type:'string',enum:['light','medium','heavy']},emitter:{type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:-16,maximum:16}}}};
export function legacyTraits(b){const text=(b.name+' '+b.description).toLowerCase();return {weapon:b.ability==='none'?'none':b.ability==='swing'?(/knife|dagger/.test(text)?'knife':/hammer|mace/.test(text)?'hammer':'blade'):/fire|flame|dragon/.test(text)?'flame':/machine|automatic|minigun/.test(text)?'automatic':/bow|archery/.test(text)?'bow':'pulse',armor:/shield/.test(text)?'shield':'medium',mass:/heavy|tank/.test(text)?'heavy':'medium',emitter:[0,1,1]};}
export function creationStats(input='foot',dimensions){
 const b=typeof input==='object'?input:null,mode=b?(b.movement==='fly'?'plane':['drive','walk'].includes(b.movement)?'car':b.movement==='carry'?'equipment':'foot'):input;
 const movement=b?.movement||(mode==='plane'?'fly':mode==='car'?'drive':['bow','sword'].includes(mode)?'carry':'walk');
 const mounted=mode==='car'||mode==='plane',t=b?.traits|| (b?legacyTraits(b):{weapon:mode==='bow'?'bow':mode==='sword'?'blade':mode==='foot'?'pulse':'none',armor:'medium',mass:'medium',emitter:[0,1.4,1]});
 const weapon=t.armor==='shield'&&t.weapon==='none'?'pulse':WEAPONS[t.weapon]?t.weapon:'none',heavy=t.mass==='heavy',light=t.mass==='light',shield=t.armor==='shield';
 let speed=mounted?(movement==='fly'?29:movement==='walk'?11:22):7;
 speed*=heavy?.76:light?1.07:1;if(weapon==='automatic'&&!mounted)speed*=.76;if(shield)speed*=.8;
 const bodyArmor=t.armor==='heavy'?.24:shield?.45:t.armor==='medium'?.1:0;
 let mountMax=mounted?Math.round((movement==='fly'?120:movement==='walk'?175:155)*(heavy?1.4:light?.75:1)):shield?90:0;
 const size=dimensions|| (mounted?(mode==='plane'?[7.06,2.75,5.02]:[3.16,2.04,4.72]):[.9,2.5,.9]);
 const collision=mounted?size.map((v,i)=>Math.max(i===1?1:.65,Math.min(8,v))):[.9,2.5,.9];
 return {name:b?.name||({foot:'Builder',car:'Trail car',plane:'Sky plane',bow:'Brick bow',sword:'Star sword'}[mode]||'Creation'),movement,mounted,weapon,...WEAPONS[weapon],projectileSpeed:WEAPONS[weapon].speed,speed:Math.min(32,Math.max(4,speed)),mass:mounted?(heavy?620:light?150:330):(heavy?115:75),armor:bodyArmor,mountMax:Math.min(250,mountMax),collision,emitter:t.emitter||[0,1.4,1],offense:Math.round(WEAPONS[weapon].damage/WEAPONS[weapon].interval),defense:Math.round(bodyArmor*100),heavy};
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
