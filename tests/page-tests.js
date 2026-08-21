'use strict';

// Exported as a string: executed in the renderer via webContents.executeJavaScript.
// Constraints: no backticks and no ${ inside the code below.
module.exports = `(async () => {
  const results = [];
  async function test(name, fn) {
    try {
      const info = await fn();
      results.push({ name: name, pass: true, info: info == null ? '' : String(info) });
    } catch (err) {
      results.push({ name: name, pass: false, info: err && err.message ? err.message : String(err) });
    }
  }
  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }
  function $(id) { return document.getElementById(id); }
  function clickRange(id, value) {
    const el = $(id);
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function clickChip(key) {
    const chip = document.querySelector('.chip[data-key="' + key + '"]');
    assert(chip, 'chip manquant: ' + key);
    chip.click();
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await test('dom: elements essentiels', () => {
    const ids = ['toggleBtn','micSelect','outSelect','monitorChk','meter','latency','toast',
      'presets','customName','saveCustomBtn','irFileBtn','irFile','rvcStatus','rvcVoice',
      'rvcLoadBtn','rvcEnable','rvcChunk','rvcUrlName','rvcUrl','rvcAddBtn','outAudio',
      'statusDot','statusText','voiceSliders','fxSliders','openLogsBtn','langSelect'];
    for (const id of ids) assert($(id), 'id manquant: ' + id);
    return ids.length + ' ids';
  });

  await test('sliders: comptes generes', () => {
    const voice = document.querySelectorAll('#voiceSliders input[type="range"]').length;
    const fx = document.querySelectorAll('#fxSliders input[type="range"]').length;
    assert(voice === 10, 'voice sliders=' + voice);
    assert(fx === 8, 'fx sliders=' + fx);
    const sel = $('irType');
    assert(sel && sel.tagName === 'SELECT' && sel.options.length === 4, 'irType select invalide');
    return 'voice=' + voice + ' fx=' + fx;
  });

  await test('sliders: remplissage --fill initialise', () => {
    const fill = getComputedStyle($('s_pitch')).getPropertyValue('--fill');
    assert(fill && fill.trim() !== '', '--fill vide');
    return '--fill=' + fill.trim();
  });

  await test('preset: feminin', () => {
    clickChip('feminin');
    assert(Math.abs(params.pitch - 3.4) < 0.01, 'pitch=' + params.pitch);
    assert(Math.abs(params.formant - 38) < 0.5, 'formant=' + params.formant);
    assert($('v_formant').textContent === '38 %', 'label=' + $('v_formant').textContent);
    assert($('s_pitch').value === '3.4', 's_pitch=' + $('s_pitch').value);
    return 'ok';
  });

  await test('preset: cathedrale change IR', () => {
    clickChip('cathedrale');
    assert($('irType').value === 'cathedral', 'irType=' + $('irType').value);
    assert(params.reverb === 68, 'reverb=' + params.reverb);
    return 'ok';
  });

  await test('preset: naturel remet a zero', () => {
    clickChip('naturel');
    assert(params.ring === 0, 'ring=' + params.ring);
    assert(params.pitch === 0, 'pitch=' + params.pitch);
    assert(document.querySelector('.chip[data-key="naturel"]').classList.contains('active'), 'pas actif');
    return 'ok';
  });

  await test('preset personnalise: sauver puis supprimer', () => {
    clickChip('feminin');
    clickRange('s_pitch', -5);
    assert(params.pitch === -5, 'pitch=' + params.pitch);
    $('customName').value = 'E2E Voice';
    $('saveCustomBtn').click();
    const customs = JSON.parse(localStorage.getItem('vt_custom_presets') || '{}');
    const keys = Object.keys(customs);
    assert(keys.length === 1, 'customs=' + keys.length);
    const k = keys[0];
    assert(customs[k].label === 'E2E Voice', 'label=' + customs[k].label);
    assert(customs[k].p.pitch === -5, 'p.pitch=' + customs[k].p.pitch);
    const chip = document.querySelector('.chip[data-key="' + k + '"]');
    assert(chip, 'chip custom absent');
    assert(document.querySelector('.chip[data-key="feminin"]').classList.contains('active'),
      'highlight perdu apres rebuild');
    chip.querySelector('.del').click();
    const after = JSON.parse(localStorage.getItem('vt_custom_presets') || '{}');
    assert(Object.keys(after).length === 0, 'suppression echouee');
    assert(document.querySelector('.chip[data-key="feminin"]').classList.contains('active'),
      'highlight perdu apres suppression');
    clickChip('naturel');
    return 'ok';
  });

  await test('slider: params + persistance debouncee', async () => {
    clickRange('s_echoTime', 400);
    assert(params.echoTime === 400, 'param=' + params.echoTime);
    assert($('v_echoTime').textContent === '400 ms', 'label=' + $('v_echoTime').textContent);
    await sleep(450);
    const raw = localStorage.getItem('vt_settings');
    assert(raw, 'vt_settings absent');
    const meta = JSON.parse(raw);
    assert(meta.params.echoTime === 400, 'saved=' + meta.params.echoTime);
    return 'ok';
  });

  await test('loadSettings: valeurs hors bornes bornees', () => {
    const meta = JSON.parse(localStorage.getItem('vt_settings'));
    meta.params.pitch = 99;
    meta.params.grain = -50;
    meta.params.low = -9;
    localStorage.setItem('vt_settings', JSON.stringify(meta));
    loadSettings();
    assert(params.pitch === 12, 'pitch=' + params.pitch);
    assert(params.grain === 40, 'grain=' + params.grain);
    assert(params.low === -9, 'low=' + params.low);
    saveSettingsNow();
    const saved2 = JSON.parse(localStorage.getItem('vt_settings'));
    assert(saved2.params.low === -9, 'low persiste=' + saved2.params.low);
    return 'ok';
  });

  await test('preset EQ: low/high appliques puis reinitialises', () => {
    clickChip('etouffe');
    assert(params.low === -14 && params.high === -12, 'eq=' + params.low + '/' + params.high);
    clickChip('feminin');
    assert(params.low === null && params.high === null, 'override non nettoye');
    clickRange('s_timbre', 3);
    assert(params.low === null && params.high === null, 'timbre doit lever les overrides');
    clickChip('naturel');
    return 'ok';
  });

  await test('audio: demarrage avec micro factice', async () => {
    await start();
    assert(state.running === true, 'running=false');
    assert(state.stream && state.stream.getAudioTracks().length === 1, 'pas de piste audio');
    assert($('outAudio').srcObject !== null, 'srcObject null');
    await sleep(700);
    const lvl = state.level;
    await stop();
    assert(state.running === false, 'stop: running=true');
    assert(state.ctx === null, 'ctx non ferme');
    assert($('outAudio').srcObject === null, 'srcObject non nettoye');
    return 'niveau=' + lvl.toFixed(5);
  });

  await test('worklet: rendus pitch 0 vs +7 differents', async () => {
    async function render(pitch) {
      const c = new OfflineAudioContext(1, 24000, 48000);
      await c.audioWorklet.addModule(new URL('./worklets/voice-worklet.js', location.href));
      const node = new AudioWorkletNode(c, 'voice-processor', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { pitch: pitch, grain: 85, gateDb: -100, ring: 0, ringFreq: 50,
          vibrDepth: 0, vibrRate: 5, humanize: 0, breath: 0, transients: 55 },
      });
      node.port.postMessage({ pitch: pitch, grain: 85, gateDb: -100, ring: 0, ringFreq: 50,
        vibrDepth: 0, vibrRate: 5, humanize: 0, breath: 0, transients: 55 });
      const osc = c.createOscillator();
      osc.frequency.value = 220;
      osc.connect(node);
      node.connect(c.destination);
      osc.start();
      return c.startRendering();
    }
    const a = await render(0);
    const b = await render(7);
    const da = a.getChannelData(0);
    const dbf = b.getChannelData(0);
    let diff = 0;
    for (let i = 0; i < da.length; i++) diff = Math.max(diff, Math.abs(da[i] - dbf[i]));
    assert(diff > 0.05, 'diff=' + diff.toFixed(4));
    return 'diff=' + diff.toFixed(3);
  });

  await test('worklet: formant alpha 1.12 rendu connu', async () => {
    const c = new OfflineAudioContext(1, 8192, 48000);
    await c.audioWorklet.addModule(new URL('./worklets/formant-worklet.js', location.href));
    const fp = new AudioWorkletNode(c, 'formant-processor', {
      processorOptions: { alpha: 1.12 },
    });
    fp.port.postMessage({ alpha: 1.12 });
    const osc = c.createOscillator();
    osc.frequency.value = 220;
    osc.connect(fp);
    fp.connect(c.destination);
    osc.start();
    const buf = await c.startRendering();
    let peak = 0;
    for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
    assert(Math.abs(peak - 0.86) < 0.05, 'peak=' + peak.toFixed(3));
    return 'peak=' + peak.toFixed(3);
  });

  await test('rvc: onnxruntime charge cote main', async () => {
    const s = await window.vt.rvc.status();
    assert(s.ortOk === true, 'ortOk=false');
    return 'hubert=' + s.hubertOk;
  });

  await test('ns: RNNoise attenue fortement le bruit', async () => {
    const res = await fetch(new URL('./vendor/ns/rnnoise_simd.wasm', location.href));
    const bytes = await res.arrayBuffer();
    assert(bytes.byteLength > 100000, 'wasm trop petit');
    async function render(enabled) {
      const c = new OfflineAudioContext(1, 48000, 48000);
      await c.audioWorklet.addModule(
        new URL('./vendor/ns/rnnoise-worklet.js', location.href)
      );
      const node = new AudioWorkletNode(c, '@sapphi-red/web-noise-suppressor/rnnoise', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { maxChannels: 1, wasmBinary: bytes.slice(0) },
      });
      const buf = c.createBuffer(1, 48000, 48000);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.1;
      const src = c.createBufferSource();
      src.buffer = buf;
      if (enabled) {
        src.connect(node);
        node.connect(c.destination);
      } else {
        src.connect(c.destination);
      }
      src.start();
      return c.startRendering();
    }
    const off = await render(false);
    const on = await render(true);
    function rmsWindow(b) {
      let a = 0;
      const ch = b.getChannelData(0);
      const start = 9600;
      for (let i = start; i < ch.length; i++) a += ch[i] * ch[i];
      return Math.sqrt(a / (ch.length - start));
    }
    const rOff = rmsWindow(off);
    const rOn = rmsWindow(on);
    assert(rOff > 0.05, 'bypass rms=' + rOff.toFixed(4));
    assert(rOn < rOff * 0.7, 'attenuation insuffisante on=' + rOn.toFixed(4) + ' off=' + rOff.toFixed(4));
    return 'off=' + rOff.toFixed(3) + ' on=' + rOn.toFixed(3);
  });

  await test('presets: sequence rapide sans erreur', () => {
    clickChip('telephone');
    assert(params.low === -18 && params.high === -14, 'eq tel=' + params.low + '/' + params.high);
    clickChip('radio');
    clickChip('etouffe');
    assert(params.timbre === -6, 'timbre=' + params.timbre);
    assert(params.drive === 10, 'drive=' + params.drive);
    clickChip('naturel');
    return 'ok';
  });

  await test('i18n: bascule FR vers EN puis retour', () => {
    const sel = $('langSelect');
    sel.value = 'en';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    assert($('toggleBtn').textContent === 'Start', 'start=' + $('toggleBtn').textContent);
    assert($('statusText').textContent === 'Stopped', 'status=' + $('statusText').textContent);
    const chipFem = document.querySelector('.chip[data-key="feminin"]');
    assert(chipFem.textContent === 'Female', 'chip=' + chipFem.textContent);
    const meta = JSON.parse(localStorage.getItem('vt_settings'));
    assert(meta.lang === 'en', 'persist=' + meta.lang);
    sel.value = 'fr';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    assert($('toggleBtn').textContent === 'Démarrer', 'retour=' + $('toggleBtn').textContent);
    assert(document.querySelector('.chip[data-key="feminin"]').textContent === 'Féminin',
      'chip fr=' + document.querySelector('.chip[data-key="feminin"]').textContent);
    return 'ok';
  });

  return JSON.stringify(results);
})()`;
