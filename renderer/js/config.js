'use strict';

const $ = (id) => document.getElementById(id);

const pctFmt = (v) => Math.round(v) + ' %';

const SLIDERS = [
  { id: 'pitch', group: 'voice', label: 'Pitch', min: -12, max: 12, step: 0.1, value: 0,
    fmt: (v) => v.toFixed(1) + ' st', tip: 'Hauteur de la voix en demi-tons.' },
  { id: 'formant', group: 'voice', label: 'Formant', min: -100, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Translation des formants indépendante du pitch — clé du réalisme M↔F.' },
  { id: 'timbre', group: 'voice', label: 'Timbre (EQ)', min: -10, max: 10, step: 0.1, value: 0,
    fmt: (v) => v.toFixed(1), tip: 'Égalisation complémentaire autour des formants.' },
  { id: 'transients', group: 'voice', label: 'Transitoires', min: 0, max: 100, step: 1, value: 55,
    fmt: pctFmt, tip: 'Préserve la netteté des consonnes pendant le shift.' },
  { id: 'grain', group: 'voice', label: 'Grain (qualité)', min: 40, max: 160, step: 1, value: 85,
    fmt: (v) => Math.round(v) + ' ms', tip: 'Taille des grains du pitch shifter : stable ↔ réactif.' },
  { id: 'gate', group: 'voice', label: 'Noise gate', min: -100, max: -20, step: 1, value: -90,
    fmt: (v) => Math.round(v) + ' dB', tip: 'Coupe le micro sous ce niveau.' },
  { id: 'vibrDepth', group: 'voice', label: 'Vibrato', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Profondeur du vibrato.' },
  { id: 'vibrRate', group: 'voice', label: 'Vitesse vibrato', min: 0.5, max: 8, step: 0.1, value: 5,
    fmt: (v) => v.toFixed(1) + ' Hz', tip: 'Vitesse du vibrato.' },
  { id: 'humanize', group: 'voice', label: 'Humanisation', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Micro-dérives aléatoires de hauteur pour un rendu naturel.' },
  { id: 'breath', group: 'voice', label: 'Souffle', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: "Ajoute un souffle d'air suivant l'intensité de la voix." },

  { id: 'ring', group: 'fx', label: 'Robot (ring mod)', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Modulation en anneau : effet robot.' },
  { id: 'ringFreq', group: 'fx', label: 'Fréquence robot', min: 20, max: 400, step: 1, value: 50,
    fmt: (v) => Math.round(v) + ' Hz', tip: 'Fréquence du porteur du ring mod.' },
  { id: 'irType', group: 'fx', type: 'select', label: 'Type réverbe', value: 'hall',
    options: [
      { value: 'room', label: 'Salle' },
      { value: 'hall', label: 'Hall' },
      { value: 'cathedral', label: 'Cathédrale' },
      { value: 'plate', label: 'Plate' },
    ],
    tip: 'Caractère acoustique de la réverbe.' },
  { id: 'reverb', group: 'fx', label: 'Réverbe', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Niveau de la réverbe.' },
  { id: 'drive', group: 'fx', label: 'Saturation', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Saturation douce (tanh).' },
  { id: 'echo', group: 'fx', label: 'Écho', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: "Niveau de l'écho." },
  { id: 'echoTime', group: 'fx', label: 'Temps écho', min: 30, max: 800, step: 10, value: 220,
    fmt: (v) => Math.round(v) + ' ms', tip: "Durée entre chaque répétition de l'écho." },
  { id: 'chorus', group: 'fx', label: 'Chorus', min: 0, max: 100, step: 1, value: 0,
    fmt: pctFmt, tip: 'Épaissit la voix par léger délai modulé.' },
  { id: 'volume', group: 'fx', label: 'Volume', min: 0, max: 150, step: 1, value: 100,
    fmt: pctFmt, tip: 'Volume général de la sortie.' },
];

const params = {};
for (const s of SLIDERS) params[s.id] = s.value;

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
