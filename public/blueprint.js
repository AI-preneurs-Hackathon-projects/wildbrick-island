import {blueprintMetrics} from './blueprint-metrics.js';
import {TRAIT_SCHEMA} from './combat.js';
// A data-only format shared by the server validator and the game renderer.
const bounded=(minimum,maximum,type='number')=>({type,minimum,maximum});
const vec=(minimum,maximum)=>({type:'array',items:bounded(minimum,maximum),minItems:3,maxItems:3});
const label=max=>({type:'string',pattern:`^[^<>\\u0000-\\u001f]{1,${max}}$`});
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const BLUEPRINT_SCHEMA=obj({
 version:{type:'integer',enum:[3]},traits:TRAIT_SCHEMA,name:label(64),description:label(180),
 movement:{type:'string',enum:['fly','drive','walk','carry','static']},
 ability:{type:'string',enum:['pulse','swing','none']},
 palette:{type:'array',items:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},minItems:1,maxItems:10},seat:vec(-12,12),
 joints:{type:'array',maxItems:16,items:obj({parent:{type:'integer',enum:[-1]},pivot:vec(-12,12),axis:{type:'string',enum:['x','y','z']},motion:{type:'string',enum:['flap','spin','stride','sway']},amplitude:bounded(-90,90),phase:bounded(-360,360)})},
 parts:{type:'array',minItems:32,maxItems:128,items:obj({shape:{type:'string',enum:['box','wedge','cylinder','cone','sphere']},position:vec(-16,16),size:vec(.025,16),rotation:vec(-360,360),color:bounded(0,9,'integer'),joint:bounded(-1,15,'integer'),studs:{type:'boolean'}})}
});
// Optional measured compact generation profile; old versions keep their limits.
export const COMPACT_BLUEPRINT_SCHEMA=structuredClone(BLUEPRINT_SCHEMA);
COMPACT_BLUEPRINT_SCHEMA.properties.version.enum=[4];
COMPACT_BLUEPRINT_SCHEMA.properties.parts.minItems=20;
COMPACT_BLUEPRINT_SCHEMA.properties.parts.maxItems=64;
// Only fresh model output may receive this unambiguous indexing repair. Saved
// designs and arena uploads still go directly through the strict validator.
export function normalizeGeneratedBlueprint(value){
 if(value?.version!==4||!Array.isArray(value.parts))return value;
 const b=structuredClone(value);
 for(const [field,list,minimum] of [['joint',b.joints,0],['color',b.palette,-1]]){
  if(!Array.isArray(list)||!list.length)continue;
  const references=b.parts.map(p=>p?.[field]).filter(n=>n>minimum);
  const usesZero=b.parts.some(p=>p?.[field]===0);
  if(!usesZero&&references.includes(list.length)&&references.every(n=>Number.isInteger(n)&&n>=1&&n<=list.length))
   for(const part of b.parts)if(part[field]>=1)part[field]--;
 }
 return b;
}
export function validateBlueprint(value){
 let stage='structure';const fail=(code=stage)=>{const error=new Error('The design could not be assembled. Try a simpler description.');error.code=code;throw error;};
 const exact=(x,keys)=>{if(!x||Array.isArray(x)||typeof x!=='object'||Object.keys(x).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(x,k)))fail();};
 const vector=(v,min,max)=>{if(!Array.isArray(v)||v.length!==3||v.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<min||n>max))fail();return [...v];};
 const text=(s,max)=>{if(typeof s!=='string'||!s.trim()||s.length>max||/[<>\u0000-\u001f]/.test(s))fail();return s.trim();};
 exact(value,Object.keys(BLUEPRINT_SCHEMA.properties).filter(k=>k!=='traits'||value.version>=3));if(![1,2,3,4].includes(value.version))fail();
 const b={version:value.version,name:text(value.name,64),description:text(value.description,180),movement:value.movement,ability:value.ability,palette:[],seat:vector(value.seat,-12,12),joints:[],parts:[]};
 if(!['fly','drive','walk','carry','static'].includes(b.movement)||!['pulse','swing','none'].includes(b.ability))fail();
 if(!Array.isArray(value.palette)||value.palette.length<1||value.palette.length>10)fail();
 b.palette=value.palette.map(c=>{if(typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c))fail();return c;});
 if(!Array.isArray(value.joints)||value.joints.length>16)fail();
 stage='joints';b.joints=value.joints.map((j,i)=>{exact(j,['parent','pivot','axis','motion','amplitude','phase']);if(!Number.isInteger(j.parent)||j.parent< -1||j.parent>=i||(b.version>=2&&j.parent!==-1)||!['x','y','z'].includes(j.axis)||!['flap','spin','stride','sway'].includes(j.motion)||!Number.isFinite(j.amplitude)||Math.abs(j.amplitude)>90||!Number.isFinite(j.phase)||Math.abs(j.phase)>360)fail();return {...j,pivot:vector(j.pivot,-12,12)};});
 if(!Array.isArray(value.parts)||value.parts.length<(b.version===4?20:b.version>=2?32:8)||value.parts.length>(b.version===4?64:128))fail();
 stage='parts';b.parts=value.parts.map(p=>{exact(p,['shape','position','size','rotation','color','joint','studs']);if(!Number.isInteger(p.color)||p.color<0||p.color>=b.palette.length)fail('palette_index');if(!Number.isInteger(p.joint)||p.joint< -1||p.joint>=b.joints.length)fail('joint_index');if(!['box','wedge','cylinder','cone','sphere'].includes(p.shape)||!Number.isInteger(p.color)||p.color<0||p.color>=b.palette.length||!Number.isInteger(p.joint)||p.joint< -1||p.joint>=b.joints.length||typeof p.studs!=='boolean')fail();return {...p,position:vector(p.position,-16,16),size:vector(p.size,.025,16),rotation:vector(p.rotation,-360,360)};});
 if(b.version>=3){stage='traits';const t=value.traits;exact(t,['weapon','armor','mass','emitter']);for(const key of ['weapon','armor','mass'])if(!TRAIT_SCHEMA.properties[key].enum.includes(t[key]))fail();b.traits={...t,emitter:vector(t.emitter,-16,16)};}
 blueprintMetrics(b);return b;
}
export function customMode(b){return b.movement==='fly'?'plane':b.movement==='drive'||b.movement==='walk'?'car':b.movement==='carry'?(b.ability==='pulse'?'bow':'sword'):'foot';}
export function creationPrompt(input){if(typeof input!=='string')throw new Error('Describe something to build.');const prompt=input.replace(/[\u0000-\u001f]/g,' ').trim();if(prompt.length<2||prompt.length>360)throw new Error('Use a description between 2 and 360 characters.');return prompt;}
