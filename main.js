const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { RvcEngine } = require('./rvc-engine');

const SMOKE = !!process.env.VT_SMOKE;
const E2E = !!process.env.VT_E2E;
const e2eConsoleErrors = [];

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (E2E) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}

const rvc = new RvcEngine(path.join(__dirname, 'models'));

/* ---------- Local crash/diagnostic log (no telemetry) ---------- */

let logDir = null;
let logFile = null;

function logLine(msg) {
  try {
    if (!logFile) return;
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1_000_000) {
      fs.writeFileSync(logFile, '');
    }
    fs.appendFileSync(logFile, msg + '\n');
  } catch (e) {}
}

function initLogging() {
  try {
    logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    logFile = path.join(logDir, 'voicetweaker.log');
    logLine(
      `--- VoiceTweaker ${app.getVersion()} electron ${process.versions.electron} ` +
        `${new Date().toISOString()}`
    );
  } catch (e) {}
}

function wrap(fn) {
  return async (...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  };
}

ipcMain.handle('rvc:status', () => rvc.status());
ipcMain.handle('rvc:load', wrap((id) => rvc.load(id)));
ipcMain.handle('rvc:convert', async (_e, buf) => {
  try {
    const audio = await rvc.convert(buf);
    return { ok: true, audio };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});
ipcMain.handle('rvc:addUrl', wrap((_e, name, url) => rvc.addUrl(name, url)));
ipcMain.handle('rvc:openFolder', () => rvc.openFolder());
ipcMain.handle('logs:open', () => (logDir ? shell.openPath(logDir) : 'logs indisponibles'));
ipcMain.handle('updater:check', () => {
  if (!app.isPackaged || SMOKE || E2E) return { ok: false, error: 'indisponible en dev' };
  autoUpdater.checkForUpdates().catch((err) => logLine('[updater] check failed: ' + err.message));
  return { ok: true };
});

function setupAutoUpdater(win) {
  if (!app.isPackaged || SMOKE || E2E) return;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = (type, info) => {
    try { win.webContents.send('updater', { type, info }); } catch (e) {}
  };
  autoUpdater.on('update-available', (i) => send('available', i && i.version));
  autoUpdater.on('update-not-available', () => send('none', ''));
  autoUpdater.on('download-progress', (p) => send('progress', Math.round(p.percent)));
  autoUpdater.on('update-downloaded', (i) => {
    logLine('[updater] downloaded ' + (i && i.version));
    send('downloaded', i && i.version);
  });
  autoUpdater.on('error', (err) => logLine('[updater] error: ' + err.message));
  autoUpdater.checkForUpdates().catch((err) => logLine('[updater] check failed: ' + err.message));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 880,
    minHeight: 660,
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    title: 'VoiceTweaker',
    icon: path.join(__dirname, 'renderer', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.on('console-message', (event) => {
    console.log(`[renderer] ${event.message}`);
    if (event.level === 'error') logLine(`[renderer:error] ${event.message}`);
    if (E2E && event.level === 'error') e2eConsoleErrors.push(event.message);
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    const msg = `[main] renderer gone: ${details.reason} exitCode=${details.exitCode}`;
    console.error(msg);
    logLine(msg);
    if (SMOKE || E2E) process.exit(1);
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  initLogging();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  const win = createWindow();
  setupAutoUpdater(win);

  if (SMOKE) {
    win.webContents.on('did-finish-load', async () => {
      try {
        const results = await win.webContents.executeJavaScript(`
          (async () => {
            const out = [];
            const ctx = new OfflineAudioContext(1, 8192, 48000);
            for (const f of ['voice-worklet.js','formant-worklet.js','stream-tap-worklet.js','player-worklet.js','deesser-worklet.js']) {
              await ctx.audioWorklet.addModule(new URL('./worklets/' + f, location.href));
              out.push(f + ':loaded');
            }
            await ctx.audioWorklet.addModule(new URL('./vendor/ns/rnnoise-worklet.js', location.href));
            out.push('rnnoise-worklet:loaded');
            const fp = new AudioWorkletNode(ctx, 'formant-processor', {
              processorOptions: { alpha: 1.12 },
            });
            fp.port.postMessage({ alpha: 1.12 });
            const osc = ctx.createOscillator();
            osc.frequency.value = 220;
            osc.connect(fp);
            fp.connect(ctx.destination);
            osc.start();
            const buf = await ctx.startRendering();
            let peak = 0;
            for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
            out.push('formant-render:peak=' + peak.toFixed(3));
            return out.join(' | ');
          })().catch(e => 'RENDER_FAIL: ' + e.message)
        `);
        console.log(`[smoke] ${results}`);
        if (results.includes('FAIL')) process.exitCode = 1;
      } catch (err) {
        console.error(`[smoke] executeJavaScript failed: ${err.message}`);
        process.exitCode = 1;
      }
      setTimeout(() => {
        console.log(`[smoke] rvc ort=${rvc.status().ortOk} hubert=${rvc.status().hubertOk}`);
        console.log('SMOKE_OK');
        app.quit();
      }, 500);
    });
  }

  if (E2E) {
    win.webContents.on('did-finish-load', async () => {
      try {
        const json = await win.webContents.executeJavaScript(
          require('./tests/page-tests'),
          true
        );
        const results = JSON.parse(json);
        let pass = 0;
        for (const r of results) {
          if (r.pass) pass++;
          const suffix = r.info ? ' — ' + r.info : '';
          console.log(`[e2e] ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? suffix : ' — ' + r.info}`);
        }
        console.log(`[e2e] SUMMARY ${pass}/${results.length}`);
        if (e2eConsoleErrors.length) {
          console.log('[e2e] console errors:');
          for (const m of e2eConsoleErrors) console.log('  ' + m);
        }
        process.exitCode = pass === results.length && e2eConsoleErrors.length === 0 ? 0 : 1;
      } catch (err) {
        console.error(`[e2e] harness failed: ${err.message}`);
        process.exitCode = 1;
      }
      setTimeout(() => app.quit(), 300);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

process.on('uncaughtException', (err) => {
  console.error('[main] uncaught:', err);
  logLine('[main] uncaught: ' + (err && err.stack ? err.stack : String(err)));
  if (SMOKE || E2E) process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason);
  logLine('[main] unhandled rejection: ' + (reason && reason.stack ? reason.stack : String(reason)));
  if (SMOKE || E2E) process.exit(1);
});
