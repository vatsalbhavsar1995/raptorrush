import { CONFIG } from '../config.js';

export const STAGE_NAMES = [
  'Hatchling',
  'Hunter',
  'Predator',
  'Alpha',
  'Apex',
  'Legend',
];

export function getStageName(stage) {
  const names = CONFIG.evolutionStageNames || STAGE_NAMES;
  const idx = Math.max(0, Math.min(names.length - 1, stage));
  return names[idx];
}

export function getFoodById(foods, foodId) {
  if (!foods) return null;
  if (Array.isArray(foods)) {
    for (let i = 0; i < foods.length; i++) {
      if (foods[i].id === foodId) return foods[i];
    }
    return null;
  }
  return foods[foodId] || null;
}

export function createEvolutionState() {
  return {
    meter: 0,
    stage: 0,
    benefits: {
      speed: 1.0,
      max_health: 1.0,
      stamina_regen: 1.0,
      bite_damage: 1.0,
    },
    stageScale: 1.0,
    flashTimer: 0,
    pulseTimer: 0,
  };
}

export function applyStageScale(evo, player) {
  if (!player) return;
  const group = player.group || (player.isObject3D ? player : null);
  if (!group || !group.scale) return;
  const baseScale = player.baseScale !== undefined ? player.baseScale : 1.0;
  group.scale.setScalar(baseScale * evo.stageScale);
}

export function evolveStage(evo, player, config = CONFIG, onToast) {
  const thresholds = config.evolutionThresholds || CONFIG.evolutionThresholds;
  const maxStage = thresholds.length - 1;
  if (evo.stage >= maxStage) return false;

  evo.stage += 1;
  const sizeGain =
    config.evolveStageSizeGain !== undefined
      ? config.evolveStageSizeGain
      : CONFIG.evolveStageSizeGain;
  evo.stageScale = Math.pow(1 + sizeGain, evo.stage);
  applyStageScale(evo, player);

  const vis = config.evolutionVisual || CONFIG.evolutionVisual;
  evo.flashTimer = vis ? vis.flashDuration : 0.3;
  evo.pulseTimer = vis ? vis.pulseDuration : 0.4;

  const toastFn = onToast || (player && player.onToast);
  if (toastFn) {
    const stageName = getStageName(evo.stage);
    toastFn(`Stage ${evo.stage} — ${stageName}`, `Size +${Math.round((evo.stageScale - 1) * 100)}%`);
  }
  return true;
}

export function applyFood(evo, foodId, foods, config = CONFIG, player = null, onToast) {
  const food = getFoodById(foods, foodId);
  if (!food) {
    return { stagedUp: false, newStage: evo.stage };
  }

  const thresholds = config.evolutionThresholds || CONFIG.evolutionThresholds;
  const caps = config.evolutionCaps || CONFIG.evolutionCaps;
  const maxStage = thresholds.length - 1;

  evo.meter += food.evolution || 0;

  let stagedUp = false;
  if (food.benefit === 'evolve_stage') {
    if (evo.stage < maxStage) {
      if (evolveStage(evo, player, config, onToast)) {
        stagedUp = true;
      }
    }
  } else if (food.benefit && evo.benefits[food.benefit] !== undefined) {
    const capBonus = caps[food.benefit] !== undefined ? caps[food.benefit] : 0;
    const maxMult = 1 + capBonus;
    const nextMult = evo.benefits[food.benefit] * (1 + (food.benefitPct || 0));
    evo.benefits[food.benefit] = Math.min(maxMult, nextMult);
  }

  while (evo.stage < maxStage && evo.meter >= thresholds[evo.stage + 1]) {
    if (evolveStage(evo, player, config, onToast)) {
      stagedUp = true;
    } else {
      break;
    }
  }

  return { stagedUp, newStage: evo.stage };
}

export function resetEvolution(evo, player) {
  evo.meter = 0;
  evo.stage = 0;
  evo.benefits.speed = 1.0;
  evo.benefits.max_health = 1.0;
  evo.benefits.stamina_regen = 1.0;
  evo.benefits.bite_damage = 1.0;
  evo.stageScale = 1.0;
  evo.flashTimer = 0;
  evo.pulseTimer = 0;

  applyStageScale(evo, player);

  const group = player && (player.group || (player.isObject3D ? player : null));
  if (group && group.userData && group.userData.legendLight) {
    group.remove(group.userData.legendLight);
    if (typeof group.userData.legendLight.dispose === 'function') {
      group.userData.legendLight.dispose();
    }
    group.userData.legendLight = null;
  }
}
