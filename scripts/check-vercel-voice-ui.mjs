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
  class Recorder {static isTypeSupported(type){return type==='audio/webm';}constructor(){this.mimeType='audio/webm';}start(){}stop(){}}
  const actions={state:()=>state,start(){state.started=true;},recent:()=>[],saved:()=>true,voice:()=>voice.start(),recordVoice:()=>voice.record(),cancelVoice:()=>voice.stop(),pause(v){state.paused=v;if(v)voice.stop();},describe:t=>heard.push(t),sound(){},cancelDesign(){}};
  const ui=createUI(actions);
  voice=createVoice({onCommand:actions.describe,onState:ui.voiceState,onFallback:ui.voiceFallback,platform:{Recognition:null,MediaRecorder:Recorder,mediaDevices:{async getUserMedia(){events.push('mic');const track={stop(){events.push('stop');}};streams.push(track);return {getTracks:()=>[track],getAudioTracks:()=>[track]};}},fetch:async url=>{events.push(url);return Response.json({configured});},setTimeout:()=>0,clearTimeout(){}}});
  $('player-name').value='Vercel test';$('explore-start').click();
  assert.equal($('record-voice'),null);
  $('mic').click();assert.equal($('voice-options').classList.contains('hidden'),false);assert.equal($('voice-options').textContent.trim(),'Type an idea');assert.equal(streams.length,0);
  $('type-voice').click();assert.equal($('menu').open,true);$('creation-description').value='a green toy tower';$('imagine-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert.deepEqual(heard,['a green toy tower']);
  ui.voiceFallback('',{canRecord:true});assert.equal($('record-voice'),null);ui.voiceState('listening','Listening…');assert.equal($('voice-options').classList.contains('hidden'),true);
  assert.doesNotMatch(fs.readFileSync('public/ui.js','utf8'),/id="record-voice"/);
  console.log('PASS Vercel offers only Type an idea after no speech, with typing and native-listening visibility matching Sites; jsdom only, no paid calls.');
}finally{voice?.dispose();dom.window.close();for(const [k,v]of old)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
