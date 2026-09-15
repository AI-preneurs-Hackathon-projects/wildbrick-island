import assert from 'node:assert/strict';
import {newRoom,addPlayer,advanceRoom,applyInput,roomSnapshot} from '../public/arena-core.js';
import {remoteMotionTarget,REMOTE_JITTER_MS,REMOTE_EXTRAPOLATION_MS} from '../public/remote-motion.js';

let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const boxes=[];
function player(){const room=newRoom(100000,'realtime-render'),p=addPlayer(room,'p','Remote');p.motion={version:2,frame:0,at:room.time};return {room,p};}

check('realtime movement advances on the owner clock, not input arrival',()=>{
 const {room,p}=player(),start=p.z;applyInput(room,p.id,{seq:1,input:{z:1},motionEpoch:0,roundId:room.round.id},room.time);
 assert.equal(p.z,start,'receiving input does not move the authority');
 advanceRoom(room,room.time+100);assert.ok(p.z>start,'fixed room clock consumes held input');
 const moved=p.z;advanceRoom(room,room.time+100);assert.ok(p.z>moved,'movement continues without another packet');
 applyInput(room,p.id,{seq:2,input:{},motionEpoch:0,roundId:room.round.id},room.time);const stopped=p.z;advanceRoom(room,room.time+100);assert.equal(p.z,stopped,'stop is applied on the next fixed clock advance');
 assert.equal(roomSnapshot(room,p.id).players[0].lastSeq,2,'snapshot acknowledges ordered input');
});

check('timestamp history interpolates stop and reversal inside the explicit jitter window',()=>{
 const {room,p}=player();let state,current;
 const target=(time,x,speed)=>{room.time=time;p.x=x;p.speed=speed;room.revision++;current=roomSnapshot(room,p.id);const result=remoteMotionTarget(state,p,current,1/60,boxes,time);state=result.state;return result;};
 target(100000,0,6);target(100050,.3,6);const between=target(100100,.6,6);const shown=remoteMotionTarget(state,p,current,1/60,boxes,100125);assert.ok(shown.x>.25&&shown.x<.6);
 const stop=target(100150,.6,0),held=remoteMotionTarget(state,p,current,1/60,boxes,100300);assert.equal(held.x,.6);assert.equal(stop.snap,false);
 target(100350,.3,6);const reversed=remoteMotionTarget(state,p,current,1/60,boxes,100400);assert.ok(reversed.x<=.6,'reversal never continues stale forward velocity');
 assert.equal(REMOTE_JITTER_MS,75);assert.equal(REMOTE_EXTRAPOLATION_MS,100);assert.ok(between.state.samples.length<=8);
});

check('respawn, mount change, teleport and room epoch reset stale velocity',()=>{
 const {room,p}=player();let state=remoteMotionTarget(null,p,roomSnapshot(room,p.id),1/60,boxes,room.time).state;
 room.time+=50;p.x+=.3;p.speed=6;room.revision++;state=remoteMotionTarget(state,p,roomSnapshot(room,p.id),1/60,boxes,room.time).state;
 p.spawnSerial=1;p.x=20;p.z=20;room.time+=50;room.revision++;let reset=remoteMotionTarget(state,p,roomSnapshot(room,p.id),1/60,boxes,room.time);assert.equal(reset.snap,true);assert.equal(reset.state.samples.length,1);
 p.kit={...p.kit,id:'mounted'};room.time+=50;room.revision++;reset=remoteMotionTarget(reset.state,p,roomSnapshot(room,p.id),1/60,boxes,room.time);assert.equal(reset.state.samples.length,1);
 room.epoch='replacement-owner';room.time+=50;room.revision++;reset=remoteMotionTarget(reset.state,p,roomSnapshot(room,p.id),1/60,boxes,room.time);assert.equal(reset.state.samples.length,1);
});

console.log(`\n${checks} realtime authority/rendering checks passed. No hosted-latency claim.`);
