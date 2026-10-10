// Local production preview: serves dist/ and runs api/lead.js like Vercel would.
// Usage: npm run build && npm run preview  (PORT=4321 by default)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import handler from '../api/lead.js';

const root = new URL('../dist/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4321);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };

async function file(path) {
  try { const s = await stat(path); if (s.isDirectory()) return file(join(path, 'index.html')); return await readFile(path); } catch { return null; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/lead') return handler(req, res);
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let p = join(root, safe);
  let body = await file(p);
  if (!body && !extname(p)) body = await file(p + '.html');
  if (!body) {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    return res.end(await file(join(root, '404.html')));
  }
  const ext = extname(p) || '.html';
  res.writeHead(200, { 'Content-Type': types[ext] || (body && !extname(p) ? types['.html'] : 'application/octet-stream'), 'X-Robots-Tag': 'noindex' });
  res.end(body);
}).listen(port, () => console.log(`preview on http://localhost:${port}`));
