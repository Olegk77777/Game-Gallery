import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { GalleryStore, AppError } from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
async function body(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new AppError('Файл слишком большой. Максимум — 64 МБ.', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function createManager({ root = path.dirname(HERE), port = 4318, storeOptions = {} } = {}) {
  const store = await new GalleryStore(root, storeOptions).init();
  const token = randomBytes(32).toString('hex');
  let origin;
  const server = http.createServer(async (req, res) => {
    const respond = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      if (req.headers.host !== new URL(origin).host) throw new AppError('Недопустимый адрес подключения.', 403);
      if (req.headers.origin && req.headers.origin !== origin) throw new AppError('Запрос из другого приложения отклонён.', 403);
      const url = new URL(req.url, origin), route = url.pathname;
      if (req.method === 'GET' && route === '/health') return respond(200, { app: 'game-gallery-album-manager', root });
      if (route.startsWith('/api/') && req.headers['x-manager-token'] !== token) throw new AppError('Обновите окно менеджера, чтобы продолжить.', 403);
      if (req.method === 'GET' && route === '/api/library') return respond(200, { albums: await store.list(), status: await store.status() });
      if (req.method === 'GET' && route === '/api/status') return respond(200, await store.status());
      if (req.method === 'GET' && route === '/api/trash') return respond(200, await store.trash());
      if (req.method === 'POST' && route === '/api/upload') {
        const data = await body(req, 64 * 1024 * 1024);
        return respond(200, await store.upload(url.searchParams.get('album'), url.searchParams.get('name'), data));
      }
      if (req.method === 'POST' && route.startsWith('/api/')) {
        let data;
        try { data = JSON.parse((await body(req, 24000)).toString()); } catch (error) { if (error instanceof AppError) throw error; throw new AppError('Не удалось прочитать запрос.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Некорректный запрос.');
        const actions = {
          '/api/albums': () => store.createAlbum(data),
          '/api/metadata': () => store.updateMetadata(data),
          '/api/caption': () => store.caption(data),
          '/api/delete': () => store.removeShots(data),
          '/api/restore': () => store.restore(data.id),
          '/api/settings': () => store.settings(data),
          '/api/publish': () => store.publish(),
          '/api/deployment': () => store.checkDeployment(),
          '/api/quit': async () => {
            if (store.busy || store.state.pending.length || store.state.outgoing) throw new AppError('Сначала завершите публикацию. Чтобы оставить изменения на потом, можно закрыть вкладку.');
            setTimeout(() => { store.close(); server.close(); server.closeIdleConnections(); }, 150);
            return { ok: true };
          },
        };
        if (!actions[route]) throw new AppError('Действие не найдено.', 404);
        return respond(200, await actions[route]());
      }
      if (req.method === 'GET' && route === '/media') {
        const media = await store.media(url.searchParams.get('album'), url.searchParams.get('name'), url.searchParams.get('full') === '1');
        res.writeHead(200, { 'Content-Type': media.type, 'Cache-Control': 'private, max-age=86400' });
        const stream = createReadStream(media.file); stream.on('error', () => res.destroy()); stream.pipe(res); return;
      }
      const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
      if (req.method === 'GET' && assets[route]) {
        const [file, type] = assets[route];
        let content = await fs.readFile(path.join(HERE, 'ui', file));
        if (route === '/') content = content.toString().replace('__MANAGER_TOKEN__', token);
        res.writeHead(200, { 'Content-Type': type }); res.end(content); return;
      }
      throw new AppError('Страница не найдена.', 404);
    } catch (error) {
      if (!res.headersSent) respond(error.status || 500, { error: error.status ? error.message : 'Не удалось выполнить операцию. ' + error.message });
      else res.destroy();
    }
  });
  server.requestTimeout = 120000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  server.on('close', () => store.close());
  return { server, store, origin, token };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createManager({ port: Number(process.env.ALBUM_MANAGER_PORT) || 4318 }).then(({ origin }) => {
    console.log(`Game Gallery Studio: ${origin}`);
  }).catch(error => { console.error('Не удалось запустить менеджер:', error.message); process.exitCode = 1; });
}
