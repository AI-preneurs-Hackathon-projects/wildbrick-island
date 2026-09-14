import assert from 'node:assert/strict';
import {assessTradeoffs} from './check-arena-tradeoffs.mjs';

const peer={eligibleMs:24000,stopMs:1000,stopCount:2,longestStopMs:500,
 worstStoppedFraction:{1000:.5,4000:.25},separationIntegralMSeconds:5,
 separationExposure:[{thresholdM:.9,durationMs:1000,longestMs:500},{thresholdM:2.2,durationMs:500,longestMs:250}]};
const control={rows:[{network:'1600',profile:'hold',peers:[peer,structuredClone(peer)]}]};
assert.equal(assessTradeoffs(control,control,{requirePriorGain:false}).passed,true);
assert.equal(assessTradeoffs(control,control).passed,false,'unchanged stops cannot establish the required gain');
assert.equal(assessTradeoffs({rows:[]},{rows:[]}).passed,false,'empty comparisons cannot pass');
const combat={rows:[{...control.rows[0],profile:'crossing'}]};
assert.equal(assessTradeoffs(combat,combat).passed,false,'combat totals cannot substitute for movement acceptance');
for(const regress of [p=>p.stopCount++,p=>p.longestStopMs+=100,p=>p.worstStoppedFraction[1000]+=.1,p=>p.separationIntegralMSeconds++,p=>p.separationExposure[1].durationMs+=100,p=>p.eligibleMs-=1000]){
 const candidate=structuredClone(control);candidate.rows[0].peers.forEach(p=>p.stopMs=700);
 regress(candidate.rows[0].peers[1]);
 assert.equal(assessTradeoffs(control,candidate).passed,false,'total-stop gain must not hide a peer regression');
}
console.log('Tradeoff gate rejects empty, unmatched and regressed comparisons despite total-stop gains.');
