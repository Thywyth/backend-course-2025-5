const assert = require('assert');
const http = require('http');
const { createOrigin } = require('../origin');
const { createProxy } = require('../proxy');

async function run() {
  const origin = createOrigin({ port: 9000 });
  await origin.start();
  console.log('Origin started on 9000');

  const proxy = createProxy({ port: 9128, ttlSeconds: 3, maxEntries: 50 });
  await proxy.start();
  console.log('Proxy started on 9128');

  // Helper to make a request through proxy to the origin
  function proxyGet(path) {
    return new Promise((resolve, reject) => {
      // full URL as required by proxy absolute-form
      const url = `http://localhost:9000${path}`;
      const options = {
        host: 'localhost',
        port: 9128,
        method: 'GET',
        path: url,
        headers: {
          Host: 'localhost:9000'
        }
      };
      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  // First request - should come from origin
  const r1 = await proxyGet('/');
  console.log('First response:', r1.body);
  assert.strictEqual(r1.statusCode, 200);
  assert.ok(r1.body.startsWith('origin-time:'), 'unexpected origin body');

  // Second request immediately - should be served from cache (same body)
  const r2 = await proxyGet('/');
  console.log('Second response:', r2.body);
  assert.strictEqual(r2.statusCode, 200);
  assert.strictEqual(r2.body, r1.body, 'Second response should be identical (from cache)');

  // Wait for TTL to expire
  await new Promise((res) => setTimeout(res, 3500));

  const r3 = await proxyGet('/');
  console.log('Third response after TTL:', r3.body);
  assert.strictEqual(r3.statusCode, 200);
  assert.notStrictEqual(r3.body, r1.body, 'After TTL, body should be refreshed from origin');

  // Cleanup
  await proxy.close();
  await origin.close();
  console.log('All servers stopped. Tests passed.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
