const http = require('http');
const https = require('https');
const { URL } = require('url');

// In-memory cache: Map preserves insertion order so we can implement a simple LRU
function createProxy({ port = 3128, ttlSeconds = 60, maxEntries = 100 } = {}) {
  const cache = new Map();

  function pruneIfNeeded() {
    while (cache.size > maxEntries) {
      // delete oldest entry (first key)
      const firstKey = cache.keys().next().value;
      if (!firstKey) break;
      cache.delete(firstKey);
    }
  }

  function getCached(url) {
    const entry = cache.get(url);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(url);
      return null;
    }
    // update LRU: move to end
    cache.delete(url);
    cache.set(url, entry);
    return entry;
  }

  function setCached(url, item) {
    cache.set(url, item);
    pruneIfNeeded();
  }

  const server = http.createServer((clientReq, clientRes) => {
    // Only handle absolute-form requests (typical for HTTP proxies): clientReq.url is full URL
    // If it's origin-form (no scheme/host), attempt to reconstruct using Host header
    let target;
    try {
      target = new URL(clientReq.url);
    } catch (err) {
      // try to build using Host header
      const host = clientReq.headers['host'];
      if (!host) {
        clientRes.writeHead(400);
        return clientRes.end('Bad request: no host');
      }
      const scheme = 'http:';
      target = new URL(`${scheme}//${host}${clientReq.url}`);
    }

    const cacheKey = target.toString();
    if (clientReq.method === 'GET') {
      const cached = getCached(cacheKey);
      if (cached) {
        // serve from cache
        clientRes.writeHead(cached.statusCode, cached.headers);
        return clientRes.end(cached.body);
      }
    }

    const lib = target.protocol === 'https:' ? https : http;
    const options = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: clientReq.method,
      headers: { ...clientReq.headers }
    };

    // Remove proxy-specific headers that might confuse origin
    delete options.headers['proxy-connection'];
    delete options.headers['proxy-authorization'];

    const upstream = lib.request(options, (upRes) => {
      const chunks = [];
      upRes.on('data', (chunk) => chunks.push(chunk));
      upRes.on('end', () => {
        const body = Buffer.concat(chunks);
        // Forward response headers and status
        const headers = { ...upRes.headers };
        clientRes.writeHead(upRes.statusCode, headers);
        clientRes.end(body);

        // Cache GET 200 responses (simple policy)
        if (clientReq.method === 'GET' && upRes.statusCode === 200) {
          const expiresAt = Date.now() + ttlSeconds * 1000;
          setCached(cacheKey, { statusCode: upRes.statusCode, headers, body, expiresAt });
        }
      });
    });

    upstream.on('error', (err) => {
      clientRes.writeHead(502);
      clientRes.end(`Bad gateway: ${err.message}`);
    });

    // pipe request body for e.g., POST (we don't cache non-GET anyway)
    clientReq.pipe(upstream);
  });

  return {
    start: () => new Promise((resolve) => server.listen(port, resolve)),
    close: () => new Promise((resolve) => server.close(resolve)),
    server,
    _cache: cache // exported for testing/inspection
  };
}

if (require.main === module) {
  const p = createProxy();
  p.start().then(() => console.log(`Proxy listening on port 3128`));
}

module.exports = { createProxy };
