import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createRealtimeTicket} from '../server/realtime-ticket.js';
import {createLocalRealtimeDb} from '../realtime/local-db.js';
import {createRealtimeServer} from '../realtime/server.js';
import {arenaStore} from '../worker/arena-store.js';

const secret = 'focused-realtime-test-secret-'.repeat(2);
const origin = 'http://127.0.0.1:4173';
const local = createLocalRealtimeDb();
const app = createRealtimeServer({db: local.db, ticketSecret: secret, origins: new Set([origin])});
await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
const {port} = app.server.address(), endpoint = `ws://127.0.0.1:${port}/arena`;

function ticket(principal, create, room) {
  return createRealtimeTicket({principal, room, create, origin, secret, jti: randomUUID()}).ticket;
}

async function connect(principal, create, resume, room = 'RT01') {
  const socket = new WebSocket(endpoint, {origin});
  const messages = [], waiters = [];
  socket.on('message', bytes => {
    const message = JSON.parse(bytes.toString());
    messages.push(message);
    for (const wake of waiters.splice(0)) wake();
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const waitFor = async (predicate, timeout = 3000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return messages.splice(index, 1)[0];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { const index = waiters.indexOf(wake); if (index >= 0) waiters.splice(index, 1); reject(new Error('Timed out waiting for realtime message')); }, Math.min(500, timeout));
        const wake = () => { clearTimeout(timer); resolve(); };
        waiters.push(wake);
      }).catch(error => { if (Date.now() - started >= timeout) throw error; });
    }
    throw new Error('Timed out waiting for realtime message');
  };
  socket.send(JSON.stringify({type: 'authenticate', ticket: ticket(principal, create, room)}));
  await waitFor(message => message.type === 'authenticated');
  socket.send(JSON.stringify({type: 'join', requestId: 1, name: principal, room, create, avatarColor: '#ffcf55', resume, motionVersion: 2, mapVersion: 1}));
  const joined = await waitFor(message => message.type === 'joined' || message.type === 'error');
  assert.equal(joined.type, 'joined', joined.message);
  return {socket, messages, waitFor, joined};
}

try {
  const provisional={session:randomUUID(),token:randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','')};
  const idempotent=await connect('test:idempotent',true,provisional,'IDEM');
  assert.equal(idempotent.joined.session,provisional.session,'first join persists the client attempt credential');
  const idempotentPlayer=idempotent.joined.snapshot.self;
  idempotent.socket.close();await new Promise(resolve=>idempotent.socket.once('close',resolve));
  const idempotentRetry=await connect('test:idempotent',true,provisional,'IDEM');
  assert.equal(idempotentRetry.joined.snapshot.self,idempotentPlayer,'retry after a lost joined response reuses the same seat');
  assert.equal(idempotentRetry.joined.snapshot.players.length,1,'idempotent retry does not duplicate the lobby player');
  idempotentRetry.socket.send(JSON.stringify({type:'leave',requestId:9}));await idempotentRetry.waitFor(message=>message.type==='result'&&message.requestId===9);

  const first = await connect('test:first', true);
  const second = await connect('test:second', false);
  first.socket.send(JSON.stringify({type: 'start', requestId: 2}));
  assert.equal((await first.waitFor(message => message.type === 'result' && message.requestId === 2)).snapshot.round.status, 'active');
  await new Promise(resolve=>setTimeout(resolve,5200));
  assert.equal(first.socket.readyState,WebSocket.OPEN,'authenticated sockets survive the five-second admission guard');
  assert.equal(second.socket.readyState,WebSocket.OPEN,'joined peers survive the five-second admission guard');

  const before = second.joined.snapshot.players.find(player => player.id === first.joined.snapshot.self);
  first.socket.send(JSON.stringify({type: 'input', seq: 1, roundId: 1, input: {z: 1, cameraYaw: 0}, afterEvent: 0}));
  const observed = [], times = [], ages = [];
  while (observed.length < 5) {
    const message = await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === first.joined.snapshot.self && player.lastSeq >= 1));
    observed.push(message.snapshot.players.find(player => player.id === first.joined.snapshot.self));
    times.push(Date.now());ages.push(Math.max(0,Date.now()-message.snapshot.time));
  }
  assert.ok(Math.hypot(observed.at(-1).x - before.x, observed.at(-1).z - before.z) > 0.1, 'authoritative fixed ticks move held input');
  assert.ok(times.slice(1).every((time, index) => time - times[index] < 150), 'snapshots arrive near the 20 Hz fixed cadence without HTTP requests');
  assert.equal(observed.at(-1).lastSeq, 1, 'snapshot acknowledges ordered input');

  first.socket.send(JSON.stringify({type: 'input', seq: 2, roundId: 1, input: {z: 0}, afterEvent: 0}));
  await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === first.joined.snapshot.self && player.lastSeq === 2));
  const stopA = await second.waitFor(message => message.type === 'snapshot');
  const stopB = await second.waitFor(message => message.type === 'snapshot' && message.snapshotSeq >= stopA.snapshotSeq + 2);
  const a = stopA.snapshot.players.find(player => player.id === first.joined.snapshot.self), b = stopB.snapshot.players.find(player => player.id === first.joined.snapshot.self);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.001, 'stop input does not coast between snapshots');

  first.socket.send(JSON.stringify({type: 'input', seq: 3, roundId: 1, input: {z: -1}, command: {type: 'fire', id: 1}, afterEvent: 0}));
  const reversed = await second.waitFor(message => message.type === 'snapshot' && message.snapshot.players.some(player => player.id === first.joined.snapshot.self && player.lastSeq === 3));
  assert.equal(reversed.snapshot.players.find(player => player.id === first.joined.snapshot.self).lastCommand, 1, 'move-and-fire command is deduplicated and acknowledged');

  // Relays may deliver a short backlog between owner ticks. Superseded movement
  // state must collapse to the newest sequence without disconnecting the peer.
  for(let seq=4;seq<64;seq++)first.socket.send(JSON.stringify({type:'input',seq,roundId:1,input:{z:1},afterEvent:0}));
  await new Promise(resolve=>setTimeout(resolve,10));
  for(let seq=64;seq<124;seq++)first.socket.send(JSON.stringify({type:'input',seq,roundId:1,input:{z:seq===123?0:1},afterEvent:0}));
  const backlog=await first.waitFor(message=>message.type==='snapshot'&&message.snapshot.players.some(player=>player.id===first.joined.snapshot.self&&player.lastSeq===123));
  assert.equal(first.socket.readyState,WebSocket.OPEN,'a relayed input backlog keeps the connection open');
  assert.equal(backlog.snapshot.players.find(player=>player.id===first.joined.snapshot.self).lastSeq,123,'the newest coalesced input sequence is acknowledged');

  const late=await connect('test:late',false,undefined);
  const latePlayer=late.joined.snapshot.players.find(player=>player.id===late.joined.snapshot.self);
  assert.equal(late.joined.snapshot.round.status,'active','a new player can enter an active match');
  assert.equal(latePlayer.roundId,late.joined.snapshot.round.id,'a late arrival participates in the current round');
  assert.ok(latePlayer.protectedUntil>=late.joined.snapshot.time+2900,'a late arrival receives bounded spawn protection');
  late.socket.send(JSON.stringify({type:'leave',requestId:33}));
  await late.waitFor(message=>message.type==='result'&&message.requestId===33);
  const lateReturned=await connect('test:late',false,undefined);
  assert.equal(lateReturned.joined.snapshot.round.status,'active','an explicit leaver can return while the match is active');
  assert.notEqual(lateReturned.joined.snapshot.self,late.joined.snapshot.self,'an explicit leave creates a fresh authenticated seat');
  lateReturned.socket.send(JSON.stringify({type:'leave',requestId:34}));
  await lateReturned.waitFor(message=>message.type==='result'&&message.requestId===34);

  const largeBlueprint={version:3,traits:{weapon:'pulse',armor:'medium',mass:'medium',emitter:[1.23456789,2.34567891,3.45678912]},name:'Large preserved creation',description:'A deliberately detailed valid creation used to verify the preserved Arena build packet boundary.',movement:'carry',ability:'pulse',palette:['#ffcf55','#16392e'],seat:[0.12345678,1.23456789,-0.98765432],joints:[],parts:Array.from({length:128},(_,index)=>({shape:'box',position:[(index%8)-4.12345678,Math.floor(index/16)+0.12345678,(index%16)-8.12345678],size:[1.12345678,.98765432,.87654321],rotation:[12.345678,23.456789,34.567891],color:index%2,joint:-1,studs:index%2===0}))};
  const largePacket={type:'input',seq:124,roundId:1,input:{z:0},command:{type:'build',id:2},blueprint:largeBlueprint,afterEvent:0};
  assert.ok(Buffer.byteLength(JSON.stringify(largePacket))>16_384,'valid creation exercises the expanded build-only packet allowance');
  first.socket.send(JSON.stringify(largePacket));
  const built=await second.waitFor(message=>message.type==='snapshot'&&message.snapshot.players.some(player=>player.id===first.joined.snapshot.self&&player.lastCommand===2));
  assert.equal(built.snapshot.players.find(player=>player.id===first.joined.snapshot.self).lastCommand,2,'large valid stored creation remains buildable over realtime');

  const runtime=app.authority.rooms.get('RT01');
  runtime.room.round.endsAt=Date.now();
  const finished=await second.waitFor(message=>message.type==='snapshot'&&message.snapshot.round.status==='finished');
  const originalIntermission=finished.snapshot.round.intermissionEndsAt;
  first.socket.send(JSON.stringify({type:'ready',requestId:30,roundId:finished.snapshot.round.id}));
  const firstReady=await first.waitFor(message=>message.type==='result'&&message.requestId===30);
  assert.equal(firstReady.snapshot.readiness.readyCount,1,'first Ready is acknowledged without starting the next round');
  assert.equal(firstReady.snapshot.round.intermissionEndsAt,originalIntermission,'one Ready keeps the automatic timeout');
  second.socket.send(JSON.stringify({type:'ready',requestId:31,roundId:finished.snapshot.round.id}));
  const allReady=await second.waitFor(message=>message.type==='result'&&message.requestId===31);
  assert.equal(allReady.snapshot.readiness.allReady,true,'Ready is authoritative across realtime peers');
  assert.ok(allReady.snapshot.round.intermissionEndsAt<=allReady.snapshot.time+3000,'all eligible peers shorten the remaining wait to at most three seconds');
  first.socket.send(JSON.stringify({type:'ready',requestId:32,roundId:finished.snapshot.round.id}));
  const duplicateReady=await first.waitFor(message=>message.type==='result'&&message.requestId===32);
  assert.equal(duplicateReady.snapshot.round.intermissionEndsAt,allReady.snapshot.round.intermissionEndsAt,'repeated Ready cannot lengthen or double-start the countdown');

  second.socket.close();
  await new Promise(resolve => second.socket.once('close', resolve));
  const resumed = await connect('test:second', false, {session: second.joined.session, token: second.joined.token});
  assert.equal(resumed.joined.session, second.joined.session);
  assert.equal(resumed.joined.snapshot.self, second.joined.snapshot.self);
  assert.equal(resumed.joined.snapshot.players.length, 2, 'reconnect receives a full authoritative snapshot');

  await assert.rejects(arenaStore(local.db).mutate('RT01', room => room), error => error.status === 409, 'HTTP authority cannot mutate a live realtime-v1 room');
  resumed.socket.send(JSON.stringify({type: 'leave', requestId: 4}));
  await resumed.waitFor(message => message.type === 'result' && message.requestId === 4);
  const returned=await connect('test:second',false,undefined);
  assert.equal(returned.joined.snapshot.round.status,'finished','an explicit leaver can also return during intermission');
  assert.notEqual(returned.joined.snapshot.self,second.joined.snapshot.self,'an explicit leave creates a fresh authenticated seat');
  returned.socket.send(JSON.stringify({type:'leave',requestId:6}));
  await returned.waitFor(message=>message.type==='result'&&message.requestId===6);
  first.socket.send(JSON.stringify({type: 'leave', requestId: 5}));
  await first.waitFor(message => message.type === 'result' && message.requestId === 5);

  const four=[];
  for(let i=0;i<4;i++)four.push(await connect(`test:four:${i}`,i===0,undefined,'RT04'));
  const fanout=await four[3].waitFor(message=>message.type==='snapshot'&&message.snapshot.players.length===4);
  assert.equal(fanout.snapshot.players.length,4,'four connected clients share one authoritative room and fanout');
  for(let i=0;i<four.length;i++){four[i].socket.send(JSON.stringify({type:'leave',requestId:20+i}));await four[i].waitFor(message=>message.type==='result'&&message.requestId===20+i);}
  const intervals=times.slice(1).map((time,index)=>time-times[index]);
  console.log(JSON.stringify({transport:'realtime-v1',authorityHz:20,snapshotIntervalsMs:intervals,snapshotAgeMs:ages,maxSnapshotAgeMs:Math.max(...ages),idempotentFirstJoin:true,largeCreationPacket:true,roundReady:true,reconnectFullSync:true,fourClientFanout:true},null,2));
  console.log('Realtime Arena: two-client 20 Hz movement/reconnect smoke plus four-client join/fanout/cleanup passed.');
} finally {
  await app.close();
  local.close();
}
