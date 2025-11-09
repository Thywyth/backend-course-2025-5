const http = require('http');
const fs = require('fs'); // Для mkdirSync
const fsPromises = require('fs').promises; // Для асинхронних операцій [cite: 45]
const path = require('path');
const { Command } = require('commander');
const superagent = require('superagent'); // [cite: 61]

// 1. Налаштування Commander [cite: 35, 36, 37]
const program = new Command();
program
  .requiredOption('-h, --host <address>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port', parseInt)
  .requiredOption('-c, --cache <path>', 'Cache directory path');

// 2. Парсинг аргументів
try {
  program.parse(process.argv);
} catch (error) {
  console.error('Error parsing arguments:', error.message);
  process.exit(1);
}

const options = program.opts();
const CACHE_DIR = options.cache;

// 3. Створюємо папку для кешу, якщо її не існує 
if (!fs.existsSync(CACHE_DIR)) {
  console.log(`Cache directory not found. Creating: ${CACHE_DIR}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 4. Створення HTTP-сервера [cite: 40]
const server = http.createServer(async (req, res) => {
  
  // Отримуємо код з URL, наприклад /200 -> 200
  const httpCode = req.url.slice(1);
  if (!httpCode || !/^\d+$/.test(httpCode)) {
    res.writeHead(400); // Bad Request
    res.end('Invalid HTTP status code in URL');
    return;
  }

  // Формуємо шлях до файлу в кеші
  const filePath = path.join(CACHE_DIR, `${httpCode}.jpeg`);

  // 5. Обробка методів [cite: 47]
  switch (req.method) {
    
    case 'GET': // [cite: 48]
      try {
        // 1. Спробували прочитати з кешу
        const data = await fsPromises.readFile(filePath);
        
        console.log(`[CACHE HIT] Serving ${httpCode}.jpeg from cache`);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' }); // [cite: 53, 54]
        res.end(data);
      
      } catch (err) {
        // 2. Помилка - файлу в кеші немає [cite: 59]
        console.log(`[CACHE MISS] ${httpCode}.jpeg not found. Fetching from http.cat...`);

        // 3. Робимо запит на http.cat [cite: 61, 62]
        try {
          const response = await superagent.get(`https://http.cat/${httpCode}`);

          // 4. Зберігаємо картинку в кеш [cite: 64]
          await fsPromises.writeFile(filePath, response.body);
          console.log(`[CACHE WRITE] Saved ${httpCode}.jpeg to cache`);

          // 5. Віддаємо картинку клієнту
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(response.body);

        } catch (proxyErr) {
          // 6. Якщо http.cat повернув помилку (наприклад, 404) [cite: 63]
          console.error(`[PROXY FAIL] Failed to fetch ${httpCode} from http.cat. Status: ${proxyErr.status}`);
          res.writeHead(proxyErr.status || 500);
          res.end(`Failed to fetch image. Origin server responded with: ${proxyErr.status}`);
        }
      }
      break;

    case 'PUT': // [cite: 49]
      try {
        // PUT передає картинку в тілі запиту. Нам потрібно її "зібрати".
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        
        req.on('end', async () => {
          const body = Buffer.concat(chunks);
          
          // Записуємо тіло запиту (картинку) у файл [cite: 45, 50]
          await fsPromises.writeFile(filePath, body);
          
          console.log(`[CACHE WRITE] Saved ${httpCode}.jpeg to cache via PUT`);
          res.writeHead(201); // [cite: 53]
          res.end('Created/Updated in cache');
        });

      } catch (err) {
        console.error(`[PUT FAIL] ${err.message}`);
        res.writeHead(500);
        res.end('Server error while writing to cache');
      }
      break;
    
    case 'DELETE': // [cite: 50]
      try {
        // Видаляємо файл з кешу
        await fsPromises.unlink(filePath);
        
        console.log(`[CACHE DELETE] Deleted ${httpCode}.jpeg from cache`);
        res.writeHead(200); // [cite: 53]
        res.end('OK, deleted from cache');
      } catch (err) {
        // Якщо помилка (немає файлу)
        console.log(`[DELETE FAIL] ${httpCode}.jpeg not in cache`);
        res.writeHead(404); // [cite: 51]
        res.end('Not Found in cache');
      }
      break;

    default:
      res.writeHead(405); // [cite: 50]
      res.end('Method Not Allowed');
      break;
  }
});

// 5. Запуск сервера
server.listen(options.port, options.host, () => {
  console.log(`Server started at http://${options.host}:${options.port}`);
  console.log(`Caching files in: ${CACHE_DIR}`);
});