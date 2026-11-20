import { CONFIG } from '../config.js';
import { getStageName } from '../systems/evolution.js';

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createHud() {
  const healthBar = document.getElementById('lb');
  const hungerBar = document.getElementById('hb');
  const staminaBar = document.getElementById('sb');
  const zoneLabel = document.getElementById('lv');
  const scoreEl = document.getElementById('sc');
  const timerEl = document.getElementById('tm');
  const objectiveEl = document.getElementById('obj');
  const warningEl = document.getElementById('warn');
  const vignetteEl = document.getElementById('vig');
  const bossWrap = document.getElementById('boss');
  const bossNameEl = document.getElementById('bn');
  const bossHealthEl = document.getElementById('bh');
  const toastEl = document.getElementById('toast');
  const dinoTagEl = document.getElementById('dino-tag');
  const abilHudEl = document.getElementById('abil-hud');
  const abilBtnEl = document.getElementById('abil');
  const abilLblEl = document.getElementById('abil-lbl');
  const abilSweepEl = document.getElementById('abil-sweep');
  const abilCdEl = document.getElementById('abil-cd');
  const evoBarEl = document.getElementById('eb');
  const evoCountEl = document.getElementById('evo-count');
  const evoStageEl = document.getElementById('evo-stage');

  let toastTimer = null;
  let lastSec = -1;
  let lastNearestMeters = -1;
  let lastBossName = '';
  let lastTimeOfDay = '';
  let abilityNameUpper = 'POUNCE';
  let lastAbilCooling = null;
  let lastAbilSec = -1;
  let lastAbilDeg = -1;
  let lastEvoMeter = -1;
  let lastEvoStage = -1;
  let lastEvoFlash = false;
  let lastEvoPulse = false;

  const thresholds = CONFIG.evolutionThresholds;
  const maxStage = thresholds.length - 1;

  function showToast(heading, subtitle) {
    toastEl.innerHTML = `${heading}<small>${subtitle || ''}</small>`;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, CONFIG.hud.toastDurationMs);
  }

  function setZoneName(name) {
    zoneLabel.textContent = name;
  }

  function setDinoIdentity(dino) {
    if (!dino) return;
    if (dinoTagEl) {
      dinoTagEl.textContent = `${dino.name.toUpperCase()} • ${dino.role.toUpperCase()}`;
    }
    const shortName = dino.ability.shortName || dino.ability.name.slice(0, 6);
    abilityNameUpper = dino.ability.name.toUpperCase();
    if (abilLblEl) {
      abilLblEl.textContent = shortName;
    }
    if (abilBtnEl) {
      abilBtnEl.setAttribute('aria-label', dino.ability.name);
    }
    lastAbilSec = -1;
  }

  function showBoss(name) {
    bossNameEl.textContent = name;
    bossWrap.style.display = 'flex';
    bossHealthEl.style.width = '100%';
  }

  function updateBossHealth(hp, maxHp) {
    bossHealthEl.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
  }

  function hideBoss() {
    bossWrap.style.display = 'none';
  }

  function setWarning(active) {
    warningEl.style.opacity = active ? '1' : '0';
  }

  function clearAlerts() {
    vignetteEl.style.opacity = '0';
    warningEl.style.opacity = '0';
  }

  function update(hudState) {
    const healthPct = Math.max(0, Math.min(100, (hudState.health / hudState.maxHealth) * 100));
    const staminaPct = Math.max(0, Math.min(100, (hudState.stamina / hudState.maxStamina) * 100));

    healthBar.style.width = `${healthPct}%`;
    healthBar.style.opacity = hudState.hurt > 0 ? '0.5' : '1';

    hungerBar.style.width = `${hudState.hunger}%`;
    hungerBar.classList.toggle('low', hudState.hunger < CONFIG.hud.lowHungerThreshold);

    staminaBar.style.width = `${staminaPct}%`;
    staminaBar.style.opacity = hudState.tired ? '0.4' : '1';

    scoreEl.textContent = hudState.boss ? CONFIG.copy.bossScoreLabel : String(hudState.eaten);

    const wholeSec = Math.max(0, Math.floor(hudState.elapsedSec));
    if (wholeSec !== lastSec) {
      lastSec = wholeSec;
      timerEl.textContent = formatTime(wholeSec);
    }

    const tod = hudState.timeOfDay || '';
    const todPrefix = tod ? `${tod}  ·  ` : '';
    if (hudState.boss) {
      const bName = hudState.boss.boss.name;
      if (bName !== lastBossName || tod !== lastTimeOfDay) {
        lastBossName = bName;
        lastTimeOfDay = tod;
        lastNearestMeters = -1;
        objectiveEl.textContent = `${todPrefix}${bName} — bite it down`;
      }
    } else {
      const meters = Math.round(hudState.nearestBerryDist);
      if (meters !== lastNearestMeters || lastBossName !== '' || tod !== lastTimeOfDay) {
        lastBossName = '';
        lastTimeOfDay = tod;
        lastNearestMeters = meters;
        objectiveEl.textContent = `${todPrefix}Nearest berry ${meters} m`;
      }
    }

    // Evolution meter + stage badge
    const evoMeter = hudState.evoMeter || 0;
    const evoStage = hudState.evoStage || 0;
    if (evoMeter !== lastEvoMeter || evoStage !== lastEvoStage) {
      lastEvoMeter = evoMeter;
      lastEvoStage = evoStage;
      const stageFloor = thresholds[evoStage] || 0;
      const isMax = evoStage >= maxStage;
      const nextThreshold = isMax ? thresholds[maxStage] : thresholds[evoStage + 1];
      const pct = isMax
        ? 100
        : Math.max(0, Math.min(100, ((evoMeter - stageFloor) / Math.max(1, nextThreshold - stageFloor)) * 100));
      if (evoBarEl) evoBarEl.style.width = `${pct}%`;
      if (evoCountEl) {
        evoCountEl.textContent = isMax ? `${evoMeter} · MAX` : `${evoMeter} / ${nextThreshold}`;
      }
      if (evoStageEl) {
        evoStageEl.textContent = `STAGE ${evoStage} · ${getStageName(evoStage).toUpperCase()}`;
      }
    }

    const evoFlash = (hudState.evoFlash || 0) > 0;
    if (evoFlash !== lastEvoFlash) {
      lastEvoFlash = evoFlash;
      if (evoBarEl) evoBarEl.classList.toggle('flash', evoFlash);
    }

    const evoPulse = (hudState.evoPulse || 0) > 0;
    if (evoPulse !== lastEvoPulse) {
      lastEvoPulse = evoPulse;
      if (evoStageEl) evoStageEl.classList.toggle('pulse', evoPulse);
    }

    // Ability cooldown readout & circular sweep
    const abCd = hudState.abilityCooldown || 0;
    const abMax = hudState.abilityMaxCooldown || 1;
    if (abCd > 0) {
      const remSec = Math.ceil(abCd);
      const deg = Math.round(Math.max(0, Math.min(360, (abCd / abMax) * 360)));
      if (lastAbilCooling !== true) {
        lastAbilCooling = true;
        if (abilBtnEl) abilBtnEl.classList.add('cooling');
        if (abilHudEl) abilHudEl.classList.remove('hide');
      }
      if (remSec !== lastAbilSec) {
        lastAbilSec = remSec;
        if (abilCdEl) abilCdEl.textContent = `${remSec}s`;
        if (abilHudEl) abilHudEl.textContent = `[Q] ${abilityNameUpper}  ⏱ ${remSec}s`;
      }
      if (deg !== lastAbilDeg) {
        lastAbilDeg = deg;
        if (abilSweepEl) {
          abilSweepEl.style.background = `conic-gradient(rgba(26, 15, 12, 0.74) ${deg}deg, transparent 0deg)`;
        }
      }
    } else if (lastAbilCooling !== false) {
      lastAbilCooling = false;
      lastAbilSec = -1;
      lastAbilDeg = -1;
      if (abilBtnEl) abilBtnEl.classList.remove('cooling');
      if (abilCdEl) abilCdEl.textContent = '';
      if (abilSweepEl) abilSweepEl.style.background = '';
      if (abilHudEl) {
        abilHudEl.textContent = '';
        abilHudEl.classList.add('hide');
      }
    }

    const hungerVig =
      hudState.hunger < CONFIG.hud.vignetteHungerThreshold
        ? (CONFIG.hud.vignetteHungerThreshold - hudState.hunger) / CONFIG.hud.vignetteHungerThreshold
        : 0;
    const hurtVig = (hudState.hurt / hudState.hurtInvuln) * CONFIG.hud.vignetteHurtScale;
    vignetteEl.style.opacity = hudState.playing ? String(Math.max(hungerVig, hurtVig)) : '0';
  }

  return {
    showToast,
    setZoneName,
    setDinoIdentity,
    showBoss,
    updateBossHealth,
    hideBoss,
    setWarning,
    clearAlerts,
    update,
  };
}

export function createDebugOverlay() {
  const enabled = new URLSearchParams(window.location.search).has('debug');
  if (!enabled) {
    return {
      enabled: false,
      tick() {},
    };
  }

  const el = document.createElement('pre');
  el.id = 'dbg';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);

  let frameCount = 0;
  let lastSampleMs = performance.now();
  let fps = 0;

  function tick(nowMs, renderInfo, counts) {
    frameCount++;
    const elapsed = nowMs - lastSampleMs;
    if (elapsed < 250) return;
    fps = Math.round((frameCount * 1000) / elapsed);
    frameCount = 0;
    lastSampleMs = nowMs;

    el.textContent =
      `FPS: ${fps}\n` +
      `Calls: ${renderInfo.calls}  Tris: ${renderInfo.triangles}\n` +
      `Rex: ${counts.rexes}  Boss: ${counts.boss}\n` +
      `Compy: ${counts.compies}  Trike: ${counts.trikes}\n` +
      `Berries: ${counts.berries}  Trees: ${counts.trees}  Rocks: ${counts.rocks}`;
  }

  return {
    enabled: true,
    tick,
  };
}
