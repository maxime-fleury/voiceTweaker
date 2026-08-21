'use strict';

/* Wizard de premier lancement : micro → VB-CABLE (détection) → voix de départ. */

const WIZARD_VOICES = ['naturel', 'feminin', 'masculin', 'robot'];
let wizStep = 1;
let wizAutoTimer = 0;

function wizardSetStep(n) {
  wizStep = n;
  for (let i = 1; i <= 3; i++) {
    document.getElementById('wp' + i).classList.toggle('active', i === n);
  }
  const dots = document.querySelectorAll('.wizard-dots i');
  dots.forEach((d, idx) => d.classList.toggle('on', idx < n));
  $('wizBack').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('wizNext').textContent = n === 3 ? t('wiz.finish') : t('wiz.next');
}

async function wizardCheckCable() {
  const box = $('wizCable');
  box.textContent = t('wiz.checking');
  box.className = 'cable-state';
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const labeled = devs.some((d) => d.label);
    const hasOut = devs.some((d) => d.kind === 'audiooutput' && /cable/i.test(d.label));
    const hasIn = devs.some((d) => d.kind === 'audioinput' && /cable/i.test(d.label));
    if (!labeled) {
      box.textContent = t('wiz.unknown');
      box.className = 'cable-state warn';
    } else if (hasOut || hasIn) {
      box.textContent = t('wiz.found');
      box.className = 'cable-state ok';
    } else {
      box.textContent = t('wiz.notfound');
      box.className = 'cable-state warn';
    }
  } catch (e) {
    box.textContent = t('wiz.unknown');
    box.className = 'cable-state warn';
  }
}

function showWizard() {
  const sel = $('wizMic');
  sel.innerHTML = '';
  [...$('micSelect').options].forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.textContent;
    sel.appendChild(opt);
  });
  if ($('micSelect').value) sel.value = $('micSelect').value;

  const wrap = $('wizVoices');
  wrap.innerHTML = '';
  for (const key of WIZARD_VOICES) {
    const preset = ALL_PRESETS[key];
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.key = key;
    chip.textContent = preset.labelKey ? t(preset.labelKey) : preset.label;
    chip.addEventListener('click', () => {
      applyPreset(key);
      wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
    wrap.appendChild(chip);
  }

  $('wizard').classList.remove('hidden');
  wizardSetStep(1);
}

function closeWizard() {
  if (wizAutoTimer) {
    clearTimeout(wizAutoTimer);
    wizAutoTimer = 0;
  }
  try {
    localStorage.setItem(
      'vt_settings',
      JSON.stringify(Object.assign(savedSettings(), { wizardDone: true }))
    );
  } catch (e) {}
  $('wizard').classList.add('hidden');
}

function initWizard(saved) {
  $('wizNext').addEventListener('click', () => {
    if (wizStep < 3) {
      wizardSetStep(wizStep + 1);
      if (wizStep === 2) wizardCheckCable();
      return;
    }
    const v = $('wizMic').value;
    if (v && v !== $('micSelect').value) {
      $('micSelect').value = v;
      $('micSelect').dispatchEvent(new Event('change'));
    }
    closeWizard();
  });

  $('wizBack').addEventListener('click', () => wizardSetStep(Math.max(1, wizStep - 1)));
  $('wizSkip').addEventListener('click', closeWizard);
  $('wizCableRetry').addEventListener('click', wizardCheckCable);
  $('wizCableOpen').addEventListener('click', () => window.vt.openUrl('https://vb-audio.com/Cable/'));

  if (!saved.wizardDone) wizAutoTimer = setTimeout(showWizard, 500);
}
