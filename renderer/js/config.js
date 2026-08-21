'use strict';

const $ = (id) => document.getElementById(id);

const pctFmt = (v) => Math.round(v) + ' %';

const SLIDERS = [
  { id: 'pitch', group: 'voice', label: () => t('slider.pitch'), min: -12, max: 12, step: 0.1, value: 0,
    fmt: (v) => v.toFixed(1) + ' st', tip: () => t('tip.pitch') },
  { id: 'formant', group: 'voice', label: () => t('slider.formant'), min: -100, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.formant') },
  { id: 'timbre', group: 'voice', label: () => t('slider.timbre'), min: -10, max: 10, step: 0.1, value: 0,
    fmt: (v) => v.toFixed(1), tip: () => t('tip.timbre') },
  { id: 'transients', group: 'voice', label: () => t('slider.transients'), min: 0, max: 100, step: 1, value: 55,
    fmt: pctFmt, tip: () => t('tip.transients') },
  { id: 'grain', group: 'voice', label: () => t('slider.grain'), min: 40, max: 160, step: 1, value: 85,
    fmt: (v) => Math.round(v) + ' ms', tip: () => t('tip.grain') },
  { id: 'gate', group: 'voice', label: () => t('slider.gate'), min: -100, max: -20, step: 1, value: -90,
    fmt: (v) => Math.round(v) + ' dB', tip: () => t('tip.gate') },
  { id: 'vibrDepth', group: 'voice', label: () => t('slider.vibrDepth'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.vibrDepth') },
  { id: 'vibrRate', group: 'voice', label: () => t('slider.vibrRate'), min: 0.5, max: 8, step: 0.1, value: 5,
    fmt: (v) => v.toFixed(1) + ' Hz', tip: () => t('tip.vibrRate') },
  { id: 'humanize', group: 'voice', label: () => t('slider.humanize'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.humanize') },
  { id: 'breath', group: 'voice', label: () => t('slider.breath'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.breath') },

  { id: 'ring', group: 'fx', label: () => t('slider.ring'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.ring') },
  { id: 'ringFreq', group: 'fx', label: () => t('slider.ringFreq'), min: 20, max: 400, step: 1, value: 50,
    fmt: (v) => Math.round(v) + ' Hz', tip: () => t('tip.ringFreq') },
  { id: 'irType', group: 'fx', type: 'select', label: () => t('slider.irType'), value: 'hall',
    options: [
      { value: 'room', label: () => t('ir.room') },
      { value: 'hall', label: () => t('ir.hall') },
      { value: 'cathedral', label: () => t('ir.cathedral') },
      { value: 'plate', label: () => t('ir.plate') },
    ],
    tip: () => t('tip.irType') },
  { id: 'reverb', group: 'fx', label: () => t('slider.reverb'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.reverb') },
  { id: 'drive', group: 'fx', label: () => t('slider.drive'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.drive') },
  { id: 'echo', group: 'fx', label: () => t('slider.echo'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.echo') },
  { id: 'echoTime', group: 'fx', label: () => t('slider.echoTime'), min: 30, max: 800, step: 10, value: 220,
    fmt: (v) => Math.round(v) + ' ms', tip: () => t('tip.echoTime') },
  { id: 'chorus', group: 'fx', label: () => t('slider.chorus'), min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: () => t('tip.chorus') },
  { id: 'volume', group: 'fx', label: () => t('slider.volume'), min: 0, max: 150, step: 1, value: 100,
    fmt: pctFmt, tip: () => t('tip.volume') },
];

const params = {};
for (const s of SLIDERS) params[s.id] = s.value;

// EQ overrides set by presets (etouffe, telephone...) — null = derive from timbre.
params.low = null;
params.high = null;

const DEFAULT_PARAMS = Object.assign({}, params);

const SLIDER_IDS = SLIDERS.filter((s) => s.type !== 'select').map((s) => s.id);

const SLIDER_BY_ID = {};
for (const s of SLIDERS) SLIDER_BY_ID[s.id] = s;

const state = {
  running: false,
  ctx: null,
  stream: null,
  worklet: null,
  formant: null,
  tap: null,
  player: null,
  nodes: {},
  level: 0,
  customIr: null,
};

const rvc = {
  available: false,
  hubertOk: false,
  voices: [],
  loaded: null,
  enabled: false,
  chunkMs: 512,
  busy: false,
  errorShown: false,
};
