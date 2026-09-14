import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
// Execute the actual development harness wiring, using real UI/input/controller
// and synthetic recorder. This is deliberately not pixel or microphone evidence.
const html=fs.readFileSync('validation/voice-harness.html','utf8'),script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const dom=new JSDOM(html,{url:'https://brickwild.test/__voice'}),old=new Map(['window','document','location','localStorage','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
const tasks=new Map();let id=0;Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,setTimeout(fn,ms){tasks.set(++id,{fn,ms});return id;},clearTimeout(id){tasks.delete(id);}});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();},run=async ms=>{for(const [id,t]of [...tasks])if(t.ms===ms){tasks.delete(id);t.fn();}await flush();};
try{
 const code=script.replaceAll("from '/",`from '${new URL('../public/',import.meta.url).href}`);await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const $=id=>document.getElementById(id);assert.equal($('intro').classList.contains('hidden'),true);
 $('mic').click();assert.ok(!$('voice-options').classList.contains('hidden'));$('record-voice').click();await flush();assert.match($('voice-review-status').textContent,/recording/);$('mic').click();await run(100);await run(200);assert.match($('voice-review-status').textContent,/creation callbacks: 1/);
 $('voice-reset').click();$('voice-delay').checked=true;$('mic').click();$('record-voice').click();await flush();$('mic').click();await run(100);$('cancel-voice').click();await run(5000);assert.match($('voice-review-status').textContent,/creation callbacks: 0/);
 $('voice-route').value='native';$('voice-route').dispatchEvent(new window.Event('change'));$('mic').click();await run(1200);assert.match($('voice-review-status').textContent,/creation callbacks: 1/);assert.match($('voice-review-status').textContent,/mock transcription calls: 0/);
 $('voice-route').value='failure';$('voice-route').dispatchEvent(new window.Event('change'));$('mic').click();await run(300);assert.ok(!$('voice-options').classList.contains('hidden'));
 $('voice-route').value='synthetic';$('voice-reset').click();$('mic').click();$('record-voice').click();await flush();$('voice-ko').click();assert.match($('voice-review-status').textContent,/canceled/);$('voice-transition').click();assert.match($('voice-review-status').textContent,/creation callbacks: 0/);
 window.dispatchEvent(new window.Event('pagehide'));console.log('PASS actual no-upload harness wiring: record/finish, delayed cancel, native success/failure and KO/mode transitions (jsdom only)');
}finally{dom.window.close();for(const [k,v]of old)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
