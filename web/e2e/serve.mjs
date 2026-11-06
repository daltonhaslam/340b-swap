// A static server for docs/, with the CSP from vercel.json, so tests see what Vercel would serve.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../docs/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain' };
const vercel = JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8'));
const headers = Object.fromEntries(vercel.headers[0].headers.map((x) => [x.key, x.value]));

export function serve(port = 0) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Vercel serves its analytics script at this path in production; stand in with an empty script.
    if (p === '/_vercel/insights/script.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', ...headers }); res.end(''); return; }
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headers });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}
