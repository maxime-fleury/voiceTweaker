'use strict';

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

    state.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    await state.ctx.audioWorklet.addModule(new URL('./worklets/voice-worklet.js', location.href));
    await state.ctx.audioWorklet.addModule(new URL('./worklets/formant-worklet.js', location.href));
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
      toast('Sortie audio refusée (' + err.name + ') : ' + err.message);
    }
    try {
      await outAudio.play();
    } catch (err) {
      toast('Lecture bloquée : ' + err.message);
    }

    state.running = true;
    setStatus(true);
    updateLatency();
    saveSettingsNow();
    listDevices();
  } catch (err) {
    console.error(err);
    toast(
      'Erreur : ' +
        (err.name === 'NotAllowedError' ? 'accès micro refusé' : err.message || err)
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
  state.tap = null;
  state.player = null;
  state.msDest = null;
  state.nodes = {};
  setStatus(false);
  updateLatency();
}

function init() {
  const saved = loadSettings();

  renderSliders('voiceSliders', 'voice');
  renderSliders('fxSliders', 'fx');

  renderPresets();

  $('monitorChk').checked = !!saved.monitor;

  $('saveCustomBtn').addEventListener('click', () => {
    const name = $('customName').value.trim();
    if (!name) {
      toast('Donne un nom à ta voix avant de sauvegarder.');
      return;
    }
    saveCustomPreset(name);
    $('customName').value = '';
    renderPresets();
    toast('Voix « ' + name + ' » sauvegardée.');
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
      toast('Impossible de changer la sortie (' + err.name + ') : ' + err.message);
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
      toast('Démarre le traitement avant de charger une IR.');
      e.target.value = '';
      return;
    }
    try {
      const data = await file.arrayBuffer();
      state.customIr = await state.ctx.decodeAudioData(data);
      rebuildConvolver();
      toast('IR « ' + file.name + ' » chargée.');
    } catch (err) {
      toast('Impossible de décoder ce fichier : ' + err.message);
    }
    e.target.value = '';
  });

  navigator.mediaDevices.addEventListener?.('devicechange', listDevices);

  window.vt.updater?.onUpdate(({ type, info }) => {
    if (type === 'available') toast('Mise à jour ' + info + ' disponible — téléchargement…');
    else if (type === 'downloaded') {
      toast('Mise à jour ' + info + ' prête — elle s\'installera à la fermeture de l\'app.');
    }
  });

  initRvc();

  listDevices().then(() => {
    document.querySelector('.chip[data-key="naturel"]')?.classList.add('active');
  });

  drawMeter();
}

init();
