'use strict';

function setMuted(m) {
  state.muted = m;
  applyParams();
  document.body.classList.toggle('muted', m);
  $('statusText').textContent = m ? t('status.muted') : state.running ? t('status.active') : t('status.stopped');
}

function handleHotkey(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'mute') {
    setMuted(!state.muted);
    return;
  }
  if (msg.type === 'preset' && typeof msg.index === 'number') {
    const keys = PRESET_GROUPS.flatMap((g) => g.keys);
    const key = keys[msg.index];
    if (key) {
      applyPreset(key);
      const p = ALL_PRESETS[key];
      toast(p.labelKey ? t(p.labelKey) : p.label);
    }
  }
}

async function start() {
  try {
    const micId = $('micSelect').value;
    const constraints = {
      audio: {
        deviceId: micId && micId !== '' && micId !== 'default' ? { exact: micId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
      },
    };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (!state.nsWasmBytes) {
      const simdOk = WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
        10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]));
      const url = simdOk ? './vendor/ns/rnnoise_simd.wasm' : './vendor/ns/rnnoise.wasm';
      const res = await fetch(new URL(url, location.href));
      state.nsWasmBytes = await res.arrayBuffer();
    }

    state.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    await state.ctx.audioWorklet.addModule(
      new URL('./vendor/ns/rnnoise-worklet.js', location.href)
    );
    await state.ctx.audioWorklet.addModule(new URL('./worklets/voice-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/pitchvocoder-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/formant-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/deesser-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/stream-tap-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/player-worklet.js', location.href));

    buildGraph();
    applyParams();

    const outAudio = $('outAudio');
    outAudio.srcObject = state.msDest.stream;
    const outId = $('outSelect').value || 'default';
    try {
      await outAudio.setSinkId(outId);
    } catch (err) {
      toast(t('toast.outputRefused') + ' (' + err.name + ') : ' + err.message);
    }
    try {
      await outAudio.play();
    } catch (err) {
      toast(t('toast.playbackBlocked') + ' : ' + err.message);
    }

    state.running = true;
    setStatus(true);
    updateLatency();
    saveSettingsNow();
    listDevices();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    toast(
      err.name === 'NotAllowedError'
        ? t('toast.micDenied')
        : t('toast.errGeneric') + ' : ' + (err.message || err)
    );
    stop();
  }
}

function stop() {
  state.running = false;
  state.level = 0;
  if (state.stream) {
    for (const t of state.stream.getTracks()) t.stop();
    state.stream = null;
  }
  const outAudio = $('outAudio');
  outAudio.pause();
  outAudio.srcObject = null;
  if (state.ctx) {
    state.ctx.close().catch(() => {});
    state.ctx = null;
  }
  state.worklet = null;
  state.formant = null;
  state.voc = null;
  state.deesser = null;
  state.ns = null;
  state.nsWet = null;
  state.nsDry = null;
  state.tap = null;
  state.player = null;
  state.msDest = null;
  state.nodes = {};
  setStatus(false);
  updateLatency();
}

function init() {
  const saved = loadSettings();

  applyStaticI18n();
  $('langSelect').value = LANG_MODE;

  renderSliders('voiceSliders', 'voice');
  renderSliders('fxSliders', 'fx');

  renderPresets();

  $('monitorChk').checked = !!saved.monitor;

  initTabs(saved);

  $('nsEnable').checked = !!params.nsEnabled;
  $('s_nsStrength').value = String(params.nsStrength);
  $('v_nsStrength').textContent = Math.round(params.nsStrength) + ' %';

  $('nsEnable').addEventListener('change', (e) => {
    params.nsEnabled = e.target.checked;
    applyParams();
    saveSettingsDebounced();
  });

  $('s_nsStrength').addEventListener('input', () => {
    params.nsStrength = parseFloat($('s_nsStrength').value);
    $('v_nsStrength').textContent = Math.round(params.nsStrength) + ' %';
    applyParams();
    saveSettingsDebounced();
  });

  $('qualityChk').checked = params.pitchQuality === 1;
  $('qualityChk').addEventListener('change', (e) => {
    params.pitchQuality = e.target.checked ? 1 : 0;
    applyParams();
    updateLatency();
    saveSettingsDebounced();
  });

  let resetArmed = 0;
  $('resetBtn').addEventListener('click', () => {
    const now = Date.now();
    if (now - resetArmed > 3000) {
      resetArmed = now;
      toast(t('toast.resetConfirm'));
      return;
    }
    resetArmed = 0;
    resetAllSettings();
    toast(t('toast.resetDone'));
  });

  window.vt.appInfo().then((info) => {
    const el = document.getElementById('appVersion');
    if (!el) {
      console.error('[vt] #appVersion introuvable dans le DOM');
      return;
    }
    el.textContent = 'v' + info.version;
  }).catch((e) => console.error('[vt] appInfo:', e && e.message));

  $('ghBtn').addEventListener('click', () => {
    window.vt.openUrl('https://github.com/maxime-fleury/voiceTweaker');
  });
  $('sponsorBtn').addEventListener('click', () => {
    window.vt.openUrl('https://github.com/sponsors/maxime-fleury');
  });

  initWizard(saved);

  initSoundboard();

  window.vt.onHotkey(handleHotkey);

  $('langSelect').addEventListener('change', (e) => setLang(e.target.value));

  onLangChange(() => {
    renderSliders('voiceSliders', 'voice');
    renderSliders('fxSliders', 'fx');
    renderPresets();
    setStatus(state.running);
    updateLatency();
    refreshRvcStatus();
  });

  $('saveCustomBtn').addEventListener('click', () => {
    const name = $('customName').value.trim();
    if (!name) {
      toast(t('toast.customNeedName'));
      return;
    }
    saveCustomPreset(name);
    $('customName').value = '';
    renderPresets();
    toast(t('toast.customSaved') + ' « ' + name + ' ».');
  });

  $('toggleBtn').addEventListener('click', () => (state.running ? stop() : start()));

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, select, textarea, button')) return;
    e.preventDefault();
    state.running ? stop() : start();
  });

  $('micSelect').addEventListener('change', () => {
    saveSettingsDebounced();
    if (state.running) {
      stop();
      setTimeout(start, 150);
    }
  });

  $('outSelect').addEventListener('change', async () => {
    saveSettingsDebounced();
    const outAudio = $('outAudio');
    if (!state.running || !outAudio.srcObject) return;
    try {
      await outAudio.setSinkId($('outSelect').value || 'default');
    } catch (err) {
      toast(t('toast.outputRefused') + ' (' + err.name + ') : ' + err.message);
    }
  });

  $('monitorChk').addEventListener('change', () => {
    saveSettingsDebounced();
    if (!state.nodes.monitorGain) return;
    const g = state.nodes.monitorGain.gain;
    const t = state.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime($('monitorChk').checked ? 1 : 0, t + 0.05);
  });

  $('irFileBtn').addEventListener('click', () => $('irFile').click());

  $('openLogsBtn').addEventListener('click', async () => {
    const res = await window.vt.openLogs();
    if (res) toast('Dossier de logs introuvable : ' + res);
  });
  $('irFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!state.ctx) {
      toast(t('toast.irNeedStart'));
      e.target.value = '';
      return;
    }
    try {
      const data = await file.arrayBuffer();
      state.customIr = await state.ctx.decodeAudioData(data);
      rebuildConvolver();
      toast(t('toast.irLoaded') + ' « ' + file.name + ' »');
    } catch (err) {
      toast(t('toast.irDecodeFail') + ' : ' + err.message);
    }
    e.target.value = '';
  });

  $('openLogsBtn').addEventListener('click', async () => {
    const res = await window.vt.openLogs();
    if (res) toast(t('toast.logsMissing') + ' : ' + res);
  });

  navigator.mediaDevices.addEventListener?.('devicechange', listDevices);

  window.vt.updater?.onUpdate(({ type, info }) => {
    if (type === 'available') toast(t('toast.updAvailable').replace('{v}', info));
    else if (type === 'downloaded') {
      toast(t('toast.updReady').replace('{v}', info));
    }
  });

  initRvc();

  listDevices().then(() => {
    document.querySelector('.chip[data-key="naturel"]')?.classList.add('active');
  });

  drawMeter();
}

init();
