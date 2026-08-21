'use strict';

/* i18n FR/EN — langue par défaut détectée de l'OS, modifiable dans les réglages.
   Chargé AVANT config.js : les libellés sont des fonctions évaluées au rendu. */

const I18N_DICT = {
  fr: {
    'status.stopped': 'Arrêté',
    'status.active': 'Actif',
    'btn.start': 'Démarrer',
    'btn.stop': 'Arrêter',

    'tab.voice': 'Voix',
    'tab.fx': 'Effets',
    'tab.audio': 'Audio',
    'tab.settings': 'Réglages',

    'card.ns': 'Réduction de bruit',
    'settings.general': 'Général',
    'settings.maintenance': 'Maintenance',
    'settings.about': 'À propos',
    'settings.reset': 'Réinitialiser les réglages',
    'settings.tagline': 'changeur de voix temps réel, 100 % local et open source.',
    'btn.sponsor': 'Soutenir le projet',
    'toast.resetConfirm': 'Reclique pour confirmer la réinitialisation.',
    'toast.resetDone': 'Réglages réinitialisés.',

    'card.devices': 'Périphériques',
    'card.presets': 'Voix prédéfinies',
    'card.voice': 'Voix & réalisme',
    'card.fx': 'Effets',
    'card.rvc': 'Conversion neuronale (RVC — expérimental)',

    'label.mic': 'Microphone (entrée)',
    'label.out': 'Sortie audio',
    'label.monitor': "S'entendre (test de voix)",
    'label.lang': 'Langue',
    'label.ns': 'Réduction de bruit (RNNoise)',
    'slider.nsStrength': 'Force NS',
    'tip.nsStrength': 'Mélange entre le signal débruité et le signal brut.',

    'hint.vbcable':
      "Pour un micro virtuel dans Discord / OBS / jeux : installez <b>VB-CABLE</b> (gratuit), choisissez <b>CABLE Input</b> comme sortie ici, puis <b>CABLE Output</b> comme microphone dans l'application cible. Utilisez un casque pour éviter le larsen.",
    'btn.openLogs': 'Ouvrir les logs',

    'placeholder.customName': 'Nom de ta voix…',
    'btn.save': 'Sauver',

    'btn.loadIR': 'Charger une IR personnalisée (.wav)…',

    'rvc.state': 'État',
    'rvc.voice': 'Voix RVC',
    'btn.load': 'Charger',
    'rvc.chunk': 'Latence (bloc)',
    'rvc.enable': ' Activer sur la sortie',
    'rvc.addUrl': 'Ajouter par URL',
    'placeholder.rvcName': 'nom',
    'btn.download': 'Télécharger',
    'hint.rvc':
      "Place les modèles dans <b>models/&lt;nom&gt;/model.onnx</b> (export ONNX officiel RVC) et l'encodeur dans <b>models/hubert/hubert.onnx</b>, puis recharge. Les modèles tournent sur CPU : compte ~300-700 ms de latence supplémentaire.",

    'slider.pitch': 'Pitch',
    'tip.pitch': 'Hauteur de la voix en demi-tons.',
    'slider.formant': 'Formant',
    'tip.formant': 'Translation des formants indépendante du pitch — clé du réalisme M↔F.',
    'slider.timbre': 'Timbre (EQ)',
    'tip.timbre': 'Égalisation complémentaire autour des formants.',
    'slider.transients': 'Transitoires',
    'tip.transients': 'Préserve la netteté des consonnes pendant le shift.',
    'slider.grain': 'Grain (qualité)',
    'tip.grain': 'Taille des grains du pitch shifter : stable ↔ réactif.',
    'slider.gate': 'Noise gate',
    'tip.gate': 'Coupe le micro sous ce niveau.',
    'slider.vibrDepth': 'Vibrato',
    'tip.vibrDepth': 'Profondeur du vibrato.',
    'slider.vibrRate': 'Vitesse vibrato',
    'tip.vibrRate': 'Vitesse du vibrato.',
    'slider.humanize': 'Humanisation',
    'tip.humanize': 'Micro-dérives aléatoires de hauteur pour un rendu naturel.',
    'slider.breath': 'Souffle',
    'tip.breath': "Ajoute un souffle d'air suivant l'intensité de la voix.",
    'slider.ring': 'Robot (ring mod)',
    'tip.ring': 'Modulation en anneau : effet robot.',
    'slider.ringFreq': 'Fréquence robot',
    'tip.ringFreq': 'Fréquence du porteur du ring mod.',
    'slider.irType': 'Type réverbe',
    'tip.irType': 'Caractère acoustique de la réverbe.',
    'ir.room': 'Salle',
    'ir.hall': 'Hall',
    'ir.cathedral': 'Cathédrale',
    'ir.plate': 'Plate',
    'slider.reverb': 'Réverbe',
    'tip.reverb': 'Niveau de la réverbe.',
    'slider.drive': 'Saturation',
    'tip.drive': 'Saturation douce (tanh).',
    'slider.echo': 'Écho',
    'tip.echo': "Niveau de l'écho.",
    'slider.echoTime': 'Temps écho',
    'tip.echoTime': "Durée entre chaque répétition de l'écho.",
    'slider.chorus': 'Chorus',
    'tip.chorus': 'Épaissit la voix par léger délai modulé.',
    'slider.deesser': 'Dé-esser',
    'tip.deesser': 'Adoucit les sibilants (s, ch) durcis par les shifts.',
    'slider.volume': 'Volume',
    'tip.volume': 'Volume général de la sortie.',

    'group.realistes': 'Réalistes',
    'group.personnages': 'Personnages',
    'group.radio': 'Radio & scène',
    'group.mine': 'Mes voix',

    'preset.naturel': 'Naturel',
    'preset.feminin': 'Féminin',
    'preset.femininDoux': 'Féminin doux',
    'preset.masculin': 'Masculin',
    'preset.masculinProfond': 'Voix profonde',
    'preset.enfant': 'Enfant',
    'preset.ado': 'Ado',
    'preset.vieilleDame': 'Vieille dame',
    'preset.vieuxMonsieur': 'Vieux monsieur',
    'preset.ecureuil': 'Écureuil',
    'preset.bebe': 'Bébé',
    'preset.monstre': 'Monstre',
    'preset.geant': 'Géant',
    'preset.robot': 'Robot',
    'preset.alien': 'Alien',
    'preset.demon': 'Démon',
    'preset.sorcier': 'Sorcier',
    'preset.fantome': 'Fantôme',
    'preset.etouffe': 'Étouffé',
    'preset.telephone': 'Téléphone',
    'preset.interphone': 'Interphone',
    'preset.radio': 'Radio',
    'preset.podcast': 'Podcast',
    'preset.stadium': 'Stadium',
    'preset.cathedrale': 'Cathédrale',
    'preset.choeur': 'Chœur',
    'preset.double': 'Double voix',
    'preset.murmure': 'Murmure',

    'dev.micFallback': 'Microphone',
    'dev.outFallback': 'Sortie',
    'dev.systemDefault': 'Sortie par défaut du système',

    'toast.micDenied': "Erreur : accès micro refusé",
    'toast.outputRefused': 'Sortie audio refusée',
    'toast.playbackBlocked': 'Lecture bloquée',
    'toast.errGeneric': 'Erreur',
    'toast.irLoaded': 'IR chargée',
    'toast.irDecodeFail': 'Impossible de décoder ce fichier',
    'toast.irNeedStart': 'Démarre le traitement avant de charger une IR.',
    'toast.customNeedName': 'Donne un nom à ta voix avant de sauvegarder.',
    'toast.customSaved': 'Voix sauvegardée',
    'toast.logsMissing': 'Dossier de logs introuvable',
    'toast.updAvailable': 'Mise à jour {v} disponible — téléchargement…',
    'toast.updReady': "Mise à jour {v} prête — elle s'installera à la fermeture de l'app.",

    'rvc.checking': 'Vérification…',
    'rvc.noOrt': 'onnxruntime-node indisponible',
    'rvc.noHubert': 'Encodeur hubert manquant (models/hubert/hubert.onnx)',
    'rvc.noVoices': 'Aucune voix — place les modèles dans models/',
    'rvc.loaded': 'Prêt — voix « ',
    'rvc.loadedEnd': ' » chargée',
    'rvc.available': ' voix disponible(s) — charge-en une',
    'rvc.toastNoVoice': 'Aucune voix à charger.',
    'rvc.toastLoaded': 'Voix RVC « ',
    'rvc.toastLoadedEnd': ' » chargée.',
    'rvc.toastLoadFail': 'Chargement RVC impossible',
    'rvc.toastEnableFirst': "Charge d'abord une voix RVC.",
    'rvc.toastChunkNext': 'Nouvelle latence appliquée au prochain démarrage.',
    'rvc.toastUrlNeed': 'Indique un nom et une URL de modèle .onnx.',
    'rvc.toastDownloading': 'Téléchargement en cours…',
    'rvc.toastAdded': 'Voix « ',
    'rvc.toastAddedEnd': ' » ajoutée.',
    'rvc.toastDlFailed': 'Téléchargement échoué',
  },

  en: {
    'status.stopped': 'Stopped',
    'status.active': 'Active',
    'btn.start': 'Start',
    'btn.stop': 'Stop',

    'tab.voice': 'Voice',
    'tab.fx': 'Effects',
    'tab.audio': 'Audio',
    'tab.settings': 'Settings',

    'card.ns': 'Noise suppression',
    'settings.general': 'General',
    'settings.maintenance': 'Maintenance',
    'settings.about': 'About',
    'settings.reset': 'Reset settings',
    'settings.tagline': 'real-time voice changer, 100% local and open source.',
    'btn.sponsor': 'Support the project',
    'toast.resetConfirm': 'Click again to confirm the reset.',
    'toast.resetDone': 'Settings reset.',

    'card.devices': 'Devices',
    'card.presets': 'Voice presets',
    'card.voice': 'Voice & realism',
    'card.fx': 'Effects',
    'card.rvc': 'Neural conversion (RVC — experimental)',

    'label.mic': 'Microphone (input)',
    'label.out': 'Audio output',
    'label.monitor': 'Hear yourself (voice test)',
    'label.lang': 'Language',
    'label.ns': 'Noise suppression (RNNoise)',
    'slider.nsStrength': 'NS strength',
    'tip.nsStrength': 'Blend between the denoised signal and the raw signal.',

    'hint.vbcable':
      'For a virtual mic in Discord / OBS / games: install <b>VB-CABLE</b> (free), pick <b>CABLE Input</b> as the output here, then <b>CABLE Output</b> as the microphone in the target app. Use headphones to avoid feedback.',
    'btn.openLogs': 'Open logs',

    'placeholder.customName': 'Your voice name…',
    'btn.save': 'Save',

    'btn.loadIR': 'Load a custom IR (.wav)…',

    'rvc.state': 'Status',
    'rvc.voice': 'RVC voice',
    'btn.load': 'Load',
    'rvc.chunk': 'Latency (block)',
    'rvc.enable': ' Enable on output',
    'rvc.addUrl': 'Add via URL',
    'placeholder.rvcName': 'name',
    'btn.download': 'Download',
    'hint.rvc':
      'Put models in <b>models/&lt;name&gt;/model.onnx</b> (official RVC ONNX export) and the encoder in <b>models/hubert/hubert.onnx</b>, then reload. Models run on CPU: expect ~300-700 ms of extra latency.',

    'slider.pitch': 'Pitch',
    'tip.pitch': 'Voice pitch in semitones.',
    'slider.formant': 'Formant',
    'tip.formant': 'Formant shift independent of pitch — key to M↔F realism.',
    'slider.timbre': 'Timbre (EQ)',
    'tip.timbre': 'Complementary EQ around the formants.',
    'slider.transients': 'Transients',
    'tip.transients': 'Keeps consonants crisp during the shift.',
    'slider.grain': 'Grain (quality)',
    'tip.grain': 'Pitch shifter grain size: stable ↔ responsive.',
    'slider.gate': 'Noise gate',
    'tip.gate': 'Mutes the mic below this level.',
    'slider.vibrDepth': 'Vibrato',
    'tip.vibrDepth': 'Vibrato depth.',
    'slider.vibrRate': 'Vibrato rate',
    'tip.vibrRate': 'Vibrato speed.',
    'slider.humanize': 'Humanize',
    'tip.humanize': 'Random micro pitch drift for a natural feel.',
    'slider.breath': 'Breath',
    'tip.breath': 'Adds an air layer following voice intensity.',
    'slider.ring': 'Robot (ring mod)',
    'tip.ring': 'Ring modulation: robot effect.',
    'slider.ringFreq': 'Robot frequency',
    'tip.ringFreq': 'Ring mod carrier frequency.',
    'slider.irType': 'Reverb type',
    'tip.irType': 'Acoustic character of the reverb.',
    'ir.room': 'Room',
    'ir.hall': 'Hall',
    'ir.cathedral': 'Cathedral',
    'ir.plate': 'Plate',
    'slider.reverb': 'Reverb',
    'tip.reverb': 'Reverb level.',
    'slider.drive': 'Saturation',
    'tip.drive': 'Soft saturation (tanh).',
    'slider.echo': 'Echo',
    'tip.echo': 'Echo level.',
    'slider.echoTime': 'Echo time',
    'tip.echoTime': 'Time between each echo repetition.',
    'slider.chorus': 'Chorus',
    'tip.chorus': 'Thickens the voice with slight modulated delay.',
    'slider.deesser': 'De-esser',
    'tip.deesser': "Softens sibilants (s, ch) hardened by the shifts.",
    'slider.volume': 'Volume',
    'tip.volume': 'Overall output volume.',

    'group.realistes': 'Realistic',
    'group.personnages': 'Characters',
    'group.radio': 'Radio & stage',
    'group.mine': 'My voices',

    'preset.naturel': 'Natural',
    'preset.feminin': 'Female',
    'preset.femininDoux': 'Soft female',
    'preset.masculin': 'Male',
    'preset.masculinProfond': 'Deep voice',
    'preset.enfant': 'Child',
    'preset.ado': 'Teen',
    'preset.vieilleDame': 'Old lady',
    'preset.vieuxMonsieur': 'Old man',
    'preset.ecureuil': 'Squirrel',
    'preset.bebe': 'Baby',
    'preset.monstre': 'Monster',
    'preset.geant': 'Giant',
    'preset.robot': 'Robot',
    'preset.alien': 'Alien',
    'preset.demon': 'Demon',
    'preset.sorcier': 'Wizard',
    'preset.fantome': 'Ghost',
    'preset.etouffe': 'Muffled',
    'preset.telephone': 'Telephone',
    'preset.interphone': 'Intercom',
    'preset.radio': 'Radio',
    'preset.podcast': 'Podcast',
    'preset.stadium': 'Stadium',
    'preset.cathedrale': 'Cathedral',
    'preset.choeur': 'Choir',
    'preset.double': 'Double voice',
    'preset.murmure': 'Whisper',

    'dev.micFallback': 'Microphone',
    'dev.outFallback': 'Output',
    'dev.systemDefault': 'System default output',

    'toast.micDenied': 'Error: microphone access denied',
    'toast.outputRefused': 'Audio output refused',
    'toast.playbackBlocked': 'Playback blocked',
    'toast.errGeneric': 'Error',
    'toast.irLoaded': 'IR loaded',
    'toast.irDecodeFail': 'Could not decode this file',
    'toast.irNeedStart': 'Start processing before loading an IR.',
    'toast.customNeedName': 'Give your voice a name before saving.',
    'toast.customSaved': 'Voice saved',
    'toast.logsMissing': 'Logs folder not found',
    'toast.updAvailable': 'Update {v} available — downloading…',
    'toast.updReady': 'Update {v} ready — it will install when the app closes.',

    'rvc.checking': 'Checking…',
    'rvc.noOrt': 'onnxruntime-node unavailable',
    'rvc.noHubert': 'Hubert encoder missing (models/hubert/hubert.onnx)',
    'rvc.noVoices': 'No voices — put models in models/',
    'rvc.loaded': 'Ready — voice “',
    'rvc.loadedEnd': '” loaded',
    'rvc.available': ' voice(s) available — load one',
    'rvc.toastNoVoice': 'No voice to load.',
    'rvc.toastLoaded': 'RVC voice “',
    'rvc.toastLoadedEnd': '” loaded.',
    'rvc.toastLoadFail': 'RVC load failed',
    'rvc.toastEnableFirst': 'Load an RVC voice first.',
    'rvc.toastChunkNext': 'New latency applied on next start.',
    'rvc.toastUrlNeed': 'Provide a name and a .onnx model URL.',
    'rvc.toastDownloading': 'Downloading…',
    'rvc.toastAdded': 'Voice “',
    'rvc.toastAddedEnd': '” added.',
    'rvc.toastDlFailed': 'Download failed',
  },
};

let LANG = 'fr';
let LANG_MODE = 'auto';

(function initLang() {
  try {
    const saved = JSON.parse(localStorage.getItem('vt_settings') || '{}');
    if (saved.lang === 'fr' || saved.lang === 'en' || saved.lang === 'auto') {
      LANG_MODE = saved.lang;
    }
  } catch (e) {}
  if (LANG_MODE === 'auto') {
    LANG = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } else {
    LANG = LANG_MODE;
  }
})();

function t(key) {
  const d = I18N_DICT[LANG] || I18N_DICT.fr;
  return d[key] !== undefined ? d[key] : (I18N_DICT.fr[key] !== undefined ? I18N_DICT.fr[key] : key);
}

const i18nListeners = [];
function onLangChange(fn) {
  i18nListeners.push(fn);
}

function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
}

function setLang(mode) {
  if (mode !== 'auto' && mode !== 'fr' && mode !== 'en') return;
  LANG_MODE = mode;
  LANG = mode === 'auto'
    ? ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en')
    : mode;
  try {
    const meta = JSON.parse(localStorage.getItem('vt_settings') || '{}');
    meta.lang = LANG_MODE;
    localStorage.setItem('vt_settings', JSON.stringify(meta));
  } catch (e) {}
  applyStaticI18n();
  for (const fn of i18nListeners) {
    try { fn(); } catch (e) {}
  }
}
