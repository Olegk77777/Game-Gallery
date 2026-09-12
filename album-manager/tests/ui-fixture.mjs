// Изолированная галерея для ручной проверки интерфейса. Публикации идут только в локальный bare-репозиторий.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { run } from '../store.mjs';
import { createManager } from '../server.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-studio-ui-'));
const root = path.join(dir, 'project'), album = 'Kingdom Come Deliverance II';
await fs.mkdir(path.join(root, 'public/gallery', album), { recursive: true });
await fs.mkdir(path.join(root, 'src/data'), { recursive: true });
const names = (await fs.readdir(path.join(project, 'public/gallery', album))).filter(x => /\.jpg$/i.test(x)).slice(0, 3);
for (const name of names) {
  await fs.copyFile(path.join(project, 'public/gallery', album, name), path.join(root, 'public/gallery', album, name));
  await fs.copyFile(path.join(project, 'public/gallery', album, name.replace(/\.jpg$/i, '.txt')), path.join(root, 'public/gallery', album, name.replace(/\.jpg$/i, '.txt')));
}
await fs.copyFile(path.join(project, 'public/gallery', album, names[0]), path.join(dir, 'studio-upload.jpg'));
const metadata = JSON.parse(await fs.readFile(path.join(project, 'src/data/album-meta.json'), 'utf8'));
await fs.writeFile(path.join(root, 'src/data/album-meta.json'), JSON.stringify({ [album]: metadata[album] }));
await fs.writeFile(path.join(root, '.gitignore'), '.album-manager/\n');
const git = args => run('git', args, { cwd: root });
await git(['init', '-b', 'main']); await git(['config', 'user.name', 'Studio UI Test']); await git(['config', 'user.email', 'test@example.invalid']);
await git(['add', '.']); await git(['commit', '-m', 'UI fixture']);
await run('git', ['init', '--bare', path.join(dir, 'origin.git')]); await git(['remote', 'add', 'origin', path.join(dir, 'origin.git')]); await git(['push', '-u', 'origin', 'main']);
const { origin, store } = await createManager({ root, port: 4319, storeOptions: { allowTestRemote: true } });
await store.settings({ autoPublish: false });
console.log(JSON.stringify({ origin, root, upload: path.join(dir, 'studio-upload.jpg') }));
