# VoiceTweaker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/maxime-fleury/voiceTweaker/actions/workflows/ci.yml/badge.svg)](https://github.com/maxime-fleury/voiceTweaker/actions/workflows/ci.yml)

Voice changer temps réel pour Windows : pitch + **formants STFT**, transitoires préservés, réverbes réalistes (IR procédurales ou .wav perso), effets, et **conversion neuronale RVC** expérimentale. Sortie vers n'importe quel périphérique, y compris un micro virtuel (VB-CABLE) pour Discord / OBS / jeux.

**100 % local, sans compte, sans télémétrie.** Si le projet te plaît, [soutiens-le sur GitHub Sponsors](https://github.com/sponsors/maxime-fleury) 💜

## Télécharger

Récupère le dernier installeur (`VoiceTweaker-Setup-x.y.z.exe`) dans les
[Releases](https://github.com/maxime-fleury/voiceTweaker/releases). L'installeur
n'est pas signé : Windows SmartScreen peut afficher un avertissement au premier
lancement — clique **Informations supplémentaires → Exécuter quand même**.
Les mises à jour sont automatiques (vérification d'intégrité SHA512).

## Lancer

```bash
bun install
bun start
```

## Utilisation

1. Cliquez sur **Démarrer** (autorisez l'accès au micro).
2. Choisissez votre **microphone** et votre **sortie audio**.
3. Cochez **S'entendre (test de voix)** pour vous écouter en direct.
4. Choisissez une voix prédéfinie (28 voix groupées) ou ajustez les réglages.

### Réglages de voix

- **Pitch** : hauteur (-12 à +12 demi-tons), shifter granulaire 4 grains
- **Formant** : vraie translation formantique indépendante du pitch (STFT 1024 + enveloppe céstrale) — le réglage clé du réalisme M↔F
- **Timbre (EQ)** : complément d'égalisation
- **Transitoires** : préserve la netteté des consonnes pendant le shift
- **Grain** : taille des grains (qualité vs réactivité)
- **Noise gate**, **Vibrato**, **Humanisation** (dérive aléatoire naturelle), **Souffle**
- **Effets** : ring modulator (robot), réverbe (Salle / Hall / Cathédrale / Plate ou IR .wav perso), saturation, écho, chorus

### Voix personnalisées

Réglez les sliders → entrez un nom → **Sauver**. Les voix restent enregistrées et supprimables.

## Micro virtuel (Discord, OBS, jeux…)

1. Installez [VB-CABLE](https://vb-audio.com/Cable/) puis redémarrez.
2. Dans VoiceTweaker, choisissez **CABLE Input** comme *Sortie audio*.
3. Dans Discord/OBS/le jeu, choisissez **CABLE Output** comme *Microphone*.

Utilisez un casque pour éviter le larsen.

## Conversion neuronale RVC (expérimental)

Remplace le traitement DSP par un vrai modèle de voice conversion. Latence supplémentaire ~300-700 ms (CPU).

1. Récupérez un export ONNX d'encodeur HuBERT et placez-le dans `models/hubert/hubert.onnx`.
2. Placez une voix exportée ONNX (script d'export officiel RVC) dans `models/<nom>/model.onnx`.
3. Relancez l'app : la voix apparaît dans la carte RVC → **Charger** → cochez **Activer sur la sortie**.

Vous pouvez aussi ajouter un modèle par URL directe (.onnx) depuis l'interface. Le bouton « État » affiche ce qui manque. Sans modèle, tout le reste de l'app fonctionne normalement.

## Technique

- Electron + Web Audio API, AudioWorklets dédiés : pitch granulaire (4 grains Hann 75 % overlap, humanisation, vibrato, gate, ring mod), formant shifter céstral STFT, tap/chunk player pour le pipeline RVC.
- Effets natifs : convolution (IR générées avec réflexions précoces + décroissance dépendante de la fréquence), waveshaper, delay, chorus, compresseur.
- Sortie sélectionnable via `setSinkId`, routage RVC commutable à chaud.

### Tests

```bash
bun run smoke     # vérification des worklets + rendu offline
bun run test:e2e  # suite E2E complète (UI, presets, audio réel avec micro factice)
```

## Licence

[MIT](LICENSE) — Copyright (c) 2026 maxime-fleury
