import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { stepWalkable } from '../world/terrain.js';
import { addBoxPart, buildDinoModel, disposeObjectTree, makeFlatMaterial } from './models.js';

export { addBoxPart, buildDinoModel, disposeObjectTree, makeFlatMaterial };

export function getDinoById(roster, id) {
  for (let i = 0; i < roster.length; i++) {
    if (roster[i].id === id) return roster[i];
  }
  return roster[0];
}

export function loadSelectedDinoId(roster) {
  try {
    const saved = localStorage.getItem(CONFIG.picker.storageKey);
    if (saved) {
      for (let i = 0; i < roster.length; i++) {
        if (roster[i].id === saved) return saved;
      }
    }
  } catch {
    // Storage may be unavailable.
  }
  return CONFIG.picker.defaultDinoId;
}

export function saveSelectedDinoId(id) {
  try {
    localStorage.setItem(CONFIG.picker.storageKey, id);
  } catch {
    // Storage may be unavailable.
  }
}

export function computePlayerStats(dino, baseStats, evo = null) {
  const s = dino.stats;
  const b = evo && evo.benefits ? evo.benefits : null;
  const speedMult = b ? b.speed : 1.0;
  const healthMult = b ? b.max_health : 1.0;
  const biteMult = b ? b.bite_damage : 1.0;
  const stamRegenMult = b ? b.stamina_regen : 1.0;
  const stageScale = evo ? evo.stageScale : 1.0;

  return {
    ...baseStats,
    id: dino.id,
    name: dino.name,
    role: dino.role,
    scale: dino.scale * stageScale,
    armor: s.armor,
    maxHealth: Math.round(baseStats.maxHealth * s.health * healthMult),
    maxStamina: Math.round(baseStats.maxStamina * s.stamina),
    walkSpeed: baseStats.walkSpeed * s.speed * speedMult,
    sprintSpeed: baseStats.sprintSpeed * s.speed * speedMult,
    biteDamage: baseStats.biteDamage * s.bite * biteMult,
    staminaDrain: baseStats.staminaDrain / s.stamina,
    staminaRegen: baseStats.staminaRegen * s.stamina * stamRegenMult,
    tiredRecoverThreshold: baseStats.tiredRecoverThreshold * s.stamina,
    ability: dino.ability,
  };
}

export function syncPlayerStatsWithEvolution(stats, dino, baseStats, evo) {
  const s = dino.stats;
  const b = evo.benefits;
  const prevMaxHealth = stats.maxHealth;
  stats.scale = dino.scale * evo.stageScale;
  stats.maxHealth = Math.round(baseStats.maxHealth * s.health * b.max_health);
  stats.walkSpeed = baseStats.walkSpeed * s.speed * b.speed;
  stats.sprintSpeed = baseStats.sprintSpeed * s.speed * b.speed;
  stats.biteDamage = baseStats.biteDamage * s.bite * b.bite_damage;
  stats.staminaRegen = baseStats.staminaRegen * s.stamina * b.stamina_regen;
  return stats.maxHealth - prevMaxHealth;
}

export function createPlayerMesh(scene, baseStats, dino, evo = null) {
  const dinoId = dino ? dino.id : 'raptor';
  const color = dino ? dino.color : baseStats.colors.body;
  const accentColor = dino ? dino.accentColor : baseStats.colors.stripe;
  const group = buildDinoModel(dinoId, color, accentColor);

  const stageScale = evo ? evo.stageScale : 1.0;
  if (dino && dino.scale) {
    group.scale.setScalar(dino.scale * stageScale);
  }

  scene.add(group);
  return {
    group,
    tail: group.userData.tail || null,
    legs: group.userData.legs,
  };
}

export function updateEvolutionVisuals(group, dino, evo, config = CONFIG) {
  if (!group || !dino || !evo) return;
  const ud = group.userData;
  const vis = config.evolutionVisual || CONFIG.evolutionVisual;

  group.scale.setScalar(dino.scale * evo.stageScale);

  const flashing = evo.flashTimer > 0;
  const stageChanged = ud.appliedStage !== evo.stage;
  const flashChanged = ud.wasFlashing !== flashing;

  if (flashing && flashChanged) {
    const mats = ud.materials;
    if (mats) {
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.setHex(0xffffff);
      }
    }
    ud.wasFlashing = true;
  } else if (!flashing && (flashChanged || stageChanged)) {
    const mats = ud.materials;
    const baseColors = ud.baseColors;
    if (mats && baseColors) {
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseColors[i]);
      }
    }
    if (evo.stage >= vis.tintStartStage) {
      const pMats = ud.primaryMaterials;
      const pBases = ud.primaryBaseColors;
      const accent = ud.accentColor;
      if (pMats && pBases && accent) {
        const tint = Math.min(0.6, (evo.stage - (vis.tintStartStage - 1)) * vis.tintPerStage);
        for (let i = 0; i < pMats.length; i++) {
          pMats[i].color.copy(pBases[i]).lerp(accent, tint);
        }
      }
    }
    ud.wasFlashing = false;
    ud.appliedStage = evo.stage;
  }

  if (evo.stage >= vis.legendStage) {
    if (!ud.legendLight) {
      const glow = new THREE.PointLight(
        dino.accentColor,
        vis.legendLightIntensity,
        vis.legendLightDistance,
      );
      glow.position.set(0, 2.4, 0);
      group.add(glow);
      ud.legendLight = glow;
    }
  } else if (ud.legendLight) {
    group.remove(ud.legendLight);
    if (typeof ud.legendLight.dispose === 'function') {
      ud.legendLight.dispose();
    }
    ud.legendLight = null;
  }
}

export function createAbilityRuntime() {
  return {
    cooldown: 0,
    maxCooldown: 0,
    chargeTimer: 0,
    chargeDirX: 0,
    chargeDirZ: 0,
    whipTimer: 0,
    chargeHits: new Set(),
  };
}

export function resetAbilityRuntime(rt) {
  rt.cooldown = 0;
  rt.maxCooldown = 0;
  rt.chargeTimer = 0;
  rt.chargeDirX = 0;
  rt.chargeDirZ = 0;
  rt.whipTimer = 0;
  rt.chargeHits.clear();
}

function dashForward(player, dist, trees, collisionRadius, halfSize, edgeMargin) {
  const fx = Math.sin(player.a);
  const fz = Math.cos(player.a);
  const steps = 4;
  const stepDist = dist / steps;

  for (let step = 0; step < steps; step++) {
    const moved = stepWalkable(player, player.x + fx * stepDist, player.z + fz * stepDist, edgeMargin);
    if (!moved) break;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const ax = player.x - t.x;
      const az = player.z - t.z;
      const d = Math.hypot(ax, az);
      const minDist = t.r + collisionRadius;
      if (d < minDist && d > 0) {
        stepWalkable(player, t.x + (ax / d) * minDist, t.z + (az / d) * minDist, edgeMargin);
      }
    }
  }
}

export function triggerDinoAbility({
  dinoId,
  abilityRuntime,
  player,
  playerStats,
  rexes,
  npcs,
  trees,
  onBite,
  onAreaDamage,
  onStompRing,
  onShake,
  onBossDamaged,
  onBossDefeated,
  onNpcKilled,
}) {
  if (abilityRuntime.cooldown > 0) return false;

  const abCfg = CONFIG.abilities;
  const ability = playerStats.ability;
  abilityRuntime.cooldown = ability.cooldown;
  abilityRuntime.maxCooldown = ability.cooldown;

  if (dinoId === 'raptor') {
    dashForward(
      player,
      abCfg.pounceDashDist,
      trees,
      playerStats.collisionRadius,
      CONFIG.world.halfSize,
      CONFIG.world.playerEdgeMargin,
    );
    onBite(playerStats.biteDamage);
    return true;
  }

  if (dinoId === 'triceratops') {
    abilityRuntime.chargeTimer = abCfg.chargeDuration;
    abilityRuntime.chargeDirX = Math.sin(player.a);
    abilityRuntime.chargeDirZ = Math.cos(player.a);
    abilityRuntime.chargeHits.clear();
    return true;
  }

  if (dinoId === 'stegosaurus') {
    abilityRuntime.whipTimer = abCfg.tailWhipAnimDuration;
    onAreaDamage(
      player,
      abCfg.tailWhipRadius,
      abCfg.tailWhipDamage,
      rexes,
      npcs,
      onBossDamaged,
      onBossDefeated,
      onNpcKilled,
    );
    onShake(0.25);
    return true;
  }

  if (dinoId === 'spinosaurus') {
    dashForward(
      player,
      abCfg.lungeDashDist,
      trees,
      playerStats.collisionRadius,
      CONFIG.world.halfSize,
      CONFIG.world.playerEdgeMargin,
    );
    onBite(playerStats.biteDamage * abCfg.lungeDamageMultiplier);
    return true;
  }

  if (dinoId === 'ankylosaurus') {
    onStompRing(player.x, player.z, abCfg.clubSlamRingDuration);
    onShake(0.6);
    for (let i = 0; i < rexes.length; i++) {
      const r = rexes[i];
      const d = Math.hypot(r.x - player.x, r.z - player.z);
      if (d <= abCfg.clubSlamRadius + (r.k || 0)) {
        r.mode = 'rest';
        r.t = abCfg.clubSlamStunDuration;
      }
    }
    return true;
  }

  if (dinoId === 'trex') {
    onShake(abCfg.roarShake);
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (!n.dead && n.type === 'compy') {
        const d = Math.hypot(n.x - player.x, n.z - player.z);
        if (d <= abCfg.roarCompyRadius) {
          n.roarFlee = abCfg.roarCompyFleeDuration;
        }
      }
    }
    for (let i = 0; i < rexes.length; i++) {
      const r = rexes[i];
      if (!r.boss) {
        const d = Math.hypot(r.x - player.x, r.z - player.z);
        if (d <= abCfg.roarRexRadius) {
          r.mode = 'rest';
          r.t = abCfg.roarRexStunDuration;
        }
      }
    }
    return true;
  }

  return false;
}

export function stepDinoAbility({
  dt,
  abilityRuntime,
  player,
  playerStats,
  rexes,
  npcs,
  onBossDamaged,
  onBossDefeated,
  onNpcKilled,
  onShake,
}) {
  abilityRuntime.cooldown = Math.max(0, abilityRuntime.cooldown - dt);
  abilityRuntime.whipTimer = Math.max(0, abilityRuntime.whipTimer - dt);

  if (abilityRuntime.chargeTimer <= 0) return false;

  const abCfg = CONFIG.abilities;
  const spd = playerStats.sprintSpeed;

  abilityRuntime.chargeTimer = Math.max(0, abilityRuntime.chargeTimer - dt);
  stepWalkable(
    player,
    player.x + abilityRuntime.chargeDirX * spd * dt,
    player.z + abilityRuntime.chargeDirZ * spd * dt,
    CONFIG.world.playerEdgeMargin,
  );
  player.s += spd * dt * playerStats.strideScale;

  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    if (abilityRuntime.chargeHits.has(r)) continue;
    const dx = r.x - player.x;
    const dz = r.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d <= abCfg.chargeHitRadius + (r.k || 1.25)) {
      abilityRuntime.chargeHits.add(r);
      const nx = d > 0.001 ? dx / d : abilityRuntime.chargeDirX;
      const nz = d > 0.001 ? dz / d : abilityRuntime.chargeDirZ;
      stepWalkable(
        r,
        r.x + nx * abCfg.chargeKnockback,
        r.z + nz * abCfg.chargeKnockback,
        CONFIG.world.npcEdgeMargin,
      );
      onShake(0.35);
      if (r.boss) {
        r.hp -= abCfg.chargeDamage;
        onBossDamaged(r);
        if (r.hp <= 0) {
          onBossDefeated();
          abilityRuntime.chargeTimer = 0;
          return true;
        }
      } else {
        r.mode = 'rest';
        r.t = CONFIG.dinos.rex.biteStunDuration;
      }
    }
  }

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (n.dead || abilityRuntime.chargeHits.has(n)) continue;
    const dx = n.x - player.x;
    const dz = n.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d <= abCfg.chargeHitRadius + n.r) {
      abilityRuntime.chargeHits.add(n);
      const nx = d > 0.001 ? dx / d : abilityRuntime.chargeDirX;
      const nz = d > 0.001 ? dz / d : abilityRuntime.chargeDirZ;
      stepWalkable(
        n,
        n.x + nx * abCfg.chargeKnockback,
        n.z + nz * abCfg.chargeKnockback,
        CONFIG.world.npcEdgeMargin,
      );
      n.hp -= abCfg.chargeDamage;
      n.flash = CONFIG.simulation.npcFlashDuration;
      if (n.hp <= 0) {
        onNpcKilled(n);
      }
    }
  }

  return true;
}
