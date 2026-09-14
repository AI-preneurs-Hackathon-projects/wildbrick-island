import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performanceFixture} from './lib/performance-fixture.mjs';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const source=option('--client-source',null),diagnosticModule=option('--diagnostics',null),duration=Number(option('--duration-ms',12000));
if(!Number.isFinite(duration)||duration<1000||duration>3600000)throw RangeError('Duration must be 1000–3600000 ms');
let clientFactory;
if(source){const code=fs.readFileSync(source,'utf8').replace(/from '\.\/([^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL('../public/'+file,import.meta.url).href));clientFactory=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).createArenaClient;}
const createDiagnostics=diagnosticModule?(await import(new URL(diagnosticModule,import.meta.url))).createArenaDiagnostics:null;
const results=[];
for(const latency of [0,100,600,1600]){
 // Identical supply/spawn randomness for sequential baseline/candidate runs.
 const originalRandom=Math.random;let seed=452067;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 try{
  const packetHash=createHash('sha256'),outcomeHash=createHash('sha256'),diagnostics=createDiagnostics?[createDiagnostics(),createDiagnostics()]:[];
  const n=performanceFixture({latency,clientFactory,diagnostics,onPacket:p=>packetHash.update(JSON.stringify(p)),onOutcome:p=>outcomeHash.update(JSON.stringify(p))});await n.start();
  for(let i=0;i<Math.round(duration/ (1000/60));i++){const z=Math.floor(i/60)%2?-.6:.6;await n.step([{z},{z}]);}
  await n.leave();results.push({latencyMs:latency,durationMs:duration,stats:n.stats,resources:n.resources,packetDigest:packetHash.digest('hex'),outcomeDigest:outcomeHash.digest('hex'),diagnostics:diagnostics.map(d=>d.export())});
 }finally{Math.random=originalRandom;}
}
const output={environment:'virtual clock, in-process fetch, real clients and authoritative core; no HTTP/store/rendering',results};
const file=option('--output',null);if(file)fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
