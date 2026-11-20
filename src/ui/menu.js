import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildDinoModel, disposeObjectTree } from '../entities/models.js';
import { saveSelectedDinoId } from '../entities/player.js';
import { formatTime } from './hud.js';

const STAT_ROWS = [
  ['speed', 'Speed'],
  ['health', 'Health'],
  ['bite', 'Bite'],
  ['stamina', 'Stamina'],
  ['armor', 'Armor'],
];

export function calcStatSegments(value) {
  const { statMin, statMax, minSegments, maxSegments } = CONFIG.picker;
  const ratio = (value - statMin) / (statMax - statMin);
  const raw = Math.round(minSegments + ratio * (maxSegments - minSegments));
  return Math.max(1, Math.min(maxSegments, raw));
}

const EVO_STAT_MAP = {
  speed: 'speed',
  health: 'max_health',
  bite: 'bite_damage',
  stamina: 'stamina_regen',
};

export function createMenu({ roster, initialDinoId, evo = null, onSelectDino, onStart }) {
  const cardEl = document.getElementById('card');
  const titleEl = document.getElementById('ti');
  const subEl = document.getElementById('card-sub');
  const msgEl = document.getElementById('msg');
  const controlsHintEl = document.getElementById('controls-hint');
  const goBtn = document.getElementById('go');

  const rosterEl = document.getElementById('pick-roster');
  const prevBtn = document.getElementById('pick-prev');
  const nextBtn = document.getElementById('pick-next');
  const nameEl = document.getElementById('pick-name');
  const previewWrap = document.getElementById('picker-preview');
  const roleEl = document.getElementById('pick-role');
  const descEl = document.getElementById('pick-desc');
  const statsEl = document.getElementById('pick-stats');
  const abTitleEl = document.getElementById('pick-ab-title');
  const abCdEl = document.getElementById('pick-ab-cd');
  const abDescEl = document.getElementById('pick-ab-desc');

  let currentIndex = Math.max(
    0,
    roster.findIndex((d) => d.id === initialDinoId),
  );
  let chosenDino = roster[currentIndex];
  let menuVisible = false;
  let isGameOverMode = false;

  // Isolated 3D preview resources (created while menu is visible, disposed on close)
  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewRoot = null;
  let previewModel = null;
  let previewRafId = 0;
  let previewCanvas = null;

  // Build 6-dino roster selector tabs once
  const rosterButtons = [];
  rosterEl.innerHTML = '';
  for (let i = 0; i < roster.length; i++) {
    const dino = roster[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roster-tab';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');

    const swatch = document.createElement('span');
    swatch.className = 'roster-swatch';
    swatch.style.background = dino.color;
    swatch.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'roster-label';
    label.textContent = dino.name;

    btn.appendChild(swatch);
    btn.appendChild(label);
    btn.addEventListener('click', () => selectIndex(i));
    rosterEl.appendChild(btn);
    rosterButtons.push(btn);
  }

  // Build stat row DOM once
  const statFillEls = Object.create(null);
  const statValEls = Object.create(null);
  statsEl.innerHTML = '';
  for (let i = 0; i < STAT_ROWS.length; i++) {
    const [key, label] = STAT_ROWS[i];
    const row = document.createElement('div');
    row.className = 'pstat';

    const b = document.createElement('b');
    b.textContent = label;

    const bar = document.createElement('div');
    bar.className = 'bar seg10';
    const fill = document.createElement('i');
    bar.appendChild(fill);

    const val = document.createElement('span');
    val.className = 'pstat-val';

    row.appendChild(b);
    row.appendChild(bar);
    row.appendChild(val);
    statsEl.appendChild(row);
    statFillEls[key] = fill;
    statValEls[key] = val;
  }

  function updateStartButtonLabel() {
    const prefix = isGameOverMode ? CONFIG.copy.retryButton : 'Start as';
    goBtn.textContent = isGameOverMode
      ? `${prefix} (${chosenDino.name})`
      : `${prefix} ${chosenDino.name}`;
  }

  function loadPreviewModel(dino) {
    if (!previewRoot) return;
    if (previewModel) {
      previewRoot.remove(previewModel);
      disposeObjectTree(previewModel);
      previewModel = null;
    }

    const model = buildDinoModel(dino.id, dino.color, dino.accentColor);
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    model.position.set(-center.x, -center.y, -center.z);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const fitScale = 3.25 / maxDim;
    previewRoot.scale.setScalar(fitScale);
    previewRoot.rotation.set(0, 0.58, 0);
    previewRoot.add(model);
    previewModel = model;
  }

  function renderPickerData() {
    const dino = roster[currentIndex];
    chosenDino = dino;

    for (let i = 0; i < rosterButtons.length; i++) {
      const active = i === currentIndex;
      rosterButtons[i].classList.toggle('on', active);
      rosterButtons[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }

    nameEl.textContent = dino.name;
    roleEl.textContent = dino.role;
    descEl.textContent = dino.description;

    const benefits = evo && evo.benefits ? evo.benefits : null;
    for (let i = 0; i < STAT_ROWS.length; i++) {
      const [key] = STAT_ROWS[i];
      const evoKey = EVO_STAT_MAP[key];
      const mult = benefits && evoKey && benefits[evoKey] ? benefits[evoKey] : 1.0;
      const effectiveVal = dino.stats[key] * mult;
      const segments = calcStatSegments(effectiveVal);
      statFillEls[key].style.width = `${segments * 10}%`;
      if (mult > 1.001) {
        const bonusPct = Math.round((mult - 1) * 100);
        statValEls[key].textContent = `+${bonusPct}%`;
        statValEls[key].classList.add('evolved');
      } else {
        statValEls[key].textContent = `${segments}/10`;
        statValEls[key].classList.remove('evolved');
      }
    }

    abTitleEl.textContent = dino.ability.name;
    abCdEl.textContent = `${dino.ability.cooldown}s cooldown`;
    abDescEl.textContent = dino.ability.description;
    updateStartButtonLabel();

    if (menuVisible) {
      loadPreviewModel(dino);
    }
  }

  function selectIndex(idx, persist = true) {
    currentIndex = (idx + roster.length) % roster.length;
    chosenDino = roster[currentIndex];
    if (persist) {
      saveSelectedDinoId(chosenDino.id);
      if (onSelectDino) onSelectDino(chosenDino);
    }
    renderPickerData();
  }

  function startPreviewRenderer() {
    if (previewRenderer) {
      loadPreviewModel(roster[currentIndex]);
      return;
    }

    previewCanvas = document.createElement('canvas');
    previewCanvas.id = 'picker-canvas';
    previewCanvas.width = 200;
    previewCanvas.height = 200;
    previewCanvas.setAttribute('aria-label', 'Rotating 3D dinosaur preview');
    previewWrap.innerHTML = '';
    previewWrap.appendChild(previewCanvas);

    previewRenderer = new THREE.WebGLRenderer({
      canvas: previewCanvas,
      alpha: true,
      antialias: true,
    });
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    previewRenderer.toneMapping = THREE.NoToneMapping;
    previewRenderer.setClearColor(0x000000, 0);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    previewRenderer.setSize(200, 200, false);

    previewScene = new THREE.Scene();
    previewCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    previewCamera.position.set(0, 1.5, 5.1);
    previewCamera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffe2c0, 0x3b5a3a, CONFIG.lighting.hemiIntensity);
    const sun = new THREE.DirectionalLight(0xffd0a0, CONFIG.lighting.sunIntensity);
    sun.position.set(-6, 10, 8);
    previewScene.add(hemi, sun);

    previewRoot = new THREE.Group();
    previewScene.add(previewRoot);
    loadPreviewModel(roster[currentIndex]);

    let lastPreviewMs = performance.now();
    function animatePreview(nowMs) {
      if (!menuVisible || !previewRenderer) return;
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastPreviewMs) / 1000));
      lastPreviewMs = nowMs;
      if (previewRoot) {
        previewRoot.rotation.y += dt * 0.85;
      }
      previewRenderer.render(previewScene, previewCamera);
      previewRafId = requestAnimationFrame(animatePreview);
    }
    previewRafId = requestAnimationFrame(animatePreview);
  }

  function stopPreviewRenderer() {
    if (previewRafId) {
      cancelAnimationFrame(previewRafId);
      previewRafId = 0;
    }
    if (previewModel && previewRoot) {
      previewRoot.remove(previewModel);
      disposeObjectTree(previewModel);
      previewModel = null;
    }
    if (previewRenderer) {
      previewRenderer.dispose();
      previewRenderer = null;
    }
    previewScene = null;
    previewCamera = null;
    previewRoot = null;
    if (previewCanvas) {
      previewCanvas.remove();
      previewCanvas = null;
    }
  }

  function startSelectedDino() {
    chosenDino = roster[currentIndex];
    saveSelectedDinoId(chosenDino.id);
    if (onSelectDino) onSelectDino(chosenDino);
    hide();
    onStart();
  }

  prevBtn.addEventListener('click', () => selectIndex(currentIndex - 1));
  nextBtn.addEventListener('click', () => selectIndex(currentIndex + 1));
  goBtn.addEventListener('click', startSelectedDino);

  // Keyboard navigation while start dashboard is visible
  window.addEventListener('keydown', (e) => {
    if (!menuVisible) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectIndex(currentIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectIndex(currentIndex + 1);
    } else if (e.key === 'Enter' && document.activeElement !== prevBtn && document.activeElement !== nextBtn) {
      e.preventDefault();
      startSelectedDino();
    }
  });

  // Swipe left/right on preview stage
  let swipeStartX = null;
  previewWrap.addEventListener('pointerdown', (e) => {
    swipeStartX = e.clientX;
  });
  previewWrap.addEventListener('pointerup', (e) => {
    if (swipeStartX === null) return;
    const dx = e.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(dx) >= 28) {
      selectIndex(currentIndex + (dx < 0 ? 1 : -1));
    }
  });
  previewWrap.addEventListener('pointercancel', () => {
    swipeStartX = null;
  });

  function showTitle() {
    isGameOverMode = false;
    menuVisible = true;
    document.body.classList.add('in-menu');
    titleEl.textContent = CONFIG.copy.titleHtml;
    subEl.textContent = '';
    subEl.classList.add('hide');
    msgEl.textContent = CONFIG.copy.titleMsg;
    if (controlsHintEl) controlsHintEl.textContent = CONFIG.copy.controlsHint;
    cardEl.classList.remove('hide');
    renderPickerData();
    startPreviewRenderer();
  }

  function showGameOver(cause, elapsedSec, eaten) {
    isGameOverMode = true;
    menuVisible = true;
    document.body.classList.add('in-menu');
    titleEl.textContent = CONFIG.copy.gameOverHtml;
    subEl.textContent = `${cause || 'Starved'} after ${formatTime(elapsedSec)} · Eaten: ${eaten} dinos`;
    subEl.classList.remove('hide');
    msgEl.textContent = CONFIG.copy.titleMsg;
    if (controlsHintEl) controlsHintEl.textContent = CONFIG.copy.controlsHint;
    cardEl.classList.remove('hide');
    renderPickerData();
    startPreviewRenderer();
  }

  function hide() {
    menuVisible = false;
    document.body.classList.remove('in-menu');
    stopPreviewRenderer();
    cardEl.classList.add('hide');
  }

  // Open integrated start dashboard on load with last saved dino highlighted
  showTitle();

  return {
    showTitle,
    showGameOver,
    hide,
    isPickerOpen: () => menuVisible,
    getChosenDino: () => chosenDino,
  };
}
