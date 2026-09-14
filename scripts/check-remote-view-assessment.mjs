import assert from 'node:assert/strict';
import {assessRemoteComparison} from './lib/remote-view-assessment.mjs';
const peer={movingMs:21000,stepP99M:1,velocityChangeP99Mps:10,slowMs:1000,receivedFitLagMs:50,authorityErrorP95M:1,attachmentErrorM:0,attachments:10};
const baseline={results:['100','variable100-300','600','asymmetric-jitter','1600'].map(profile=>({profile,seconds:24,seed:452067,timestepMs:1000/60,peers:[structuredClone(peer),structuredClone(peer)],stats:[{},{}],events:[{},{}]}))};
const candidate=structuredClone(baseline);for(const r of candidate.results)for(const p of r.peers)Object.assign(p,{stepP99M:.7,velocityChangeP99Mps:7,slowMs:700,receivedFitLagMs:100,authorityErrorP95M:1.3});
assert.equal(assessRemoteComparison(baseline,candidate).passed,true);
assert.equal(assessRemoteComparison(baseline,baseline).passed,false);
assert.equal(assessRemoteComparison({results:[]},{results:[]}).passed,false);
for(const mutate of [r=>r.peers[1].slowMs=950,r=>r.peers[1].stepP99M=.8,r=>r.peers[1].receivedFitLagMs=151,r=>r.peers[1].authorityErrorP95M=1.51,r=>r.stats[1].shots=1,r=>r.events[1].hit=1,r=>r.peers[1].movingMs=20000,r=>r.seconds=25]){const bad=structuredClone(candidate);mutate(bad.results[1]);assert.equal(assessRemoteComparison(baseline,bad).passed,false);}
console.log('Remote acceptance rejects unmatched work, insufficient benefit, excess lag/error and changed gameplay for either peer.');
