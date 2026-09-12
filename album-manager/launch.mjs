import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const origin = 'http://127.0.0.1:4318';
try {
  let running = false;
  try {
    const response = await fetch(origin + '/health', { signal: AbortSignal.timeout(1200) });
    const health = await response.json();
    if (health.app !== 'game-gallery-album-manager' || health.root !== root) throw new Error('Порт 4318 занят другим приложением.');
    running = true;
  } catch (error) { if (error.message.includes('занят')) throw error; }
  if (!running) {
    const { createManager } = await import('./server.mjs');
    await createManager({ root });
  }
  const program = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', origin] : [origin];
  const child = spawn(program, args, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(`Откройте в браузере: ${origin}`));
  child.unref();
  console.log(`\nGame Gallery Studio\n${origin}\n\nМенеджер открыт в браузере. Это окно можно свернуть.\nДля выхода используйте «Завершить работу» в менеджере.\n`);
} catch (error) {
  console.error('\nНе удалось открыть менеджер: ' + error.message);
  if (error.code === 'ERR_MODULE_NOT_FOUND') console.error('Запустите файл «Менеджер альбомов.command» ещё раз для установки зависимостей.');
  process.exitCode = 1;
}
