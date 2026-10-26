// Máy chủ tĩnh để chạy thử: /KH/* -> thư mục repo, /acc.js -> mock-acc.js (nối Firebase Emulator)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = +process.env.PORT || 8000;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = p === '/acc.js' ? path.join(__dirname, 'mock-acc.js') : p.startsWith('/KH/') ? path.join(ROOT, p.slice(4) || 'index.html') : null;
  if (f && f.endsWith('/')) f += 'index.html';
  if (!f || !f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('http://127.0.0.1:' + PORT + '/KH/'));
