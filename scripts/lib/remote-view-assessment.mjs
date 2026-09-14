// Prospective criteria for the bounded, non-extrapolating interpolation experiment.
export function assessRemoteComparison(baseline,candidate){
 const failures=[],required=['100','variable100-300','600','asymmetric-jitter','1600'];
 for(const profile of required){
  const b=baseline.results.find(r=>r.profile===profile),c=candidate.results.find(r=>r.profile===profile);
  if(!b||!c){failures.push(profile+': missing matched profile');continue;}
  if(b.seconds!==c.seconds||b.seed!==c.seed||b.timestepMs!==c.timestepMs){failures.push(profile+': unmatched scenario');continue;}
  for(let i=0;i<2;i++){
   const p=b.peers[i],q=c.peers[i],label=profile+'/peer'+(i+1);if(!p||!q){failures.push(label+': missing peer');continue;}
   if(p.movingMs!==q.movingMs)failures.push(label+': unmatched moving duration');
   if(JSON.stringify(b.stats[i])!==JSON.stringify(c.stats[i])||JSON.stringify(b.events[i])!==JSON.stringify(c.events[i]))failures.push(label+': local/network/gameplay outcomes changed');
   if(q.attachmentErrorM>1e-7||q.attachments===0)failures.push(label+': attachment check failed');
   if(['100','variable100-300'].includes(profile)){
    for(const k of ['stepP99M','velocityChangeP99Mps'])if(q[k]>p[k]*.75)failures.push(label+': '+k+' reduction below25%');
    if(q.slowMs>p.slowMs*.9)failures.push(label+': slow duration reduction below10%');
   }
   if(['600','asymmetric-jitter'].includes(profile)&&q.slowMs>p.slowMs+p.movingMs*.05)failures.push(label+': slow duration increased over5% of moving time');
   if(profile!=='1600'){
    if(q.receivedFitLagMs-p.receivedFitLagMs>100+1e-6)failures.push(label+': added fitted receipt lag over100ms');
    if(q.authorityErrorP95M-p.authorityErrorP95M>.5)failures.push(label+': added authority position error over0.5m');
   }
  }
 }
 return {passed:failures.length===0,failures};
}
