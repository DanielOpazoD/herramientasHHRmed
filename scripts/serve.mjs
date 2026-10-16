import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const port = Number(process.env.PORT ?? 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'),
      file = resolve(
        root,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
      );
    if (file !== root && !file.startsWith(root + sep)) throw new Error();
    if (file.split(sep).some((part) => part.startsWith('.'))) throw new Error();
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log('HHR: http://127.0.0.1:' + port));
