'use strict';

const PRESETS = {
  naturel:       { label: 'Naturel',        p: { transients: 55 } },
  feminin:       { label: 'Féminin',        p: { pitch: 3.4, formant: 38, timbre: 2, grain: 70, gate: -70, reverb: 6, humanize: 35, breath: 15, transients: 65 } },
  femininDoux:   { label: 'Féminin doux',   p: { pitch: 2.8, formant: 30, timbre: 1.5, grain: 80, gate: -70, reverb: 10, humanize: 45, breath: 25, vibrDepth: 8, vibrRate: 5.2, transients: 65 } },
  masculin:      { label: 'Masculin',       p: { pitch: -3.2, formant: -32, timbre: -2, grain: 95, gate: -70, reverb: 4, humanize: 30, transients: 65 } },
  masculinProfond:{ label: 'Voix profonde', p: { pitch: -4.5, formant: -38, timbre: -3, grain: 115, gate: -65, reverb: 8, drive: 6, humanize: 20, transients: 60 } },
  enfant:        { label: 'Enfant',         p: { pitch: 5, formant: 48, timbre: 2, grain: 60, gate: -70, breath: 12, humanize: 25, transients: 70 } },
  ado:           { label: 'Ado',            p: { pitch: 1.5, formant: 18, timbre: 1.5, grain: 75, gate: -70, breath: 10, humanize: 40 } },
  vieilleDame:   { label: 'Vieille dame',   p: { pitch: 2.5, formant: 22, timbre: -0.5, grain: 90, gate: -70, vibrDepth: 22, vibrRate: 4.2, breath: 30, humanize: 35 } },
  vieuxMonsieur: { label: 'Vieux monsieur', p: { pitch: -2, formant: -20, timbre: -2, grain: 100, gate: -70, breath: 35, humanize: 40, drive: 4 } },
  ecureuil:      { label: 'Écureuil',       p: { pitch: 7, formant: 30, timbre: 2, grain: 60, gate: -70 } },
  bebe:          { label: 'Bébé',           p: { pitch: 8, formant: 55, timbre: 3, grain: 55, gate: -70, breath: 20 } },
  monstre:       { label: 'Monstre',        p: { pitch: -6, formant: -30, timbre: -4, grain: 110, gate: -65, reverb: 22, drive: 38 } },
  geant:         { label: 'Géant',          p: { pitch: -8, formant: -42, timbre: -4, grain: 130, gate: -65, reverb: 18, drive: 15 } },
  robot:         { label: 'Robot',          p: { formant: -8, timbre: -2, grain: 85, gate: -55, ring: 72, ringFreq: 46, reverb: 8, drive: 10 } },
  alien:         { label: 'Alien',          p: { pitch: 2, formant: 15, grain: 80, gate: -60, ring: 38, ringFreq: 118, chorus: 45, reverb: 12 } },
  demon:         { label: 'Démon',          p: { pitch: -5, formant: -28, timbre: -3, grain: 105, gate: -60, ring: 25, ringFreq: 30, drive: 45, reverb: 25 } },
  sorcier:       { label: 'Sorcier',        p: { pitch: -3, formant: -15, timbre: -1.5, grain: 100, gate: -70, reverb: 45, chorus: 20, echo: 15, echoTime: 350 } },
  fantome:       { label: 'Fantôme',        p: { pitch: -2, formant: 5, grain: 100, gate: -70, reverb: 55, chorus: 40, echo: 28, echoTime: 320, breath: 20, irType: 'plate' } },
  murmure:       { label: 'Murmure',        p: { formant: 8, timbre: 2, grain: 90, gate: -60, breath: 85, reverb: 5 } },
  etouffe:       { label: 'Étouffé',        p: { timbre: -6, grain: 90, gate: -65, drive: 10, low: -14, high: -12 } },
  telephone:     { label: 'Téléphone',      p: { grain: 85, gate: -60, drive: 22, low: -18, high: -14 } },
  interphone:    { label: 'Interphone',     p: { grain: 85, gate: -50, drive: 18, echo: 12, echoTime: 90, low: -12, high: -10 } },
  radio:         { label: 'Radio',          p: { formant: 10, timbre: 2, grain: 85, gate: -60, reverb: 3, drive: 26 } },
  podcast:       { label: 'Podcast',        p: { formant: 6, timbre: 1, grain: 85, gate: -55, drive: 6, reverb: 2, humanize: 15 } },
  stadium:       { label: 'Stadium',        p: { grain: 85, gate: -70, reverb: 45, echo: 35, echoTime: 400, irType: 'hall' } },
  cathedrale:    { label: 'Cathédrale',     p: { grain: 85, gate: -75, reverb: 68, irType: 'cathedral' } },
  choeur:        { label: 'Chœur',          p: { grain: 95, gate: -70, chorus: 60, reverb: 30, irType: 'hall' } },
  double:        { label: 'Double voix',    p: { grain: 85, gate: -70, chorus: 85 } },
};

const PRESET_GROUPS = [
  { name: 'Réalistes', keys: ['naturel', 'feminin', 'femininDoux', 'masculin', 'masculinProfond', 'enfant', 'ado', 'vieilleDame', 'vieuxMonsieur'] },
  { name: 'Personnages', keys: ['ecureuil', 'bebe', 'monstre', 'geant', 'robot', 'alien', 'demon', 'sorcier', 'fantome', 'etouffe'] },
  { name: 'Radio & scène', keys: ['telephone', 'interphone', 'radio', 'podcast', 'stadium', 'cathedrale', 'choeur', 'double', 'murmure'] },
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
