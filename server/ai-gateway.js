import {Buffer} from 'node:buffer';
import {handleAPI} from '../worker/index.js';
import {handleTranscription, transcriptionStatus} from '../worker/transcription-api.js';

const BASE = 'https://ai-gateway.vercel.sh';
const modelId = value => value.startsWith('openai/') ? value : `openai/${value}`;
const json = value => Response.json(value, {headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});

// Vercel-only adapter. The shared Sites worker keeps its direct OpenAI transport.
// Credentials and destinations are exclusively server controlled; no fallback or retries.
export function createGatewayWorker(worker, {fetchImpl = fetch} = {}) {
  return {async fetch(request, env, ctx) {
    if (!env.AI_GATEWAY_API_KEY) return worker.fetch(request, env, ctx);
    const path = new URL(request.url).pathname;
    if (!['/api/generate', '/api/generation-status', '/api/transcribe', '/api/transcription-status'].includes(path)) return worker.fetch(request, env, ctx);
    const generationModel = modelId(env.AI_GATEWAY_MODEL || env.OPENAI_MODEL || 'gpt-5.4');
    const transcriptionModel = modelId(env.AI_GATEWAY_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
    // Retain the shared worker's validated OpenAI model semantics and reasoning selection.
    const adapted = {...env, OPENAI_API_KEY: env.AI_GATEWAY_API_KEY,
      OPENAI_MODEL: generationModel.replace(/^openai\//, ''),
      OPENAI_TRANSCRIPTION_MODEL: 'gpt-4o-mini-transcribe'};
    const headers = {'Authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`};
    const upstream = async (url, init) => {
      if (url === 'https://api.openai.com/v1/responses') {
        const body = JSON.parse(init.body);
        return fetchImpl(`${BASE}/v1/responses`, {...init, redirect: 'error',
          headers: {...headers, 'Content-Type': 'application/json'},
          body: JSON.stringify({...body, model: generationModel})});
      }
      if (url === 'https://api.openai.com/v1/audio/transcriptions') {
        const file = init.body.get('file');
        const audio = Buffer.from(await file.arrayBuffer()).toString('base64');
        init.signal?.throwIfAborted();
        return fetchImpl(`${BASE}/v4/ai/transcription-model`, {...init, redirect: 'error',
          headers: {...headers, 'Content-Type': 'application/json',
            'ai-gateway-protocol-version': '0.0.1', 'ai-transcription-model-specification-version': '4',
            'ai-model-id': transcriptionModel},
          body: JSON.stringify({audio, mediaType: file.type})});
      }
      throw new Error('Unsupported AI transport request');
    };
    if (path === '/api/transcription-status') return transcriptionStatus(request, adapted);
    if (path === '/api/transcribe') return handleTranscription(request, adapted, upstream);
    if (path === '/api/generation-status' && request.method === 'GET') {
      if (new URL(request.url).searchParams.get('verify') !== '1') return json({configured: true});
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
      const result = {configured: true, reachable: false, model: generationModel, provider: 'vercel-ai-gateway'};
      try {
        // Catalog alone is public and cannot establish authentication. Never expose balances.
        const auth = await fetchImpl(`${BASE}/v1/credits`, {headers, signal: controller.signal, redirect: 'error'});
        const status = auth.status;
        await auth.body?.cancel();
        if (!auth.ok) return json({...result, upstreamStatus: status, code: status === 401 ? 'invalid_key' : status === 403 ? 'access_denied' : 'upstream_error'});
        const catalog = await fetchImpl(`${BASE}/v1/models`, {headers, signal: controller.signal, redirect: 'error'});
        if (!catalog.ok) { await catalog.body?.cancel(); return json({...result, code: 'upstream_error', upstreamStatus: catalog.status}); }
        const data = await catalog.json();
        const listed = Array.isArray(data.data) && data.data.some(model => model.id === generationModel);
        return json({...result, reachable: listed, code: listed ? 'ready' : 'model_unavailable', upstreamStatus: listed ? 200 : 404, inferenceVerified: false});
      } catch { return json({...result, code: 'connection_timeout'}); }
      finally { clearTimeout(timer); }
    }
    return handleAPI(request, adapted, upstream);
  }};
}
