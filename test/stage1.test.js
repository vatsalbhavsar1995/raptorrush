import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { CONFIG } from '../src/config.js';
import { placeLandmarks } from '../src/world/landmarks.js';
import { createWorldProps } from '../src/world/props.js';
import { createBerryManager, createEggManager } from '../src/entities/pickups.js';
import { createBossEntity, createNpcEntity, createRexEntity } from '../src/systems/spawn.js';
import { createEnvironmentController, getTimeOfDayInfo } from '../src/systems/environment.js';
import { applyAreaDamage, collectFood, scaleIncomingDamage } from '../src/systems/combat.js';
import {
  applyFood,
  createEvolutionState,
  getStageName,
  resetEvolution,
} from '../src/systems/evolution.js';
import {
  computePlayerStats,
  createAbilityRuntime,
  getDinoById,
  stepDinoAbility,
  triggerDinoAbility,
  updateEvolutionVisuals,
} from '../src/entities/player.js';
import { buildDinoModel, disposeObjectTree } from '../src/entities/models.js';
import { calcStatSegments } from '../src/ui/menu.js';
import { sanitizeSettings } from '../src/ui/pause.js';
import {
  computeBiomeWeights,
  createBiomeController,
  findNearestZone,
} from '../src/world/biomes.js';
import {
  createRng,
  getGroundHeight,
  getIslandMask,
  getRiverDistance,
  getWalkHeight,
  isOnBridge,
  isWalkable,
  isWaterAt,
  stepWalkable,
} from '../src/world/terrain.js';

const zones = JSON.parse(fs.readFileSync(new URL('../src/data/zones.json', import.meta.url), 'utf8'));
const bosses = JSON.parse(fs.readFileSync(new URL('../src/data/bosses.json', import.meta.url), 'utf8'));
const dinos = JSON.parse(fs.readFileSync(new URL('../src/data/dinos.json', import.meta.url), 'utf8'));
const foods = JSON.parse(fs.readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8'));

test('data tables contain expected Stage 1, 2, 3 & 4 entries', () => {
  assert.equal(zones.length, 5);
  assert.equal(bosses.length, 4);
  assert.equal(Array.isArray(dinos), true);
  assert.equal(dinos.length, 6);
  assert.ok(CONFIG.dinos.player && CONFIG.dinos.rex && CONFIG.dinos.compy && CONFIG.dinos.trike);
  assert.equal(Array.isArray(foods), true);
  assert.equal(foods.length, 6);
  const foodIds = new Set(foods.map((f) => f.id));
  for (const id of ['berry', 'compy', 'trike', 'egg', 'fish', 'boss']) {
    assert.equal(foodIds.has(id), true, `missing food ${id}`);
  }
  assert.deepEqual(CONFIG.evolutionThresholds, [0, 20, 50, 90, 140, 200]);
  assert.equal(CONFIG.evolveStageSizeGain, 0.12);
  assert.equal(CONFIG.evolutionCaps.speed, 0.35);
  assert.equal(CONFIG.population.bossEveryScore, 25);
  assert.equal(CONFIG.simulation.fixedHz, 30);
  assert.equal(CONFIG.simulation.fixedDt, 1 / 30);
});

test('dino stat multipliers and evolution benefits stack correctly', () => {
  const raptor = getDinoById(dinos, 'raptor');
  const raptorStats = computePlayerStats(raptor, CONFIG.dinos.player);
  assert.equal(raptorStats.maxHealth, 100);
  assert.equal(raptorStats.walkSpeed, 10);
  assert.equal(raptorStats.biteDamage, 10);

  const trike = getDinoById(dinos, 'triceratops');
  const trikeStats = computePlayerStats(trike, CONFIG.dinos.player);
  assert.equal(trikeStats.maxHealth, 160);
  assert.equal(trikeStats.walkSpeed, 8);
  assert.equal(trikeStats.biteDamage, 8);
  assert.equal(trikeStats.armor, 1.4);

  const evo = createEvolutionState();
  evo.benefits.speed = 1.25;
  evo.benefits.max_health = 1.2;
  evo.benefits.bite_damage = 1.3;
  evo.benefits.stamina_regen = 1.4;
  evo.stageScale = 1.12;
  const evolvedTrike = computePlayerStats(trike, CONFIG.dinos.player, evo);
  assert.equal(evolvedTrike.maxHealth, Math.round(100 * 1.6 * 1.2));
  assert.ok(Math.abs(evolvedTrike.walkSpeed - 10 * 0.8 * 1.25) < 1e-6);
  assert.ok(Math.abs(evolvedTrike.biteDamage - 10 * 0.8 * 1.3) < 1e-6);
  assert.ok(Math.abs(evolvedTrike.staminaRegen - 22 * 1.2 * 1.4) < 1e-6);
  assert.ok(Math.abs(evolvedTrike.scale - 1.4 * 1.12) < 1e-6);

  const trex = getDinoById(dinos, 'trex');
  const trexStats = computePlayerStats(trex, CONFIG.dinos.player);
  assert.equal(trexStats.maxHealth, 150);
  assert.equal(trexStats.biteDamage, 16);
});

test('buildDinoModel produces distinct groups with legs and idleOffset for all 6 dinos', () => {
  for (const d of dinos) {
    const group = buildDinoModel(d.id, d.color, d.accentColor);
    assert.ok(group && group.isGroup, `expected Group for ${d.id}`);
    assert.equal(Array.isArray(group.userData.legs), true, `expected legs array for ${d.id}`);
    assert.equal(group.userData.legs.length, 2, `expected 2 primary leg pivots for ${d.id}`);
    assert.equal(typeof group.userData.idleOffset, 'function', `expected idleOffset for ${d.id}`);
    assert.ok(Number.isFinite(group.userData.idleOffset(1.23)));
    disposeObjectTree(group);
  }
});

test('difficulty and armor stack multiplicatively on incoming damage', () => {
  assert.ok(Math.abs(scaleIncomingDamage(30, 0, 1.0) - 21) < 1e-6);
  assert.ok(Math.abs(scaleIncomingDamage(30, 1, 1.0) - 30) < 1e-6);
  assert.ok(Math.abs(scaleIncomingDamage(30, 2, 1.0) - 39) < 1e-6);
  assert.ok(Math.abs(scaleIncomingDamage(30, 2, 1.5) - 26) < 1e-6);
  assert.equal(scaleIncomingDamage(30, 99, 1.0), 30);
});

test('calcStatSegments scales 0.65 -> 3, 1.0 -> 5, and 1.7 -> 10', () => {
  assert.equal(calcStatSegments(0.65), 3);
  assert.equal(calcStatSegments(1.0), 5);
  assert.equal(calcStatSegments(1.7), 10);
});

test('all 6 dino abilities trigger expected effects and respect cooldowns', () => {
  for (const dino of dinos) {
    assert.ok(dino.ability.shortName.length <= 6, `shortName <= 6 chars for ${dino.id}`);
    const stats = computePlayerStats(dino, CONFIG.dinos.player);
    const rt = createAbilityRuntime();
    const player = { x: 0, z: 0, a: 0, s: 0 };
    const rexes = [{ x: 0, z: 3, mode: 'chase', t: 5, k: 1.25, boss: null }];
    const npcs = [
      { x: 0, z: 4, type: 'compy', r: 0.7, hp: 20, dead: false, flash: 0, roarFlee: 0 },
    ];
    let biteDmg = 0;
    let ringCalled = false;
    let shakeAmt = 0;

    const fired = triggerDinoAbility({
      dinoId: dino.id,
      abilityRuntime: rt,
      player,
      playerStats: stats,
      rexes,
      npcs,
      trees: [],
      onBite: (d) => {
        biteDmg = d;
      },
      onAreaDamage: applyAreaDamage,
      onStompRing: () => {
        ringCalled = true;
      },
      onShake: (amt) => {
        shakeAmt = Math.max(shakeAmt, amt);
      },
      onBossDamaged: () => {},
      onBossDefeated: () => {},
      onNpcKilled: (n) => {
        n.dead = true;
      },
    });
    assert.equal(fired, true, `${dino.id} ability should trigger`);
    assert.equal(rt.cooldown, dino.ability.cooldown);

    // Calling again immediately must be rejected while on cooldown
    const firedAgain = triggerDinoAbility({
      dinoId: dino.id,
      abilityRuntime: rt,
      player,
      playerStats: stats,
      rexes,
      npcs,
      trees: [],
      onBite: () => {},
      onAreaDamage: applyAreaDamage,
      onStompRing: () => {},
      onShake: () => {},
      onBossDamaged: () => {},
      onBossDefeated: () => {},
      onNpcKilled: () => {},
    });
    assert.equal(firedAgain, false, `${dino.id} ability should respect cooldown`);

    if (dino.id === 'raptor') {
      assert.ok(player.z > 3.5);
      assert.equal(biteDmg, stats.biteDamage);
    } else if (dino.id === 'triceratops') {
      assert.ok(rt.chargeTimer > 0);
      const charging = stepDinoAbility({
        dt: 0.2,
        abilityRuntime: rt,
        player,
        playerStats: stats,
        rexes,
        npcs,
        onBossDamaged: () => {},
        onBossDefeated: () => {},
        onNpcKilled: (n) => {
          n.dead = true;
        },
        onShake: () => {},
      });
      assert.equal(charging, true);
      assert.ok(player.z > 1);
    } else if (dino.id === 'stegosaurus') {
      assert.ok(rt.whipTimer > 0);
      assert.equal(npcs[0].hp < 20 || npcs[0].dead, true);
    } else if (dino.id === 'spinosaurus') {
      assert.ok(player.z > 2.5);
      assert.ok(Math.abs(biteDmg - stats.biteDamage * 1.5) < 1e-6);
    } else if (dino.id === 'ankylosaurus') {
      assert.equal(ringCalled, true);
      assert.equal(rexes[0].mode, 'rest');
      assert.equal(rexes[0].t, CONFIG.abilities.clubSlamStunDuration);
    } else if (dino.id === 'trex') {
      assert.ok(shakeAmt > 0);
      assert.ok(npcs[0].roarFlee > 0);
      assert.equal(rexes[0].mode, 'rest');
      assert.equal(rexes[0].t, CONFIG.abilities.roarRexStunDuration);
    }
  }
});

test('evolution applies food benefits, respects caps, crosses thresholds, and resets cleanly', () => {
  const evo = createEvolutionState();
  const mockGroup = { scale: { value: 1, setScalar(v) { this.value = v; } }, userData: {} };
  const playerTarget = { group: mockGroup, baseScale: 1.4 };
  const toasts = [];
  const onToast = (h) => toasts.push(h);

  // Eating 100 berries must cap stamina_regen at +40% (1.40) and cross stage thresholds
  for (let i = 0; i < 100; i++) {
    collectFood('berry', evo, foods, CONFIG, playerTarget, onToast);
  }
  assert.equal(evo.meter, 100);
  assert.equal(evo.stage, 3); // 100 >= 90 (Stage 3), < 140 (Stage 4)
  assert.equal(getStageName(evo.stage), 'Alpha');
  assert.ok(Math.abs(evo.benefits.stamina_regen - 1.4) < 1e-6);
  assert.equal(toasts.length, 3);
  assert.equal(toasts[0], 'Stage 1 — Hunter');
  assert.equal(toasts[2], 'Stage 3 — Alpha');
  assert.ok(Math.abs(mockGroup.scale.value - 1.4 * Math.pow(1.12, 3)) < 1e-6);

  // Eating 100 compies must cap speed at +35% (1.35)
  for (let i = 0; i < 100; i++) {
    applyFood(evo, 'compy', foods, CONFIG, playerTarget, onToast);
  }
  assert.ok(Math.abs(evo.benefits.speed - 1.35) < 1e-6);
  assert.equal(evo.stage, 5); // Capped at stage 5 (Legend)
  assert.equal(getStageName(evo.stage), 'Legend');

  // Eating 50 trikes caps max_health at +45% (1.45), 50 eggs caps bite_damage at +40% (1.40)
  for (let i = 0; i < 50; i++) {
    applyFood(evo, 'trike', foods, CONFIG, playerTarget);
    applyFood(evo, 'egg', foods, CONFIG, playerTarget);
  }
  assert.ok(Math.abs(evo.benefits.max_health - 1.45) < 1e-6);
  assert.ok(Math.abs(evo.benefits.bite_damage - 1.4) < 1e-6);

  // Reset restores all values and base scale
  resetEvolution(evo, playerTarget);
  assert.equal(evo.meter, 0);
  assert.equal(evo.stage, 0);
  assert.equal(evo.stageScale, 1.0);
  assert.equal(evo.benefits.speed, 1.0);
  assert.equal(evo.benefits.max_health, 1.0);
  assert.equal(evo.benefits.stamina_regen, 1.0);
  assert.equal(evo.benefits.bite_damage, 1.0);
  assert.equal(mockGroup.scale.value, 1.4);

  // Boss kill evolves stage immediately and grants +25 evolution
  const bossRes = applyFood(evo, 'boss', foods, CONFIG, playerTarget, onToast);
  assert.equal(bossRes.stagedUp, true);
  assert.equal(bossRes.newStage, 1);
  assert.equal(evo.meter, 25);
});

test('Stage 3-5 evolution visuals apply flash, accent tinting, Legend PointLight, and clean reset', () => {
  const dino = getDinoById(dinos, 'raptor');
  const group = buildDinoModel(dino.id, dino.color, dino.accentColor);
  const evo = createEvolutionState();
  const baseFirstHex = group.userData.primaryBaseColors[0].getHex();

  // Stage-up flash sets materials white while flashTimer > 0
  evo.stage = 3;
  evo.stageScale = Math.pow(1.12, 3);
  evo.flashTimer = 0.25;
  updateEvolutionVisuals(group, dino, evo, CONFIG);
  assert.equal(group.userData.materials[0].color.getHex(), 0xffffff);
  assert.ok(Math.abs(group.scale.x - dino.scale * evo.stageScale) < 1e-6);

  // After flash ends at Stage 3, primary material tints toward accentColor
  evo.flashTimer = 0;
  updateEvolutionVisuals(group, dino, evo, CONFIG);
  assert.notEqual(group.userData.primaryMaterials[0].color.getHex(), 0xffffff);
  assert.notEqual(group.userData.primaryMaterials[0].color.getHex(), baseFirstHex);
  assert.equal(group.userData.legendLight, null);

  // Stage 5 attaches Legend PointLight (intensity 0.6, distance 8)
  evo.stage = 5;
  evo.stageScale = Math.pow(1.12, 5);
  updateEvolutionVisuals(group, dino, evo, CONFIG);
  assert.ok(group.userData.legendLight && group.userData.legendLight.isPointLight);
  assert.equal(group.userData.legendLight.intensity, 0.6);
  assert.equal(group.userData.legendLight.distance, 8);

  // Reset removes PointLight, restores base scale and base colors
  resetEvolution(evo, { group, baseScale: dino.scale });
  updateEvolutionVisuals(group, dino, evo, CONFIG);
  assert.equal(group.userData.legendLight, null);
  assert.ok(Math.abs(group.scale.x - dino.scale) < 1e-6);
  assert.equal(group.userData.primaryMaterials[0].color.getHex(), baseFirstHex);
  disposeObjectTree(group);
});

test('sanitizeSettings rejects malformed values and preserves valid options', () => {
  const clean = sanitizeSettings({
    shadows: 0,
    quality: true,
    diff: 99,
    view: -1,
    cam: 1,
    unknown: 'ignored',
  });
  assert.equal(clean.shadows, 0);
  assert.equal(clean.quality, 1);
  assert.equal(clean.diff, CONFIG.settings.defaults.diff);
  assert.equal(clean.view, CONFIG.settings.defaults.view);
  assert.equal(clean.cam, 1);
  assert.equal('unknown' in clean, false);
});

test('soft biome weights normalize cleanly and match all 5 island biomes with 5s smooth transition', () => {
  const lm = CONFIG.landmarks;
  assert.equal(findNearestZone(zones, 0, 0).id, 'jungle');
  assert.equal(findNearestZone(zones, lm.swamp_ruins.x, lm.swamp_ruins.z).id, 'swamp');
  assert.equal(findNearestZone(zones, lm.canyon.x, lm.canyon.z).id, 'canyon');
  assert.equal(findNearestZone(zones, lm.mountain.x, lm.mountain.z).id, 'tundra');
  assert.equal(findNearestZone(zones, lm.beach_nw.x, lm.beach_nw.z).id, 'beach');

  const w = { jungle: 0, swamp: 0, canyon: 0, tundra: 0, beach: 0 };
  computeBiomeWeights(45, 45, undefined, undefined, w);
  const sum = w.jungle + w.swamp + w.canyon + w.tundra + w.beach;
  assert.ok(Math.abs(sum - 1) < 1e-6, 'biome weights must sum to 1');

  // Verify 5-second atmospheric lerp does not snap instantaneously
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(zones[0].sky);
  scene.fog = new THREE.Fog(zones[0].sky, zones[0].fog[0], zones[0].fog[1]);
  const hemi = new THREE.HemisphereLight(zones[0].hemi[0], zones[0].hemi[1], 1);
  const sun = new THREE.DirectionalLight(zones[0].sun, 1);
  const ctrl = createBiomeController({ zones, scene, hemi, sun });
  ctrl.reset();
  const startSkyHex = scene.background.getHex();
  const tundraHex = new THREE.Color(zones.find((z) => z.id === 'tundra').sky).getHex();

  // After 1 second in tundra, sky should be mid-blend (neither start nor full target)
  ctrl.update(lm.mountain.x, lm.mountain.z, 1.0);
  const midHex = scene.background.getHex();
  assert.notEqual(midHex, startSkyHex);
  assert.notEqual(midHex, tundraHex);

  // After 5 more seconds, sky finishes blending to tundra
  ctrl.update(lm.mountain.x, lm.mountain.z, 5.0);
  assert.equal(scene.background.getHex(), tundraHex);
});

test('seeded RNG and island terrain heightmap, river, bridges, and coastline work deterministically', () => {
  const r1 = createRng(11);
  const r2 = createRng(11);
  for (let i = 0; i < 10; i++) {
    assert.equal(r1(), r2());
  }
  assert.equal(CONFIG.world.halfSize, 200);
  assert.equal(CONFIG.worldSeed, 42);

  const h = getGroundHeight(15, -20);
  assert.ok(Number.isFinite(h));
  assert.equal(h, getGroundHeight(15, -20));

  // Origin and key land landmarks must be dry and walkable
  const lm = CONFIG.landmarks;
  assert.equal(isWalkable(0, 0), true, 'spawn origin must be walkable');
  for (const key of ['beach_nw', 'mountain', 'cave', 'canyon', 'swamp_ruins', 'forest_e', 'dock_w']) {
    const pt = lm[key];
    assert.equal(isWalkable(pt.x, pt.z), true, `landmark ${key} (${pt.x}, ${pt.z}) must be walkable`);
  }

  // Mountain peak rises into snow zone (y > 18)
  const mtY = getGroundHeight(lm.mountain.x, lm.mountain.z);
  assert.ok(mtY > CONFIG.terrain.snowHeight, `mountain y=${mtY.toFixed(2)} should exceed snowHeight`);

  // Outer ocean corners must have mask < 0.05 and be unwalkable
  for (const [ox, oz] of [[-195, -195], [195, -195], [-195, 195], [195, 195]]) {
    assert.ok(getIslandMask(ox, oz) < 0.05, `corner (${ox},${oz}) must be ocean`);
    assert.equal(isWalkable(ox, oz), false, `corner (${ox},${oz}) must be unwalkable`);
  }

  // North lake water is unwalkable outside islet; islet center is above water
  assert.equal(isWaterAt(lm.lake_n.x + 12, lm.lake_n.z), true, 'north lake ring must be water');
  assert.ok(getGroundHeight(lm.lake_n.x, lm.lake_n.z) > 0, 'north lake islet must rise above water');

  // River blocks crossing between bridges, while bridges allow safe crossing
  assert.ok(getRiverDistance(lm.bridge_n.x, lm.bridge_n.z) < 0.5, 'bridge_n must sit on river');
  assert.ok(getRiverDistance(lm.bridge_s.x, lm.bridge_s.z) < 0.5, 'bridge_s must sit on river');
  assert.equal(isOnBridge(lm.bridge_n.x, lm.bridge_n.z), true);
  assert.equal(isOnBridge(lm.bridge_s.x, lm.bridge_s.z), true);
  assert.equal(isWalkable(lm.bridge_n.x, lm.bridge_n.z), true);
  assert.equal(isWalkable(lm.bridge_s.x, lm.bridge_s.z), true);
  assert.ok(getWalkHeight(lm.bridge_n.x, lm.bridge_n.z) > 0.5, 'bridge deck must sit above water');

  // Midpoint of river between bridges is water and blocks stepping
  assert.equal(isOnBridge(33, 18), false);
  assert.equal(isWaterAt(33, 18), true);
  assert.equal(isWalkable(33, 18), false);

  const probe = { x: 24, z: 18 };
  assert.equal(isWalkable(probe.x, probe.z), true);
  stepWalkable(probe, 33, 18, 4);
  assert.equal(isWalkable(probe.x, probe.z), true, 'stepWalkable must not enter unbridged river');
});

test('placeLandmarks mounts all 12 island landmarks and animates waterfall cleanly', () => {
  const scene = new THREE.Scene();
  const lm = placeLandmarks(scene, CONFIG);
  assert.ok(lm.group && lm.group.children.length >= 25);
  assert.equal(Object.keys(CONFIG.landmarks).length, 12);
  assert.doesNotThrow(() => {
    lm.update(0.0);
    lm.update(1.75);
  });
});

test('createWorldProps places biome-varied props deterministically with zero water or river overlap', () => {
  const s1 = new THREE.Scene();
  const s2 = new THREE.Scene();
  const p1 = createWorldProps(s1, zones[0], zones);
  const p2 = createWorldProps(s2, zones[0], zones);

  assert.equal(p1.treeCount, p2.treeCount);
  assert.equal(p1.rockCount, p2.rockCount);
  assert.ok(p1.treeCount > 120, `expected >120 trees, got ${p1.treeCount}`);
  assert.ok(p1.fernCount > 20, `expected >20 swamp/jungle ferns, got ${p1.fernCount}`);

  const types = new Set();
  for (let i = 0; i < p1.trees.length; i++) {
    const t = p1.trees[i];
    assert.equal(t.x, p2.trees[i].x);
    assert.equal(t.z, p2.trees[i].z);
    assert.equal(isWalkable(t.x, t.z), true, `tree at (${t.x},${t.z}) must be on dry land`);
    assert.ok(
      getRiverDistance(t.x, t.z) >= CONFIG.world.riverPropBuffer,
      `tree at (${t.x},${t.z}) must stay >= 6 units from river`,
    );
    types.add(t.type);
  }
  assert.equal(types.has('broadleaf'), true);
  assert.equal(types.has('pine'), true);
  assert.equal(types.has('dead'), true);
});

test('biome ecology keeps all spawns on dry land, respects biome tables, spawns bosses near cave, and places 8 eggs', () => {
  const scene = new THREE.Scene();
  const player = { x: 0, z: 0 };
  const spot = { x: 0, z: 0 };

  // Berries: dry land, never canyon or tundra
  const berryFood = foods.find((f) => f.id === 'berry');
  const bm = createBerryManager(scene, berryFood, []);
  bm.reset(CONFIG.population.berries);
  for (const b of bm.items) {
    assert.equal(isWalkable(b.x, b.z), true, 'berry must spawn on dry land');
    const zone = findNearestZone(zones, b.x, b.z).id;
    assert.notEqual(zone, 'canyon');
    assert.notEqual(zone, 'tundra');
  }

  // Compies never spawn in tundra; trikes only in jungle or canyon; rexes never in canyon or beach
  for (let i = 0; i < 20; i++) {
    const c = createNpcEntity(scene, 'compy', player, CONFIG.dinos, spot);
    assert.equal(isWalkable(c.x, c.z), true, 'compy must spawn on dry land');
    assert.notEqual(findNearestZone(zones, c.x, c.z).id, 'tundra');

    const t = createNpcEntity(scene, 'trike', player, CONFIG.dinos, spot);
    assert.equal(isWalkable(t.x, t.z), true, 'trike must spawn on dry land');
    const tZone = findNearestZone(zones, t.x, t.z).id;
    assert.ok(tZone === 'jungle' || tZone === 'canyon', `unexpected trike biome ${tZone}`);

    const r = createRexEntity(scene, player, CONFIG.dinos.rex);
    assert.equal(isWalkable(r.x, r.z), true, 'rex must spawn on dry land');
    const rZone = findNearestZone(zones, r.x, r.z).id;
    assert.ok(rZone !== 'canyon' && rZone !== 'beach', `unexpected rex biome ${rZone}`);
  }

  // Boss always spawns near cave (+/- 20) on dry land
  const cave = CONFIG.landmarks.cave;
  for (let i = 0; i < 10; i++) {
    const b = createBossEntity(scene, bosses[0], player, CONFIG.dinos.rex);
    assert.equal(isWalkable(b.x, b.z), true, 'boss must spawn on dry land');
    assert.ok(Math.abs(b.x - cave.x) <= 20 && Math.abs(b.z - cave.z) <= 20, 'boss must spawn near cave');
  }

  // 8 collectible eggs near cave and beach_nw
  const eggFood = foods.find((f) => f.id === 'egg');
  const em = createEggManager(scene, eggFood, CONFIG.landmarks);
  em.reset();
  assert.equal(em.items.length, 8);
  const beach = CONFIG.landmarks.beach_nw;
  for (const e of em.items) {
    assert.equal(e.active, true);
    assert.equal(isWalkable(e.x, e.z), true, 'egg must be on dry land');
    const nearCave = Math.hypot(e.x - cave.x, e.z - cave.z) <= 25;
    const nearBeach = Math.hypot(e.x - beach.x, e.z - beach.z) <= 25;
    assert.ok(nearCave || nearBeach, 'egg must be near cave or beach_nw');
  }
  assert.equal(em.collectAt(0), true);
  assert.equal(em.items[0].active, false);
  assert.equal(em.collectAt(0), false);
  em.stepTimers(50);
  assert.equal(em.items[0].active, true);
});

test('day/night cycle transitions Dawn -> Day -> Dusk -> Night with moon light and 1.3x night hunger drain', () => {
  const dur = CONFIG.dayDuration;
  assert.equal(dur, 240);
  assert.equal(CONFIG.nightHungerMultiplier, 1.3);

  const dawn = getTimeOfDayInfo(dur * 0.05, dur, {});
  assert.equal(dawn.phase, 'dawn');
  assert.equal(dawn.label, '🌅 Dawn');
  assert.equal(dawn.hungerMultiplier, 1.0);

  const day = getTimeOfDayInfo(dur * 0.4, dur, {});
  assert.equal(day.phase, 'day');
  assert.equal(day.label, '☀ Day');
  assert.equal(day.hungerMultiplier, 1.0);

  const dusk = getTimeOfDayInfo(dur * 0.78, dur, {});
  assert.equal(dusk.phase, 'dusk');
  assert.equal(dusk.label, '🌇 Dusk');
  assert.equal(dusk.hungerMultiplier, 1.0);

  const night = getTimeOfDayInfo(dur * 0.92, dur, {});
  assert.equal(night.phase, 'night');
  assert.equal(night.label, '🌙 Night');
  assert.equal(night.isNight, true);
  assert.equal(night.hungerMultiplier, 1.3);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(zones[0].sky);
  scene.fog = new THREE.Fog(zones[0].sky, zones[0].fog[0], zones[0].fog[1]);
  const hemi = new THREE.HemisphereLight(zones[0].hemi[0], zones[0].hemi[1], CONFIG.lighting.hemiIntensity);
  const sun = new THREE.DirectionalLight(zones[0].sun, CONFIG.lighting.sunIntensity);
  const bio = createBiomeController({ zones, scene, hemi, sun, applyToScene: false });
  bio.reset();
  const env = createEnvironmentController({ scene, hemi, sun, config: CONFIG });

  // Midday: bright hemi, moon off, sun high
  env.update(dur * 0.5, bio.getAtmosphere(), 0, 2, 0);
  assert.equal(env.moon.intensity, 0);
  assert.ok(env.state.sunElevation > 59);
  assert.ok(Math.abs(hemi.intensity - CONFIG.lighting.hemiIntensity) < 1e-6);

  // Deep night: fog 10..50, hemi 0.3, moon 0.4, night sky #0a0510
  env.update(dur * 0.92, bio.getAtmosphere(), 0, 2, 0);
  assert.equal(scene.fog.near, 10);
  assert.equal(scene.fog.far, 50);
  assert.ok(Math.abs(hemi.intensity - 0.3) < 1e-6);
  assert.ok(Math.abs(env.moon.intensity - 0.4) < 1e-6);
  assert.equal(scene.background.getHex(), 0x0a0510);
});
