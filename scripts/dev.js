import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/build/config.js';
import { options } from './options.js';
import { serve } from './server.js';

const values = options();
let running = false;
let queued = false;
let timer;
async function rebuild() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    // 重启新进程会从磁盘重新加载改动过的模板/内容模块。
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL('./build.js', import.meta.url)), ...process.argv.slice(2)],
        { stdio: 'inherit', windowsHide: true },
      );
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`builder exited with code ${code}`)),
      );
    });
    console.log('Refresh the browser to see changes.');
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
  } finally {
    running = false;
    if (queued) {
      queued = false;
      await rebuild();
    }
  }
}

await rebuild();
const config = await loadConfig(process.cwd(), { basePath: values.base });
serve({ directory: values.out, port: values.port, host: values.host, basePath: config.basePath });
for (const directory of new Set(
  ['src', 'config', 'content', 'public', values.content].filter(Boolean),
)) {
  if (!fs.existsSync(directory)) continue;
  fs.watch(directory, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  });
}
