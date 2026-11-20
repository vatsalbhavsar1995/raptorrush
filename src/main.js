import * as THREE from 'three';
import { CONFIG } from './config.js';
import zones from './data/zones.json';
import bosses from './data/bosses.json';
import dinoRoster from './data/dinos.json';
import foods from './data/foods.json';
import { getWalkHeight, isWalkable, stepWalkable } from './world/terrain.js';
import { createIslandWorld } from './world/index.js';
import { createBiomeController } from './world/biomes.js';
import {
  computePlayerStats,
  createAbilityRuntime,
  createPlayerMesh,
  disposeObjectTree,
  getDinoById,
  loadSelectedDinoId,
  resetAbilityRuntime,
  stepDinoAbility,
  syncPlayerStatsWithEvolution,
  triggerDinoAbility,
  updateEvolutionVisuals,
} from './entities/player.js';
import { createStompRing } from './entities/boss.js';
import { handleNpcKill } from './entities/npc.js';
import { createBerryManager, createEggManager } from './entities/pickups.js';
import { createInputController } from './systems/input.js';
import { createCameraController } from './systems/camera.js';
import { applyAreaDamage, collectFood, performBite, scaleIncomingDamage } from './systems/combat.js';
import { createEvolutionState, resetEvolution } from './systems/evolution.js';
import { createEnvironmentController, getTimeOfDayInfo } from './systems/environment.js';
import { createBossEntity, createNpcEntity, createRexEntity } from './systems/spawn.js';
import { createDebugOverlay, createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createMenu } from './ui/menu.js';
import { createPauseMenu, loadSettings } from './ui/pause.js';

const basePlayerStats = CONFIG.dinos.player;
const rexStats = CONFIG.dinos.rex;
const compyStats = CONFIG.dinos.compy;
const trikeStats = CONFIG.dinos.trike;
const foodsById = Object.create(null);
for (let i = 0; i < foods.length; i++) {
  foodsById[foods[i].id] = foods[i];
}
const hs = CONFIG.world.halfSize;

const canvas = document.getElementById('c');
const mapCanvas = document.getElementById('map');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const initialZone = zones[0];
const scene = new THREE.Scene();
scene.background = new THREE.Color(initialZone.sky);
scene.fog = new THREE.Fog(initialZone.sky, initialZone.fog[0], initialZone.fog[1]);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  1,
  CONFIG.camera.near,
  CONFIG.camera.far,
);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const hemi = new THREE.HemisphereLight(
  initialZone.hemi[0],
  initialZone.hemi[1],
  CONFIG.lighting.hemiIntensity,
);
scene.add(hemi);

const sun = new THREE.DirectionalLight(initialZone.sun, CONFIG.lighting.sunIntensity);
sun.castShadow = true;
sun.shadow.mapSize.set(CONFIG.lighting.shadowMapSize, CONFIG.lighting.shadowMapSize);
const shadowExt = CONFIG.lighting.shadowCameraExtent;
sun.shadow.camera.left = -shadowExt;
sun.shadow.camera.right = shadowExt;
sun.shadow.camera.top = shadowExt;
sun.shadow.camera.bottom = -shadowExt;
sun.shadow.camera.near = CONFIG.lighting.shadowCameraNear;
sun.shadow.camera.far = CONFIG.lighting.shadowCameraFar;
sun.shadow.bias = CONFIG.lighting.shadowBias;
sun.shadow.normalBias = CONFIG.lighting.shadowNormalBias;
scene.add(sun, sun.target);

const world = createIslandWorld({
  scene,
  zones,
  initialZone,
  config: CONFIG,
});
const props = world.props;
const ring = createStompRing(scene);
const berryManager = createBerryManager(scene, foodsById.berry, props.trees);
const eggManager = createEggManager(scene, foodsById.egg, CONFIG.landmarks);

let selectedDino = getDinoById(dinoRoster, loadSelectedDinoId(dinoRoster));
let playerStats = computePlayerStats(selectedDino, basePlayerStats);
let playerVisual = createPlayerMesh(scene, basePlayerStats, selectedDino);

const hud = createHud();
hud.setDinoIdentity(selectedDino);
const debugOverlay = createDebugOverlay();
const minimap = createMinimap(mapCanvas);
const cameraCtrl = createCameraController(camera);
const biomes = createBiomeController({
  zones,
  scene,
  hemi,
  sun,
  applyToScene: false,
  onZoneChange: (zone) => hud.setZoneName(zone.name),
});
const environment = createEnvironmentController({
  scene,
  hemi,
  sun,
  config: CONFIG,
});
const todScratch = { t: 0, phase: 'day', label: '☀ Day', isNight: false, hungerMultiplier: 1.0 };

const settings = loadSettings();

const player = { x: 0, z: 0, a: 0, s: 0, px: 0, pz: 0, pa: 0, ps: 0, moving: false };
const renderPlayer = { x: 0, z: 0, a: 0 };
const spotScratch = { x: 0, z: 0 };
const abilityRuntime = createAbilityRuntime();
const evo = createEvolutionState();
const evoPlayerTarget = {
  group: playerVisual.group,
  baseScale: selectedDino.scale,
  onToast: (title, sub) => hud.showToast(title, sub),
};
const debugCounts = {
  rexes: 0,
  boss: 0,
  compies: 0,
  trikes: 0,
  berries: 0,
  trees: props.treeCount,
  rocks: props.rockCount,
};
const hudState = {
  health: playerStats.maxHealth,
  maxHealth: playerStats.maxHealth,
  hunger: playerStats.maxHunger,
  stamina: playerStats.maxStamina,
  maxStamina: playerStats.maxStamina,
  hurt: 0,
  hurtInvuln: playerStats.hurtInvuln,
  tired: false,
  boss: null,
  eaten: 0,
  elapsedSec: 0,
  nearestBerryDist: 0,
  playing: false,
  abilityCooldown: 0,
  abilityMaxCooldown: 0,
  evoMeter: 0,
  evoStage: 0,
  evoFlash: 0,
  evoPulse: 0,
  timeOfDay: '☀ Day',
};
const minimapState = {
  zones,
  currentZone: initialZone,
  landmarks: CONFIG.landmarks,
  player: renderPlayer,
  camYaw: 0,
  berries: berryManager.items,
  eggs: eggManager.items,
  npcs: null,
  rexes: null,
};

let health = playerStats.maxHealth;
let hunger = playerStats.maxHunger;
let stamina = playerStats.maxStamina;
let tired = false;
let hurt = 0;
let shake = 0;
let slow = 0;
let rexes = [];
let npcs = [];
let boss = null;
let bossIdx = 0;
let eaten = 0;
let score = 0;
let biteCd = 0;
let biteT = 0;
let prevBiteT = 0;
let ringT = 0;
let prevRingT = 0;
let ringDur = 0.6;
let ringX = 0;
let ringZ = 0;
let runStartMs = 0;
let pauseAtMs = 0;
let state = 'menu';
let runToken = 0;
let accumulator = 0;
const respawnTimers = new Set();

function refreshEffectiveStats() {
  const deltaHp = syncPlayerStatsWithEvolution(playerStats, selectedDino, basePlayerStats, evo);
  if (deltaHp > 0) {
    health = Math.min(playerStats.maxHealth, health + deltaHp);
  }
  hudState.maxHealth = playerStats.maxHealth;
  if (playerVisual && playerVisual.group) {
    playerVisual.group.scale.setScalar(selectedDino.scale * evo.stageScale);
  }
}

function applySelectedDino(dino) {
  selectedDino = dino;
  playerStats = computePlayerStats(selectedDino, basePlayerStats, evo);
  scene.remove(playerVisual.group);
  disposeObjectTree(playerVisual.group);
  playerVisual = createPlayerMesh(scene, basePlayerStats, selectedDino, evo);
  evoPlayerTarget.group = playerVisual.group;
  evoPlayerTarget.baseScale = selectedDino.scale;
  updateEvolutionVisuals(playerVisual.group, selectedDino, evo, CONFIG);
  hudState.maxHealth = playerStats.maxHealth;
  hudState.maxStamina = playerStats.maxStamina;
  hudState.hurtInvuln = playerStats.hurtInvuln;
  hudState.abilityMaxCooldown = playerStats.ability.cooldown;
  hud.setDinoIdentity(selectedDino);
}

function hurtPlayer(amount) {
  health -= scaleIncomingDamage(amount, settings.diff, playerStats.armor);
}

function clearRespawnTimers() {
  respawnTimers.forEach((id) => clearTimeout(id));
  respawnTimers.clear();
}

function applySettings() {
  const shadowsOn = !!settings.shadows;
  if (shadowsOn !== renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = shadowsOn;
    scene.traverse((obj) => {
      if (obj.material) obj.material.needsUpdate = true;
    });
  }
  sun.castShadow = shadowsOn;
  renderer.setPixelRatio(settings.quality ? Math.min(window.devicePixelRatio || 1, 2) : 1);
  resize();
  mapCanvas.style.display = settings.map ? 'block' : 'none';
  cameraCtrl.applyViewSetting(settings.view);
}

function addNpc(type) {
  npcs.push(createNpcEntity(scene, type, player, CONFIG.dinos, spotScratch));
}

function spawnBoss() {
  const bossDef = bosses[bossIdx % bosses.length];
  for (let i = 0; i < rexes.length; i++) {
    scene.remove(rexes[i].g);
  }
  boss = createBossEntity(scene, bossDef, player, rexStats);
  rexes.length = 0;
  rexes.push(boss);
  hud.showBoss(bossDef.name);
  hud.showToast(bossDef.name, CONFIG.copy.bossToastSub);
}

function onBossDamaged(r) {
  shake = Math.max(shake, CONFIG.simulation.bossHitShake);
  hud.updateBossHealth(r.hp, r.boss.hp);
}

function killNpc(npc) {
  npc.dead = true;
  scene.remove(npc.g);
  const food = npc.type === 'trike' ? foodsById.trike : foodsById.compy;
  hunger = Math.min(playerStats.maxHunger, hunger + food.hunger);
  handleNpcKill(npc, evo, foods, CONFIG, evoPlayerTarget, evoPlayerTarget.onToast);
  refreshEffectiveStats();
  if (!boss) {
    eaten += food.eaten;
    score += food.score;
  }
  const activeRun = runToken;
  const delay = food.respawnMinMs + Math.random() * food.respawnExtraMs;
  const timerId = setTimeout(() => {
    respawnTimers.delete(timerId);
    if (runToken === activeRun) addNpc(npc.type);
  }, delay);
  respawnTimers.add(timerId);
}

function defeatBoss() {
  scene.remove(boss.g);
  boss = null;
  bossIdx++;
  rexes.length = 0;
  for (let i = 0; i < CONFIG.population.rex; i++) {
    rexes.push(createRexEntity(scene, player, rexStats));
  }
  const bossFood = foodsById.boss;
  hunger = Math.min(playerStats.maxHunger, hunger + bossFood.hunger);
  const evoRes = collectFood('boss', evo, foods, CONFIG, evoPlayerTarget, evoPlayerTarget.onToast);
  refreshEffectiveStats();
  hud.hideBoss();
  if (!evoRes.stagedUp) {
    hud.showToast(CONFIG.copy.bossDefeatedTitle, CONFIG.copy.bossDefeatedSub);
  }
  score = 0;
}

function executeBite(damageOverride) {
  biteT = playerStats.biteDuration;
  performBite(
    player,
    rexes,
    npcs,
    playerStats,
    rexStats,
    onBossDamaged,
    defeatBoss,
    killNpc,
    damageOverride,
  );
  compactDeadNpcs();
}

function triggerStompRing(x, z, duration) {
  ringX = x;
  ringZ = z;
  ringDur = duration;
  ringT = duration;
  prevRingT = duration;
}

function addShake(amount) {
  shake = Math.max(shake, amount);
}

const abilityTriggerArgs = {
  dinoId: selectedDino.id,
  abilityRuntime,
  player,
  playerStats,
  rexes,
  npcs,
  trees: props.trees,
  onBite: executeBite,
  onAreaDamage: applyAreaDamage,
  onStompRing: triggerStompRing,
  onShake: addShake,
  onBossDamaged,
  onBossDefeated: defeatBoss,
  onNpcKilled: killNpc,
};

const abilityStepArgs = {
  dt: 0,
  abilityRuntime,
  player,
  playerStats,
  rexes,
  npcs,
  onBossDamaged,
  onBossDefeated: defeatBoss,
  onNpcKilled: killNpc,
  onShake: addShake,
};

function setup() {
  runToken++;
  clearRespawnTimers();
  for (let i = 0; i < rexes.length; i++) scene.remove(rexes[i].g);
  for (let i = 0; i < npcs.length; i++) scene.remove(npcs[i].g);

  berryManager.reset(CONFIG.population.berries);
  eggManager.reset();
  npcs.length = 0;
  boss = null;
  hud.hideBoss();

  player.x = 0;
  player.z = 0;
  player.a = 0;
  player.s = 0;
  player.px = 0;
  player.pz = 0;
  player.pa = 0;
  player.ps = 0;
  player.moving = false;
  renderPlayer.x = 0;
  renderPlayer.z = 0;
  renderPlayer.a = 0;
  cameraCtrl.resetPosition(0, 0);

  rexes.length = 0;
  for (let i = 0; i < CONFIG.population.rex; i++) {
    rexes.push(createRexEntity(scene, player, rexStats));
  }

  resetAbilityRuntime(abilityRuntime);
  resetEvolution(evo, evoPlayerTarget);
  syncPlayerStatsWithEvolution(playerStats, selectedDino, basePlayerStats, evo);
  updateEvolutionVisuals(playerVisual.group, selectedDino, evo, CONFIG);
  health = playerStats.maxHealth;
  hunger = playerStats.maxHunger;
  stamina = playerStats.maxStamina;
  tired = false;
  hurt = 0;
  shake = 0;
  slow = 0;
  eaten = 0;
  score = 0;
  biteCd = 0;
  biteT = 0;
  prevBiteT = 0;
  ringT = 0;
  prevRingT = 0;
  ringDur = 0.6;
  accumulator = 0;
  runStartMs = performance.now();
  bossIdx = 0;

  for (let i = 0; i < CONFIG.population.compy; i++) addNpc('compy');
  for (let i = 0; i < CONFIG.population.trike; i++) addNpc('trike');
  biomes.reset();

  hudState.health = health;
  hudState.maxHealth = playerStats.maxHealth;
  hudState.hunger = hunger;
  hudState.stamina = stamina;
  hudState.maxStamina = playerStats.maxStamina;
  hudState.hurt = 0;
  hudState.tired = false;
  hudState.boss = null;
  hudState.eaten = 0;
  hudState.elapsedSec = 0;
  hudState.nearestBerryDist = 0;
  hudState.playing = false;
  hudState.abilityCooldown = 0;
  hudState.abilityMaxCooldown = playerStats.ability.cooldown;
  hudState.evoMeter = evo.meter;
  hudState.evoStage = evo.stage;
  hudState.evoFlash = evo.flashTimer;
  hudState.evoPulse = evo.pulseTimer;
  hudState.timeOfDay = '☀ Day';
  hud.update(hudState);
}

function begin() {
  resetEvolution(evo, evoPlayerTarget);
  applySelectedDino(getDinoById(dinoRoster, loadSelectedDinoId(dinoRoster)));
  setup();
  state = 'play';
  menu.hide();
  hud.showToast(CONFIG.copy.startToastTitle, CONFIG.copy.startToastSub);
}

function die(cause) {
  state = 'over';
  const elapsedSec = (performance.now() - runStartMs) / 1000;
  resetEvolution(evo, evoPlayerTarget);
  syncPlayerStatsWithEvolution(playerStats, selectedDino, basePlayerStats, evo);
  menu.showGameOver(cause, elapsedSec, eaten);
  hud.clearAlerts();
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'paused';
  pauseAtMs = performance.now();
  input.clear();
  pauseMenu.show();
}

function resumeGame() {
  if (state !== 'paused') return;
  const now = performance.now();
  runStartMs += now - pauseAtMs;
  lastMs = now;
  accumulator = 0;
  state = 'play';
  pauseMenu.hide();
}

function toTitle(preserveEvoForPicker = false) {
  pauseMenu.hide();
  if (!preserveEvoForPicker) {
    setup();
  }
  state = 'menu';
  menu.showTitle();
  hud.clearAlerts();
}

const menu = createMenu({
  roster: dinoRoster,
  initialDinoId: selectedDino.id,
  evo,
  onSelectDino: (dino) => {
    applySelectedDino(dino);
  },
  onStart: begin,
});
const pauseMenu = createPauseMenu({
  settings,
  onApplySettings: applySettings,
  onPause: pauseGame,
  onResume: resumeGame,
  onChangeDino: () => toTitle(true),
  onRestart: () => {
    pauseMenu.hide();
    begin();
  },
  onQuit: () => toTitle(false),
});

const input = createInputController({
  canvas,
  runButton: document.getElementById('run'),
  biteButton: document.getElementById('bite'),
  abilityButton: document.getElementById('abil'),
  joyElement: document.getElementById('joy'),
  onTogglePause: () => {
    if (state === 'paused') resumeGame();
    else pauseGame();
  },
  onCameraDrag: (dx, dy) => cameraCtrl.handleDrag(dx, dy),
  onCameraWheel: (dy) => cameraCtrl.handleWheel(dy),
});

applySettings();
setup();

function pickWalkableWaypoint(entity, wpLimit) {
  for (let tries = 0; tries < 20; tries++) {
    const wx = (Math.random() * 2 - 1) * wpLimit;
    const wz = (Math.random() * 2 - 1) * wpLimit;
    if (isWalkable(wx, wz)) {
      entity.wx = wx;
      entity.wz = wz;
      return;
    }
  }
  entity.wx = 0;
  entity.wz = 0;
}

function wrapAngleDelta(target, current) {
  return ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  return a + wrapAngleDelta(b, a) * t;
}

function snapshotPreviousTransforms() {
  player.px = player.x;
  player.pz = player.z;
  player.pa = player.a;
  player.ps = player.s;
  prevBiteT = biteT;
  prevRingT = ringT;

  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    r.px = r.x;
    r.pz = r.z;
    r.pa = r.a;
    r.ps = r.s;
  }
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    n.px = n.x;
    n.pz = n.z;
    n.pa = n.a;
    n.ps = n.s;
  }
}

function compactDeadNpcs() {
  let write = 0;
  for (let read = 0; read < npcs.length; read++) {
    if (!npcs[read].dead) {
      npcs[write++] = npcs[read];
    }
  }
  npcs.length = write;
}

function update(dt) {
  snapshotPreviousTransforms();

  abilityStepArgs.dt = dt;
  abilityStepArgs.playerStats = playerStats;
  const isCharging = stepDinoAbility(abilityStepArgs);
  compactDeadNpcs();

  const move = input.getMoveInput(cameraCtrl.getYaw());
  const running = !isCharging && input.isSprintHeld() && move.mag > 0 && !tired;
  if (!isCharging) {
    const baseSpeed = running ? playerStats.sprintSpeed : playerStats.walkSpeed;
    const speed = baseSpeed * move.mag * (slow > 0 ? playerStats.slowMultiplier : 1);

    stepWalkable(
      player,
      player.x + move.dx * speed * dt,
      player.z + move.dz * speed * dt,
      CONFIG.world.playerEdgeMargin,
    );
    if (move.mag > 0) {
      const targetAngle = Math.atan2(move.dx, move.dz);
      player.a += wrapAngleDelta(targetAngle, player.a) * Math.min(1, dt * playerStats.turnRate);
    }
    player.s += speed * dt * playerStats.strideScale;
  }
  player.moving = Math.hypot(player.x - player.px, player.z - player.pz) > 0.001;

  cameraCtrl.updateYaw(dt, input.keys, !!settings.cam, player.a, move.mag > 0);

  const trees = props.trees;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const ax = player.x - t.x;
    const az = player.z - t.z;
    const d = Math.hypot(ax, az);
    const minDist = t.r + playerStats.collisionRadius;
    if (d < minDist && d > 0) {
      stepWalkable(player, t.x + (ax / d) * minDist, t.z + (az / d) * minDist, CONFIG.world.playerEdgeMargin);
    }
  }

  if (running) {
    stamina -= playerStats.staminaDrain * dt;
  } else {
    stamina = Math.min(playerStats.maxStamina, stamina + playerStats.staminaRegen * dt);
  }
  if (stamina <= 0) {
    stamina = 0;
    tired = true;
  }
  if (tired && stamina > playerStats.tiredRecoverThreshold) {
    tired = false;
  }

  const elapsedNowSec = (performance.now() - runStartMs) / 1000;
  const todNow = getTimeOfDayInfo(elapsedNowSec, CONFIG.dayDuration, todScratch);
  hunger -=
    (playerStats.hungerDrain + (running ? playerStats.sprintHungerDrain : 0)) *
    todNow.hungerMultiplier *
    dt;

  const berries = berryManager.items;
  const berryFood = foodsById.berry;
  for (let i = 0; i < berries.length; i++) {
    const b = berries[i];
    if (Math.hypot(b.x - player.x, b.z - player.z) < berryFood.pickupRange) {
      berryManager.respawnAt(i);
      hunger = Math.min(playerStats.maxHunger, hunger + berryFood.hunger);
      collectFood('berry', evo, foods, CONFIG, evoPlayerTarget, evoPlayerTarget.onToast);
      refreshEffectiveStats();
      eaten += berryFood.eaten;
      score += berryFood.score;
    }
  }

  eggManager.stepTimers(dt);
  const eggs = eggManager.items;
  const eggFood = foodsById.egg;
  for (let i = 0; i < eggs.length; i++) {
    const e = eggs[i];
    if (!e.active) continue;
    if (Math.hypot(e.x - player.x, e.z - player.z) < eggManager.pickupRange) {
      eggManager.collectAt(i);
      hunger = Math.min(playerStats.maxHunger, hunger + eggFood.hunger);
      collectFood('egg', evo, foods, CONFIG, evoPlayerTarget, evoPlayerTarget.onToast);
      refreshEffectiveStats();
      if (!boss) {
        eaten += eggFood.eaten;
        score += eggFood.score;
      }
    }
  }

  hurt = Math.max(0, hurt - dt);
  shake = Math.max(0, shake - dt * CONFIG.simulation.shakeDecay);
  biteCd = Math.max(0, biteCd - dt);
  biteT = Math.max(0, biteT - dt);
  slow = Math.max(0, slow - dt);
  ringT = Math.max(0, ringT - dt);
  evo.flashTimer = Math.max(0, evo.flashTimer - dt);
  evo.pulseTimer = Math.max(0, evo.pulseTimer - dt);

  if (input.consumeAbility()) {
    abilityTriggerArgs.dinoId = selectedDino.id;
    abilityTriggerArgs.playerStats = playerStats;
    triggerDinoAbility(abilityTriggerArgs);
    compactDeadNpcs();
    if (state !== 'play') return;
  }

  if (input.consumeBite()) {
    if (biteCd <= 0) {
      biteCd = playerStats.biteCooldown;
      executeBite();
      if (state !== 'play') return;
    }
  }

  if (hunger > playerStats.healThreshold && health < playerStats.maxHealth) {
    health = Math.min(playerStats.maxHealth, health + playerStats.healRate * dt);
  }

  if (!boss && score >= CONFIG.population.bossEveryScore) {
    score = 0;
    spawnBoss();
  }

  const elapsedSec = (performance.now() - runStartMs) / 1000;
  const targetRexPop =
    CONFIG.population.rex +
    (elapsedSec > CONFIG.population.rexLateBonusAfterSec ? CONFIG.population.rexLateBonusCount : 0);
  if (!boss && rexes.length < targetRexPop) {
    rexes.push(createRexEntity(scene, player, rexStats));
  }

  let warn = false;
  const wpLimit = hs - CONFIG.world.waypointEdgeMargin;
  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    const rx = player.x - r.x;
    const rz = player.z - r.z;
    const d = Math.hypot(rx, rz);
    r.t -= dt;

    if (r.mode === 'patrol') {
      if (Math.hypot(r.wx - r.x, r.wz - r.z) < rexStats.waypointReach || r.t <= 0) {
        pickWalkableWaypoint(r, wpLimit);
        r.t = rexStats.patrolDuration;
      }
      if (d < rexStats.detectRange) {
        r.mode = 'chase';
        r.t = rexStats.chaseDuration;
      }
    } else if (r.mode === 'chase') {
      if (r.t <= 0 || d > rexStats.loseRange) {
        r.mode = 'rest';
        r.t = rexStats.restDuration;
      }
    } else if (r.t <= 0) {
      r.mode = r.boss ? 'chase' : 'patrol';
      r.t = r.boss ? rexStats.chaseDuration : 0;
    }

    let tx = r.wx;
    let tz = r.wz;
    let rSpd = rexStats.patrolSpeed;
    if (r.mode === 'chase') {
      tx = player.x;
      tz = player.z;
      if (r.boss) {
        rSpd = r.dash > 0 ? r.boss.dashSpeed : r.boss.speed;
      } else {
        rSpd = rexStats.chaseSpeed;
      }
    } else if (r.mode === 'rest') {
      rSpd = 0;
    }

    const ax = tx - r.x;
    const az = tz - r.z;
    const ad = Math.hypot(ax, az);
    if (rSpd && ad > 0.1) {
      const moved = stepWalkable(
        r,
        r.x + (ax / ad) * rSpd * dt,
        r.z + (az / ad) * rSpd * dt,
        rexStats.clampPadding,
      );
      if (!moved && r.mode === 'patrol') {
        pickWalkableWaypoint(r, wpLimit);
      }
      const ta = Math.atan2(ax, az);
      r.a += wrapAngleDelta(ta, r.a) * Math.min(1, dt * rexStats.turnRate);
      r.s += rSpd * dt * rexStats.strideScale;
    }

    for (let j = 0; j < trees.length; j++) {
      const t = trees[j];
      const ex = r.x - t.x;
      const ez = r.z - t.z;
      const ed = Math.hypot(ex, ez);
      const minDist = t.r + rexStats.collisionRadius;
      if (ed < minDist && ed > 0) {
        stepWalkable(r, t.x + (ex / ed) * minDist, t.z + (ez / ed) * minDist, rexStats.clampPadding);
      }
    }

    if (r.mode === 'chase') warn = true;

    if (r.boss) {
      r.cd -= dt;
      r.dash -= dt;
      const bDef = r.boss;
      if (
        bDef.ability === 'lunge' &&
        r.mode === 'chase' &&
        r.cd <= 0 &&
        d > bDef.abilityMinRange &&
        d < bDef.abilityMaxRange
      ) {
        r.dash = bDef.dashDuration;
        r.cd = bDef.abilityCooldown;
      }
      if (bDef.ability === 'stomp' && r.mode === 'chase' && r.cd <= 0 && d < bDef.abilityRange) {
        r.cd = bDef.abilityCooldown;
        shake = 1;
        triggerStompRing(r.x, r.z, bDef.ringDuration);
        if (d < bDef.stompHitRange && hurt <= 0) {
          hurtPlayer(bDef.stompDamage);
          hurt = bDef.stompHurtCooldown;
        }
      }
    }

    const hitRange = rexStats.hitBaseRange + (r.k || rexStats.scale) * rexStats.hitScaleRange;
    if (d < hitRange && hurt <= 0 && r.mode !== 'rest') {
      hurtPlayer(r.boss ? r.boss.damage : rexStats.damage);
      hurt = playerStats.hurtInvuln;
      shake = 1;
      r.mode = 'rest';
      r.t = r.boss ? r.boss.restDuration : rexStats.hitRestDuration;
      if (r.boss && r.boss.ability === 'chill') {
        slow = r.boss.chillDuration;
      }
      if (d > 0) {
        stepWalkable(
          player,
          player.x + (rx / d) * rexStats.knockback,
          player.z + (rz / d) * rexStats.knockback,
          CONFIG.world.playerEdgeMargin,
        );
      }
    }
  }
  hud.setWarning(warn);

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (n.dead) continue;
    const dx = player.x - n.x;
    const dz = player.z - n.z;
    const d = Math.hypot(dx, dz);
    const isTrike = n.type === 'trike';
    const nStats = isTrike ? trikeStats : compyStats;
    n.t -= dt;
    n.flash = Math.max(0, n.flash - dt);
    n.roarFlee = Math.max(0, n.roarFlee - dt);

    let tx = n.wx;
    let tz = n.wz;
    let nSpd = nStats.wanderSpeed;

    if (!isTrike) {
      if (d < compyStats.fleeRange || n.roarFlee > 0) {
        tx = n.x - dx;
        tz = n.z - dz;
        nSpd = compyStats.fleeSpeed;
      } else if (Math.hypot(n.wx - n.x, n.wz - n.z) < compyStats.waypointReach || n.t <= 0) {
        pickWalkableWaypoint(n, wpLimit);
        n.t = compyStats.wanderDuration;
      }
      if (d < compyStats.eatRange) {
        killNpc(n);
        continue;
      }
    } else {
      if (n.mode === 'wander') {
        nSpd = trikeStats.wanderSpeed;
        if (Math.hypot(n.wx - n.x, n.wz - n.z) < trikeStats.waypointReach || n.t <= 0) {
          pickWalkableWaypoint(n, wpLimit);
          n.t = trikeStats.wanderDuration;
        }
        if (d < trikeStats.chargeRange) {
          n.mode = 'charge';
          n.t = trikeStats.chargeDuration;
        }
      } else if (n.mode === 'charge') {
        tx = player.x;
        tz = player.z;
        nSpd = trikeStats.chargeSpeed;
        if (n.t <= 0) {
          n.mode = 'rest';
          n.t = trikeStats.restDuration;
        }
      } else {
        nSpd = 0;
        if (n.t <= 0) n.mode = 'wander';
      }

      if (d < trikeStats.hitRange && n.mode === 'charge' && hurt <= 0) {
        hurtPlayer(trikeStats.damage);
        hurt = trikeStats.hitHurtCooldown;
        shake = trikeStats.hitShake;
        n.mode = 'rest';
        n.t = trikeStats.hitRestDuration;
        if (d > 0) {
          stepWalkable(
            player,
            player.x + (dx / d) * trikeStats.knockback,
            player.z + (dz / d) * trikeStats.knockback,
            CONFIG.world.playerEdgeMargin,
          );
        }
      }
    }

    const ax = tx - n.x;
    const az = tz - n.z;
    const ad = Math.hypot(ax, az);
    if (nSpd && ad > 0.1) {
      const moved = stepWalkable(
        n,
        n.x + (ax / ad) * nSpd * dt,
        n.z + (az / ad) * nSpd * dt,
        CONFIG.world.npcEdgeMargin,
      );
      if (!moved) {
        pickWalkableWaypoint(n, wpLimit);
      }
      n.a += wrapAngleDelta(Math.atan2(ax, az), n.a) * Math.min(1, dt * nStats.turnRate);
      n.s += nSpd * dt * nStats.strideScale;
    }

    for (let j = 0; j < trees.length; j++) {
      const t = trees[j];
      const ex = n.x - t.x;
      const ez = n.z - t.z;
      const ed = Math.hypot(ex, ez);
      const minDist = t.r + n.r;
      if (ed < minDist && ed > 0) {
        stepWalkable(n, t.x + (ex / ed) * minDist, t.z + (ez / ed) * minDist, CONFIG.world.npcEdgeMargin);
      }
    }
  }
  compactDeadNpcs();

  if (hunger <= 0) {
    hunger = 0;
    die('Starved');
  } else if (health <= 0) {
    health = 0;
    die('Eaten');
  }

  let nearestBerryDist = Infinity;
  for (let i = 0; i < berries.length; i++) {
    const d = Math.hypot(berries[i].x - player.x, berries[i].z - player.z);
    if (d < nearestBerryDist) nearestBerryDist = d;
  }

  hudState.health = health;
  hudState.maxHealth = playerStats.maxHealth;
  hudState.hunger = hunger;
  hudState.stamina = stamina;
  hudState.maxStamina = playerStats.maxStamina;
  hudState.hurt = hurt;
  hudState.tired = tired;
  hudState.boss = boss;
  hudState.eaten = eaten;
  hudState.elapsedSec = elapsedSec;
  hudState.nearestBerryDist = nearestBerryDist;
  hudState.playing = state === 'play';
  hudState.abilityCooldown = abilityRuntime.cooldown;
  hudState.abilityMaxCooldown = abilityRuntime.maxCooldown || playerStats.ability.cooldown;
  hudState.evoMeter = evo.meter;
  hudState.evoStage = evo.stage;
  hudState.evoFlash = evo.flashTimer;
  hudState.evoPulse = evo.pulseTimer;
  hudState.timeOfDay = todNow.label;
  hud.update(hudState);
  biomes.update(player.x, player.z, dt);
}

function renderScene(nowMs, alpha, frameDt) {
  const px = lerp(player.px, player.x, alpha);
  const pz = lerp(player.pz, player.z, alpha);
  const pa = lerpAngle(player.pa, player.a, alpha);
  const ps = lerp(player.ps, player.s, alpha);
  const rBiteT = lerp(prevBiteT, biteT, alpha);
  const rRingT = lerp(prevRingT, ringT, alpha);

  renderPlayer.x = px;
  renderPlayer.z = pz;
  renderPlayer.a = pa;

  const groundY = getWalkHeight(px, pz);
  const timeSec = nowMs / 1000;
  world.update(timeSec);
  const moving = state === 'play' && player.moving;
  const idleFn = playerVisual.group.userData.idleOffset;
  const idleY = idleFn ? idleFn(timeSec) : Math.sin(timeSec * 3) * 0.05;

  const bobY = moving ? Math.abs(Math.sin(ps)) * 0.25 : idleY;
  playerVisual.group.position.set(px, groundY + bobY, pz);

  const whipSpin =
    abilityRuntime.whipTimer > 0
      ? (1 - abilityRuntime.whipTimer / CONFIG.abilities.tailWhipAnimDuration) * Math.PI * 2
      : 0;
  playerVisual.group.rotation.y = pa + whipSpin;

  if (rBiteT > 0) {
    const lunge = Math.sin((rBiteT / playerStats.biteDuration) * Math.PI) * playerStats.biteLunge;
    playerVisual.group.position.x += Math.sin(pa) * lunge;
    playerVisual.group.position.z += Math.cos(pa) * lunge;
  }

  const legSwing = moving ? Math.sin(ps) * 0.9 : 0;
  const pLegs = playerVisual.group.userData.legs || playerVisual.legs;
  pLegs[0].rotation.x = legSwing;
  pLegs[1].rotation.x = -legSwing;
  if (playerVisual.group.userData.hindLegs) {
    playerVisual.group.userData.hindLegs[0].rotation.x = -legSwing;
    playerVisual.group.userData.hindLegs[1].rotation.x = legSwing;
  }
  if (playerVisual.tail) {
    playerVisual.tail.rotation.z = Math.sin(timeSec * 4) * 0.12;
  }
  playerVisual.group.visible =
    hurt <= 0 || Math.floor(timeSec * CONFIG.simulation.hurtBlinkHz) % 2 === 0;
  updateEvolutionVisuals(playerVisual.group, selectedDino, evo, CONFIG);

  berryManager.updateVisuals(timeSec);
  eggManager.updateVisuals(timeSec);

  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (n.dead) continue;
    const nx = lerp(n.px, n.x, alpha);
    const nz = lerp(n.pz, n.z, alpha);
    const na = lerpAngle(n.pa, n.a, alpha);
    const ns = lerp(n.ps, n.s, alpha);
    const bob =
      Math.abs(Math.sin(ns)) * (n.type === 'trike' ? trikeStats.bobHeight : compyStats.bobHeight);
    n.g.position.set(nx, getWalkHeight(nx, nz) + bob, nz);
    n.g.rotation.y = na;
    n.g.scale.setScalar(n.flash > 0 ? CONFIG.simulation.npcFlashScale : 1);
  }

  for (let i = 0; i < rexes.length; i++) {
    const r = rexes[i];
    const rx = lerp(r.px, r.x, alpha);
    const rz = lerp(r.pz, r.z, alpha);
    const ra = lerpAngle(r.pa, r.a, alpha);
    const rs = lerp(r.ps, r.s, alpha);
    r.g.position.set(rx, getWalkHeight(rx, rz) + Math.abs(Math.sin(rs)) * 0.15, rz);
    r.g.rotation.y = ra;
    const swing = r.mode === 'rest' ? 0 : Math.sin(rs) * 0.7;
    r.g.userData.legs[0].rotation.x = swing;
    r.g.userData.legs[1].rotation.x = -swing;
  }

  ring.visible = rRingT > 0;
  if (rRingT > 0) {
    const k = 1 - rRingT / (ringDur || 0.6);
    ring.scale.setScalar(1 + k * CONFIG.simulation.ringExpandScale);
    ring.position.set(ringX, getWalkHeight(ringX, ringZ) + CONFIG.simulation.ringYOffset, ringZ);
    ring.material.opacity = CONFIG.simulation.ringOpacity * (1 - k);
  }

  cameraCtrl.updateRender(px, pz, groundY, shake, !!settings.shake, frameDt);

  const envElapsed =
    state === 'play'
      ? Math.max(0, (nowMs - runStartMs) / 1000)
      : state === 'paused'
        ? Math.max(0, (pauseAtMs - runStartMs) / 1000)
        : CONFIG.dayDuration * 0.35;
  environment.update(envElapsed, biomes.getAtmosphere(), px, groundY, pz);

  renderer.render(scene, camera);

  if (debugOverlay.enabled) {
    let compies = 0;
    let trikes = 0;
    for (let i = 0; i < npcs.length; i++) {
      if (npcs[i].dead) continue;
      if (npcs[i].type === 'trike') trikes++;
      else compies++;
    }
    debugCounts.rexes = boss ? 0 : rexes.length;
    debugCounts.boss = boss ? 1 : 0;
    debugCounts.compies = compies;
    debugCounts.trikes = trikes;
    debugCounts.berries = berryManager.items.length;
    debugOverlay.tick(nowMs, renderer.info.render, debugCounts);
  }

  if (settings.map) {
    minimapState.currentZone = biomes.getCurrentZone();
    minimapState.camYaw = cameraCtrl.getYaw();
    minimapState.npcs = npcs;
    minimapState.rexes = rexes;
    minimap.draw(minimapState);
  }
}

const fixedDt = CONFIG.simulation.fixedDt;
const maxFrameDt = CONFIG.simulation.maxFrameDt;
const maxSubSteps = CONFIG.simulation.maxSubSteps;
let lastMs = performance.now();

function frame(nowMs) {
  const frameDt = Math.min(maxFrameDt, Math.max(0, (nowMs - lastMs) / 1000));
  lastMs = nowMs;

  if (state === 'play') {
    accumulator += frameDt;
    let steps = 0;
    while (accumulator >= fixedDt && steps < maxSubSteps) {
      update(fixedDt);
      accumulator -= fixedDt;
      steps++;
      if (state !== 'play') {
        accumulator = 0;
        break;
      }
    }
    if (accumulator > fixedDt) accumulator = fixedDt;
  } else {
    accumulator = 0;
  }

  const alpha = state === 'play' ? accumulator / fixedDt : 1;
  renderScene(nowMs, alpha, frameDt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
