'use strict';

const driveCache = new Map();

function driveCurve(amount) {
  const k = Math.round(amount);
  if (driveCache.has(k)) return driveCache.get(k);
  const kk = (k / 100) * 30 + 1e-4;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + kk) * x) / (1 + kk * Math.abs(x));
  }
  driveCache.set(k, curve);
  return curve;
}

function buildGraph() {
  const ctx = state.ctx;
  const source = ctx.createMediaStreamSource(state.stream);

  // RNNoise (vendor sapphi-red/web-noise-suppressor, 48 kHz) + blend wet/dry.
  const ns = new AudioWorkletNode(ctx, '@sapphi-red/web-noise-suppressor/rnnoise', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { maxChannels: 1, wasmBinary: state.nsWasmBytes },
  });
  const nsWet = ctx.createGain();
  const nsDry = ctx.createGain();
  nsWet.gain.value = params.nsEnabled ? params.nsStrength / 100 : 0;
  nsDry.gain.value = params.nsEnabled ? 1 - params.nsStrength / 100 : 1;
  const nsSum = ctx.createGain();

  // Vocoder « Qualité max » : toujours en chaîne, bypass interne si off.
  const voc = new AudioWorkletNode(ctx, 'pitch-vocoder', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: {
      enabled: params.pitchQuality === 1,
      pitch: params.pitch,
      vibrDepth: params.vibrDepth,
      vibrRate: params.vibrRate,
      humanize: params.humanize,
    },
  });

  // atténuation de la voix quand un pad du soundboard joue
  const duckVoice = ctx.createGain();
  duckVoice.gain.value = 1;

  const worklet = new AudioWorkletNode(ctx, 'voice-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: {
      pitch: params.pitch,
      grain: params.grain,
      gateDb: params.gate,
      ring: params.ring / 100,
      ringFreq: params.ringFreq,
      vibrDepth: params.vibrDepth,
      vibrRate: params.vibrRate,
      humanize: params.humanize,
      breath: params.breath,
      transients: params.transients,
      bypassPitch: params.pitchQuality === 1 ? 1 : 0,
    },
  });
  worklet.port.onmessage = (e) => {
    if (e.data && e.data.type === 'meter') state.level = e.data.rms;
  };

  const formant = new AudioWorkletNode(ctx, 'formant-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { alpha: Math.pow(2, (params.formant * 4) / 1200) },
  });

  const deesser = new AudioWorkletNode(ctx, 'deesser-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { amount: params.deesser },
  });

  const tap = new AudioWorkletNode(ctx, 'stream-tap', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: { chunkMs: rvc.chunkMs },
  });
  tap.port.onmessage = (e) => sendRvcChunk(e.data);

  const player = new AudioWorkletNode(ctx, 'chunk-player', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 2800;
  peak.Q.value = 0.9;

  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 320;

  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 2600;

  const shaper = ctx.createWaveShaper();
  shaper.oversample = '2x';

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.15;

  const conv = ctx.createConvolver();
  conv.buffer = state.customIr || generateIR(ctx, params.irType);

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const master = ctx.createGain();

  const echoDelay = ctx.createDelay(1.0);
  echoDelay.delayTime.value = params.echoTime / 1000;
  const echoFb = ctx.createGain();
  echoFb.gain.value = 0.35;
  const echoWet = ctx.createGain();
  echoWet.gain.value = 0;

  const chorusDelay = ctx.createDelay(0.05);
  chorusDelay.delayTime.value = 0.02;
  const chorusLfo = ctx.createOscillator();
  chorusLfo.frequency.value = 0.8;
  const chorusLfoGain = ctx.createGain();
  chorusLfoGain.gain.value = 0.006;
  chorusLfo.connect(chorusLfoGain);
  chorusLfoGain.connect(chorusDelay.delayTime);
  chorusLfo.start(0);
  const chorusWet = ctx.createGain();
  chorusWet.gain.value = 0;

  const monitorGain = ctx.createGain();
  monitorGain.gain.value = $('monitorChk').checked ? 1 : 0;

  // mute global (hotkey) + bus du soundboard, tous deux avant la sortie
  const muteGain = ctx.createGain();
  muteGain.gain.value = state.muted ? 0 : 1;
  const sbBus = ctx.createGain();
  sbBus.gain.value = params.sbVolume / 100;

  // limiteur final : protège de tout clip quand drive/réverbe/volume s'additionnent
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;

  const msDest = ctx.createMediaStreamDestination();

  source.connect(ns);
  ns.connect(nsWet);
  nsWet.connect(nsSum);
  source.connect(nsDry);
  nsDry.connect(nsSum);
  nsSum.connect(voc);
  voc.connect(duckVoice);
  duckVoice.connect(worklet);
  worklet.connect(formant);
  formant.connect(deesser);
  deesser.connect(peak);
  peak.connect(low);
  low.connect(high);
  high.connect(shaper);
  shaper.connect(comp);
  comp.connect(dry);
  dry.connect(master);
  comp.connect(conv);
  conv.connect(wet);
  wet.connect(master);
  comp.connect(echoDelay);
  echoDelay.connect(echoFb);
  echoFb.connect(echoDelay);
  echoDelay.connect(echoWet);
  echoWet.connect(master);
  comp.connect(chorusDelay);
  chorusDelay.connect(chorusWet);
  chorusWet.connect(master);

  master.connect(limiter);
  sbBus.connect(limiter);
  limiter.connect(muteGain);
  muteGain.connect(monitorGain);
  monitorGain.connect(ctx.destination);

  muteGain.connect(msDest);

  state.worklet = worklet;
  state.formant = formant;
  state.voc = voc;
  state.deesser = deesser;
  state.ns = ns;
  state.nsWet = nsWet;
  state.nsDry = nsDry;
  state.tap = tap;
  state.player = player;
  state.msDest = msDest;
  state.duckVoice = duckVoice;
  state.muteGain = muteGain;
  state.sbBus = sbBus;
  state.nodes = { peak, low, high, shaper, wet, master, monitorGain, echoDelay, echoWet, chorusWet, conv, limiter };
  connectOutput();
}

function connectOutput() {
  const { muteGain, player } = state;
  const monitorGain = state.nodes && state.nodes.monitorGain;
  if (!muteGain || !monitorGain) return;
  try { muteGain.disconnect(); } catch (e) {}
  try { player.disconnect(); } catch (e) {}
  if (rvc.enabled && rvc.loaded) {
    muteGain.connect(state.tap);
    player.connect(monitorGain);
    player.connect(state.msDest);
  } else {
    muteGain.connect(monitorGain);
    muteGain.connect(state.msDest);
  }
}

async function sendRvcChunk(chunk) {
  if (!rvc.enabled || !rvc.loaded || rvc.busy) return;
  rvc.busy = true;
  try {
    const res = await window.vt.rvc.convert(chunk);
    if (res.ok && state.player) {
      const audio = new Float32Array(res.audio);
      state.player.port.postMessage({ audio }, [audio.buffer]);
    } else if (!res.ok && !rvc.errorShown) {
      rvc.errorShown = true;
      toast('RVC : ' + res.error);
      setTimeout(() => (rvc.errorShown = false), 10000);
    }
  } finally {
    rvc.busy = false;
  }
}

function applyParams() {
  if (state.deesser) {
    state.deesser.port.postMessage({ amount: params.deesser });
  }
  if (state.muteGain) {
    const g = state.muteGain.gain;
    const t = state.ctx ? state.ctx.currentTime : 0;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(state.muted ? 0 : 1, t + 0.04);
  }
  if (state.sbBus) {
    state.sbBus.gain.value = params.sbVolume / 100;
  }
  if (state.voc) {
    state.voc.port.postMessage({
      enabled: params.pitchQuality === 1,
      pitch: params.pitch,
      vibrDepth: params.vibrDepth,
      vibrRate: params.vibrRate,
      humanize: params.humanize,
    });
  }
  if (state.worklet) {
    state.worklet.port.postMessage({
      pitch: params.pitch,
      grain: params.grain,
      gateDb: params.gate,
      ring: params.ring / 100,
      ringFreq: params.ringFreq,
      vibrDepth: params.vibrDepth,
      vibrRate: params.vibrRate,
      humanize: params.humanize,
      breath: params.breath,
      transients: params.transients,
      bypassPitch: params.pitchQuality === 1 ? 1 : 0,
    });
  }
  if (state.nsWet) {
    const on = !!params.nsEnabled;
    const s = params.nsStrength / 100;
    const t = state.ctx ? state.ctx.currentTime : 0;
    for (const [g, target] of [[state.nsWet, on ? s : 0], [state.nsDry, on ? 1 - s : 1]]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + 0.05);
    }
  }
  if (state.formant) {
    const alpha = Math.pow(2, (params.formant * 4) / 1200);
    state.formant.port.postMessage({ alpha });
  }
  const n = state.nodes;
  if (!n.peak) return;
  n.peak.gain.value = params.timbre;
  n.low.gain.value = params.low ?? -(params.timbre * 0.4);
  n.high.gain.value = params.high ?? params.timbre * 0.5;
  n.shaper.curve = driveCurve(params.drive);
  n.wet.gain.value = (params.reverb / 100) * 0.9;
  n.echoDelay.delayTime.value = params.echoTime / 1000;
  n.echoWet.gain.value = (params.echo / 100) * 0.6;
  n.chorusWet.gain.value = (params.chorus / 100) * 0.5;
  n.master.gain.value = Math.pow(params.volume / 100, 2);
}

function rebuildConvolver() {
  if (state.ctx && state.nodes.conv) {
    state.nodes.conv.buffer = state.customIr || generateIR(state.ctx, params.irType);
  }
}

function updateLatency() {
  const el = $('latency');
  if (!el) return;
  if (state.running && state.ctx) {
    let ms = (state.ctx.baseLatency + params.grain / 1000) * 1000;
    if (params.pitchQuality === 1) ms += 55;
    if (rvc.enabled && rvc.loaded) ms += rvc.chunkMs;
    el.textContent = '~' + Math.round(ms) + ' ms';
  } else {
    el.textContent = '—';
  }
}
