import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker/index.js';

const entrypoint = fs.readFileSync(new URL('../api/handler.js', import.meta.url), 'utf8');
assert.match(entrypoint, /worker:\s*productionWorker/);
assert.doesNotMatch(entrypoint, /createGatewayWorker|server\/ai-gateway/);

const directKey = 'test-only-direct-openai-key';
const staleGatewayKey = 'test-only-stale-gateway-key';
const originalFetch = globalThis.fetch;
let calls = 0;

try {
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/models/gpt-5.4');
    assert.equal(init.headers.Authorization, `Bearer ${directKey}`);
    assert.doesNotMatch(init.headers.Authorization, /gateway/i);
    return Response.json({id: 'gpt-5.4'});
  };

  const response = await worker.fetch(
    new Request('https://game.test/api/generation-status?verify=1'),
    {
      OPENAI_API_KEY: directKey,
      OPENAI_MODEL: 'gpt-5.4',
      AI_GATEWAY_API_KEY: staleGatewayKey,
      AI_GATEWAY_MODEL: 'openai/ignored-model',
    },
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    configured: true,
    reachable: true,
    model: 'gpt-5.4',
    code: 'ready',
    upstreamStatus: 200,
  });
  assert.equal(calls, 1);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('PASS Vercel production uses OPENAI_API_KEY directly and ignores legacy AI Gateway settings.');
