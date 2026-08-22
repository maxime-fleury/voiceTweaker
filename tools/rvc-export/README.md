# Conversion d'un modèle RVC (.pth) en ONNX

Ce dossier contient le code officiel de RVC (tag `2.2.231006`, MIT) adapté pour
exporter un modèle `.pth` entraîné en `model.onnx` utilisable par `rvc-engine.js`
(onnxruntime-node).

## Dépendances (Python, hors repo)

```bash
pip install torch==2.13 scikit-learn scipy onnx onnxscript transformers
```

Testé avec `torch 2.13.0+cpu` et `transformers` récents.

## 1. Convertir le générateur (.pth -> model.onnx)

```bash
cd tools/rvc-export
PYTHONPATH=. python -c "import sys; sys.path.insert(0,'.'); \
  import torch; _o=torch.load; torch.load=lambda *a,**k:_o(*a,**{**k,'weights_only':False}); \
  import infer.modules.onnx.export as ex; \
  ex.export_onnx(r'..\..\models\VOTRE_VOIX\VOTRE_VOIX.pth', r'..\..\models\VOTRE_VOIX\model.onnx')"
```

Notes de patch (déjà appliquées dans ce dossier) :

- `infer/lib/infer_pack/models_onnx.py` : `ResidualCouplingBlock.forward` en mode
  `reverse` décompresse bien le tuple `(x, logdet)` (requis depuis torch 2.6+).
- `infer/modules/onnx/export.py` : l'attention relative à fenêtre (`window_size`)
  est désactivée avant l'export. Ses `reshape` cuisent la longueur temporelle `T`
  lors du tracing ONNX et cassent l'inférence à `T` variable. On garde une
  attention dot-product pure (dynamique), les poids `emb_rel` devenant inutilisés
  (harmless, `strict=False`).

Le modèle exporté attend 6 entrées : `phone [1,T,D]`, `phone_lengths [1]`,
`pitch [1,T]` (coarse 1..255), `pitchf [1,T]` (Hz float), `ds [1]` (speaker),
`rnd [1,192,T]` (bruit). Sortie : `audio`.

## 2. Convertir l'encodeur ContentVec (HuBERT couche 12)

`rvc-engine.js` attend `models/hubert/hubert.onnx` (entrée `wav [1,T]` brut 16 kHz
non normalisé, sortie `features [1,T/320,768]`).

```bash
PYTHONPATH=. python export_contentvec.py <dossier content-vec-best> ..\..\models\hubert\hubert.onnx
```

`lengyue233/content-vec-best` (format transformers, équivalent HuBERT base
couche 12) est utilisé ; l'attention est forcée en mode `eager` pour éviter
l'opérateur `scaled_dot_product_attention` non supporté par opset 13.

## Droits

Code RVC sous licence MIT (voir le dépôt d'origine RVC-Project). Ce dossier est
un outil de conversion local, aucune donnée n'est envoyée sur le réseau.
