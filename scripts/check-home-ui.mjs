import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createUI} from '../public/ui.js';
import {createArenaUI} from '../public/arena-ui.js';
import {character,C} from '../public/models.js';
import {createState} from '../public/rules.js';
import {newRoom,addPlayer,roomSnapshot} from '../public/arena-core.js';
const shell=await import('node:fs').then(fs=>fs.readFileSync('public/index.html','utf8'));
assert.match(shell,/style\.css\?v=40/);assert.match(shell,/main\.js\?v=40/);
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
 const state=createState(),joins=[];let starts=0,leaves=0,resets=0,snapshots=0,arenaUI,entry;
 const exit=()=>{leaves++;state.arena=false;state.mode='foot';arenaUI.reset();ui.resetPlayUI();ui.update(state);};
 const exitHome=()=>{exit();state.started=false;ui.showEntry();};
 const ui=createUI({state:()=>state,snapshot(){snapshots++;},start(){state.started=true;starts++;},openArena(){return arenaUI.play();},resetPractice(){resets++;for(const key of ['gates','targets','crates','rings'])state[key]=[];state.bricks=0;state.won=false;ui.update(state);},pause(v){state.paused=v;},recent:()=>[],saved:()=>true,exitHome,leaveArena:exit});
 arenaUI=createArenaUI({getPlayerName:ui.playerName,join:async(name,room,create)=>{joins.push({name,room,create});entry=joinImpl();return entry;},start:async()=>true,leave:exit,exitHome,toast(){}});
 return {ui,arenaUI,state,joins,exit,get starts(){return starts;},get leaves(){return leaves;},get resets(){return resets;},get snapshots(){return snapshots;},get entry(){return entry;}};
}
function name(value){$('player-name').value=value;$('player-name').dispatchEvent(new window.Event('input',{bubbles:true}));}
await check('both modes require a name and recover from whitespace input',async()=>{
 const app=setup();assert.equal(document.querySelector('.intro-small'),null);assert.doesNotMatch($('intro').textContent,/Keyboard or touch|Type or speak to build/);assert.equal($('hud').classList.contains('hidden'),true);assert.equal($('hud').getAttribute('aria-hidden'),'true');for(const id of ['practice-map-name','snapshot','help','pause','mode-pill','mic','action'])assert.equal($(id).closest('#hud'),$('hud'));assert.equal($('jump-equipped'),null);assert.equal($('snapshot').getAttribute('aria-label'),'Take a snapshot');app.ui.toast('First sentence. Second sentence!');assert.equal($('toast').textContent,'First sentence.\nSecond sentence!');for(const id of ['explore-start','start']){$(id).click();assert.equal(app.starts,0);}
 name('   ');$('start').click();assert.equal(app.starts,0);assert.equal($('player-name').validity.customError,true);
 name('  River  ');$('start').click();assert.equal($('arena-lobby').open,true);$('arena-create').click();await app.entry;await Promise.resolve();assert.equal(app.starts,1);assert.equal($('hud').classList.contains('hidden'),false);assert.equal($('hud').getAttribute('aria-hidden'),'false');$('snapshot').click();assert.equal(app.snapshots,1);assert.equal(app.ui.playerName(),'River');assert.equal(app.joins[0].name,'River');assert.equal(app.joins[0].create,true);assert.match(app.joins[0].room,/^[A-Z2-9]{6}$/);
});
await check('Explore keeps newer speech controls and shows the full Practice route without Arena or rewards',async()=>{
 const app=setup();name('River');$('explore-start').click();assert.equal(app.joins.length,0);assert.equal(document.activeElement,$('help'));assert.equal($('toast').textContent,'Practice on the island.\nFollow the gold beacon and Speak / Build to create.');assert.equal($('imagine'),null);assert.equal($('mic').textContent.includes('Speak / Build'),true);
 assert.match($('practice-route').textContent,/Scenic route/);assert.match($('practice-route').textContent,/Right on target/);assert.match($('practice-route').textContent,/Smash & grab/);assert.match($('practice-route').textContent,/Sky is the limit/);assert.equal(document.querySelector('.brick-counter'),null);
 app.state.gates.push('gate-1');app.ui.update(app.state);assert.equal($('practice-gates').textContent,'1/4');assert.ok($('practice-creations'));
 Object.assign(app.state,{gates:[0,1,2,3],targets:[0,1,2],crates:[0,1,2],rings:[0,1,2,3,4],won:true,bricks:226});app.ui.update(app.state);assert.equal($('practice-route').classList.contains('complete'),true);assert.equal($('practice-reset').classList.contains('hidden'),false);$('practice-reset').click();assert.equal(app.resets,1);assert.equal($('practice-reset').classList.contains('hidden'),true);
});
await check('failed authentication preserves sign-in and Exit to home returns to the home screen',async()=>{
 const app=setup(async()=>{app.arenaUI.error('Sign in',401);return false;});name('Sky');$('start').click();$('arena-room').value='ROOM1';$('arena-join').click();await app.entry;await Promise.resolve();
 assert.equal($('arena-sign-in').classList.contains('hidden'),false);assert.equal($('arena-sign-in').target,'_top');assert.equal(new URL($('arena-sign-in').href).searchParams.get('return_to'),'/');assert.equal(window.sessionStorage.getItem('brickwild-player-name'),'Sky');
 assert.equal($('arena-explore').textContent,'Exit to home');$('arena-explore').click();assert.equal(app.leaves,1);assert.equal(app.state.started,false);assert.equal($('arena-lobby').open,false);assert.equal($('arena-join-error').textContent,'');assert.equal($('arena-sign-in').classList.contains('hidden'),true);assert.equal($('hud').classList.contains('hidden'),true);assert.equal($('hud').getAttribute('aria-hidden'),'true');assert.equal($('intro').classList.contains('hidden'),false);
});
await check('pause exit returns home in online, reconnecting, expired, offline and dead states',()=>{
 const app=setup();name('River');$('explore-start').click();const room=newRoom(),p=addPlayer(room,'p','River');
 for(const status of ['online','reconnecting','expired','offline','dead']){
  if(!app.state.started)$('explore-start').click();app.state.arena=true;p.health=status==='dead'?0:100;app.ui.update(app.state);app.arenaUI.setStatus(status==='dead'?'online':status);app.arenaUI.update({active:true,self:p,snapshot:roomSnapshot(room,p.id),room:'ISLAND',serverTime:()=>room.time});$('arena-board').open=false;
  assert.equal($('arena-exit'),null);assert.equal($('arena-vitals').classList.contains('hidden'),false);app.ui.openMenu('pause');$('exit-home').click();assert.equal(app.state.started,false);assert.equal($('intro').classList.contains('hidden'),false);assert.equal($('hud').classList.contains('hidden'),true);assert.equal(document.activeElement,$('player-name'));assert.equal(app.state.arena,false);assert.equal(document.body.classList.contains('in-arena'),false);assert.equal($('arena-vitals').classList.contains('hidden'),true);assert.equal($('arena-board').classList.contains('hidden'),true);assert.equal($('arena-death').classList.contains('hidden'),true);assert.equal($('arena-network').textContent,'');assert.equal($('open-arena').textContent,'Arena');assert.equal($('action').querySelector('span').textContent,'Punch');assert.equal($('jump-equipped'),null);assert.match($('practice-route').textContent,/Scenic route/);
 }assert.equal(app.leaves,5);
});
await check('leaving during pending join prevents the old completion reopening the lobby',async()=>{
 let resolve;const app=setup(()=>new Promise(r=>resolve=r));name('River');$('start').click();$('arena-room').value='ROOM1';$('arena-join').click();assert.equal($('arena-join').disabled,true);$('arena-explore').click();resolve(false);await app.entry;await Promise.resolve();assert.equal($('arena-lobby').open,false);assert.equal($('arena-join').disabled,false);assert.equal(app.state.arena,false);
});
await check('name survives reload and respects server limits; unavailable storage does not block either mode',()=>{
 setup();name('  <Sky>  ');$('explore-start').click();const app=setup();assert.equal($('player-name').value,'Sky');name('ABCDEFGHIJKLMNOPQRSTUVWXYZ');$('explore-start').click();assert.equal(app.ui.playerName(),'ABCDEFGHIJKLMNOPQRST');
 window.Storage.prototype.getItem=()=>{throw Error('Blocked');};window.Storage.prototype.setItem=()=>{throw Error('Blocked');};
 for(const id of ['explore-start','start']){const next=setup();name('Guest');$(id).click();assert.equal(next.starts,1);assert.equal(next.ui.playerName(),'Guest');assert.equal($('tutorial').open,true);$('tour-skip').click();}
});
await check('first-play tour respects Explore choice and does not join Arena on completion',()=>{
 localStorage.removeItem('brickwild-tour-v1');const app=setup();name('River');$('explore-start').click();assert.equal($('tutorial').open,true);$('tour-next').click();$('tour-next').click();assert.match($('tutorial').textContent,/Practice at your own pace/);$('tour-next').click();assert.equal(app.joins.length,0);assert.equal(app.state.paused,false);
});
await check('avatar recoloring leaves other characters and shared world materials intact',()=>{
 const first=character(),other=character();first.setColor('#579fe2');const shirts=model=>model.group.children.filter(g=>g.position.y===1.32).map(g=>g.children[0].material.color.getHex());assert.deepEqual(shirts(first),[0x579fe2]);assert.deepEqual(shirts(other),[C.orange]);first.setColor('#ee634e');assert.deepEqual(shirts(other),[C.orange]);
});
await check('avatar offers eight persistent colors without starting a game',()=>{
 const app=setup();const radios=[...document.querySelectorAll('[name="avatar-color"]')];assert.equal(radios.length,8);assert.equal(radios[0].getAttribute('aria-label'),'Orange');assert.equal(radios.at(-1).getAttribute('aria-label'),'Brown');assert.equal(radios.filter(r=>r.checked).length,1);assert.equal(radios[0].checked,true);assert.equal(app.ui.playerColor(),'#f17a48');assert.equal($('avatar-hint').textContent,'Drag to rotate');assert.equal($('avatar-preview').hasAttribute('tabindex'),false);radios.find(r=>r.value==='#579fe2').click();assert.equal(app.ui.playerColor(),'#579fe2');assert.equal(app.starts,0);assert.equal(setup().ui.playerColor(),'#579fe2');
});
await check('Explore pause exit returns home and permits a different mode and name',async()=>{
 const app=setup();name('River');$('explore-start').click();app.ui.openMenu('pause');$('exit-home').click();assert.equal(app.state.started,false);assert.equal($('menu').open,false);assert.equal($('intro').classList.contains('hidden'),false);name('Sky');$('start').click();$('arena-create').click();await app.entry;await Promise.resolve();assert.equal(app.starts,2);assert.equal(app.joins[0].name,'Sky');
});
console.log(`\n${checks} home and Arena exit checks passed.`);
