import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, 'dist');
const port = Number(process.env.PORT || 4180);
const url = `http://127.0.0.1:${port}/`;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
function openBrowser() {
  const args = process.platform === 'win32' ? ['cmd.exe', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(args[0], args[1], { windowsHide: true, stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}
const server = http.createServer((req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, url).pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    http.get(url, response => {
      let body = ''; response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (/\<title\>(Vision studio|Machine Vision Studio)/.test(body)) { console.log(`Machine Vision Studio is already running: ${url}`); if (process.argv.includes('--open')) openBrowser(); }
        else { console.error(`Port ${port} is in use. Set PORT to another number.`); process.exitCode = 1; }
      });
    }).on('error', () => { console.error(`Port ${port} is unavailable.`); process.exitCode = 1; });
  } else { console.error(error.message); process.exitCode = 1; }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Machine Vision Studio: ${url}`);
  if (process.argv.includes('--open')) openBrowser();
});
