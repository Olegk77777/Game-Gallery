import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

export const IMAGE = /\.(jpe?g|png|webp)$/i;
export const META = 'src/data/album-meta.json';
const MAX_IMAGE = 64 * 1024 * 1024;
const collator = new Intl.Collator('ru', { numeric: true });
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function run(command, args, { cwd, env, input, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trimEnd());
      else reject(new AppError((stderr || stdout || `${command}: операция не завершена`).trim(), 409));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
async function exists(file) { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function json(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
async function atomic(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, content);
  await fs.rename(temp, file);
}
function component(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.startsWith('.') || ['__proto__', 'constructor', 'prototype'].includes(value) || /[\\/\x00-\x1f<>:"|?*]/.test(value) || /[. ]$/.test(value) || value.length > 180 || Buffer.byteLength(value) > 200 || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value)) {
    throw new AppError('Название содержит недопустимые символы. Используйте буквы, цифры, пробелы и дефисы.');
  }
  return value;
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function textValue(value, max, label) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new AppError(`${label}: слишком длинный или некорректный текст.`);
  return value.trim();
}

export class GalleryStore {
  constructor(root, { remote = 'origin', branch = 'main', allowTestRemote = false } = {}) {
    this.root = root;
    this.privateDir = path.join(root, '.album-manager');
    this.stateFile = path.join(this.privateDir, 'state.json');
    this.remote = remote; this.branch = branch; this.allowTestRemote = allowTestRemote;
    this.busy = false; this.timer = null; this.lastError = null; this.deployment = null;
  }
  git(args, options = {}) { return run('git', args, { cwd: this.root, ...options }); }
  async init() {
    await fs.mkdir(path.join(this.privateDir, 'trash'), { recursive: true });
    this.state = await json(this.stateFile, { autoPublish: true, pending: [], outgoing: null, base: null, lastPublished: null });
    // Незавершённая отправка остаётся доступна для явного повторения после перезапуска.
    this.state.pending ||= [];
    return this;
  }
  save() { return atomic(this.stateFile, JSON.stringify(this.state, null, 2)); }
  async safe(relative) {
    const pieces = relative.split('/');
    if (path.isAbsolute(relative) || pieces.some(p => !p || p === '.' || p === '..')) throw new AppError('Недопустимый путь.');
    let current = this.root;
    for (const piece of pieces) {
      current = path.join(current, piece);
      try { if ((await fs.lstat(current)).isSymbolicLink()) throw new AppError('Ссылки на внешние файлы не поддерживаются.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return current;
  }
  async albumDir(album) {
    component(album);
    const folder = await this.safe(`public/gallery/${album}`);
    if (!(await exists(folder)) || !(await fs.stat(folder)).isDirectory()) throw new AppError('Альбом не найден.', 404);
    return folder;
  }
  async shotPath(album, name) {
    await this.albumDir(album); component(name);
    if (!IMAGE.test(name)) throw new AppError('Поддерживаются JPG, PNG и WebP.');
    const file = await this.safe(`public/gallery/${album}/${name}`);
    if (!(await exists(file))) throw new AppError('Скриншот не найден.', 404);
    return file;
  }
  async metadata() { return json(await this.safe(META), {}); }
  async changed(paths) {
    this.state.pending = [...new Set([...this.state.pending, ...paths])];
    this.lastError = null;
    await this.save();
    this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    if (this.state.autoPublish && this.state.pending.length && !this.state.outgoing) {
      this.timer = setTimeout(() => this.publish().catch(() => {}), 6000);
      this.timer.unref?.();
    }
  }
  async exclusive(action, allowOutgoing = false) {
    if (this.state.outgoing && !allowOutgoing) throw new AppError('Предыдущая отправка не завершена. Нажмите «Повторить публикацию», затем продолжите редактирование.', 409);
    if (this.busy) throw new AppError('Предыдущая операция ещё выполняется. Подождите немного.', 409);
    this.busy = true;
    try { return await action(); } finally { this.busy = false; }
  }
  async list() {
    const base = await this.safe('public/gallery');
    const metadata = await this.metadata();
    const directories = await fs.readdir(base, { withFileTypes: true });
    const albums = [];
    for (const entry of directories) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const album = entry.name, files = await fs.readdir(path.join(base, album), { withFileTypes: true });
      const shots = [];
      for (const entry of files) {
        if (!entry.isFile() || !IMAGE.test(entry.name)) continue;
        const name = entry.name, file = path.join(base, album, name), stat = await fs.stat(file);
        const captionPath = await this.safe(`public/gallery/${album}/${path.parse(name).name}.txt`);
        const caption = await exists(captionPath) ? await fs.readFile(captionPath, 'utf8') : '';
        shots.push({ name, caption: caption.trim(), revision: digest(caption), bytes: stat.size, modified: stat.mtimeMs,
          image: `/media?album=${encodeURIComponent(album)}&name=${encodeURIComponent(name)}&v=${stat.mtimeMs}` });
      }
      shots.sort((a, b) => a.name.localeCompare(b.name));
      const meta = metadata[album] || { title: album, full: album, place: 'Curated archive', year: new Date().getFullYear(), accent: '#e6a15c' };
      albums.push({ name: album, ...meta, metaRevision: digest(JSON.stringify(metadata[album] || null)), shots, updated: Math.max(0, ...shots.map(s => s.modified)) });
    }
    return albums.sort((a, b) => b.updated - a.updated || collator.compare(a.name, b.name));
  }
  async createAlbum(data) {
    return this.exclusive(async () => {
      const name = component(data.name), metadata = await this.metadata();
      const names = await fs.readdir(await this.safe('public/gallery'));
      if (names.some(n => n.normalize('NFC').toLowerCase() === name.normalize('NFC').toLowerCase())) throw new AppError('Альбом с таким названием уже есть.');
      const folder = await this.safe(`public/gallery/${name}`);
      await fs.mkdir(folder);
      await fs.writeFile(path.join(folder, '.gitkeep'), '');
      metadata[name] = { title: name, full: name, place: data.place?.trim() || 'Curated archive', year: new Date().getFullYear(), accent: '#e6a15c' };
      await atomic(await this.safe(META), JSON.stringify(metadata, null, 2) + '\n');
      await this.changed([META, `public/gallery/${name}/.gitkeep`]);
      return { name };
    });
  }
  async updateMetadata(data) {
    return this.exclusive(async () => {
      await this.albumDir(data.album);
      const all = await this.metadata();
      if (data.revision !== digest(JSON.stringify(all[data.album] || null))) throw new AppError('Оформление изменилось в другом окне. Обновите альбом.', 409);
      const { title, full, place, accent } = data;
      if (!/^#[0-9a-f]{6}$/i.test(accent) || !Number.isInteger(Number(data.year)) || Number(data.year) < 1970 || Number(data.year) > 2100) throw new AppError('Проверьте год и цвет акцента.');
      const meta = { title: textValue(title, 160, 'Название'), full: textValue(full, 200, 'Полное название'), place: textValue(place, 200, 'Место'), year: Number(data.year), accent };
      if (!meta.title || !meta.full) throw new AppError('Введите название альбома.');
      if (data.cover) { await this.shotPath(data.album, data.cover); meta.cover = data.cover; }
      all[data.album] = meta;
      await atomic(await this.safe(META), JSON.stringify(all, null, 2) + '\n');
      await this.changed([META]);
      return { ok: true };
    });
  }
  async caption(data) {
    return this.exclusive(async () => {
      await this.shotPath(data.album, data.name);
      const relative = `public/gallery/${data.album}/${path.parse(data.name).name}.txt`, file = await this.safe(relative);
      const old = await exists(file) ? await fs.readFile(file, 'utf8') : '';
      if (data.revision !== digest(old)) throw new AppError('Подпись уже изменили в другом окне. Закройте кадр и откройте снова.', 409);
      const next = textValue(data.caption, 4000, 'Подпись');
      if (next === old.trim()) return { ok: true };
      await atomic(file, next ? next + '\n' : '');
      await this.changed([relative]);
      return { ok: true };
    });
  }
  async upload(album, name, buffer) {
    return this.exclusive(async () => {
      const folder = await this.albumDir(album);
      component(name);
      if (!IMAGE.test(name) || !buffer.length || buffer.length > MAX_IMAGE) throw new AppError('Нужен JPG, PNG или WebP размером до 64 МБ.');
      let info;
      try { info = await sharp(buffer, { limitInputPixels: 100_000_000 }).metadata(); await sharp(buffer, { limitInputPixels: 100_000_000 }).resize(32, 32).toBuffer(); }
      catch { throw new AppError('Не удалось прочитать изображение. Файл повреждён или формат не поддерживается.'); }
      const ext = path.extname(name).toLowerCase();
      if (!(['.jpg', '.jpeg'].includes(ext) ? info.format === 'jpeg' : info.format === ext.slice(1))) throw new AppError('Расширение файла не совпадает с форматом изображения.');
      // Одинаковые основы имён делят подпись и WebP-превью: всегда делаем имя уникальным.
      const names = await fs.readdir(folder), stems = new Set(names.map(n => path.parse(n).name.normalize('NFC').toLowerCase()));
      let stem = path.parse(name).name.slice(0, 165);
      while (Buffer.byteLength(stem) > 180) stem = stem.slice(0, -1);
      let chosen = name, n = 2;
      while (stems.has(path.parse(chosen).name.normalize('NFC').toLowerCase())) chosen = `${stem} (${n++})${ext}`;
      const relative = `public/gallery/${album}/${chosen}`;
      await fs.writeFile(await this.safe(relative), buffer, { flag: 'wx' });
      await this.changed([relative]);
      return { name: chosen, width: info.width, height: info.height };
    });
  }
  async removeShots({ album, names }) {
    return this.exclusive(async () => {
      if (!Array.isArray(names) || !names.length) throw new AppError('Выберите кадры.');
      const unique = [...new Set(names)];
      for (const name of unique) await this.shotPath(album, name);
      const relatives = [];
      for (const name of unique) {
        const stem = path.parse(name).name;
        relatives.push(`public/gallery/${album}/${name}`, `public/gallery/${album}/${stem}.txt`, `public/hero-gallery/${album}/${stem}.jpg`);
      }
      const files = [];
      for (const relative of relatives) if (await exists(await this.safe(relative))) files.push(relative);
      const id = randomUUID(), trash = path.join(this.privateDir, 'trash', id);
      await fs.mkdir(trash);
      const manifest = { id, album, names: unique, date: new Date().toISOString(), files, restored: false };
      // Сначала копируем весь набор: при сбое ни один оригинал не пропадёт без копии.
      for (let i = 0; i < files.length; i++) await fs.copyFile(await this.safe(files[i]), path.join(trash, String(i)));
      await atomic(path.join(trash, 'manifest.json'), JSON.stringify(manifest));
      await this.changed(files);
      for (const relative of files) await fs.unlink(await this.safe(relative));
      return { id, count: unique.length };
    });
  }
  async trash() {
    const entries = await fs.readdir(path.join(this.privateDir, 'trash'));
    const items = await Promise.all(entries.map(id => json(path.join(this.privateDir, 'trash', id, 'manifest.json'), null)));
    return items.filter(x => x && !x.restored).sort((a, b) => b.date.localeCompare(a.date));
  }
  async restore(id) {
    return this.exclusive(async () => {
      if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Неизвестная запись корзины.');
      const folder = path.join(this.privateDir, 'trash', id), file = path.join(folder, 'manifest.json');
      const item = await json(file, null);
      if (!item || item.restored) throw new AppError('Эти кадры уже восстановлены.');
      const missing = [];
      for (let i = 0; i < item.files.length; i++) {
        const dest = await this.safe(item.files[i]);
        if (await exists(dest)) {
          const [existing, backup] = await Promise.all([fs.readFile(dest), fs.readFile(path.join(folder, String(i)))]);
          if (!existing.equals(backup)) throw new AppError('В альбоме уже есть другой файл с таким именем. Восстановление остановлено.');
        } else missing.push(i);
      }
      for (const i of missing) {
        const dest = await this.safe(item.files[i]);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(path.join(folder, String(i)), dest, 1);
      }
      item.restored = true;
      await atomic(file, JSON.stringify(item));
      await this.changed(item.files);
      return { ok: true };
    });
  }
  async settings(data) {
    return this.exclusive(async () => {
      if (typeof data.autoPublish !== 'boolean') throw new AppError('Неверная настройка.');
      this.state.autoPublish = data.autoPublish;
      await this.save(); this.schedule(); return { ok: true };
    });
  }
  allowed(relative) {
    return relative === META || /^public\/(gallery|hero-gallery)\/[^/]+\/[^/]+$/.test(relative);
  }
  async publish() {
    clearTimeout(this.timer);
    return this.exclusive(async () => {
      this.lastError = null;
      try {
        if (!this.state.pending.length && !this.state.outgoing) return { ok: true, unchanged: true };
        if (await this.git(['branch', '--show-current']) !== this.branch) throw new AppError('Публикация доступна только из ветки main. Изменения сохранены на компьютере.');
        const url = await this.git(['remote', 'get-url', this.remote]);
        if (!this.allowTestRemote && !/^(https:\/\/github\.com\/|git@github\.com:)Olegk77777\/Game-Gallery(?:\.git)?$/i.test(url)) throw new AppError('Адрес репозитория отличается от Game-Gallery. Проверьте подключение GitHub.');
        await this.git(['fetch', this.remote, this.branch]);
        let head = await this.git(['rev-parse', 'HEAD']);
        const remoteHead = await this.git(['rev-parse', `${this.remote}/${this.branch}`]);
        const paths = [...new Set(this.state.pending)];
        for (const relative of paths) {
          if (!this.allowed(relative)) throw new AppError('В очереди есть файл вне галереи. Публикация остановлена.');
          await this.safe(relative);
        }
        const specs = paths.map(p => `:(literal)${p}`);
        const staged = (await this.git(['diff', '--cached', '--name-only', '-z'])).split('\0');
        if (!this.state.outgoing && staged.some(p => paths.includes(p))) throw new AppError('Часть кадров подготовлена к коммиту в другом приложении. Завершите его операцию и повторите публикацию.');
        if (this.state.outgoing) {
          if (head === this.state.base) {
            await this.git(['update-ref', 'HEAD', this.state.outgoing, head]);
            head = this.state.outgoing;
          }
          if (head !== this.state.outgoing || ![this.state.base, head].includes(remoteHead)) throw new AppError('История GitHub изменилась. Кадры сохранены; требуется синхронизировать репозиторий.');
        } else {
          if (head !== remoteHead) throw new AppError('Локальная версия и GitHub отличаются. Сначала синхронизируйте репозиторий; ваши кадры сохранены.');
          if (!specs.length) return { ok: true, unchanged: true };
          const indexFile = path.join(this.privateDir, `index-${randomUUID()}`), env = { GIT_INDEX_FILE: indexFile };
          try {
            await this.git(['read-tree', 'HEAD'], { env });
            // Новый файл могли добавить и удалить до первой отправки. Его уже нет ни на диске, ни в Git.
            const applicable = [];
            for (let i = 0; i < paths.length; i++) {
              const tracked = await this.git(['ls-files', '--', specs[i]], { env });
              if (tracked || await exists(await this.safe(paths[i]))) applicable.push(specs[i]);
            }
            if (applicable.length) await this.git(['add', '-A', '--', ...applicable], { env });
            const tree = await this.git(['write-tree'], { env });
            if (tree === await this.git(['rev-parse', 'HEAD^{tree}'])) {
              this.state.pending = []; await this.save(); return { ok: true, unchanged: true };
            }
            const sha = await this.git(['commit-tree', tree, '-p', head], { input: `Album Manager: update gallery (${new Date().toISOString()})\n` });
            // Хеш записывается до изменения HEAD: отправку можно продолжить даже после перезапуска.
            this.state.base = head; this.state.outgoing = sha; await this.save();
            await this.git(['update-ref', 'HEAD', sha, head]);
            head = sha;
          } finally { await fs.rm(indexFile, { force: true }); }
        }
        // Обновляем в обычном индексе только опубликованные файлы. Чужие правки не затрагиваем.
        if (paths.length) await this.git(['update-index', '--add', '--remove', '-z', '--stdin'], { input: paths.join('\0') + '\0' });
        await this.git(['push', this.remote, `HEAD:refs/heads/${this.branch}`]);
        this.state.lastPublished = { sha: head, date: new Date().toISOString() };
        this.state.pending = []; this.state.outgoing = null; this.state.base = null;
        await this.save(); this.deployment = null;
        return { ok: true, sha: head };
      } catch (error) {
        this.lastError = error.message;
        throw error;
      }
    }, true);
  }
  async status() {
    let branch = null;
    try { branch = await this.git(['branch', '--show-current']); } catch { /* Показываем редактор даже при недоступном Git. */ }
    return { app: 'game-gallery-album-manager', busy: this.busy, autoPublish: this.state.autoPublish,
      pending: this.state.pending, outgoing: this.state.outgoing, lastPublished: this.state.lastPublished,
      error: this.lastError, branch, deployment: this.deployment, site: 'https://olegk77777.github.io/Game-Gallery/' };
  }
  async checkDeployment() {
    const sha = this.state.lastPublished?.sha;
    if (!sha) return null;
    try {
      const output = await run('gh', ['run', 'list', '--repo', 'Olegk77777/Game-Gallery', '--workflow', 'deploy.yml', '--commit', sha, '--limit', '1', '--json', 'status,conclusion,url'], { cwd: this.root, timeout: 20000 });
      const result = JSON.parse(output)[0];
      this.deployment = result || { status: 'waiting', conclusion: null };
    } catch {
      this.deployment = { status: 'unknown', conclusion: null, url: 'https://github.com/Olegk77777/Game-Gallery/actions' };
    }
    return this.deployment;
  }
  async media(album, name, full = false) {
    const file = await this.shotPath(album, name);
    if (full) return { file, type: `image/${path.extname(name).toLowerCase().replace('.', '').replace('jpg', 'jpeg')}` };
    const stat = await fs.stat(file), hash = digest(`${album}/${name}/${stat.mtimeMs}/${stat.size}`);
    const thumb = path.join(this.privateDir, 'previews', hash + '.webp');
    if (!await exists(thumb)) {
      await fs.mkdir(path.dirname(thumb), { recursive: true });
      const buffer = await sharp(file).rotate().resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await atomic(thumb, buffer);
    }
    return { file: thumb, type: 'image/webp' };
  }
  close() { clearTimeout(this.timer); }
}
