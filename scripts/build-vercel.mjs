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
// Recorded voice is enabled independently on Vercel. Keep the Sites source and
// its text-only fallback intact, and fail the build if upstream UI wiring drifts.
const uiPath=path.join(out,'ui.js');
let ui=fs.readFileSync(uiPath,'utf8');
const transforms=[
  ['<div id="voice-options" class="voice-options hidden"><button id="type-voice"', '<div id="voice-options" class="voice-options hidden"><button id="record-voice" type="button" hidden>Record instead</button><button id="type-voice"'],
  ["on('#type-voice',()=>openMenu('imagine'));", "on('#type-voice',()=>openMenu('imagine'));on('#record-voice',()=>{if(!$('#record-voice').hidden)actions.recordVoice();});"],
  ["function voiceFallback(_message,{draft=''}={}){if(draft)lastPrompt=draft;$('#voice-options').classList.remove('hidden');}", "function voiceFallback(_message,{draft='',canRecord=false}={}){if(draft)lastPrompt=draft;$('#record-voice').hidden=!canRecord;$('#voice-options').classList.remove('hidden');}"]
];
for(const [before,after]of transforms){
  if(ui.split(before).length!==2)throw new Error('Review the Vercel recorded-voice UI against updated main.');
  ui=ui.replace(before,after);
}
fs.writeFileSync(uiPath,ui);
console.log('Copied game assets with Vercel guest access and recorded-voice fallback; API builds separately.');

if(process.env.VERCEL_ENV==='production') await import('./migrate-vercel.mjs');
