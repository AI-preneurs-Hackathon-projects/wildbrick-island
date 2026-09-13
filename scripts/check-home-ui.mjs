import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createUI} from '../public/ui.js';
import {createArenaUI} from '../public/arena-ui.js';
import {createState} from '../public/rules.js';
import {newRoom,addPlayer,roomSnapshot} from '../public/arena-core.js';
let checks=0;
async function check(name,run){
 const dom=new JSDOM('<div id="ui"></div>',{url:'https://brickwild.test/'});
 const originals=new Map(['window','document','location','localStorage','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,setTimeout:()=>0,clearTimeout(){}});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};localStorage.setItem('brickwild-tour-v1','seen');
 try{await run();checks++;console.log('PASS '+name);}finally{dom.window.close();for(const [k,v] of originals){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
const $=id=>document.getElementById(id);
function setup(joinImpl=async()=>true){
 const state=createState(),joins=[];let starts=0,leaves=0,arenaUI,entry;
 const exit=()=>{leaves++;state.arena=false;state.mode='foot';arenaUI.reset();ui.resetPlayUI();ui.update(state);};
 const ui=createUI({state:()=>state,start(){state.started=true;starts++;},openArena(){entry=arenaUI.play();return entry;},pause(v){state.paused=v;},recent:()=>[],saved:()=>true,leaveArena:exit});
 arenaUI=createArenaUI({getPlayerName:ui.playerName,join:async(name,room)=>{joins.push({name,room});return joinImpl();},leave:exit,toast(){}});
 return {ui,arenaUI,state,joins,exit,get starts(){return starts;},get leaves(){return leaves;},get entry(){return entry;}};
}
function name(value){$('player-name').value=value;$('player-name').dispatchEvent(new window.Event('input',{bubbles:true}));}
await check('both modes require a name and recover from whitespace input',async()=>{
 const app=setup();for(const id of ['explore-start','start']){$(id).click();assert.equal(app.starts,0);}
 name('   ');$('start').click();assert.equal(app.starts,0);assert.equal($('player-name').validity.customError,true);
 name('  River  ');$('start').click();await app.entry;assert.equal(app.starts,1);assert.equal(app.ui.playerName(),'River');assert.deepEqual(app.joins,[{name:'River',room:'ISLAND'}]);
});
await check('Explore keeps newer speech controls and carries the name into shared Arena and rejoin',async()=>{
 const app=setup();name('River');$('explore-start').click();assert.equal(app.joins.length,0);assert.equal(document.activeElement,$('help'));assert.equal($('imagine'),null);assert.equal($('mic').textContent.includes('Speak / Build'),true);
 $('open-arena').click();await app.entry;assert.equal($('arena-name'),null);assert.equal($('arena-room'),null);assert.equal($('arena-player-name').textContent,'River');assert.deepEqual(app.joins,[{name:'River',room:'ISLAND'}]);
 app.arenaUI.error('Position held',410);assert.equal($('arena-lobby').open,true);await app.arenaUI.play();assert.equal(app.joins.length,2);assert.equal($('arena-lobby').open,false);
});
await check('failed authentication preserves sign-in and Back to Explore clears the lobby and errors',async()=>{
 const app=setup(async()=>{app.arenaUI.error('Sign in',401);return false;});name('Sky');$('start').click();await app.entry;
 assert.equal($('arena-sign-in').classList.contains('hidden'),false);assert.equal($('arena-sign-in').target,'_top');assert.equal(new URL($('arena-sign-in').href).searchParams.get('return_to'),'/');assert.equal(window.sessionStorage.getItem('brickwild-player-name'),'Sky');
 $('arena-explore').click();assert.equal(app.leaves,1);assert.equal($('arena-lobby').open,false);assert.equal($('arena-join-error').textContent,'');assert.equal($('arena-sign-in').classList.contains('hidden'),true);assert.equal($('hud').classList.contains('hidden'),false);
});
await check('direct exit works with leaderboard closed in online, reconnecting, expired, offline and dead states',()=>{
 const app=setup();name('River');$('explore-start').click();const room=newRoom(),p=addPlayer(room,'p','River');
 for(const status of ['online','reconnecting','expired','offline','dead']){
  app.state.arena=true;p.health=status==='dead'?0:100;app.ui.update(app.state);app.arenaUI.setStatus(status==='dead'?'online':status);app.arenaUI.update({active:true,self:p,snapshot:roomSnapshot(room,p.id),room:'ISLAND',serverTime:()=>room.time});$('arena-board').open=false;
  assert.equal($('arena-exit').closest('details'),null);assert.equal($('arena-vitals').classList.contains('hidden'),false);$('arena-exit').click();assert.equal(app.state.arena,false);assert.equal(document.body.classList.contains('in-arena'),false);assert.equal($('arena-vitals').classList.contains('hidden'),true);assert.equal($('arena-board').classList.contains('hidden'),true);assert.equal($('arena-death').classList.contains('hidden'),true);assert.equal($('arena-network').textContent,'');assert.equal($('open-arena').textContent,'Arena');assert.equal($('action').querySelector('span').textContent,'Jump');assert.match($('objective-title').textContent,/mint gates/);
 }assert.equal(app.leaves,5);
});
await check('leaving during pending join prevents the old completion reopening the lobby',async()=>{
 let resolve;const app=setup(()=>new Promise(r=>resolve=r));name('River');$('start').click();assert.equal($('arena-join').disabled,true);$('arena-explore').click();resolve(false);await app.entry;assert.equal($('arena-lobby').open,false);assert.equal($('arena-join').disabled,false);assert.equal(app.state.arena,false);
});
await check('name survives reload and respects server limits; unavailable storage does not block either mode',()=>{
 setup();name('  <Sky>  ');$('explore-start').click();const app=setup();assert.equal($('player-name').value,'Sky');name('ABCDEFGHIJKLMNOPQRSTUVWXYZ');$('explore-start').click();assert.equal(app.ui.playerName(),'ABCDEFGHIJKLMNOPQRST');
 window.Storage.prototype.getItem=()=>{throw Error('Blocked');};window.Storage.prototype.setItem=()=>{throw Error('Blocked');};
 for(const id of ['explore-start','start']){const next=setup();name('Guest');$(id).click();assert.equal(next.starts,1);assert.equal(next.ui.playerName(),'Guest');assert.equal($('tutorial').open,true);$('tour-skip').click();}
});
await check('first-play tour respects Explore choice and does not join Arena on completion',()=>{
 localStorage.removeItem('brickwild-tour-v1');const app=setup();name('River');$('explore-start').click();assert.equal($('tutorial').open,true);$('tour-next').click();$('tour-next').click();assert.match($('tutorial').textContent,/Explore at your own pace/);$('tour-next').click();assert.equal(app.joins.length,0);assert.equal(app.state.paused,false);
});
console.log(`\n${checks} home and Arena exit checks passed.`);
