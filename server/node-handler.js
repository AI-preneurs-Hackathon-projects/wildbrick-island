const MAX_TRANSPORT_BODY = 4 * 1024 * 1024;

// Vercel replays unsupported MIME bodies through data/end events while the
// original IncomingMessage's native readable state is already exhausted.
function requestBody(req) {
  let cleanup;
  return new ReadableStream({
    start(controller) {
      let bytes = 0, active = true;
      cleanup = () => {
        active = false;
        req.removeListener('data', data);
        req.removeListener('end', end);
        req.removeListener('error', error);
        req.removeListener('aborted', aborted);
      };
      const error = reason => { if (!active) return; cleanup(); controller.error(reason); };
      const aborted = () => error(new Error('Request aborted'));
      const data = chunk => {
        if (!active) return;
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += value.length;
        if (bytes > MAX_TRANSPORT_BODY) { error(new Error('Request body too large')); return; }
        controller.enqueue(value);
      };
      const end = () => { if (!active) return; cleanup(); controller.close(); };
      req.on('data', data);
      req.on('end', end);
      req.on('error', error);
      req.on('aborted', aborted);
      if (req.aborted) aborted();
    },
    cancel() { cleanup?.(); },
  });
}

// Propagate downstream disconnects through the Fetch boundary to paid requests.
export function createNodeHandler(handle, {waitUntil = () => {}} = {}) {
 return async function handler(req, res) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const disconnected = () => { if (!res.writableEnded) abort(); };
  req.once("aborted", abort);
  res.once("close", disconnected);
  if (req.aborted || res.destroyed) abort();
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    // Vercel routes this function by Host; do not trust a client forwarded-host override.
    const host = headers.get('host');
    if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host)) { res.statusCode = 400; res.end(); return; }
    const init = {method: req.method, headers, signal: controller.signal};
    if (!['GET', 'HEAD'].includes(req.method)) {
      init.body = req.body === undefined ? requestBody(req) : (Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      init.duplex = 'half';
    }
    const routed = new URL(req.url, `https://${host}`);
    const route = routed.searchParams.get('route') || '';
    // Vercel may preserve the original pathname while appending rewrite params.
    if (routed.pathname === '/api/handler' || (route && routed.pathname === '/api/' + route)) {
      routed.pathname = '/api/' + route;
      routed.searchParams.delete('route');
    }
    if (routed.searchParams.get('path') === routed.pathname.slice('/api/'.length)) routed.searchParams.delete('path');
    const response = await handle(new Request(routed, init), {waitUntil});
    if (res.destroyed) { await response.body?.cancel(); return; }
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (res.destroyed) return;
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({error: 'Arena service is temporarily unavailable.', code: 'unavailable'}));
  }
  finally {
    req.removeListener("aborted", abort);
    res.removeListener("close", disconnected);
  }
 };
}
