import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

if (!existsSync(electron)) {
  console.error(
    '[e2e-runner] Electron introuvable : ' + electron +
    '\n  Le postinstall d\'electron n\'a pas tourné. Essaie : node node_modules/electron/install.js'
  );
  process.exit(1);
}

const child = spawn(electron, ['.'], {
  cwd: root,
  env: { ...process.env, VT_E2E: '1', ELECTRON_ENABLE_LOGGING: '0' },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('[e2e-runner] spawn failed:', err.message);
  process.exit(1);
});
