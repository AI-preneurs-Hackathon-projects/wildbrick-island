// Controlled contact benchmark, not a human playtest or ranged accuracy estimate.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {WEAPONS} from '../public/combat.js';
import {newRoom,addPlayer,makeKit,applyInput,advanceRoom} from '../public/arena-core.js';
import {WORLD_ENTITIES} from '../public/world-data.js';
export const baseline=JSON.parse(fs.readFileSync(new URL('../validation/critical-gameplay/combat-baseline.json',import.meta.url))).weapons;
const saved=JSON.parse(fs.readFileSync(new URL('../validation/live/final-compact-none/armed-car.json',import.meta.url))).blueprint;
export const familyBlueprint=(weapon,armor='medium',movement='carry',mass='medium')=>({...saved,movement,ability:WEAPONS[weapon].speed?'pulse':weapon==='none'?'none':'swing',traits:{...saved.traits,weapon,armor,mass}});
export const PROFILES=['default','heavy','defense-10s','shield-90','mount-155','heavy-mount-217'];
export function measure(weapon,values=WEAPONS[weapon],profile='default'){
 const r=newRoom(100000),p=addPlayer(r,'p','Attacker'),q=addPlayer(r,'q','Target');for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;r.nextDrop=1e12;
 Object.assign(p,{x:0,y:0,z:0,yaw:0,motion:{},protectedUntil:0,kit:makeKit('family:'+weapon,familyBlueprint(weapon))});
 for(const k of ['damage','interval','range','windup'])if(values[k]!==undefined)p.kit.stats[k]=values[k];p.kit.stats.projectileSpeed=values.speed;p.kit.stats.spread=0;
 const kit=profile==='heavy'?makeKit('heavy',familyBlueprint('none','heavy')):profile==='shield-90'?makeKit('shield',familyBlueprint('none','shield')):profile==='mount-155'?makeKit('car'):profile==='heavy-mount-217'?makeKit('heavy-mount',familyBlueprint('none','heavy','drive','heavy')):makeKit();
 Object.assign(q,{x:0,y:0,z:0,yaw:0,motion:{},protectedUntil:0,kit,mountHealth:kit.stats.mountMax,defenseUntil:profile==='defense-10s'?r.time+10000:0});
 let id=0,cursor=r.eventId,hits=0,first=null,ko=null,shots=0,heatCycles=0,previousOverheat=0,heatWait=0;const initial=r.time,health=100,mount=q.mountHealth,armor=kit.stats.armor;
 if(values.damage>0)for(let elapsed=0;elapsed<=60000;elapsed+=10){p.lastSeen=q.lastSeen=initial+elapsed;advanceRoom(r,initial+elapsed);if(q.health>0&&r.time>=p.nextShot){if(r.time<p.overheatedUntil)heatWait+=10;else applyInput(r,p.id,{seq:++id,command:{id,type:'fire'}},r.time);}if(p.overheatedUntil>previousOverheat){heatCycles++;previousOverheat=p.overheatedUntil;}for(const e of r.events)if(e.id>cursor){if(e.type==='hit'&&e.by===p.id){hits++;first??=e.time-initial;}if(['shot','swing'].includes(e.type)&&e.player===p.id)shots++;if(e.type==='ko'&&e.player===q.id)ko=e.time-initial;cursor=e.id;}if(ko!==null)break;}
 return {profile,initialHealth:health,initialMount:mount,initialArmor:armor,hitsToKO:ko===null?null:hits,elapsedToKOMs:ko,firstImpactMs:first,acceptedAttacks:shots,overheatCycles:heatCycles,heatWaitMs:heatWait};
}
export function balanceMatrix(){return {baseline:'d87477233aa9d3d614c96b56d461a2a673eea16d',assumptions:'Stationary body-overlap contact, zero spread, no spawn protection, commands at earliest legal cadence on 10 ms ticks; time starts at first fire and includes windup. Armor/absorption and automatic heat are actual Arena rules. Defense starts with its actual 10 s duration. Mount destruction returns target to default armor. No travel/aim/movement or human reaction cost.',families:Object.entries(WEAPONS).map(([family,w])=>({family,interval:w.interval,range:w.range,projectileSpeed:w.speed,spread:w.spread,windup:w.speed?0:w.windup??.18,before:{damage:baseline[family].damage,rawDPS:baseline[family].damage/baseline[family].interval,profiles:PROFILES.map(p=>measure(family,baseline[family],p))},candidate:{damage:w.damage,rawDPS:w.damage/w.interval,profiles:PROFILES.map(p=>measure(family,w,p))}}))};}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(balanceMatrix(),null,2));
