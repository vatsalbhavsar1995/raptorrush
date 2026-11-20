import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getBiomeSpawnWeight } from '../systems/spawn.js';
import { getGroundHeight, isWalkable } from '../world/terrain.js';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);
const _eggScale = new THREE.Vector3(0.88, 1.18, 0.88);
const _zeroScale = new THREE.Vector3(0, 0, 0);
const _mat4 = new THREE.Matrix4();

export function createBerryManager(scene, berryFood, trees) {
  const maxCount = CONFIG.population.berries;
  const berryGeo = new THREE.IcosahedronGeometry(berryFood.radius, 0);
  const berryMat = new THREE.MeshBasicMaterial({ color: berryFood.color });
  const beamGeo = new THREE.CylinderGeometry(
    berryFood.beamRadius,
    berryFood.beamRadius,
    berryFood.beamHeight,
    6,
    1,
    true,
  );
  const beamMat = new THREE.MeshBasicMaterial({
    color: berryFood.beamColor,
    transparent: true,
    opacity: berryFood.beamOpacity,
    depthWrite: false,
  });

  const berryMesh = new THREE.InstancedMesh(berryGeo, berryMat, maxCount);
  const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, maxCount);
  berryMesh.frustumCulled = false;
  beamMesh.frustumCulled = false;
  scene.add(berryMesh, beamMesh);

  const hs = CONFIG.world.halfSize;
  const margin = CONFIG.world.berryEdgeMargin;
  const items = [];
  for (let i = 0; i < maxCount; i++) {
    items.push({ x: 0, z: 0, groundY: 0 });
  }

  function assignSpot(target) {
    const maxAttempts = CONFIG.world.maxPlacementAttempts * 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = (Math.random() * 2 - 1) * (hs - margin);
      const z = (Math.random() * 2 - 1) * (hs - margin);
      if (!isWalkable(x, z)) continue;
      const w = getBiomeSpawnWeight('berry', x, z);
      if (w <= 0) continue;
      if (w < 1 && Math.random() > w) continue;

      let blocked = false;
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        if (Math.hypot(t.x - x, t.z - z) < t.r + berryFood.treeClearance) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        target.x = x;
        target.z = z;
        target.groundY = getGroundHeight(x, z);
        return;
      }
    }

    // Safe central jungle fallback
    for (let attempt = 0; attempt < 60; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 40;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (isWalkable(x, z) && getBiomeSpawnWeight('berry', x, z) > 0) {
        target.x = x;
        target.z = z;
        target.groundY = getGroundHeight(x, z);
        return;
      }
    }
    target.x = 6;
    target.z = 6;
    target.groundY = getGroundHeight(6, 6);
  }

  function writeBeamMatrix(index) {
    const item = items[index];
    _pos.set(item.x, item.groundY + berryFood.beamY, item.z);
    _quat.identity();
    _mat4.compose(_pos, _quat, _scale);
    beamMesh.setMatrixAt(index, _mat4);
  }

  function reset(count) {
    const activeCount = Math.min(count, maxCount);
    berryMesh.count = activeCount;
    beamMesh.count = activeCount;
    for (let i = 0; i < activeCount; i++) {
      assignSpot(items[i]);
      writeBeamMatrix(i);
    }
    beamMesh.instanceMatrix.needsUpdate = true;
    updateVisuals(0);
  }

  function respawnAt(index) {
    assignSpot(items[index]);
    writeBeamMatrix(index);
    beamMesh.instanceMatrix.needsUpdate = true;
  }

  function updateVisuals(timeSec) {
    const count = berryMesh.count;
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const bobY =
        item.groundY +
        berryFood.baseY +
        Math.sin(timeSec * berryFood.bobSpeed + i) * berryFood.bobAmp;
      _pos.set(item.x, bobY, item.z);
      _euler.set(0, timeSec + i, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      berryMesh.setMatrixAt(i, _mat4);
    }
    berryMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    items,
    reset,
    respawnAt,
    updateVisuals,
  };
}

// 8 collectible white icosahedron eggs (radius 0.6) near cave and beach_nw landmarks
export function createEggManager(scene, eggFood, landmarks = CONFIG.landmarks) {
  const count = CONFIG.population.eggs || 8;
  const eggGeo = new THREE.IcosahedronGeometry(0.6, 0);
  const eggMat = new THREE.MeshLambertMaterial({
    color: 0xf7f3e3,
    emissive: 0x2b2416,
    flatShading: true,
  });
  const eggMesh = new THREE.InstancedMesh(eggGeo, eggMat, count);
  eggMesh.castShadow = true;
  eggMesh.frustumCulled = false;
  scene.add(eggMesh);

  const respawnSec = 45;
  const pickupRange = 2.4;

  // 4 eggs near Central Cave, 4 eggs near NW Fossil Beach
  const cave = landmarks.cave;
  const beach = landmarks.beach_nw;
  const anchorOffsets = [
    [cave.x + 11, cave.z + 9],
    [cave.x - 12, cave.z + 11],
    [cave.x + 15, cave.z - 8],
    [cave.x - 14, cave.z - 9],
    [beach.x + 10, beach.z + 11],
    [beach.x - 10, beach.z + 10],
    [beach.x + 13, beach.z - 8],
    [beach.x - 8, beach.z - 12],
  ];

  const items = [];
  for (let i = 0; i < count; i++) {
    const pair = anchorOffsets[i % anchorOffsets.length];
    let ex = pair[0];
    let ez = pair[1];
    if (!isWalkable(ex, ez)) {
      const base = i < 4 ? cave : beach;
      for (let step = 0; step < 24; step++) {
        const a = (step / 24) * Math.PI * 2;
        const tx = base.x + Math.cos(a) * 14;
        const tz = base.z + Math.sin(a) * 14;
        if (isWalkable(tx, tz)) {
          ex = tx;
          ez = tz;
          break;
        }
      }
    }
    items.push({
      x: ex,
      z: ez,
      groundY: getGroundHeight(ex, ez),
      active: true,
      respawnTimer: 0,
    });
  }

  function reset() {
    for (let i = 0; i < items.length; i++) {
      items[i].active = true;
      items[i].respawnTimer = 0;
    }
    updateVisuals(0);
  }

  function collectAt(index) {
    const item = items[index];
    if (!item || !item.active) return false;
    item.active = false;
    item.respawnTimer = respawnSec;
    return true;
  }

  function stepTimers(dt) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.active) {
        item.respawnTimer -= dt;
        if (item.respawnTimer <= 0) {
          item.active = true;
          item.respawnTimer = 0;
        }
      }
    }
  }

  function updateVisuals(timeSec) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.active) {
        _pos.set(item.x, -50, item.z);
        _quat.identity();
        _mat4.compose(_pos, _quat, _zeroScale);
        eggMesh.setMatrixAt(i, _mat4);
        continue;
      }
      const bobY = item.groundY + 0.72 + Math.sin(timeSec * 2.2 + i * 1.1) * 0.14;
      _pos.set(item.x, bobY, item.z);
      _euler.set(0, timeSec * 0.8 + i, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _eggScale);
      eggMesh.setMatrixAt(i, _mat4);
    }
    eggMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    items,
    pickupRange,
    eggFood,
    reset,
    collectAt,
    stepTimers,
    updateVisuals,
  };
}
