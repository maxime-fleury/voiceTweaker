'use strict';

/* Soundboard : pads audio importés, joués dans le bus micro (limiteur inclus),
   avec étouffement optionnel de la voix pendant la lecture. */

const SB_STORE_KEY = 'vt_sounds';
let sbBuffers = new Map();
let sbActive = new Set();

function sbList() {
  try {
    return JSON.parse(localStorage.getItem(SB_STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

function sbSave(list) {
  localStorage.setItem(SB_STORE_KEY, JSON.stringify(list));
}

function renderPads() {
  const wrap = $('sbPads');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const s of sbList()) {
    const pad = document.createElement('button');
    pad.className = 'pad';
    pad.textContent = s.name;
    pad.addEventListener('click', () => playSound(s));
    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Supprimer';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.vt.sb.remove(s.file);
      sbSave(sbList().filter((x) => x.id !== s.id));
      sbBuffers.delete(s.id);
      renderPads();
    });
    pad.appendChild(del);
    wrap.appendChild(pad);
  }
}

async function decodeSound(s) {
  if (sbBuffers.has(s.id)) return sbBuffers.get(s.id);
  const res = await window.vt.sb.load(s.file);
  if (!res.ok) {
    toast(t('toast.sbLoadFail') + ' : ' + res.error);
    return null;
  }
  const buf = await state.ctx.decodeAudioData(res.data);
  sbBuffers.set(s.id, buf);
  return buf;
}

function duck(on) {
  if (!state.duckVoice || !params.sbDuck || !state.ctx) return;
  const g = state.duckVoice.gain;
  const t = state.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(on ? 0.25 : 1, t + 0.08);
}

async function playSound(s) {
  if (!state.running || !state.ctx) {
    toast(t('toast.sbNeedStart'));
    return;
  }
  const buf = await decodeSound(s);
  if (!buf) return;
  const src = state.ctx.createBufferSource();
  src.buffer = buf;
  src.connect(state.sbBus);
  src.onended = () => {
    sbActive.delete(src);
    if (sbActive.size === 0) duck(false);
  };
  src.start();
  sbActive.add(src);
  duck(true);
}

function stopAllSounds() {
  for (const src of [...sbActive]) {
    try { src.stop(); } catch (e) {}
  }
  sbActive.clear();
  duck(false);
}

function initSoundboard() {
  $('s_sbVol').value = String(params.sbVolume);
  $('v_sbVol').textContent = Math.round(params.sbVolume) + ' %';
  $('sbDuck').checked = !!params.sbDuck;

  renderPads();

  $('sbAdd').addEventListener('click', async () => {
    const res = await window.vt.sb.add();
    if (res.ok && res.added.length) {
      sbSave([...sbList(), ...res.added]);
      renderPads();
      toast(t('toast.sbAdded') + ' ' + res.added.length);
    }
  });

  $('sbStopAll').addEventListener('click', stopAllSounds);

  $('s_sbVol').addEventListener('input', () => {
    params.sbVolume = parseFloat($('s_sbVol').value);
    $('v_sbVol').textContent = Math.round(params.sbVolume) + ' %';
    applyParams();
    saveSettingsDebounced();
  });

  $('sbDuck').addEventListener('change', (e) => {
    params.sbDuck = e.target.checked;
    saveSettingsDebounced();
  });
}
