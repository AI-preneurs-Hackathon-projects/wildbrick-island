import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createUI} from '../vercel-public/ui.js';
import {createVoice} from '../vercel-public/voice-controller.js';
import {createState} from '../vercel-public/rules.js';
const dom=new JSDOM('<div id="scene"></div><div id="ui"></div>',{url:'https://game.test/'});
const keys=['window','document','location','localStorage','setTimeout','clearTimeout'];
const old=new Map(keys.map(k=>[k,globalThis[k]]));
Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,setTimeout:()=>0,clearTimeout(){}});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
localStorage.setItem('brickwild-tour-v1','seen');
const $=id=>document.getElementById(id);
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
let voice;
try{
  const state=createState(),heard=[],events=[],streams=[];
  let configured=true;
  class Recorder {static isTypeSupported(type){return type==='audio/webm';}constructor(){this.mimeType='audio/webm';}start(){}stop(){}}
  const actions={state:()=>state,start(){state.started=true;},recent:()=>[],saved:()=>true,voice:()=>voice.start(),recordVoice:()=>voice.record(),cancelVoice:()=>voice.stop(),pause(v){state.paused=v;if(v)voice.stop();},describe:t=>heard.push(t),sound(){},cancelDesign(){}};
  const ui=createUI(actions);
  voice=createVoice({onCommand:actions.describe,onState:ui.voiceState,onFallback:ui.voiceFallback,platform:{Recognition:null,MediaRecorder:Recorder,mediaDevices:{async getUserMedia(){events.push('mic');const track={stop(){events.push('stop');}};streams.push(track);return {getTracks:()=>[track],getAudioTracks:()=>[track]};}},fetch:async url=>{events.push(url);return Response.json({configured});},setTimeout:()=>0,clearTimeout(){}}});
  $('player-name').value='Vercel test';$('explore-start').click();
  assert.equal($('record-voice').hidden,true);
  $('mic').click();assert.equal($('record-voice').hidden,false);assert.equal($('voice-options').classList.contains('hidden'),false);assert.equal(streams.length,0);
  $('record-voice').click();await flush();assert.deepEqual(events.slice(0,2),['/api/transcription-status','mic']);assert.equal(streams.length,1);assert.equal(voice.state,'recording');assert.equal($('voice-options').classList.contains('hidden'),true);
  voice.stop();assert.ok(events.includes('stop'));
  configured=false;events.length=0;ui.voiceFallback('',{canRecord:true});$('record-voice').click();await flush();assert.deepEqual(events,['/api/transcription-status']);assert.equal($('record-voice').hidden,true);
  // A programmatic click cannot bypass an unavailable recording fallback.
  $('record-voice').click();await flush();assert.deepEqual(events,['/api/transcription-status']);
  $('type-voice').click();assert.equal($('menu').open,true);$('creation-description').value='a green toy tower';$('imagine-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert.deepEqual(heard,['a green toy tower']);
  ui.voiceFallback('',{canRecord:true});ui.voiceState('listening','Listening…');assert.equal($('voice-options').classList.contains('hidden'),true);
  assert.doesNotMatch(fs.readFileSync('public/ui.js','utf8'),/id="record-voice"/);
  console.log('PASS built Vercel Record action, readiness-before-mic, disabled fallback, typing, native-listening visibility and unchanged Sites source; jsdom only, no paid calls.');
}finally{voice?.dispose();dom.window.close();for(const [k,v]of old)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
