// Run after npm run build. Validate the actual bundled Worker and public boundary.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
let assets=0;
async function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await walk(file);else{
 const response=await worker.fetch(new Request('https://brickwild.test/'+file.slice(7)),{},{});assert.equal(response.status,200,file);assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(file),file);assets++;
 if(/\.(js|html|css)$/.test(file))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/sk-(?:proj-)?[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|siwc_bypass_bearer_token/);
 }}}
await walk('public');
for(const path of ['/__stability','/__performance-fixture.js','/scripts/lib/arena-http-fixture.mjs','/scripts/compare-arena-movement.mjs','/__creations','/validation/creation-shortcuts-harness.html','/__combat','/__combat-fixtures.js','/validation/live/arena-dragon.json','/__controls','/__layouts','/.sites-runtime/api-preview.json','/worker/index.js'])assert.equal((await worker.fetch(new Request('https://brickwild.test'+path),{},{})).status,404);
assert.equal((await worker.fetch(new Request('https://brickwild.test/api/arena/join',{method:'POST'}),{},{})).status,401);
const migrations=fs.readdirSync('dist/.openai/drizzle').filter(x=>x.endsWith('.sql')).length;assert.equal(migrations,3);
console.log(JSON.stringify({assets,migrations,byteIdentical:true,developmentFilesExcluded:true,unauthenticatedArenaStatus:401,publicSecretScan:'passed'},null,2));
