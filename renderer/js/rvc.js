'use strict';

async function refreshRvcStatus() {
  const s = await window.vt.rvc.status();
  rvc.available = s.ortOk;
  rvc.hubertOk = s.hubertOk;
  rvc.voices = s.voices;
  rvc.loaded = s.loaded;

  const el = $('rvcStatus');
  if (!s.ortOk) {
    el.textContent = 'onnxruntime-node indisponible';
    el.className = 'rvc-status warn';
  } else if (!s.hubertOk) {
    el.textContent = 'Encodeur hubert manquant (models/hubert/hubert.onnx)';
    el.className = 'rvc-status warn';
  } else if (!s.voices.length) {
    el.textContent = 'Aucune voix — place les modèles dans models/';
    el.className = 'rvc-status warn';
  } else if (s.loaded) {
    el.textContent = 'Prêt — voix « ' + s.loaded + ' » chargée';
    el.className = 'rvc-status ok';
  } else {
    el.textContent = s.voices.length + ' voix disponible(s) — charge-en une';
    el.className = 'rvc-status';
  }

  const sel = $('rvcVoice');
  sel.innerHTML = '';
  for (const v of s.voices) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.label;
    sel.appendChild(opt);
  }
}

async function initRvc() {
  await refreshRvcStatus();

  $('rvcChunk').value = String(rvc.chunkMs);

  $('rvcLoadBtn').addEventListener('click', async () => {
    const id = $('rvcVoice').value;
    if (!id) {
      toast('Aucune voix à charger.');
      return;
    }
    $('rvcLoadBtn').disabled = true;
    try {
      const res = await window.vt.rvc.load(id);
      if (!res.ok) throw new Error(res.error);
      toast('Voix RVC « ' + id + ' » chargée.');
    } catch (err) {
      toast('Chargement RVC impossible : ' + err.message);
    }
    $('rvcLoadBtn').disabled = false;
    refreshRvcStatus();
  });

  $('rvcEnable').addEventListener('change', (e) => {
    rvc.enabled = e.target.checked;
    if (rvc.enabled && !rvc.loaded) {
      toast("Charge d'abord une voix RVC.");
      e.target.checked = false;
      rvc.enabled = false;
      return;
    }
    connectOutput();
    updateLatency();
  });

  $('rvcChunk').addEventListener('change', (e) => {
    rvc.chunkMs = parseInt(e.target.value, 10);
    saveSettingsDebounced();
    updateLatency();
    toast('Nouvelle latence appliquée au prochain démarrage.');
  });

  $('rvcAddBtn').addEventListener('click', async () => {
    const name = $('rvcUrlName').value.trim();
    const url = $('rvcUrl').value.trim();
    if (!name || !url) {
      toast('Indique un nom et une URL de modèle .onnx.');
      return;
    }
    $('rvcAddBtn').disabled = true;
    toast('Téléchargement en cours…');
    const res = await window.vt.rvc.addUrl(name, url);
    $('rvcAddBtn').disabled = false;
    if (res.ok) {
      toast('Voix « ' + name + ' » ajoutée.');
      $('rvcUrlName').value = '';
      $('rvcUrl').value = '';
      refreshRvcStatus();
    } else {
      toast('Téléchargement échoué : ' + res.error);
    }
  });
}
