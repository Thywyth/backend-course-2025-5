const http = require('http');

function createOrigin({ port = 8000 } = {}) {
  const server = http.createServer((req, res) => {
    // Return a body that includes a timestamp so we can tell if cache served
    const now = Date.now();
    res.setHeader('content-type', 'text/plain');
    res.end(`origin-time:${now}`);
  });

  return {
    start: () => new Promise((resolve) => server.listen(port, resolve)),
    close: () => new Promise((resolve) => server.close(resolve)),
    port,
    server
  };
}

if (require.main === module) {
  const o = createOrigin();
  o.start().then(() => console.log(`Origin server listening on port ${o.port}`));
}

module.exports = { createOrigin };
