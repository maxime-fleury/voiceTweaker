'use strict';

const PRESETS = {
  // Calibrés sur une voix d'homme (~136 Hz) : conversion féminine réaliste
  // = f0 ×1,6–1,8 (+8..+10 st) ET formants ×1,10–1,15 (+36..+50 unités).
  naturel:       { labelKey: 'preset.naturel',        p: { transients: 55, nsEnabled: false } },
  feminin:       { labelKey: 'preset.feminin',        p: { pitch: 9, formant: 42, timbre: 2, grain: 55, gate: -70, reverb: 6, humanize: 35, breath: 15, transients: 65 } },
  femininDoux:   { labelKey: 'preset.femininDoux',    p: { pitch: 8, formant: 38, timbre: 1.5, grain: 60, gate: -70, reverb: 10, humanize: 45, breath: 25, vibrDepth: 8, vibrRate: 5.2, transients: 65 } },
  masculin:      { labelKey: 'preset.masculin',       p: { pitch: -3, formant: -20, timbre: -2, grain: 70, gate: -70, reverb: 4, humanize: 30, transients: 65 } },
  masculinProfond:{ labelKey: 'preset.masculinProfond', p: { pitch: -5.5, formant: -30, timbre: -3, grain: 85, gate: -65, reverb: 8, drive: 6, humanize: 20, transients: 60 } },
  enfant:        { labelKey: 'preset.enfant',         p: { pitch: 11, formant: 55, timbre: 2, grain: 45, gate: -70, breath: 12, humanize: 25, transients: 70 } },
  ado:           { labelKey: 'preset.ado',            p: { pitch: 5, formant: 28, timbre: 1.5, grain: 55, gate: -70, breath: 10, humanize: 40 } },
  vieilleDame:   { labelKey: 'preset.vieilleDame',    p: { pitch: 6, formant: 32, timbre: -0.5, grain: 65, gate: -70, vibrDepth: 22, vibrRate: 4.2, breath: 30, humanize: 35 } },
  vieuxMonsieur: { labelKey: 'preset.vieuxMonsieur',  p: { pitch: -3, formant: -22, timbre: -2, grain: 75, gate: -70, breath: 35, humanize: 40, drive: 4 } },
  ecureuil:      { labelKey: 'preset.ecureuil',       p: { pitch: 16, formant: 45, timbre: 2, grain: 40, gate: -70 } },
  bebe:          { labelKey: 'preset.bebe',           p: { pitch: 19, formant: 70, timbre: 3, grain: 40, gate: -70, breath: 20 } },
  monstre:       { labelKey: 'preset.monstre',        p: { pitch: -8, formant: -40, timbre: -4, grain: 90, gate: -65, reverb: 22, drive: 38 } },
  geant:         { labelKey: 'preset.geant',          p: { pitch: -11, formant: -50, timbre: -4, grain: 100, gate: -65, reverb: 18, drive: 15 } },
  robot:         { labelKey: 'preset.robot',          p: { formant: -8, timbre: -2, grain: 60, gate: -55, ring: 72, ringFreq: 46, reverb: 8, drive: 10 } },
  alien:         { labelKey: 'preset.alien',          p: { pitch: 4, formant: 30, grain: 55, gate: -60, ring: 38, ringFreq: 118, chorus: 45, reverb: 12 } },
  demon:         { labelKey: 'preset.demon',          p: { pitch: -6, formant: -35, timbre: -3, grain: 85, gate: -60, ring: 25, ringFreq: 30, drive: 45, reverb: 25 } },
  sorcier:       { labelKey: 'preset.sorcier',        p: { pitch: -4, formant: -18, timbre: -1.5, grain: 75, gate: -70, reverb: 45, chorus: 20, echo: 15, echoTime: 350 } },
  fantome:       { labelKey: 'preset.fantome',        p: { pitch: -3, formant: 8, grain: 75, gate: -70, reverb: 55, chorus: 40, echo: 28, echoTime: 320, breath: 20, irType: 'plate' } },
  murmure:       { labelKey: 'preset.murmure',        p: { formant: 12, timbre: 2, grain: 65, gate: -60, breath: 85, reverb: 5 } },
  etouffe:       { labelKey: 'preset.etouffe',        p: { timbre: -6, grain: 65, gate: -65, drive: 10, low: -14, high: -12 } },
  telephone:     { labelKey: 'preset.telephone',      p: { grain: 60, gate: -60, drive: 22, low: -18, high: -14 } },
  interphone:    { labelKey: 'preset.interphone',     p: { grain: 60, gate: -50, drive: 18, echo: 12, echoTime: 90, low: -12, high: -10 } },
  radio:         { labelKey: 'preset.radio',          p: { formant: 14, timbre: 2, grain: 60, gate: -60, reverb: 3, drive: 26 } },
  podcast:       { labelKey: 'preset.podcast',        p: { formant: 8, timbre: 1, grain: 60, gate: -55, drive: 6, reverb: 2, humanize: 15 } },
  stadium:       { labelKey: 'preset.stadium',        p: { grain: 60, gate: -70, reverb: 45, echo: 35, echoTime: 400, irType: 'hall' } },
  cathedrale:    { labelKey: 'preset.cathedrale',     p: { grain: 60, gate: -75, reverb: 68, irType: 'cathedral' } },
  choeur:        { labelKey: 'preset.choeur',         p: { grain: 70, gate: -70, chorus: 60, reverb: 30, irType: 'hall' } },
  double:        { labelKey: 'preset.double',         p: { grain: 60, gate: -70, chorus: 85 } },
};

const PRESET_GROUPS = [
  { nameKey: 'group.realistes', keys: ['naturel', 'feminin', 'femininDoux', 'masculin', 'masculinProfond', 'enfant', 'ado', 'vieilleDame', 'vieuxMonsieur'] },
  { nameKey: 'group.personnages', keys: ['ecureuil', 'bebe', 'monstre', 'geant', 'robot', 'alien', 'demon', 'sorcier', 'fantome', 'etouffe'] },
  { nameKey: 'group.radio', keys: ['telephone', 'interphone', 'radio', 'podcast', 'stadium', 'cathedrale', 'choeur', 'double', 'murmure'] },
];

function getCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem('vt_custom_presets') || '{}');
  } catch {
    return {};
  }
}

function saveCustomPreset(name) {
  const customs = getCustomPresets();
  const key = 'custom_' + Date.now().toString(36);
  customs[key] = { label: name, p: Object.assign({}, params) };
  localStorage.setItem('vt_custom_presets', JSON.stringify(customs));
  return key;
}

function deleteCustomPreset(key) {
  const customs = getCustomPresets();
  delete customs[key];
  localStorage.setItem('vt_custom_presets', JSON.stringify(customs));
}
