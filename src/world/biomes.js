import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getGroundHeight, getIslandMask } from './terrain.js';

const BIOME_KEYS = ['jungle', 'swamp', 'canyon', 'tundra', 'beach'];
const BLEND_DURATION_SEC = 5.0;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const _weightScratch = { jungle: 1, swamp: 0, canyon: 0, tundra: 0, beach: 0 };

export function computeBiomeWeights(x, z, height, mask, out = _weightScratch) {
  const lm = CONFIG.landmarks;
  const h = height === undefined ? getGroundHeight(x, z) : height;
  const m = mask === undefined ? getIslandMask(x, z) : mask;

  // Tundra / Snow mountain in NE + high elevation
  const mtDx = x - lm.mountain.x;
  const mtDz = z - lm.mountain.z;
  const mtProx = Math.exp(-(mtDx * mtDx + mtDz * mtDz) / (76 * 76));
  const elevSnow = smoothstep(8.0, 14.5, h);
  const wTundra = mtProx * 1.15 + elevSnow * 1.6;

  // Beach on low coastal sandband + NW Fossil Beach landmark
  const bwDx = x - lm.beach_nw.x;
  const bwDz = z - lm.beach_nw.z;
  const bwProx = Math.exp(-(bwDx * bwDx + bwDz * bwDz) / (64 * 64));
  const coastSand = smoothstep(0.24, 0.08, m) * (1 - elevSnow);
  const wBeach = bwProx * 1.25 + coastSand * 0.95;

  // Red Canyon in SW around (-105, +85)
  const cnDx = x - lm.canyon.x;
  const cnDz = z - lm.canyon.z;
  const wCanyon = Math.exp(-(cnDx * cnDx + cnDz * cnDz) / (74 * 74)) * 1.3;

  // Swamp in SE around (+110, +100)
  const swDx = x - lm.swamp_ruins.x;
  const swDz = z - lm.swamp_ruins.z;
  const wSwamp = Math.exp(-(swDx * swDx + swDz * swDz) / (74 * 74)) * 1.3;

  // Jungle across center and East Forest (+120, -30)
  const feDx = x - lm.forest_e.x;
  const feDz = z - lm.forest_e.z;
  const feProx = Math.exp(-(feDx * feDx + feDz * feDz) / (78 * 78));
  const centerProx = Math.exp(-(x * x + z * z) / (105 * 105));
  const wJungle = Math.max(0.05, 0.25 + centerProx * 0.85 + feProx * 0.85) * (1 - elevSnow * 0.75);

  const sum = wJungle + wSwamp + wCanyon + wTundra + wBeach || 1;
  out.jungle = wJungle / sum;
  out.swamp = wSwamp / sum;
  out.canyon = wCanyon / sum;
  out.tundra = wTundra / sum;
  out.beach = wBeach / sum;
  return out;
}

export function getDominantBiomeId(x, z, height, mask) {
  const w = computeBiomeWeights(x, z, height, mask, _weightScratch);
  let bestId = 'jungle';
  let bestW = -1;
  for (let i = 0; i < BIOME_KEYS.length; i++) {
    const id = BIOME_KEYS[i];
    if (w[id] > bestW) {
      bestW = w[id];
      bestId = id;
    }
  }
  return bestId;
}

export function findNearestZone(zones, x, z, height, mask) {
  const id = getDominantBiomeId(x, z, height, mask);
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].id === id) return zones[i];
  }
  return zones[0];
}

export function createGroundColorBlender(zones) {
  const byId = Object.create(null);
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    byId[z.id] = {
      lo: new THREE.Color(z.lo),
      hi: new THREE.Color(z.hi),
    };
  }
  const tmpWeights = { jungle: 1, swamp: 0, canyon: 0, tundra: 0, beach: 0 };
  const tmpSample = new THREE.Color();

  return function blendGroundColor(x, z, y, mask, outColor) {
    computeBiomeWeights(x, z, y, mask, tmpWeights);
    const heightT = clamp((y - CONFIG.terrain.colorMinY) / CONFIG.terrain.colorRangeY, 0, 1);

    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < BIOME_KEYS.length; i++) {
      const id = BIOME_KEYS[i];
      const w = tmpWeights[id];
      if (w <= 0.0001) continue;
      const entry = byId[id];
      if (!entry) continue;
      tmpSample.copy(entry.lo).lerp(entry.hi, heightT);
      r += tmpSample.r * w;
      g += tmpSample.g * w;
      b += tmpSample.b * w;
    }
    outColor.setRGB(r, g, b);
    return outColor;
  };
}

export function createBiomeController({ zones, scene, hemi, sun, onZoneChange, applyToScene = true }) {
  let currentZone = zones[0];
  let blendProgress = 1;

  const startSky = new THREE.Color(currentZone.sky);
  const targetSky = new THREE.Color(currentZone.sky);
  const curSky = new THREE.Color(currentZone.sky);

  const startHemiSky = new THREE.Color(currentZone.hemi[0]);
  const targetHemiSky = new THREE.Color(currentZone.hemi[0]);
  const curHemiSky = new THREE.Color(currentZone.hemi[0]);

  const startHemiGround = new THREE.Color(currentZone.hemi[1]);
  const targetHemiGround = new THREE.Color(currentZone.hemi[1]);
  const curHemiGround = new THREE.Color(currentZone.hemi[1]);

  const startSun = new THREE.Color(currentZone.sun);
  const targetSun = new THREE.Color(currentZone.sun);
  const curSun = new THREE.Color(currentZone.sun);

  let startFogNear = currentZone.fog[0];
  let targetFogNear = currentZone.fog[0];
  let curFogNear = currentZone.fog[0];

  let startFogFar = currentZone.fog[1];
  let targetFogFar = currentZone.fog[1];
  let curFogFar = currentZone.fog[1];

  const atmosphere = {
    sky: curSky,
    fogNear: curFogNear,
    fogFar: curFogFar,
    hemiSky: curHemiSky,
    hemiGround: curHemiGround,
    sun: curSun,
  };

  function syncScene() {
    if (!applyToScene) return;
    scene.background.copy(curSky);
    scene.fog.color.copy(curSky);
    scene.fog.near = curFogNear;
    scene.fog.far = curFogFar;
    hemi.color.copy(curHemiSky);
    hemi.groundColor.copy(curHemiGround);
    sun.color.copy(curSun);
  }

  function applyZoneImmediate(zone) {
    if (!zone) return;
    currentZone = zone;
    blendProgress = 1;
    startSky.set(zone.sky);
    targetSky.set(zone.sky);
    curSky.set(zone.sky);
    startHemiSky.set(zone.hemi[0]);
    targetHemiSky.set(zone.hemi[0]);
    curHemiSky.set(zone.hemi[0]);
    startHemiGround.set(zone.hemi[1]);
    targetHemiGround.set(zone.hemi[1]);
    curHemiGround.set(zone.hemi[1]);
    startSun.set(zone.sun);
    targetSun.set(zone.sun);
    curSun.set(zone.sun);
    startFogNear = targetFogNear = curFogNear = zone.fog[0];
    startFogFar = targetFogFar = curFogFar = zone.fog[1];
    atmosphere.fogNear = curFogNear;
    atmosphere.fogFar = curFogFar;
    syncScene();
    if (onZoneChange) onZoneChange(zone);
  }

  function setTargetZone(zone) {
    if (!zone || zone === currentZone) return;
    currentZone = zone;
    startSky.copy(curSky);
    targetSky.set(zone.sky);
    startHemiSky.copy(curHemiSky);
    targetHemiSky.set(zone.hemi[0]);
    startHemiGround.copy(curHemiGround);
    targetHemiGround.set(zone.hemi[1]);
    startSun.copy(curSun);
    targetSun.set(zone.sun);
    startFogNear = curFogNear;
    targetFogNear = zone.fog[0];
    startFogFar = curFogFar;
    targetFogFar = zone.fog[1];
    blendProgress = 0;
    if (onZoneChange) onZoneChange(zone);
  }

  function update(x, z, dt = 1 / 30) {
    const dominant = findNearestZone(zones, x, z);
    if (dominant !== currentZone) {
      setTargetZone(dominant);
    }
    if (blendProgress < 1) {
      blendProgress = Math.min(1, blendProgress + Math.max(0, dt) / BLEND_DURATION_SEC);
      const t = blendProgress * blendProgress * (3 - 2 * blendProgress);
      curSky.copy(startSky).lerp(targetSky, t);
      curHemiSky.copy(startHemiSky).lerp(targetHemiSky, t);
      curHemiGround.copy(startHemiGround).lerp(targetHemiGround, t);
      curSun.copy(startSun).lerp(targetSun, t);
      curFogNear = startFogNear + (targetFogNear - startFogNear) * t;
      curFogFar = startFogFar + (targetFogFar - startFogFar) * t;
      atmosphere.fogNear = curFogNear;
      atmosphere.fogFar = curFogFar;
      syncScene();
    }
  }

  function reset() {
    applyZoneImmediate(findNearestZone(zones, 0, 0));
  }

  return {
    applyZone: applyZoneImmediate,
    update,
    reset,
    getCurrentZone: () => currentZone,
    getAtmosphere: () => atmosphere,
  };
}
