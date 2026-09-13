import {validateBlueprint} from './blueprint.js';
import {BUILDS,completion} from './rules.js';
const KEY='brickwild.adventure.v1',MAX_BYTES=650000;
const tracks={gates:[4,15],rings:[5,20],targets:[3,10],crates:[3,12]};
const ids=(value,count)=>Array.isArray(value)?[...new Set(value.filter(n=>Number.isInteger(n)&&n>=0&&n<count))]:[];
export function createAdventure(storage){
 let saved={version:1,progress:{},creations:[]},available=!!storage;
 try{const text=storage?.getItem(KEY);if(text&&text.length<=MAX_BYTES){const data=JSON.parse(text);if(data?.version===1)saved=data;}}catch{available=false;}
 const creations=[];
 if(Array.isArray(saved.creations))for(const raw of saved.creations.slice(0,12)){try{const b=validateBlueprint(raw);if(!creations.some(c=>JSON.stringify(c)===JSON.stringify(b)))creations.push(b);}catch{}}
 let progress=saved.progress&&typeof saved.progress==='object'?saved.progress:{};
 function restore(state){
  state.bricks=0;
  for(const [key,[count,reward]]of Object.entries(tracks)){state[key]=ids(progress[key],count);state.bricks+=state[key].length*reward;}
  state.built=Array.isArray(progress.built)?[...new Set(progress.built.filter(k=>Object.hasOwn(BUILDS,k)&&k!=='foot'))]:[];
  state.won=completion(state);
 }
 function save(state){
  progress={built:[...state.built]};for(const [key,[count]]of Object.entries(tracks))progress[key]=ids(state[key],count);
  try{if(!storage)throw new Error('No device storage');storage.setItem(KEY,JSON.stringify({version:1,progress,creations}));available=true;return true;}catch{available=false;return false;}
 }
 function remember(raw){const b=validateBlueprint(raw),key=JSON.stringify(b),i=creations.findIndex(c=>JSON.stringify(c)===key);if(i>=0)creations.splice(i,1);creations.unshift(b);creations.splice(12);}
 return {creations,restore,save,remember,get available(){return available;}};
}
