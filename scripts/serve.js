import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname} from 'node:path';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'};
const port = Number(process.env.WORD_INSPECTOR_PORT || 8765);
createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405).end(); return;}
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!filename.startsWith(root)) {res.writeHead(403).end(); return;}
    const content = await readFile(filename);
    res.writeHead(200, {'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"});
    res.end(req.method === 'HEAD' ? '' : content);
  } catch {res.writeHead(404).end('Not found');}
}).listen(port, '127.0.0.1', () => console.log('Word Sharing Inspector: http://127.0.0.1:' + port));
