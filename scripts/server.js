/* 本地预览用的静态服务器，够用就行，不打算做成通用服务器。
   处理四件事，剥掉 basePath 前缀、把目录请求补成 index.html、找不到就回 404.html、
   HEAD 只回头不回体。路径解析完必须落在 root 里，越界一律 403。 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

export function serve({ directory, port = 5502, host = '127.0.0.1', basePath = '/' }) {
  const root = path.resolve(directory);
  const server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
      }
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
        response.writeHead(302, { Location: basePath });
        response.end();
        return;
      }
      if (!pathname.startsWith(basePath)) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      pathname = pathname.slice(basePath.length);
      let file = path.resolve(root, pathname || 'index.html');
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403);
        response.end();
        return;
      }
      if ((await fs.stat(file).catch(() => null))?.isDirectory())
        file = path.join(file, 'index.html');
      let content;
      let status = 200;
      try {
        content = await fs.readFile(file);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        status = 404;
        file = path.join(root, '404.html');
        content = await fs.readFile(file).catch(() => Buffer.from('Not found'));
      }
      response.writeHead(status, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500);
      response.end('Unable to serve this request');
    }
  });
  server.on('error', (error) => {
    console.error(`Preview server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(Number(port), host, () =>
    console.log(`QxBlog → http://${host}:${port}${basePath}`),
  );
  return server;
}
