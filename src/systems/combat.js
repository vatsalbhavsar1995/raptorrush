import { CONFIG } from '../config.js';
import { applyFood } from './evolution.js';

export function collectFood(foodId, evo, foods, config = CONFIG, playerTarget = null, onToast) {
  return applyFood(evo, foodId, foods, config, playerTarget, onToast);
}

export function scaleIncomingDamage(baseDamage, diffIndex, armor = 1) {
  const mults = CONFIG.difficulty.damageMultipliers;
  const diffMult = mults[diffIndex] !== undefined ? mults[diffIndex] : 1;
  const armorFactor = armor > 0 ? 1 / armor : 1;
  return baseDamage * diffMult * armorFactor;
}

export function isInBiteCone(player, target, range, playerStats) {
  const fx = Math.sin(player.a);
  const fz = Math.cos(player.a);
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const d = Math.hypot(dx, dz);
  return (
    d < range &&
    (d < playerStats.biteCloseRange || (dx * fx + dz * fz) / d > playerStats.biteDotMin)
  );
}

export function performBite(
  player,
  rexes,
  npcs,
  playerStats,
  rexStats,
  onBossDamaged,
  onBossDefeated,
  onNpcKilled,
  damageOverride,
) {
  const dmg = damageOverride !== undefined ? damageOverride : playerStats.biteDamage;
  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    const range =
      playerStats.biteRexBaseRange + (r.k || rexStats.scale) * playerStats.biteRexScaleRange;
    if (isInBiteCone(player, r, range, playerStats)) {
      if (r.boss) {
        r.hp -= dmg;
        onBossDamaged(r);
        if (r.hp <= 0) {
          onBossDefeated();
          return;
        }
      } else {
        r.mode = 'rest';
        r.t = rexStats.biteStunDuration;
      }
    }
  }

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (!n.dead && isInBiteCone(player, n, playerStats.biteNpcRange, playerStats)) {
      n.hp -= dmg;
      n.flash = CONFIG.simulation.npcFlashDuration;
      if (n.hp <= 0) {
        onNpcKilled(n);
      }
    }
  }
}

export function applyAreaDamage(
  player,
  radius,
  damage,
  rexes,
  npcs,
  onBossDamaged,
  onBossDefeated,
  onNpcKilled,
) {
  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    const d = Math.hypot(r.x - player.x, r.z - player.z);
    if (d <= radius + (r.k || 0)) {
      if (r.boss) {
        r.hp -= damage;
        onBossDamaged(r);
        if (r.hp <= 0) {
          onBossDefeated();
          return;
        }
      } else {
        r.mode = 'rest';
        r.t = CONFIG.dinos.rex.biteStunDuration;
      }
    }
  }

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (n.dead) continue;
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d <= radius + n.r) {
      n.hp -= damage;
      n.flash = CONFIG.simulation.npcFlashDuration;
      if (n.hp <= 0) {
        onNpcKilled(n);
      }
    }
  }
}
