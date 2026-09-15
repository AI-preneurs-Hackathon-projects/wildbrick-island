import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'vercel-public');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(path.join(root,'public'),out,{recursive:true});
const lobby=path.join(out,'arena-ui.js');
const source=fs.readFileSync(lobby,'utf8');
const sitesNote='Invited players need access to this Site. Ask its owner for an invitation if sign-in does not let you in.';
if(!source.includes(sitesNote)) throw new Error('Review the Vercel guest lobby copy against updated main.');
fs.writeFileSync(lobby,source.replace(sitesNote,'Anyone with the arena code can join here. Your guest identity stays in this browser.'));
console.log('Copied game assets with Vercel guest access and the shared typing fallback; API builds separately.');

if(process.env.VERCEL_ENV==='production') await import('./migrate-vercel.mjs');
