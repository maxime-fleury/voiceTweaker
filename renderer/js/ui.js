'use strict';

let toastTimer = null;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

function setStatus(on) {
  $('statusDot').classList.toggle('on', on);
  $('statusText').textContent = on ? 'Actif' : 'Arrêté';
  const btn = $('toggleBtn');
  btn.textContent = on ? 'Arrêter' : 'Démarrer';
  btn.classList.toggle('stop', on);
  document.body.classList.toggle('running', on);
}

/* ---------- Persistance ---------- */

function savedSettings() {
  try {
    return JSON.parse(localStorage.getItem('vt_settings') || '{}');
  } catch {
    return {};
  }
}

function saveSettingsNow() {
  const meta = {
    params: {},
    micId: $('micSelect').value || '',
    outId: $('outSelect').value || 'default',
    monitor: $('monitorChk').checked,
    chunkMs: rvc.chunkMs,
  };
  for (const s of SLIDERS) meta.params[s.id] = params[s.id];
  meta.params.low = typeof params.low === 'number' ? params.low : null;
  meta.params.high = typeof params.high === 'number' ? params.high : null;
  localStorage.setItem('vt_settings', JSON.stringify(meta));
}

function saveSettingsDebounced() {
  clearTimeout(saveSettingsDebounced._t);
  saveSettingsDebounced._t = setTimeout(saveSettingsNow, 250);
}

function loadSettings() {
  const saved = savedSettings();
  if (saved.params) {
    for (const s of SLIDERS) {
      const v = saved.params[s.id];
      if (s.type === 'select') {
        if (typeof v === 'string') params[s.id] = v;
      } else if (typeof v === 'number' && isFinite(v)) {
        params[s.id] = Math.min(s.max, Math.max(s.min, v));
      }
    }
    for (const k of ['low', 'high']) {
      const v = saved.params[k];
      if (v === null || (typeof v === 'number' && isFinite(v))) params[k] = v;
    }
  }
  if (typeof saved.chunkMs === 'number') rvc.chunkMs = saved.chunkMs;
  return saved;
}

/* ---------- Devices ---------- */

async function listDevices() {
  const saved = savedSettings();
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter((d) => d.kind === 'audioinput');
  const outs = devices.filter((d) => d.kind === 'audiooutput');

  const micSel = $('micSelect');
  const prevMic = micSel.value;
  micSel.innerHTML = '';
  for (const d of mics) {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Microphone (' + d.deviceId.slice(0, 8) + '…)';
    micSel.appendChild(opt);
  }
  const wantMic = prevMic || saved.micId;
  if (wantMic && [...micSel.options].some((o) => o.value === wantMic)) micSel.value = wantMic;

  const outSel = $('outSelect');
  const prevOut = outSel.value;
  outSel.innerHTML = '';
  const def = document.createElement('option');
  def.value = 'default';
  def.textContent = 'Sortie par défaut du système';
  outSel.appendChild(def);
  for (const d of outs) {
    if (d.deviceId === 'default') continue;
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Sortie (' + d.deviceId.slice(0, 8) + '…)';
    outSel.appendChild(opt);
  }
  const wantOut = prevOut !== 'default' && prevOut ? prevOut : saved.outId;
  if (wantOut && [...outSel.options].some((o) => o.value === wantOut)) outSel.value = wantOut;
}

/* ---------- Sliders ---------- */

function updateSliderFill(input) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const v = parseFloat(input.value);
  const pct = ((v - min) / (max - min)) * 100;
  input.style.setProperty('--fill', pct + '%');
}

function setValueLabel(id) {
  const el = $('v_' + id);
  if (!el) return;
  const cfg = SLIDER_BY_ID[id];
  el.textContent = cfg && cfg.fmt ? cfg.fmt(params[id]) : '';
}

function setSlider(id, value) {
  const s = $('s_' + id);
  if (!s) return;
  s.value = value;
  updateSliderFill(s);
  setValueLabel(id);
}

function renderSliders(containerId, group) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';

  for (const s of SLIDERS) {
    if (s.group !== group) continue;

    const row = document.createElement('div');
    row.className = 'row';

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = s.label;
    lbl.title = s.tip || '';
    row.appendChild(lbl);

    let control;
    if (s.type === 'select') {
      control = document.createElement('select');
      control.className = 'inline-select';
      control.id = s.id;
      control.title = s.tip || '';
      for (const o of s.options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        control.appendChild(opt);
      }
      control.addEventListener('change', () => {
        params[s.id] = control.value;
        state.customIr = null;
        rebuildConvolver();
        saveSettingsDebounced();
      });
    } else {
      control = document.createElement('input');
      control.type = 'range';
      control.id = 's_' + s.id;
      control.min = s.min;
      control.max = s.max;
      control.step = s.step;
      control.value = params[s.id];
      control.title = s.tip || '';
      control.addEventListener('input', () => {
        params[s.id] = parseFloat(control.value);
        if (s.id === 'timbre') {
          params.low = null;
          params.high = null;
        }
        updateSliderFill(control);
        setValueLabel(s.id);
        applyParams();
        saveSettingsDebounced();
        if (s.id === 'grain') updateLatency();
      });
    }

    const val = document.createElement('span');
    val.className = 'val';
    val.id = 'v_' + s.id;

    row.appendChild(control);
    row.appendChild(val);
    container.appendChild(row);

    if (s.type !== 'select') {
      updateSliderFill(control);
      setValueLabel(s.id);
    }
  }
}

/* ---------- Presets UI ---------- */

let ALL_PRESETS = {};

function renderPresets() {
  ALL_PRESETS = Object.assign({}, PRESETS, getCustomPresets());
  const wrap = $('presets');
  if (!wrap) return;
  wrap.innerHTML = '';

  const customs = getCustomPresets();
  const groups = [
    ...PRESET_GROUPS,
    { name: 'Mes voix', keys: Object.keys(customs), custom: true },
  ];

  for (const group of groups) {
    if (!group.keys.length) continue;
    const title = document.createElement('h3');
    title.className = 'group-title';
    title.textContent = group.name;
    wrap.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const key of group.keys) {
      const preset = ALL_PRESETS[key];
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset.key = key;
      chip.textContent = preset.label;
      chip.addEventListener('click', () => applyPreset(key));
      if (group.custom) {
        const del = document.createElement('span');
        del.className = 'del';
        del.textContent = '×';
        del.title = 'Supprimer';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCustomPreset(key);
          renderPresets();
        });
        chip.appendChild(del);
      }
      chips.appendChild(chip);
    }
    wrap.appendChild(chips);
  }
}

function applyPreset(key) {
  const preset = ALL_PRESETS[key];
  if (!preset) return;
  const merged = Object.assign({}, DEFAULT_PARAMS, preset.p);
  for (const s of SLIDERS) params[s.id] = merged[s.id];
  params.low = typeof preset.p.low === 'number' ? preset.p.low : null;
  params.high = typeof preset.p.high === 'number' ? preset.p.high : null;

  for (const s of SLIDERS) {
    if (s.type === 'select') {
      const el = $(s.id);
      if (el) el.value = params[s.id];
    } else {
      setSlider(s.id, params[s.id]);
    }
  }

  state.customIr = null;
  rebuildConvolver();
  applyParams();
  updateLatency();

  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.key === key));
  saveSettingsDebounced();
}

/* ---------- Meter ---------- */

const meterCanvas = $('meter');
const meterCtx = meterCanvas.getContext('2d');

function drawMeter() {
  const w = meterCanvas.clientWidth;
  const h = meterCanvas.height;
  if (meterCanvas.width !== w) meterCanvas.width = w;

  meterCtx.clearRect(0, 0, w, h);

  const db = state.level > 0 ? 20 * Math.log10(state.level) : -100;
  const norm = Math.min(1, Math.max(0, (db + 60) / 60));
  const barW = Math.max(3, norm * (w - 8));

  const grad = meterCtx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#3ddc84');
  grad.addColorStop(0.7, '#ffd166');
  grad.addColorStop(1, '#ff5d6c');
  meterCtx.fillStyle = grad;
  if (typeof meterCtx.roundRect === 'function') {
    meterCtx.beginPath();
    meterCtx.roundRect(4, 10, barW, h - 20, 6);
    meterCtx.fill();
  } else {
    meterCtx.fillRect(4, 10, barW, h - 20);
  }

  meterCtx.fillStyle = 'rgba(139,148,167,0.35)';
  for (let i = 1; i < 6; i++) {
    meterCtx.fillRect(((w - 8) * i) / 6 + 4, 8, 1, h - 16);
  }

  requestAnimationFrame(drawMeter);
}
