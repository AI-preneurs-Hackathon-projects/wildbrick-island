import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {ACTION_BINDINGS,keyAction} from '../public/action-bindings.js';
import {creationSlots,creationKey,createCreationSelection} from '../public/creation-slots.js';
import {createAdventure} from '../public/adventure.js';
import {createState} from '../public/rules.js';
import {createInput} from '../public/input.js';
import {createUI} from '../public/ui.js';
import {createArenaUI} from '../public/arena-ui.js';
import {newRoom,addPlayer,makeKit,applyInput,advanceRoom,roomSnapshot} from '../public/arena-core.js';
// Derived names distinguish copies of existing captured car geometry. No generation.
const car=JSON.parse(fs.readFileSync('validation/live/final-compact-none/armed-car.json','utf8')).blueprint;
const design=i=>({...structuredClone(car),name:'Saved car '+i});
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
function fixture(count=6){
 const dom=new JSDOM('<div id="scene"></div><div id="ui"></div><input id="outside"><div contenteditable="true" tabindex="0" id="editable"><span id="inside">name</span></div>',{url:'https://brickwild.test'});
 for(const k of ['window','document','location','localStorage','HTMLInputElement','HTMLTextAreaElement'])globalThis[k]=dom.window[k];
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};dom.window.HTMLElement.prototype.setPointerCapture=function(){};
 const adventure=createAdventure(memory()),state=createState();for(let i=0;i<count;i++)adventure.remember(design(i));Object.assign(state,{started:true,health:100});
 let input,ui,cCalls=0,builds=[],notices=[];
 const select=createCreationSelection({records:()=>adventure.creations,state:()=>state,onRebuild:b=>{builds.push(b);return true;},onNotice:s=>notices.push(s)});
 const actions={state:()=>state,start(){state.started=true;},recent:select.slots,older:select.older,saved:()=>true,rebuild:select.choose,rebuildOlder:select.chooseOlder,pause(v){state.paused=v;input?.clear();},describe(){assert.fail('A saved rebuild must never generate');},voice(){},sound(){},cancelDesign(){},jump(){},action(){}};
 ui=createUI(actions);input=createInput({getState:()=>state,onCollection(){cCalls++;ui.openMenu('collection');},onSlot:select.choose,onHotkeys:()=>ui.toggleMenu('hotkeys'),onPause:()=>ui.toggleMenu('pause')});
 localStorage.setItem('brickwild-tour-v1','seen');document.querySelector('#player-name').value='Tester';document.querySelector('#explore-start').click();document.activeElement.blur();ui.update(state);
 const key=(type,code,extra={},target=window)=>{const e=new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true,...extra});target.dispatchEvent(e);return e;};
 const tap=code=>{key('keydown',code);key('keyup',code);};
 return {dom,adventure,state,select,actions,ui,input,builds,notices,key,tap,get cCalls(){return cCalls;},close(){ui.resetPlayUI();dom.window.close();}};
}
test('one binding per physical key, C and exactly five numbered actions, camera and item keys preserved',()=>{
 const codes=Object.values(ACTION_BINDINGS).flatMap(b=>b.codes);assert.equal(new Set(codes).size,codes.length);
 for(const [code,action] of Object.entries({KeyC:'collection',KeyR:'pitchUp',KeyF:'pitchDown',KeyQ:'lookLeft',KeyE:'lookRight',ArrowDown:'lower',KeyG:'drop',KeyT:'pickup',ArrowLeft:'speak',ArrowRight:'attack'}))assert.equal(keyAction(code),action);
 for(let i=1;i<=5;i++)assert.equal(ACTION_BINDINGS[keyAction('Digit'+i)].slot,i-1);assert.equal(keyAction('Digit6'),undefined);
});
test('0/1/5/6/12 records derive five newest distinct slots without deleting older saves or progress',()=>{
 for(const count of [0,1,5,6,12]){
  const storage=memory(),a=createAdventure(storage),s=createState();s.gates=[0];for(let i=0;i<count;i++)a.remember(design(i));a.save(s);
  const before=storage.getItem('brickwild.adventure.v1'),recent=creationSlots(a.creations);
  assert.equal(recent.length,Math.min(count,5));assert.deepEqual(recent.map(b=>b.name),Array.from({length:Math.min(count,5)},(_,i)=>'Saved car '+(count-1-i)));assert.equal(storage.getItem('brickwild.adventure.v1'),before);
  const b=createAdventure(storage),restored=createState();b.restore(restored);assert.equal(b.creations.length,count);assert.deepEqual(restored.gates,[0]);assert.deepEqual(creationSlots(b.creations),recent);
 }
});
test('duplicate designs occupy one slot; only a completed design changes order; rebuilds and reload preserve numbers',()=>{
 const f=fixture();const before=f.select.slots().map(creationKey);f.select.choose(3);assert.deepEqual(f.select.slots().map(creationKey),before);assert.equal(f.builds.length,1);
 f.adventure.remember(design(2));assert.deepEqual(f.select.slots().map(b=>b.name),['Saved car 2','Saved car 5','Saved car 4','Saved car 3','Saved car 1']);assert.equal(f.adventure.creations.length,6);
 assert.equal(creationSlots([design(1),design(1),design(2)]).length,2);f.close();
});
test('missing, malformed, duplicate, invalid and unavailable storage recover safely without erasing other keys',()=>{
 const storage=memory();storage.setItem('unrelated','keep');storage.setItem('brickwild.adventure.v1','{broken');assert.equal(createAdventure(storage).creations.length,0);assert.equal(storage.getItem('unrelated'),'keep');
 storage.setItem('brickwild.adventure.v1',JSON.stringify({version:1,creations:[null,{bad:true},design(1),design(1),design(2)]}));assert.deepEqual(createAdventure(storage).creations.map(b=>b.name),['Saved car 1','Saved car 2']);
 for(const store of [undefined,{getItem(){throw Error('denied');},setItem(){throw Error('quota');}}]){const a=createAdventure(store);a.remember(design(1));assert.equal(a.save(createState()),false);assert.equal(creationSlots(a.creations).length,1);}
});
test('keyboard and pointer use the same blueprint once with zero generation; repeated keydown and empty slots are inert',()=>{
 const f=fixture(1),fetchBefore=globalThis.fetch;let network=0;globalThis.fetch=()=>{network++;throw Error('No network expected');};
 try{f.key('keydown','Digit1');f.key('keydown','Digit1');f.key('keydown','Digit1',{repeat:true});assert.equal(f.builds.length,1);f.key('keyup','Digit1');document.querySelector('[data-slot="0"]').click();assert.equal(f.builds.length,2);assert.equal(f.builds[0],f.builds[1]);for(let i=2;i<=5;i++){f.tap('Digit'+i);const button=document.querySelector(`[data-slot="${i-1}"]`);assert.ok(button.disabled);assert.equal(button.getAttribute('aria-keyshortcuts'),null);assert.match(button.textContent,/Empty/);button.click();}assert.equal(f.builds.length,2);assert.equal(network,0);}finally{globalThis.fetch=fetchBefore;f.close();}
});
test('C opens collection once; gameplay digits are suppressed in collection, descriptions, names, dialogs and IME',()=>{
 const f=fixture();f.key('keydown','KeyC');f.key('keydown','KeyC',{repeat:true});assert.equal(f.cCalls,1);assert.ok(document.querySelector('#menu').open);f.tap('Digit1');assert.equal(f.builds.length,0);f.ui.closeMenu();f.input.clear();
 for(const selector of ['#outside','#editable']){document.querySelector(selector).focus();f.tap('Digit1');f.tap('KeyC');assert.equal(f.builds.length,0);assert.equal(f.cCalls,1);document.activeElement.blur();}
 f.ui.openMenu('imagine');const text=document.querySelector('#creation-description');f.key('keydown','Digit1',{},text);f.key('keydown','KeyC',{},text);assert.equal(f.builds.length,0);f.ui.closeMenu();text.blur();
 document.dispatchEvent(new window.CompositionEvent('compositionstart'));f.tap('Digit1');document.dispatchEvent(new window.CompositionEvent('compositionend'));f.key('keydown','Digit1',{isComposing:true});f.key('keydown','KeyC',{keyCode:229});f.key('keydown','Digit1',{},document.querySelector('#inside'));assert.equal(f.builds.length,0);assert.equal(f.cCalls,1);f.close();
});
test('modifiers, blur, pause, KO, round end, home and building guard slot dispatch while independent movement/attack remain combined',()=>{
 const f=fixture();for(const modifier of ['ctrlKey','metaKey','altKey']){f.key('keydown','Digit1',{[modifier]:true});assert.equal(f.builds.length,0);}
 for(const block of [{started:false},{paused:true},{health:0},{roundFinished:true},{building:{}}]){const before={...f.state};Object.assign(f.state,block);f.tap('Digit1');f.ui.update(f.state);document.querySelector('[data-slot="0"]').click();assert.equal(f.builds.length,0);Object.assign(f.state,before);delete f.state.roundFinished;}
 Object.assign(f.state,{started:true,paused:false,health:100,roundFinished:false,building:null,arena:true});f.key('keydown','KeyW');f.key('keydown','ArrowRight');f.key('keydown','Digit1');assert.equal(f.builds.length,1);assert.equal(f.input.read().z,1);assert.equal(f.input.read().fire,true);window.dispatchEvent(new window.Event('blur'));assert.equal(f.input.read().z,0);assert.equal(f.input.read().fire,false);f.tap('Digit1');assert.equal(f.builds.length,2);f.close();
});
test('stale menu and HUD callbacks cannot rebuild a changed index; detached double clicks do not repeat; older designs remain recoverable',()=>{
 const f=fixture();f.ui.openMenu('collection');const oldButton=document.querySelector('[data-recent="0"]');f.adventure.remember(design(99));oldButton.click();assert.equal(f.builds.length,0);assert.ok(document.querySelector('#menu').open);
 const button=document.querySelector('[data-recent="0"]');button.click();button.click();assert.equal(f.builds.length,1);assert.equal(f.builds[0].name,'Saved car 99');document.activeElement.blur();
 // HUD still displays the previous frame: choosing it must reject instead of selecting 99.
 document.querySelector('[data-slot="0"]').click();assert.equal(f.builds.length,1);assert.match(f.notices.at(-1),/slots changed/);
 f.ui.update(f.state);f.ui.openMenu('collection');const older=document.querySelector('[data-older="0"]');assert.ok(older);older.click();assert.equal(f.builds.length,2);assert.equal(f.builds[1].name,'Saved car 1');assert.equal(f.select.slots()[0].name,'Saved car 99');f.close();
});
test('HUD, collection, typing recents, Help and aria labels agree; disabled lifecycle does not retain active slot controls',()=>{
 const f=fixture(8);for(const [id,action] of [['open-creations','collection'],['help','help'],['pause','menu'],['mic','speak'],['descend','lower'],['exit-vehicle','drop']]){const b=document.getElementById(id);assert.equal(b.getAttribute('aria-keyshortcuts'),ACTION_BINDINGS[action].aria);assert.match(b.textContent,new RegExp(ACTION_BINDINGS[action].label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
 const names=f.select.slots().map(b=>b.name);assert.deepEqual([...document.querySelectorAll('[data-slot] span')].map(b=>b.textContent),names);
 for(const mode of ['collection','imagine']){f.ui.openMenu(mode);assert.deepEqual([...document.querySelectorAll('[data-recent] span')].map(b=>b.textContent),names);assert.deepEqual([...document.querySelectorAll('[data-recent] kbd')].map(b=>b.textContent),['1','2','3','4','5']);assert.equal(document.querySelector('[data-recent]').getAttribute('aria-keyshortcuts'),null);f.ui.closeMenu();}
 f.ui.openMenu('hotkeys');assert.match(document.querySelector('#menu-content').textContent,/CYour creations/);assert.match(document.querySelector('#menu-content').textContent,/1–5Rebuild recent creation/);assert.match(document.querySelector('#menu-content').textContent,/R \/ FPitch camera/);f.ui.closeMenu();
 f.state.roundFinished=true;f.ui.update(f.state);assert.ok([...document.querySelectorAll('[data-slot]')].every(b=>b.disabled));f.state.roundFinished=false;f.ui.update(f.state);assert.ok([...document.querySelectorAll('[data-slot]')].every(b=>!b.disabled));
 const room=newRoom(100000),p=addPlayer(room,'p','Tester'),arenaUI=createArenaUI({openCollection:()=>f.ui.openMenu('collection')});arenaUI.update({active:true,self:p,snapshot:roomSnapshot(room,p.id),serverTime:()=>room.time});assert.equal(document.querySelector('#arena-creations').getAttribute('aria-keyshortcuts'),'c');assert.match(document.querySelector('#arena-creations').textContent,/Your creations C/);assert.equal(document.querySelector('#action').getAttribute('aria-keyshortcuts'),'ArrowRight');f.close();
});
test('saved slot uses ordinary trusted Arena assembly, cooldown, retry, death and round gates, never immediate equipment',()=>{
 const room=newRoom(100000),p=addPlayer(room,'p','Tester'),kit=makeKit('generated',car,'saved-fixture');let builds=0;
 const select=createCreationSelection({records:()=>[car],state:()=>({started:true,health:p.health,building:p.building,roundFinished:room.round.status==='finished'}),onRebuild(){builds++;applyInput(room,p.id,{seq:p.lastSeq+1,roundId:room.round.id,command:{id:p.lastCommand+1,type:'build',mode:'generated'}},room.time,kit);return true;}});
 assert.equal(select.choose(0),true);assert.equal(p.kit.id,'foot');assert.equal(p.building.kit,kit);assert.equal(select.choose(0),false);assert.equal(builds,1);
 const commandId=p.lastCommand;applyInput(room,p.id,{seq:p.lastSeq+1,command:{id:commandId,type:'build'}},room.time,kit);assert.equal(room.events.filter(e=>e.type==='build').length,1);
 advanceRoom(room,room.time+1300);assert.equal(p.kit.id,kit.id);select.choose(0);assert.equal(p.building,null);assert.equal(room.events.filter(e=>e.type==='build').length,1);
 const previous=builds;p.health=0;assert.equal(select.choose(0),false);p.health=100;room.round.status='finished';assert.equal(select.choose(0),false);assert.equal(builds,previous);
});
