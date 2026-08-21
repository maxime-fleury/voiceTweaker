import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Optional arg: path to a packaged exe (e.g. release/win-unpacked/VoiceTweaker.exe).
// Defaults to the dev electron binary.
const override = process.argv[2] ? path.resolve(process.argv[2]) : null;
const exe = override || path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

if (!existsSync(exe)) {
  console.error(
    '[smoke-runner] Binaire introuvable : ' + exe +
    '\n  Le postinstall d\'electron n\'a pas tourné. Essaie : node node_modules/electron/install.js'
  );
  process.exit(1);
}

const child = spawn(exe, override ? [] : ['.'], {
  cwd: override ? path.dirname(override) : root,
  env: { ...process.env, VT_SMOKE: '1' },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('[smoke-runner] spawn failed:', err.message);
  process.exit(1);
});
