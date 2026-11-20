import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getDominantBiomeId } from './biomes.js';
import {
  createRng,
  getGroundHeight,
  getIslandMask,
  getRiverDistance,
  isWalkable,
} from './terrain.js';

function isBlockedByLandmark(x, z) {
  const lm = CONFIG.landmarks;
  if (Math.hypot(x, z) < CONFIG.world.spawnClearRadius) return true;
  if (Math.hypot(x - lm.cave.x, z - lm.cave.z) < 15) return true;
  if (Math.hypot(x - lm.beach_nw.x, z - lm.beach_nw.z) < 16) return true;
  if (Math.hypot(x - lm.bridge_n.x, z - lm.bridge_n.z) < 11) return true;
  if (Math.hypot(x - lm.bridge_s.x, z - lm.bridge_s.z) < 11) return true;
  if (Math.hypot(x - lm.dock_w.x, z - lm.dock_w.z) < 13) return true;
  if (Math.hypot(x - lm.waterfall.x, z - lm.waterfall.z) < 13) return true;
  if (Math.hypot(x - lm.swamp_ruins.x, z - lm.swamp_ruins.z) < 12) return true;
  if (Math.hypot(x - lm.canyon.x, z - lm.canyon.z) < 18) return true;
  if (Math.hypot(x - lm.mountain.x, z - lm.mountain.z) < 26) return true;
  return false;
}

function getZoneById(zones, id) {
  if (!zones) return null;
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].id === id) return zones[i];
  }
  return zones[0] || null;
}

// Grid-accelerated seeded variable-radius Poisson-disc sampler
function sampleBiomeTrees(rand, halfSize, edgeMargin) {
  const minCell = 5.0;
  const span = halfSize * 2;
  const gridN = Math.ceil(span / minCell);
  const grid = new Int32Array(gridN * gridN);
  grid.fill(-1);

  const accepted = [];
  const lm = CONFIG.landmarks;

  function toCell(v) {
    return Math.floor((v + halfSize) / minCell);
  }

  function hasNeighborCloserThan(x, z, minSep) {
    const radCells = Math.ceil(minSep / minCell);
    const gx = toCell(x);
    const gz = toCell(z);
    const minSepSq = minSep * minSep;
    for (let dz = -radCells; dz <= radCells; dz++) {
      const nz = gz + dz;
      if (nz < 0 || nz >= gridN) continue;
      for (let dx = -radCells; dx <= radCells; dx++) {
        const nx = gx + dx;
        if (nx < 0 || nx >= gridN) continue;
        const idx = grid[nz * gridN + nx];
        if (idx === -1) continue;
        const other = accepted[idx];
        const ddx = other.x - x;
        const ddz = other.z - z;
        const req = Math.max(minSep, other.minSep);
        if (ddx * ddx + ddz * ddz < req * req || ddx * ddx + ddz * ddz < minSepSq) {
          return true;
        }
      }
    }
    return false;
  }

  const limit = halfSize - edgeMargin;
  const maxAttempts = 5200;
  const maxTrees = 420;

  for (let attempt = 0; attempt < maxAttempts && accepted.length < maxTrees; attempt++) {
    const x = (rand() * 2 - 1) * limit;
    const z = (rand() * 2 - 1) * limit;
    if (!isWalkable(x, z)) continue;
    if (getRiverDistance(x, z) < CONFIG.world.riverPropBuffer) continue;
    if (isBlockedByLandmark(x, z)) continue;

    const y = getGroundHeight(x, z);
    const mask = getIslandMask(x, z);
    if (y > CONFIG.terrain.rockHeight) continue;

    const biome = getDominantBiomeId(x, z, y, mask);
    const inEastForest =
      Math.hypot(x - lm.forest_e.x, z - lm.forest_e.z) < lm.forest_e.radius;
    const nearNwBeach = Math.hypot(x - lm.beach_nw.x, z - lm.beach_nw.z) < 42;

    let type = null;
    let minSep = 8.5;

    if (biome === 'beach' || mask < CONFIG.world.sandMaskThreshold) {
      // Bare sandy beaches except a few extra coastal palms near NW Fossil Beach
      if (!nearNwBeach || rand() > 0.25) continue;
      type = 'palm';
      minSep = 15;
    } else if (inEastForest && biome === 'jungle') {
      type = rand() < 0.45 ? 'pine' : 'broadleaf';
      minSep = 5.8;
    } else if (biome === 'jungle') {
      type = 'broadleaf';
      minSep = 8.2;
    } else if (biome === 'swamp') {
      type = 'dead';
      minSep = 14.0;
    } else if (biome === 'canyon') {
      // Sparse dry scrub
      if (rand() > 0.45) continue;
      type = 'scrub';
      minSep = 18.0;
    } else if (biome === 'tundra') {
      if (y > 13.5) continue;
      type = 'pine';
      minSep = 13.5;
    }

    if (!type) continue;
    if (hasNeighborCloserThan(x, z, minSep)) continue;

    const idx = accepted.length;
    const gx = toCell(x);
    const gz = toCell(z);
    if (gx >= 0 && gx < gridN && gz >= 0 && gz < gridN && grid[gz * gridN + gx] === -1) {
      grid[gz * gridN + gx] = idx;
    }
    accepted.push({
      x,
      y,
      z,
      biome,
      type,
      minSep,
      scale: 0.78 + rand() * 0.72,
      rotY: rand() * Math.PI * 2,
    });
  }

  return accepted;
}

export function createWorldProps(scene, initialZone, zones = null) {
  const hs = CONFIG.world.halfSize;
  const pCfg = CONFIG.props;
  const rand = createRng(CONFIG.worldSeed + 505);

  const sampledTrees = sampleBiomeTrees(rand, hs, CONFIG.world.treeEdgeMargin);

  const broadleafList = [];
  const pineList = [];
  const deadList = [];
  const palmList = [];
  const trees = [];

  for (let i = 0; i < sampledTrees.length; i++) {
    const spec = sampledTrees[i];
    const r =
      spec.type === 'scrub'
        ? 0.45 + 0.25 * spec.scale
        : pCfg.treeRadiusBase + pCfg.treeRadiusScale * spec.scale;
    trees.push({ x: spec.x, z: spec.z, r, biome: spec.biome, type: spec.type });

    if (spec.type === 'broadleaf' || spec.type === 'scrub') broadleafList.push(spec);
    else if (spec.type === 'pine') pineList.push(spec);
    else if (spec.type === 'dead') deadList.push(spec);
    else if (spec.type === 'palm') palmList.push(spec);
  }

  const dummy = new THREE.Object3D();
  const colorScratch = new THREE.Color();

  // 1. Broadleaf + Desert Scrub InstancedMeshes
  if (broadleafList.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(
      pCfg.trunkTopRadius,
      pCfg.trunkBottomRadius,
      pCfg.trunkHeight,
      pCfg.trunkSegments,
    );
    const trunkMat = new THREE.MeshLambertMaterial({ color: pCfg.trunkColor, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, broadleafList.length);
    trunkMesh.castShadow = true;

    const tiers = pCfg.canopyTiers;
    const coneGeo = new THREE.ConeGeometry(pCfg.coneRadius, pCfg.coneHeight, pCfg.coneSegments);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const leafMesh = new THREE.InstancedMesh(coneGeo, leafMat, broadleafList.length * tiers.length);
    leafMesh.castShadow = true;

    for (let i = 0; i < broadleafList.length; i++) {
      const s = broadleafList[i];
      const isScrub = s.type === 'scrub';
      const sc = isScrub ? s.scale * 0.62 : s.scale;
      const zone = getZoneById(zones, s.biome) || initialZone;
      const palette = zone.leaf || initialZone.leaf;
      colorScratch.set(palette[i % palette.length]);

      dummy.position.set(s.x, s.y + (pCfg.trunkHeight * 0.5) * sc, s.z);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.set(sc, sc * (isScrub ? 0.7 : 1), sc);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      for (let t = 0; t < tiers.length; t++) {
        const [radius, tierY] = tiers[t];
        const instIdx = i * tiers.length + t;
        dummy.position.set(s.x, s.y + tierY * sc * (isScrub ? 0.72 : 1), s.z);
        dummy.rotation.set(0, s.rotY + t * 0.4, 0);
        dummy.scale.set(radius * sc, sc * (isScrub ? 0.65 : 1), radius * sc);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(instIdx, dummy.matrix);
        leafMesh.setColorAt(instIdx, colorScratch);
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    leafMesh.computeBoundingSphere();
    scene.add(trunkMesh, leafMesh);
  }

  // 2. Pine Trees (Tundra + East Forest mix) — tall narrow multi-tier cones
  if (pineList.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.26, 0.42, 3.0, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x593724, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, pineList.length);
    trunkMesh.castShadow = true;

    const pineTiers = [
      [1.85, 2.8, 2.5],
      [1.5, 4.4, 2.4],
      [1.1, 5.9, 2.2],
      [0.65, 7.2, 1.9],
    ];
    const coneGeo = new THREE.ConeGeometry(1, 1, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const leafMesh = new THREE.InstancedMesh(coneGeo, leafMat, pineList.length * pineTiers.length);
    leafMesh.castShadow = true;

    for (let i = 0; i < pineList.length; i++) {
      const s = pineList[i];
      const sc = s.scale * 1.08;
      const isTundra = s.biome === 'tundra';
      const baseHex = isTundra
        ? i % 2 === 0
          ? '#4b7c7a'
          : '#6a98a8'
        : i % 2 === 0
          ? '#225943'
          : '#2c6b4d';

      dummy.position.set(s.x, s.y + 1.5 * sc, s.z);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      for (let t = 0; t < pineTiers.length; t++) {
        const [rad, ty, h] = pineTiers[t];
        const instIdx = i * pineTiers.length + t;
        // Snow-dusted top tier on tundra pines
        if (isTundra && t === pineTiers.length - 1) {
          colorScratch.set('#dcebf5');
        } else {
          colorScratch.set(baseHex);
        }
        dummy.position.set(s.x, s.y + ty * sc, s.z);
        dummy.rotation.set(0, s.rotY + t * 0.5, 0);
        dummy.scale.set(rad * sc, h * sc, rad * sc);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(instIdx, dummy.matrix);
        leafMesh.setColorAt(instIdx, colorScratch);
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    leafMesh.computeBoundingSphere();
    scene.add(trunkMesh, leafMesh);
  }

  // 3. Dead Swamp Trees — twisted pale-grey trunks + drooping grey-green cones
  if (deadList.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.54, 3.8, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x524c44, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, deadList.length);
    trunkMesh.castShadow = true;

    const droopGeo = new THREE.ConeGeometry(1.7, 2.2, 5);
    const droopMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const droopMesh = new THREE.InstancedMesh(droopGeo, droopMat, deadList.length * 2);
    droopMesh.castShadow = true;

    const swampPalette = ['#4b6344', '#3e523a', '#596e4b'];
    for (let i = 0; i < deadList.length; i++) {
      const s = deadList[i];
      const sc = s.scale * 1.05;
      colorScratch.set(swampPalette[i % swampPalette.length]);

      dummy.position.set(s.x, s.y + 1.8 * sc, s.z);
      dummy.rotation.set(0.08, s.rotY, -0.09);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // Two drooping moss-draped boughs
      for (let b = 0; b < 2; b++) {
        const instIdx = i * 2 + b;
        const side = b === 0 ? 1 : -1;
        dummy.position.set(
          s.x + Math.cos(s.rotY) * side * 0.7 * sc,
          s.y + (3.2 + b * 0.85) * sc,
          s.z + Math.sin(s.rotY) * side * 0.7 * sc,
        );
        dummy.rotation.set(0.22 * side, s.rotY + b, Math.PI * 0.08 * side);
        dummy.scale.set(sc * (1.05 - b * 0.2), sc * 0.9, sc * (1.05 - b * 0.2));
        dummy.updateMatrix();
        droopMesh.setMatrixAt(instIdx, dummy.matrix);
        droopMesh.setColorAt(instIdx, colorScratch);
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    droopMesh.instanceMatrix.needsUpdate = true;
    if (droopMesh.instanceColor) droopMesh.instanceColor.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    droopMesh.computeBoundingSphere();
    scene.add(trunkMesh, droopMesh);
  }

  // 4. Coastal Palms (near NW beach fringes)
  if (palmList.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 5.4, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7c5332, flatShading: true });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmList.length);
    trunkMesh.castShadow = true;

    const frondGeo = new THREE.BoxGeometry(0.6, 0.12, 2.6);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x4f9a44, flatShading: true });
    const frondMesh = new THREE.InstancedMesh(frondGeo, frondMat, palmList.length * 5);
    frondMesh.castShadow = true;

    for (let i = 0; i < palmList.length; i++) {
      const s = palmList[i];
      const sc = s.scale * 1.05;
      dummy.position.set(s.x, s.y + 2.6 * sc, s.z);
      dummy.rotation.set(0.12, s.rotY, 0.12);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      const topX = s.x + Math.sin(0.12) * 2.5 * sc;
      const topY = s.y + 5.1 * sc;
      for (let f = 0; f < 5; f++) {
        const a = s.rotY + (f / 5) * Math.PI * 2;
        dummy.position.set(topX + Math.sin(a) * 1.2 * sc, topY, s.z + Math.cos(a) * 1.2 * sc);
        dummy.rotation.set(0.32, a, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        frondMesh.setMatrixAt(i * 5 + f, dummy.matrix);
      }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    frondMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    frondMesh.computeBoundingSphere();
    scene.add(trunkMesh, frondMesh);
  }

  // 5. Biome-colored Rocks (per-instance color, zero water/river overlap)
  const rockSpecs = [];
  const rockLimit = hs - CONFIG.world.rockEdgeMargin;
  for (let attempt = 0; attempt < 900 && rockSpecs.length < 110; attempt++) {
    const x = (rand() * 2 - 1) * rockLimit;
    const z = (rand() * 2 - 1) * rockLimit;
    if (!isWalkable(x, z)) continue;
    if (getRiverDistance(x, z) < CONFIG.world.riverPropBuffer) continue;
    if (isBlockedByLandmark(x, z)) continue;

    const y = getGroundHeight(x, z);
    const mask = getIslandMask(x, z);
    const biome = getDominantBiomeId(x, z, y, mask);

    // Higher rock chance in canyon, tundra, and swamp; sparse on beach
    if (biome === 'beach' && rand() > 0.25) continue;
    if (biome === 'jungle' && rand() > 0.55) continue;

    rockSpecs.push({
      x,
      y,
      z,
      biome,
      scale: pCfg.rockScaleMin + rand() * pCfg.rockScaleRange,
      rx: rand() * 3,
      ry: rand() * 3,
    });
  }

  const rockCount = rockSpecs.length;
  if (rockCount > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(pCfg.rockRadius, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockMesh.castShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const r = rockSpecs[i];
      const zone = getZoneById(zones, r.biome) || initialZone;
      colorScratch.set(zone.rock || initialZone.rock);
      dummy.position.set(r.x, r.y + r.scale * pCfg.rockYOffset, r.z);
      dummy.rotation.set(r.rx, r.ry, 0);
      dummy.scale.set(r.scale, r.scale * pCfg.rockYScale, r.scale);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      rockMesh.setColorAt(i, colorScratch);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    rockMesh.computeBoundingSphere();
    scene.add(rockMesh);
  }

  // 6. Swamp & Jungle Ferns (crossed flat-plane InstancedMesh)
  const fernSpecs = [];
  for (let attempt = 0; attempt < 900 && fernSpecs.length < 130; attempt++) {
    const x = (rand() * 2 - 1) * rockLimit;
    const z = (rand() * 2 - 1) * rockLimit;
    if (!isWalkable(x, z)) continue;
    if (getRiverDistance(x, z) < CONFIG.world.riverPropBuffer) continue;
    const y = getGroundHeight(x, z);
    const mask = getIslandMask(x, z);
    const biome = getDominantBiomeId(x, z, y, mask);
    if (biome !== 'swamp' && !(biome === 'jungle' && rand() < 0.35)) continue;
    fernSpecs.push({ x, y, z, biome, scale: 0.75 + rand() * 0.7, rotY: rand() * Math.PI });
  }

  const fernCount = fernSpecs.length;
  if (fernCount > 0) {
    const fernGeo = new THREE.PlaneGeometry(1.8, 1.15);
    const fernMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const fernMesh = new THREE.InstancedMesh(fernGeo, fernMat, fernCount * 2);
    for (let i = 0; i < fernCount; i++) {
      const f = fernSpecs[i];
      colorScratch.set(f.biome === 'swamp' ? '#3d6b47' : '#358547');
      for (let p = 0; p < 2; p++) {
        dummy.position.set(f.x, f.y + 0.48 * f.scale, f.z);
        dummy.rotation.set(0, f.rotY + p * (Math.PI * 0.5), 0);
        dummy.scale.setScalar(f.scale);
        dummy.updateMatrix();
        fernMesh.setMatrixAt(i * 2 + p, dummy.matrix);
        fernMesh.setColorAt(i * 2 + p, colorScratch);
      }
    }
    fernMesh.instanceMatrix.needsUpdate = true;
    if (fernMesh.instanceColor) fernMesh.instanceColor.needsUpdate = true;
    fernMesh.computeBoundingSphere();
    scene.add(fernMesh);
  }

  return {
    trees,
    treeCount: trees.length,
    rockCount,
    fernCount,
  };
}
