# Primitive Caching HTTP Proxy (Lab)

This small project implements a primitive HTTP caching proxy using Node's `http`/`https` modules, plus a tiny origin server and an automated test to verify caching behavior.

Files:
- `proxy.js` - the proxy implementation. Exports `createProxy()` and can be run directly.
- `origin.js` - a simple origin server that responds with `origin-time:<timestamp>`.
- `test/test_proxy.js` - test script that starts origin and proxy, checks cached responses and TTL expiry.
- `package.json` - run scripts.

How to run the test (Windows PowerShell):

```powershell
npm install
npm test
```

What the test does:
- Starts an origin server on port 9000.
- Starts the proxy on port 9128 with TTL=3s.
- Sends a GET through the proxy to the origin; first response is from origin.
- Sends the same GET immediately; second response must be identical (served from cache).
- Waits > TTL and requests again; third response must differ (origin refreshed).

Assumptions and notes:
- The proxy caches only GET responses with status 200.
- TTL is a simple fixed duration (configurable when creating the proxy).
- The cache is in-memory and uses a simple LRU eviction when `maxEntries` exceeded.
- This is a learning/demo implementation and not production-ready.

Next steps (optional):
- Honor Cache-Control headers from origin.
- Support CONNECT method for HTTPS tunneling.
- Persist cache to disk.
