import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {test} from 'node:test';
// Optional pinned source root makes the same behavioral cases reproducible before/after.
const root=process.env.BRICKWILD_SOURCE_ROOT||new URL('..',import.meta.url).pathname;
const core=await import(pathToFileURL(path.join(root,'public/arena-core.js')));
const {newRoom,addPlayer,makeKit,applyInput,advanceRoom,roomSnapshot}=core;
const {WORLD_ENTITIES}=await import(pathToFileURL(path.join(root,'public/world-data.js')));
const {weaponMuzzle}=await import(pathToFileURL(path.join(root,'public/weapon-aim.js')));
const {createShotPlayback}=await import(pathToFileURL(path.join(root,'public/shot-playback.js')));
const blueprint=JSON.parse(fs.readFileSync(path.join(root,'validation/live/final-compact-none/armed-car.json'))).blueprint;
const kit=weapon=>['foot','bow','sword','car','plane'].includes(weapon)?makeKit(weapon):makeKit('generated:'+weapon,{...blueprint,movement:'carry',traits:{...blueprint.traits,weapon}});
function setup(weapon='foot',z=.9,yaw=0,target='foot'){
 const r=newRoom(100000),p=addPlayer(r,'p','Shooter'),q=addPlayer(r,'q','Target');
 for(const e of WORLD_ENTITIES)r.destroyed[e.id]=1e12;r.nextDrop=1e12;
 for(const a of [p,q])Object.assign(a,{x:0,y:0,z:0,yaw,protectedUntil:0});
 p.kit=kit(weapon);q.kit=kit(target);q.mountHealth=q.kit.stats.mountMax;
 Object.assign(q,{x:Math.sin(yaw)*z,z:Math.cos(yaw)*z});return {r,p,q};
}
function fire({r,p},id=p.lastCommand+1){applyInput(r,p.id,{seq:p.lastSeq+1,input:{cameraYaw:p.yaw+Math.PI},command:{id,type:'fire'}},r.time);}
function run({r},ms=300){for(let left=ms;left>1e-7;){const step=Math.min(1000/30,left);for(const p of Object.values(r.players))p.lastSeen=r.time;advanceRoom(r,r.time+step);left-=step;}}
const hits=r=>r.events.filter(e=>e.type==='hit');
const damaged=q=>q.health<100||q.mountHealth<q.kit.stats.mountMax;
const wall=(r,z,d=.05)=>r.placed.push({id:'wall:'+r.placed.length,x:0,z,w:4,h:6,d,hp:1000});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

for(const weapon of ['bow','automatic','flame','pulse','foot','sword','knife','hammer']){
 test(`${weapon}: body-centered exact overlap and point-blank contact in eight facings`,()=>{
  for(const yaw of Array.from({length:8},(_,i)=>i*Math.PI/4))for(const z of [0,.1,.9,1]){
   const s=setup(weapon,z,yaw);fire(s);run(s);assert.ok(damaged(s.q),`${weapon} yaw=${yaw} z=${z}`);
   assert.equal(hits(s.r).length,1);near(s.p.health,100);near(s.p.yaw,yaw);
  }
 });
 test(`${weapon}: target behind receives no ordinary forward hit`,()=>{
  for(const z of [-.1,-1,-4]){const s=setup(weapon,z);fire(s);run(s,500);assert.equal(s.q.health,100,`behind ${z}`);}
 });
}
for(const weapon of ['bow','automatic','flame'])test(`${weapon}: normal body-centered forward shots in eight facings`,()=>{
 for(let i=0;i<8;i++){const s=setup(weapon,5,i*Math.PI/4);fire(s);run(s,500);assert.ok(damaged(s.q),`yaw ${i}`);assert.equal(hits(s.r).length,1);}
});
// Supersedes the former parallel-offset miss under the authorized aiming prototype.
test('generated pulse contacts a feasible body-axis target without requiring camera aim',()=>{
 const s=setup('pulse',5),from=weaponMuzzle(s.p);s.q.x=from.x;fire(s);run(s);assert.equal(hits(s.r).length,1);
 const centered=setup('pulse',5);fire(centered);run(centered);assert.ok(centered.q.health<100,'bounded convergence reaches the body axis');
});
for(const weapon of ['foot','sword','knife','hammer'])test(`${weapon}: surface reach has a strict boundary, including large mounted bodies`,()=>{
 for(const target of ['foot','car','plane'])for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI])for(const delta of [-.01,.01]){
  const s=setup(weapon,0,yaw,target),[w,,d]=s.q.kit.stats.collision;
  const angle=s.q.kit.stats.mounted?yaw:0,hx=(w*Math.abs(Math.cos(angle))+d*Math.abs(Math.sin(angle)))/2,hz=(d*Math.abs(Math.cos(angle))+w*Math.abs(Math.sin(angle)))/2;
  // Body axis direction; choose center distance by bisection for an exact surface gap.
  let lo=0,hi=20;const gap=t=>Math.hypot(Math.max(0,Math.abs(Math.sin(yaw)*t)-hx),Math.max(0,Math.abs(Math.cos(yaw)*t)-hz));
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(gap(mid)<s.p.kit.stats.range+delta)lo=mid;else hi=mid;}
  s.q.x=Math.sin(yaw)*hi;s.q.z=Math.cos(yaw)*hi;fire(s);run(s);assert.equal(damaged(s.q),delta<0,`${target} yaw=${yaw} delta=${delta}`);
 }
});
test('melee cone, exact overlap exception and vertical limits stay bounded',()=>{
 for(const z of [0,1])for(const dy of [1.8,1.81,5,-1.8,-1.81]){
  const s=setup('foot',z);s.p.y=6;s.q.y=6+dy;s.p.motion={};s.q.motion={};fire(s);run(s);assert.equal(damaged(s.q),Math.abs(dy)<=1.8);
 }
 for(const dot of [.46,.44,0,-1]){const s=setup('foot',0);s.q.z=dot;s.q.x=Math.sqrt(1-dot*dot);fire(s);run(s);assert.equal(damaged(s.q),dot>=.45);}
});
test('melee samples current positions at windup completion while retaining accepted body yaw',()=>{
 const away=setup('foot',1);fire(away);run(away,100);assert.equal(away.q.health,100);away.q.z=5;run(away,100);assert.equal(away.q.health,100);
 const into=setup('foot',5);fire(into);run(into,100);into.q.z=1;into.p.yaw=Math.PI;run(into,100);assert.equal(hits(into.r).length,1);near(into.p.yaw,Math.PI);
 const moving=setup('foot',4);fire(moving);moving.p.z=2;run(moving);assert.equal(hits(moving.r).length,1);
});
for(const weapon of ['bow','automatic','flame','pulse'])test(`${weapon}: nearest launch-path player/cover wins and one shot cannot damage twice`,()=>{
 for(const z of [.15,.65,2.5]){const s=setup(weapon,z+.95);wall(s.r,z);fire(s);run(s,500);assert.equal(s.q.health,100);assert.equal(s.r.events.filter(e=>e.type==='impact').length,1);}
 const s=setup(weapon,.9);wall(s.r,1.3);const far=addPlayer(s.r,'far','Far');Object.assign(far,{x:0,y:0,z:4,protectedUntil:0});fire(s);run(s,500);
 assert.equal(hits(s.r).length,1);assert.equal(hits(s.r)[0].player,s.q.id);assert.equal(far.health,100);assert.equal(Object.keys(s.r.damage).length,0);assert.equal(s.r.projectiles.length,0);
});
test('a cover tie at the launch origin blocks overlapping players',()=>{const s=setup('bow',0);wall(s.r,0);fire(s);run(s);assert.equal(s.q.health,100);assert.equal(s.r.events.filter(e=>e.type==='impact').length,1);});
test('melee respects cover to the nearest target surface, including overlap and large targets',()=>{
 for(const [target,z,cover] of [['foot',0,0],['foot',1,.3],['car',4,1]]){const s=setup('foot',z,0,target);wall(s.r,cover);fire(s);run(s);assert.equal(damaged(s.q),false);}
 const s=setup('foot',4,0,'car');wall(s.r,3);fire(s);run(s);assert.equal(damaged(s.q),true,'body is before cover; center LOS must not reject it');
});
for(const weapon of ['bow','automatic','flame','pulse'])test(`${weapon}: range endpoint may contact; expiry alone never causes a hit`,()=>{
 for(const delta of [-.01,.01]){const s=setup(weapon,100);s.p.kit.stats.spread=0;fire(s);const b=s.r.projectiles[0],seconds=s.p.kit.stats.range/s.p.kit.stats.projectileSpeed,pad=weapon==='flame'?.45:.12;s.q.x=b.x+b.vx*seconds;s.q.z=b.z+b.vz*seconds+.45+pad+delta;run(s,2000);assert.equal(damaged(s.q),delta<0);assert.equal(s.r.events.filter(e=>e.type==='impact').length,0);assert.equal(s.r.events.filter(e=>e.type==='shot-end').length,delta<0?0:1);}
});
test('ranged altitude separation and airborne contact use the actual body volume',()=>{
 for(const weapon of ['bow','automatic','flame'])for(const dy of [0,8]){const s=setup(weapon,.9);s.p.y=10;s.q.y=10+dy;s.p.motion={};s.q.motion={};fire(s);run(s);assert.equal(damaged(s.q),dy===0);}
});
test('ranged contact covers foot and mounted targets and generated mounted shooters',()=>{
 for(const weapon of ['bow','automatic','flame'])for(const target of ['foot','car','plane'])for(const z of [0,.9,5,100]){
  const s=setup(weapon,z,0,target);fire(s);run(s,2000);assert.equal(damaged(s.q),z<100,`${weapon} against ${target} at ${z}`);
 }
 for(const movement of ['drive','fly'])for(const weapon of ['automatic','flame','pulse'])for(const z of [0,.9,5]){
  const s=setup('bow',z);s.p.kit=makeKit('mounted',{...blueprint,movement,traits:{...blueprint.traits,weapon}});s.p.mountHealth=s.p.kit.stats.mountMax;
  fire(s);run(s,500);assert.equal(hits(s.r).length,1,`${movement} ${weapon} at ${z}`);assert.equal(s.p.mountHealth,s.p.kit.stats.mountMax);
 }
});
test('heavy armor and defense apply once to immediate contact without changing base damage',()=>{
 const s=setup('bow');s.q.kit=makeKit('heavy',{...blueprint,movement:'carry',traits:{...blueprint.traits,armor:'heavy'}});s.q.defenseUntil=s.r.time+10000;
 fire(s);run(s);near(s.q.health,100-24*.76*.45);assert.equal(hits(s.r).length,1);
});
test('jump and fall during windup can enter and leave contact without a historical sweep',()=>{
 const jumping=setup('foot',1);jumping.q.y=1.79;jumping.q.vy=8;jumping.q.grounded=false;fire(jumping);run(jumping,150);assert.ok(jumping.q.y>1.8);assert.equal(jumping.q.health,100);
 const falling=setup('foot',1);falling.q.y=1.9;falling.q.vy=-5;falling.q.grounded=false;fire(falling);run(falling,150);assert.ok(falling.q.y<1.8);assert.equal(hits(falling.r).length,1);
});
test('spawn protection distinguishes rejected attacks and blocked contacts from misses',()=>{
 const shooter=setup('bow');shooter.p.protectedUntil=shooter.r.time+3000;fire(shooter);run(shooter);assert.equal(shooter.r.events.filter(e=>e.type==='shot').length,0);assert.equal(shooter.q.health,100);
 const target=setup('bow');target.q.protectedUntil=target.r.time+3000;fire(target);run(target);assert.equal(hits(target.r).length,0);assert.equal(target.r.events.filter(e=>e.type==='blocked').length,1);assert.equal(target.r.projectiles.length,0);
});
test('damage values, armor, defense, mount destruction, KO and respawn remain authoritative',()=>{
 const bow=setup('bow');fire(bow);run(bow);near(bow.q.health,78.4);
 const punch=setup();fire(punch);run(punch);near(punch.q.health,75.7);
 const defense=setup('bow');defense.q.defenseUntil=defense.r.time+10000;fire(defense);run(defense);near(defense.q.health,90.28);
 const mounted=setup('bow',.9,0,'car');mounted.q.mountHealth=5;mounted.q.health=10;fire(mounted);run(mounted);assert.equal(mounted.q.health,0);assert.equal(mounted.q.kit.id,'foot');assert.equal(mounted.p.kills,1);assert.equal(mounted.q.deaths,1);
 fire(mounted,1);run(mounted,12000);assert.equal(mounted.p.kills,1);assert.equal(mounted.q.health,100);assert.ok(mounted.q.protectedUntil>mounted.r.time);
});
test('cooldown, command retries and heat cannot produce extra launch contacts',()=>{
 for(const weapon of ['bow','automatic','flame','foot']){const s=setup(weapon);fire(s);fire(s,1);fire(s,2);run(s);assert.equal(hits(s.r).length,1);fire(s,2);run(s);assert.equal(hits(s.r).length,1);}
 const hot=setup('automatic');hot.p.overheatedUntil=hot.r.time+2000;fire(hot);run(hot);assert.equal(hits(hot.r).length,0);assert.equal(hot.r.events.filter(e=>e.type==='shot').length,0);
});
test('immediate authoritative shot precedes exactly one contact and replays toward the contact',()=>{
 const s=setup('bow');fire(s);const shot=s.r.events.find(e=>e.type==='shot'),hit=hits(s.r)[0];assert.ok(hit,'contact resolves at launch');assert.ok(shot.id<hit.id);assert.equal(shot.projectile.id,hit.attack);assert.ok(shot.z<=hit.z,'never replay backwards from an overshooting muzzle');
 const replay=createShotPlayback();replay.add(shot.projectile);assert.equal(replay.contact(hit),true);assert.deepEqual(replay.update(.02),[]);assert.equal(replay.update(.1).length,1);replay.add(shot.projectile);replay.contact(hit);assert.deepEqual(replay.update(.2),[]);assert.equal(replay.shots.size,0);
 const restored=JSON.parse(JSON.stringify(s.r));applyInput(restored,s.p.id,{seq:2,command:{id:1,type:'fire'}},restored.time);assert.equal(hits(restored).length,1);assert.equal(roomSnapshot(restored,s.p.id,hit.id).events.length,0);
});
