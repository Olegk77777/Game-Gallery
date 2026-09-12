import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import sharp from 'sharp';
import { GalleryStore, run, META } from '../store.mjs';
import { createManager } from '../server.mjs';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-manager-test-'));
  const root = path.join(dir, 'project'), remote = path.join(dir, 'origin.git');
  await fs.mkdir(path.join(root, 'public/gallery/Test Album'), { recursive: true });
  await fs.mkdir(path.join(root, 'src/data'), { recursive: true });
  const image = await sharp({ create: { width: 128, height: 54, channels: 3, background: '#365444' } }).jpeg().toBuffer();
  await fs.writeFile(path.join(root, 'public/gallery/Test Album/original.jpg'), image);
  await fs.writeFile(path.join(root, 'public/gallery/Test Album/original.txt'), 'Original caption.\n');
  await fs.writeFile(path.join(root, META), '{}\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.album-manager/\n');
  await fs.writeFile(path.join(root, 'unrelated.txt'), 'original\n');
  const git = (args, options = {}) => run('git', args, { cwd: root, ...options });
  await git(['init', '-b', 'main']);
  await git(['config', 'user.name', 'Manager Test']); await git(['config', 'user.email', 'test@example.invalid']);
  await git(['add', '.']); await git(['commit', '-m', 'Initial fixture']);
  await run('git', ['init', '--bare', remote]); await git(['remote', 'add', 'origin', remote]); await git(['push', '-u', 'origin', 'main']);
  const store = await new GalleryStore(root, { allowTestRemote: true }).init();
  await store.settings({ autoPublish: false });
  t.after(async () => { store.close(); await fs.rm(dir, { recursive: true, force: true }); });
  return { root, remote, dir, store, git, image };
}

test('Альбомы, кириллица, подписи, обложка, коллизия основ имён и восстановление', async t => {
  const { store, image, root } = await fixture(t);
  await store.createAlbum({ name: 'Новый альбом', place: 'Ночной город' });
  const first = await store.upload('Новый альбом', 'Кадр #1.jpg', image);
  assert.equal(first.width, 128);
  const png = await sharp(image).png().toBuffer();
  const second = await store.upload('Новый альбом', 'Кадр #1.png', png);
  assert.equal(second.name, 'Кадр #1 (2).png');
  let album = (await store.list()).find(a => a.name === 'Новый альбом');
  const shot = album.shots.find(s => s.name === first.name);
  await store.caption({ album: album.name, name: shot.name, revision: shot.revision, caption: 'Свет в пустом окне.\nВторая строка.' });
  await assert.rejects(store.caption({ album: album.name, name: shot.name, revision: shot.revision, caption: 'Stale edit' }), /другом окне/);
  await store.updateMetadata({ ...album, album: album.name, revision: album.metaRevision, cover: first.name, title: 'Новый', full: 'Новый альбом', year: 2026 });
  album = (await store.list()).find(a => a.name === album.name);
  assert.equal(album.cover, first.name);
  assert.equal(album.shots.find(s => s.name === first.name).caption, 'Свет в пустом окне.\nВторая строка.');
  const removed = await store.removeShots({ album: album.name, names: [first.name] });
  assert.equal((await store.list()).find(a => a.name === album.name).shots.length, 1);
  await assert.rejects(fs.readFile(path.join(root, `public/gallery/${album.name}/Кадр #1.txt`)), { code: 'ENOENT' });
  assert.equal((await store.trash()).length, 1);
  await store.restore(removed.id);
  assert.equal((await store.list()).find(a => a.name === album.name).shots.length, 2);
  assert.equal((await store.trash()).length, 0);
  await assert.rejects(store.restore(removed.id), /уже восстановлены/);
});

test('Настоящий push в изолированный репозиторий; чужие staged и unstaged файлы не уходят', async t => {
  const { store, git, root, remote, image } = await fixture(t);
  await fs.writeFile(path.join(root, 'unrelated.txt'), 'user staged\n'); await git(['add', 'unrelated.txt']);
  await fs.writeFile(path.join(root, 'untracked.txt'), 'private draft\n');
  await store.upload('Test Album', 'new shot.jpg', image);
  const result = await store.publish();
  const remoteHead = await run('git', ['--git-dir', remote, 'rev-parse', 'main']);
  assert.equal(result.sha, remoteHead);
  assert.equal(await run('git', ['--git-dir', remote, 'show', 'main:unrelated.txt']), 'original');
  assert.equal(await git(['diff', '--cached', '--name-only']), 'unrelated.txt');
  assert.match(await git(['status', '--porcelain']), /\?\? untracked.txt/);
  assert.equal(store.state.pending.length, 0);
  assert.equal((await store.publish()).unchanged, true);
  await store.removeShots({ album: 'Test Album', names: ['original.jpg'] });
  await store.publish();
  await assert.rejects(run('git', ['--git-dir', remote, 'show', 'main:public/gallery/Test Album/original.txt']));
  assert.equal(await git(['diff', '--cached', '--name-only']), 'unrelated.txt');
});

test('Сбой push: повторная отправка после перезапуска без потери и второго коммита', async t => {
  const { store, git, root, remote, image } = await fixture(t);
  const hook = path.join(remote, 'hooks/pre-receive');
  await fs.writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  await store.upload('Test Album', 'retry.jpg', image);
  await assert.rejects(store.publish());
  assert.ok(store.state.outgoing);
  const head = await git(['rev-parse', 'HEAD']);
  await assert.rejects(store.upload('Test Album', 'too-early.jpg', image), /Предыдущая отправка/);
  store.close();
  await fs.unlink(hook);
  const reopened = await new GalleryStore(root, { allowTestRemote: true }).init(); t.after(() => reopened.close());
  const result = await reopened.publish();
  assert.equal(result.sha, head);
  assert.equal(await git(['rev-list', '--count', 'HEAD']), '2');
  assert.equal(reopened.state.outgoing, null);
});

test('Защита от публикации чужих локальных коммитов, другой ветки и изменения GitHub', async t => {
  const { store, git, image } = await fixture(t);
  await store.upload('Test Album', 'local.jpg', image);
  await git(['commit', '--allow-empty', '-m', 'Other work']);
  await assert.rejects(store.publish(), /отличаются/);
  await git(['switch', '-c', 'other-branch']);
  await assert.rejects(store.publish(), /только из ветки main/);
  assert.equal(store.state.pending.length, 1);
});

test('Добавление и удаление до первой отправки не создаёт пустой коммит', async t => {
  const { store, git, image } = await fixture(t);
  await store.upload('Test Album', 'temporary.jpg', image);
  await store.removeShots({ album: 'Test Album', names: ['temporary.jpg'] });
  assert.equal((await store.publish()).unchanged, true);
  assert.equal(await git(['rev-list', '--count', 'HEAD']), '1');
  const item = (await store.trash())[0]; await store.restore(item.id); await store.publish();
  assert.equal(await git(['rev-list', '--count', 'HEAD']), '2');
});

test('Проверка изображений, путей, symlink и устаревших настроек', async t => {
  const { store, root, image } = await fixture(t);
  await assert.rejects(store.createAlbum({ name: '../escape' }), /символы/);
  await assert.rejects(store.createAlbum({ name: '__proto__' }), /символы/);
  await assert.rejects(store.upload('Test Album', 'fake.png', image), /не совпадает/);
  await assert.rejects(store.upload('Test Album', 'fake.jpg', Buffer.from('not an image')), /прочитать/);
  await assert.rejects(store.upload('Test Album', '../outside.jpg', image), /символы/);
  await fs.symlink(path.join(root, 'unrelated.txt'), path.join(root, 'public/gallery/Test Album/symlink.jpg'));
  await assert.rejects(store.media('Test Album', 'symlink.jpg'), /внешние/);
  const a = (await store.list())[0];
  await assert.rejects(store.updateMetadata({ ...a, album: a.name, revision: 'old' }), /другом окне/);
});

test('HTTP: доступ только с локального адреса и токеном, реальный upload/caption/media/delete/restore', async t => {
  const { root, image } = await fixture(t);
  const { server, store, origin, token } = await createManager({ root, port: 0, storeOptions: { allowTestRemote: true } });
  t.after(async () => { store.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const headers = { 'X-Manager-Token': token, 'Content-Type': 'application/json', Origin: origin };
  const post = (route, data) => fetch(origin + '/api/' + route, { method: 'POST', headers, body: JSON.stringify(data) });
  assert.equal((await fetch(origin + '/api/library')).status, 403);
  assert.equal((await fetch(origin + '/api/status', { headers: { ...headers, Origin: 'https://evil.invalid' } })).status, 403);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const req = http.get(origin + '/', { headers: { Host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(wrongHostStatus, 403);
  const response = await fetch(origin + '/'); const html = await response.text();
  assert.match(html, /manager-token/); assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await post('albums', null)).status, 400);
  const uploaded = await fetch(origin + '/api/upload?album=Test%20Album&name=HTTP%20%231.jpg', { method: 'POST', headers: { 'X-Manager-Token': token, Origin: origin }, body: image });
  assert.equal(uploaded.status, 200);
  const data = await (await fetch(origin + '/api/library', { headers })).json();
  const s = data.albums[0].shots.find(s => s.name === 'HTTP #1.jpg'); assert.ok(s);
  assert.equal((await fetch(origin + s.image)).status, 200);
  assert.equal((await post('caption', { album: 'Test Album', name: s.name, caption: 'HTTP caption', revision: s.revision })).status, 200);
  assert.equal((await post('publish', {})).status, 200);
  const deleted = await (await post('delete', { album: 'Test Album', names: [s.name] })).json();
  assert.equal((await post('restore', { id: deleted.id })).status, 200);
  assert.equal((await fetch(origin + '/media?album=..&name=outside.jpg')).status, 400);
});

test('Удалённая история продвинулась: push останавливается, локальный кадр сохранён', async t => {
  const { store, remote, dir, image, root } = await fixture(t);
  const other = path.join(dir, 'other');
  await run('git', ['clone', '-b', 'main', remote, other]);
  await run('git', ['-c', 'user.name=Other', '-c', 'user.email=other@example.invalid', 'commit', '--allow-empty', '-m', 'Remote update'], { cwd: other });
  await run('git', ['push', 'origin', 'main'], { cwd: other });
  await store.upload('Test Album', 'local.jpg', image);
  await assert.rejects(store.publish(), /отличаются/);
  assert.ok((await fs.stat(path.join(root, 'public/gallery/Test Album/local.jpg'))).size);
  assert.equal(store.state.pending.length, 1);
});

test('Возобновление после записи коммита до обновления HEAD и восстановление части корзины', async t => {
  const { store, root, git, remote, image } = await fixture(t);
  await store.upload('Test Album', 'crash.jpg', image);
  const originalGit = store.git.bind(store);
  let interrupted = false;
  store.git = async (args, options) => {
    if (args[0] === 'update-ref' && !interrupted) { interrupted = true; throw new Error('Simulated process interruption'); }
    return originalGit(args, options);
  };
  await assert.rejects(store.publish(), /Simulated/);
  assert.equal(await git(['rev-parse', 'HEAD']), store.state.base);
  store.close();
  const reopened = await new GalleryStore(root, { allowTestRemote: true }).init(); t.after(() => reopened.close());
  const result = await reopened.publish();
  assert.equal(result.sha, await run('git', ['--git-dir', remote, 'rev-parse', 'main']));
  const removal = await reopened.removeShots({ album: 'Test Album', names: ['original.jpg'] });
  await fs.copyFile(path.join(root, '.album-manager/trash', removal.id, '0'), path.join(root, 'public/gallery/Test Album/original.jpg'));
  await reopened.restore(removal.id);
  assert.equal(await fs.readFile(path.join(root, 'public/gallery/Test Album/original.txt'), 'utf8'), 'Original caption.\n');
});
