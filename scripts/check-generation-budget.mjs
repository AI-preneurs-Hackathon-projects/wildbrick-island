import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {reserveGeneration} from '../worker/generation-budget.js';
import {COMPACT_BLUEPRINT_SCHEMA,normalizeGeneratedBlueprint,validateBlueprint} from '../public/blueprint.js';
const db=new DatabaseSync(':memory:');for(const n of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+n,'utf8'));
const DB={prepare(sql){return {bind(...args){return {async run(){await Promise.resolve();return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}};
const slots=await Promise.all(Array.from({length:12},(_,i)=>reserveGeneration(DB,'requester-'+i)));assert.equal(slots.filter(Boolean).length,4);await Promise.all(slots.filter(Boolean).map(release=>release()));
for(let i=0;i<8;i++){const release=await reserveGeneration(DB,'one-person');assert.ok(release);await release();}assert.equal(await reserveGeneration(DB,'one-person'),null);
for(let i=0;i<18;i++){const release=await reserveGeneration(DB,'other-'+i);assert.ok(release);await release();}assert.equal(await reserveGeneration(DB,'last'),null);
console.log('PASS durable generation slots, per-requester rate and global minute budget are atomic');
const original=JSON.parse(fs.readFileSync('validation/live/dragon.json')).blueprint;validateBlueprint(original);const compact={...original,version:4,traits:{weapon:'flame',armor:'medium',mass:'medium',emitter:[0,1,1]},parts:original.parts.slice(0,20)};validateBlueprint(compact);assert.equal(COMPACT_BLUEPRINT_SCHEMA.properties.parts.minItems,20);assert.throws(()=>validateBlueprint({...compact,parts:compact.parts.slice(0,19)}));assert.throws(()=>validateBlueprint({...compact,version:3}));console.log('PASS compact version 4 bounds and legacy version limits remain distinct');db.close();

const shifted=structuredClone(compact);for(const p of shifted.parts)if(p.joint>=0)p.joint++;
// Force inclusion of the last joint, making a one-based interpretation certain.
shifted.parts[0].joint=shifted.joints.length;shifted.parts[1].joint=1;
const repaired=normalizeGeneratedBlueprint(shifted);assert.equal(repaired.parts[0].joint,shifted.joints.length-1);assert.equal(repaired.parts[1].joint,0);validateBlueprint(repaired);assert.throws(()=>validateBlueprint(shifted));
const mixed=structuredClone(shifted);mixed.parts[1].joint=0;assert.throws(()=>validateBlueprint(normalizeGeneratedBlueprint(mixed)));
assert.deepEqual(normalizeGeneratedBlueprint(compact),compact);console.log('PASS fresh uniform one-based references repair without weakening saved or mixed-index validation');
