const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
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
    if (E2E && event.level === 'error') e2eConsoleErrors.push(event.message);
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[main] renderer gone: ${details.reason}`);
    if (SMOKE || E2E) process.exit(1);
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  const win = createWindow();

  if (SMOKE) {
    win.webContents.on('did-finish-load', async () => {
      try {
        const results = await win.webContents.executeJavaScript(`
          (async () => {
            const out = [];
            const ctx = new OfflineAudioContext(1, 8192, 48000);
            for (const f of ['voice-worklet.js','formant-worklet.js','stream-tap-worklet.js','player-worklet.js']) {
              await ctx.audioWorklet.addModule(new URL('./worklets/' + f, location.href));
              out.push(f + ':loaded');
            }
            const fp = new AudioWorkletNode(ctx, 'formant-processor');
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
          console.log(`[e2e] ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ' — ' + r.info}`);
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
  if (SMOKE || E2E) process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason);
  if (SMOKE || E2E) process.exit(1);
});
