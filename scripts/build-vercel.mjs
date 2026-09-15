import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'vercel-public');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(path.join(root,'public'),out,{recursive:true});
console.log('Copied public game assets; Vercel builds the API separately.');

if(process.env.VERCEL_ENV==='production') await import('./migrate-vercel.mjs');
