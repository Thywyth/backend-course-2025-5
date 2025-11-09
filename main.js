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

  const httpCode = req.url.slice(1);
  if (!httpCode || !/^\d+$/.test(httpCode)) {
    res.writeHead(400);
    res.end('Invalid HTTP status code in URL');
    return;
  }

  const filePath = path.join(CACHE_DIR, `${httpCode}.jpeg`);

  switch (req.method) {
    case 'GET':
      try {
        const data = await fsPromises.readFile(filePath);

        console.log(`[CACHE HIT] Serving ${httpCode}.jpeg from cache`);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);

      } catch (err) {
        console.log(`[CACHE MISS] ${httpCode}.jpeg not found. Fetching from http.cat...`);

        try {
          const response = await superagent.get(`https://http.cat/${httpCode}`);

          await fsPromises.writeFile(filePath, response.body);
          console.log(`[CACHE WRITE] Saved ${httpCode}.jpeg to cache`);

          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(response.body);

        } catch (proxyErr) {
          console.error(`[PROXY FAIL] Failed to fetch ${httpCode} from http.cat`);
          res.writeHead(proxyErr.status || 500);
          res.end(`Failed to fetch image. Origin server responded with: ${proxyErr.status}`);
        }
      }
      break;

    case 'PUT':
      try {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));

        req.on('end', async () => {
          const body = Buffer.concat(chunks);

          await fsPromises.writeFile(filePath, body);

          res.writeHead(201);
          res.end('Created/Updated in cache');
        });

      } catch (err) {
        res.writeHead(500);
        res.end('Server error while writing to cache');
      }
      break;
      case 'DELETE':
      try {
        await fsPromises.unlink(filePath);
        res.writeHead(200);
        res.end('OK, deleted from cache');
      } catch (err) {
        res.writeHead(404);
        res.end('Not Found in cache');
      }
      break;

    default:
      res.writeHead(405);
      res.end('Method Not Allowed');
      break;
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Server started at http://${options.host}:${options.port}`);
  console.log(`Caching files in: ${CACHE_DIR}`);
});