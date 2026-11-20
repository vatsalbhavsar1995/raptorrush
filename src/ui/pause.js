import { CONFIG } from '../config.js';

export function sanitizeSettings(raw) {
  const clean = { ...CONFIG.settings.defaults };
  if (!raw || typeof raw !== 'object') return clean;

  for (let i = 0; i < CONFIG.settings.definitions.length; i++) {
    const [key, , choices] = CONFIG.settings.definitions[i];
    const value = raw[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < choices.length) {
      clean[key] = value;
    } else if (typeof value === 'boolean' && choices.length === 2) {
      clean[key] = value ? 1 : 0;
    }
  }
  return clean;
}

export function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG.settings.storageKey) || '{}');
    return sanitizeSettings(parsed);
  } catch {
    return { ...CONFIG.settings.defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(CONFIG.settings.storageKey, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
}

export function createPauseMenu({
  settings,
  onApplySettings,
  onPause,
  onResume,
  onChangeDino,
  onRestart,
  onQuit,
}) {
  const pauseEl = document.getElementById('pause');
  const optsEl = document.getElementById('opts');
  const pauseBtn = document.getElementById('pbtn');
  const resumeBtn = document.getElementById('resume');
  const changeDinoBtn = document.getElementById('change-dino');
  const restartBtn = document.getElementById('restart');
  const quitBtn = document.getElementById('quit');

  function renderOptions() {
    optsEl.innerHTML = '';
    for (let i = 0; i < CONFIG.settings.definitions.length; i++) {
      const [key, label, choices] = CONFIG.settings.definitions[i];
      const row = document.createElement('div');
      row.className = 'opt';
      const span = document.createElement('span');
      span.textContent = label;
      row.appendChild(span);

      const seg = document.createElement('div');
      seg.className = 'seg';
      for (let cIdx = 0; cIdx < choices.length; cIdx++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = choices[cIdx];
        if (settings[key] === cIdx) btn.className = 'on';
        btn.addEventListener('click', () => {
          settings[key] = cIdx;
          saveSettings(settings);
          onApplySettings();
          renderOptions();
        });
        seg.appendChild(btn);
      }
      row.appendChild(seg);
      optsEl.appendChild(row);
    }
  }

  function show() {
    renderOptions();
    pauseEl.classList.remove('hide');
  }

  function hide() {
    pauseEl.classList.add('hide');
  }

  pauseBtn.addEventListener('click', onPause);
  resumeBtn.addEventListener('click', onResume);
  if (changeDinoBtn && onChangeDino) {
    changeDinoBtn.addEventListener('click', onChangeDino);
  }
  restartBtn.addEventListener('click', onRestart);
  quitBtn.addEventListener('click', onQuit);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onPause();
  });

  return {
    show,
    hide,
    renderOptions,
  };
}
