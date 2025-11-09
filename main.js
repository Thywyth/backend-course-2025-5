const http = require('http');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { Command } = require('commander');
const superagent = require('superagent');

const program = new Command();
program
  .requiredOption('-h, --host <address>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port', parseInt)
  .requiredOption('-c, --cache <path>', 'Cache directory path');

try {
  program.parse(process.argv);
} catch (error) {
  console.error('Error parsing arguments:', error.message);
  process.exit(1);
}

const options = program.opts();
const CACHE_DIR = options.cache;

if (!fs.existsSync(CACHE_DIR)) {
  console.log(`Cache directory not found. Creating: ${CACHE_DIR}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const server = http.createServer(async (req, res) => {
  res.writeHead(501);
  res.end('Server is running, but method not implemented.');
});

server.listen(options.port, options.host, () => {
  console.log(`Server started at http://${options.host}:${options.port}`);
  console.log(`Caching files in: ${CACHE_DIR}`);
});