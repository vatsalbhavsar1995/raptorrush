import { CONFIG } from '../config.js';
import { createRexMesh } from '../entities/enemy.js';
import { createCompyMesh, createTrikeMesh } from '../entities/npc.js';
import { createBossMesh } from '../entities/boss.js';
import { getDominantBiomeId } from '../world/biomes.js';
import { getGroundHeight, getIslandMask, isWalkable } from '../world/terrain.js';

export const BIOME_SPAWN_WEIGHTS = {
  berry: { jungle: 1.0, swamp: 0.35, canyon: 0.0, tundra: 0.0, beach: 0.7 },
  compy: { jungle: 1.0, swamp: 0.85, canyon: 0.85, tundra: 0.0, beach: 0.8 },
  trike: { jungle: 1.0, swamp: 0.0, canyon: 1.0, tundra: 0.0, beach: 0.0 },
  rex: { jungle: 1.0, swamp: 0.9, canyon: 0.0, tundra: 0.4, beach: 0.0 },
};

export function getBiomeSpawnWeight(kind, x, z) {
  const table = BIOME_SPAWN_WEIGHTS[kind];
  if (!table) return 1.0;
  const biome = getDominantBiomeId(x, z, getGroundHeight(x, z), getIslandMask(x, z));
  return table[biome] || 0;
}

export function pickBiomeSpot(kind, player, minPlayerDist, edgeMargin, outSpot) {
  const hs = CONFIG.world.halfSize;
  const span = hs - edgeMargin;
  const maxAttempts = CONFIG.world.maxPlacementAttempts * 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = (Math.random() * 2 - 1) * span;
    const z = (Math.random() * 2 - 1) * span;
    if (!isWalkable(x, z)) continue;
    if (player && Math.hypot(x - player.x, z - player.z) < minPlayerDist) continue;
    const w = getBiomeSpawnWeight(kind, x, z);
    if (w <= 0) continue;
    if (w < 1 && Math.random() > w) continue;
    outSpot.x = x;
    outSpot.z = z;
    return outSpot;
  }

  // Fallback: scan central jungle near origin while still strictly respecting walkability & biome
  for (let attempt = 0; attempt < 80; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 55;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!isWalkable(x, z)) continue;
    if (getBiomeSpawnWeight(kind, x, z) <= 0) continue;
    outSpot.x = x;
    outSpot.z = z;
    return outSpot;
  }

  outSpot.x = 0;
  outSpot.z = 0;
  return outSpot;
}

export function pickNpcSpot(player, outSpot, type = 'compy') {
  return pickBiomeSpot(
    type,
    player,
    CONFIG.world.npcSpawnMinPlayerDist,
    CONFIG.world.npcSpawnEdgeMargin,
    outSpot,
  );
}

const _rexSpot = { x: 0, z: 0 };

export function createRexEntity(scene, player, rexStats) {
  const hs = CONFIG.world.halfSize;
  const limit = hs - rexStats.edgePadding;
  let x = 0;
  let z = 0;
  let found = false;

  // Try spawning at normal distance from player in a valid rex biome (jungle, swamp, tundra)
  for (let attempt = 0; attempt < 100; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rexStats.spawnMinDist + Math.random() * rexStats.spawnExtraDist;
    const cx = Math.max(-limit, Math.min(limit, player.x + Math.cos(angle) * dist));
    const cz = Math.max(-limit, Math.min(limit, player.z + Math.sin(angle) * dist));
    if (!isWalkable(cx, cz)) continue;
    const w = getBiomeSpawnWeight('rex', cx, cz);
    if (w <= 0) continue;
    if (w < 1 && Math.random() > w) continue;
    x = cx;
    z = cz;
    found = true;
    break;
  }

  if (!found) {
    pickBiomeSpot('rex', player, rexStats.spawnMinDist * 0.7, rexStats.edgePadding, _rexSpot);
    x = _rexSpot.x;
    z = _rexSpot.z;
  }

  return {
    g: createRexMesh(scene, rexStats),
    x,
    z,
    a: 0,
    s: 0,
    px: x,
    pz: z,
    pa: 0,
    ps: 0,
    mode: 'patrol',
    t: rexStats.initialPatrolDuration,
    wx: x,
    wz: z,
    k: rexStats.scale,
    boss: null,
    hp: 0,
    cd: 0,
    dash: 0,
  };
}

export function createNpcEntity(scene, type, player, dinos, spotScratch) {
  const spot = pickNpcSpot(player, spotScratch, type);
  const isTrike = type === 'trike';
  const stats = isTrike ? dinos.trike : dinos.compy;
  const angle = Math.random() * 6;

  return {
    type,
    g: isTrike ? createTrikeMesh(scene, dinos.trike) : createCompyMesh(scene, dinos.compy),
    x: spot.x,
    z: spot.z,
    a: angle,
    s: 0,
    px: spot.x,
    pz: spot.z,
    pa: angle,
    ps: 0,
    hp: stats.hp,
    mode: 'wander',
    t: Math.random() * stats.initialWanderMax,
    wx: spot.x,
    wz: spot.z,
    dead: false,
    flash: 0,
    roarFlee: 0,
    r: stats.collisionRadius,
  };
}

export function createBossEntity(scene, bossDef, player, rexStats) {
  const cave = CONFIG.landmarks.cave;
  let x = cave.x + 12;
  let z = cave.z + 12;

  // Boss always spawns near the Central Cave landmark (cave +/- 20), guaranteed walkable
  for (let attempt = 0; attempt < 80; attempt++) {
    const ox = (Math.random() * 2 - 1) * 20;
    const oz = (Math.random() * 2 - 1) * 20;
    if (Math.hypot(ox, oz) < 7) continue;
    const cx = cave.x + ox;
    const cz = cave.z + oz;
    if (isWalkable(cx, cz)) {
      x = cx;
      z = cz;
      break;
    }
  }

  return {
    g: createBossMesh(scene, bossDef, rexStats),
    x,
    z,
    a: 0,
    s: 0,
    px: x,
    pz: z,
    pa: 0,
    ps: 0,
    mode: 'chase',
    t: rexStats.chaseDuration,
    wx: x,
    wz: z,
    boss: bossDef,
    hp: bossDef.hp,
    k: bossDef.scale,
    cd: CONFIG.simulation.bossStartCooldown,
    dash: 0,
  };
}
