import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
for(const path of ['/__voice','/validation/voice-harness.html','/scripts/check-voice.mjs','/worker/transcription-api.js'])assert.equal((await worker.fetch(new Request('https://brickwild.test'+path),{},{})).status,404);
assert.equal((await worker.fetch(new Request('https://brickwild.test/api/transcribe',{method:'POST'}),{},{})).status,401);
assert.doesNotMatch(fs.readFileSync('dist/server/index.js','utf8'),/SyntheticRecorder|Voice review · no upload|synthetic-key/);
console.log('PASS packaged transcription auth and development voice harness/test exclusion');
