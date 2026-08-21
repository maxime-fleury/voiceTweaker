# AGENTS.md — VoiceTweaker

Guide à destination des agents IA (Claude Code, opencode, Codex…) et des
contributeurs : ce que fait le projet, comment l'installer, le lancer, le
tester et les règles à respecter pour ne rien casser.

## Le projet en deux phrases

VoiceTweaker est un **changeur de voix temps réel pour Windows** (Electron +
Web Audio) : micro → DSP (pitch granulaire, formants STFT, gate, effets,
réverbes par convolution) → sortie sélectionnable, y compris un micro virtuel
(VB-CABLE) pour Discord/OBS/jeux. Une conversion neuronale **RVC** locale
(ONNX, onnxruntime-node) est disponible en expérimental. Interface en
français, 100 % local, zéro télémétrie.

## Installation automatisée (agent IA)

Depuis un clone frais, un agent IA peut tout faire avec ces commandes :

```bash
bun install                          # dépendances (postinstall gérés via trustedDependencies)
node node_modules/electron/install.js  # s'assure que le binaire Electron existe (idempotent)
bun run test:e2e                     # suite E2E complète : doit afficher SUMMARY 20/20
bun run smoke                        # vérifie worklets + rendu formant + RVC : SMOKE_OK
bun start                            # lance l'app
```

Si `test:e2e` ou `smoke` échouent, ne patche pas les tests pour les faire
passer : cherche la régression dans le code (voir « Règles d'or »).

## Commandes

| Commande | Rôle |
|---|---|
| `bun start` | Lance l'app en dev |
| `bun run test:e2e` | E2E headless (micro factice) — 20 tests, exit code fiable |
| `bun run smoke` | Smoke rapide : chargement des worklets, rendu offline, statut RVC |
| `bun run icon` | Régénère `renderer/favicon.ico` + `renderer/icon.png` (zéro dépendance) |
| `bun run dist:dir` | Build packagé non installable → `release/win-unpacked/` |
| `bun run dist` | Installeur NSIS signé en auto-intégrité → `release/` |

### Tester l'app packagée

```bash
bun run dist:dir
node scripts/smoke-runner.mjs release/win-unpacked/VoiceTweaker.exe
```

## Architecture

Pas de bundler : des scripts classiques qui partagent le scope global.
**L'ordre des `<script>` dans `renderer/index.html` est contractuel.**

```
main.js                  Processus principal : fenêtre, IPC RVC, logs locaux,
                         auto-update (packagé uniquement), modes VT_SMOKE / VT_E2E
preload.js               contextBridge → window.vt (rvc, openLogs, updater)
rvc-engine.js            Moteur RVC : sessions ONNX, resample, YIN f0, téléchargements
renderer/
  index.html             Charge reverb-irs.js puis js/i18n → config → presets → graph → ui → rvc → app.js
  app.js                 Orchestrateur : start/stop, listeners UI, hook i18n
  js/i18n.js             Dictionnaires FR/EN, détection OS (navigator.language), setLang persisté
  js/config.js           SLIDERS (source de vérité), params, DEFAULT_PARAMS, state, rvc
  js/presets.js          28 presets groupés + presets perso (localStorage)
  js/graph.js            Graphe audio, applyParams, routage RVC, latence
  js/ui.js               Sliders générés, presets chips, persistance 'vt_settings', vumètre
  js/rvc.js              Carte RVC (statut, chargement, URL)
  js/wizard.js           Wizard premier lancement (micro, VB-CABLE, voix de départ)
  worklets/*.js          DSP temps réel (AudioWorkletProcessor)
  reverb-irs.js          IR procédurales (room/hall/cathedral/plate)
tests/page-tests.js      Suite E2E exportée en string (exécutée dans le renderer)
scripts/                 Runners smoke/e2e + générateur d'icône
```

### Protocole worklets (important)

Les paramètres initiaux passent par **`processorOptions`** au moment de la
création du nœud ; `port.postMessage` sert uniquement aux mises à jour live.
Ne compte jamais sur un message post-création pour l'état initial (course
contre `startRendering()` — bug déjà corrigé une fois).

- `voice-processor` : `{pitch, grain, gateDb, ring(0..1), ringFreq, vibrDepth, vibrRate, humanize, breath, transients}` + messages sortants `{type:'meter', rms}`
- `formant-processor` : `{alpha}` (alpha = 2^(formant*4/1200))
- `stream-tap` → chunks Float32Array vers RVC ; `chunk-player` accepte `{audio: Float32Array}` (transférable)

## Règles d'or

1. **Toute modification passe par `bun run test:e2e` (15/15) et `bun run smoke`.**
   Un échec = régression à corriger, pas un test à assouplir.
2. L'UI est en **français** ; les identifiants techniques restent anglais.
3. Les presets définissent `low`/`high` (EQ) via `params.low/high` (`null` =
   dérivé du timbre). Ne recalcule pas ces gains hors de `applyParams()`.
4. CSP stricte (`default-src 'self'`) : pas de réseau côté renderer, pas de
   nouvelles sources inline (les styles inline sont autorisés pour `--fill`).
5. `models/` (poids RVC) et `release/` sont ignorés par git — ne les committe
   jamais.
6. La persistance va dans `localStorage` : `'vt_settings'` (réglages) et
   `'vt_custom_presets'` (voix perso). Toute nouvelle valeur doit être
   validée/bornée dans `loadSettings()`.
7. Windows d'abord : chemins, `setSinkId`, VB-CABLE. Pas d'API macOS/Linux
   sans garde-fou.
8. Pas de télémétrie, pas de compte, pas de cloud — c'est le positionnement
   produit, ne l'introduis pas.
9. **i18n** : tout texte visible passe par `t('clé')` (dictionnaires FR/EN
   dans `js/i18n.js`). Les libellés de SLIDERS/presets sont des fonctions
   évaluées au rendu ; le HTML statique utilise `data-i18n` / `-placeholder` /
   `-html`. Toute nouvelle chaîne existe dans les DEUX langues, et la
   bascule doit rester testée par l'E2E.

## Modes spéciaux

- `VT_SMOKE=1` : vérifications offline puis quit (utilisé par CI et `smoke-runner`)
- `VT_E2E=1` : micro factice Chromium, exécute `tests/page-tests.js`, remonte
  les erreurs console comme échecs, `SUMMARY X/Y` + exit code
