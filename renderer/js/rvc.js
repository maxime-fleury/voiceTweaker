'use strict';

async function refreshRvcStatus() {
  const s = await window.vt.rvc.status();
  rvc.available = s.ortOk;
  rvc.hubertOk = s.hubertOk;
  rvc.voices = s.voices;
  rvc.loaded = s.loaded;

  const el = $('rvcStatus');
  if (!s.ortOk) {
    el.textContent = t('rvc.noOrt');
    el.className = 'rvc-status warn';
  } else if (!s.hubertOk) {
    el.textContent = t('rvc.noHubert');
    el.className = 'rvc-status warn';
  } else if (!s.voices.length) {
    el.textContent = t('rvc.noVoices');
    el.className = 'rvc-status warn';
  } else if (s.loaded) {
    el.textContent = t('rvc.loaded') + s.loaded + t('rvc.loadedEnd');
    el.className = 'rvc-status ok';
  } else {
    el.textContent = s.voices.length + t('rvc.available');
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
      toast(t('rvc.toastNoVoice'));
      return;
    }
    $('rvcLoadBtn').disabled = true;
    try {
      const res = await window.vt.rvc.load(id);
      if (!res.ok) throw new Error(res.error);
      toast(t('rvc.toastLoaded') + id + t('rvc.toastLoadedEnd'));
    } catch (err) {
      toast(t('rvc.toastLoadFail') + ' : ' + err.message);
    }
    $('rvcLoadBtn').disabled = false;
    refreshRvcStatus();
  });

  $('rvcImportBtn').addEventListener('click', async () => {
    $('rvcImportBtn').disabled = true;
    try {
      const res = await window.vt.rvc.import();
      if (res.added && res.added.length) {
        toast(t('rvc.toastImported') + ' ' + res.added.map((m) => m.id).join(', '));
        await refreshRvcStatus();
      }
    } catch (err) {
      toast(t('rvc.toastLoadFail') + ' : ' + err.message);
    }
    $('rvcImportBtn').disabled = false;
  });

  $('rvcDeleteBtn').addEventListener('click', async () => {
    const id = $('rvcVoice').value;
    if (!id) {
      toast(t('rvc.toastNoVoice'));
      return;
    }
    try {
      await window.vt.rvc.remove(id);
      toast(t('rvc.toastDeleted') + ' « ' + id + ' »');
    } catch (err) {
      toast(t('rvc.toastLoadFail') + ' : ' + err.message);
    }
    refreshRvcStatus();
  });

  $('rvcEnable').addEventListener('change', (e) => {
    rvc.enabled = e.target.checked;
    if (rvc.enabled && !rvc.loaded) {
      toast(t('rvc.toastEnableFirst'));
      e.target.checked = false;
      rvc.enabled = false;
      return;
    }
    connectOutput();
    applyParams();
    updateLatency();
  });

  $('rvcChunk').addEventListener('change', (e) => {
    rvc.chunkMs = parseInt(e.target.value, 10);
    saveSettingsDebounced();
    updateLatency();
    toast(t('rvc.toastChunkNext'));
  });

  $('rvcAddBtn').addEventListener('click', async () => {
    const name = $('rvcUrlName').value.trim();
    const url = $('rvcUrl').value.trim();
    if (!name || !url) {
      toast(t('rvc.toastUrlNeed'));
      return;
    }
    $('rvcAddBtn').disabled = true;
    toast(t('rvc.toastDownloading'));
    const res = await window.vt.rvc.addUrl(name, url);
    $('rvcAddBtn').disabled = false;
    if (res.ok) {
      toast(t('rvc.toastAdded') + name + t('rvc.toastAddedEnd'));
      $('rvcUrlName').value = '';
      $('rvcUrl').value = '';
      refreshRvcStatus();
    } else {
      toast(t('rvc.toastDlFailed') + ' : ' + res.error);
    }
  });
}
