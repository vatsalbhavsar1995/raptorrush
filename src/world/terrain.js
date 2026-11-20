import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createRng(seed) {
  let s = seed | 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// 8 unit-ish 2D gradient vectors for Ken Perlin's improved noise
const GRAD_X = [1, -1, 1, -1, 1, -1, 0, 0];
const GRAD_Y = [1, 1, -1, -1, 0, 0, 1, -1];

export function createPerlin2D(seed) {
  const rand = createRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function noise2d(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const X = xi & 255;
    const Y = yi & 255;

    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[X] + Y] & 7;
    const ab = perm[perm[X] + Y + 1] & 7;
    const ba = perm[perm[X + 1] + Y] & 7;
    const bb = perm[perm[X + 1] + Y + 1] & 7;

    const x1 = lerp(
      GRAD_X[aa] * xf + GRAD_Y[aa] * yf,
      GRAD_X[ba] * (xf - 1) + GRAD_Y[ba] * yf,
      u,
    );
    const x2 = lerp(
      GRAD_X[ab] * xf + GRAD_Y[ab] * (yf - 1),
      GRAD_X[bb] * (xf - 1) + GRAD_Y[bb] * (yf - 1),
      u,
    );
    return lerp(x1, x2, v);
  }

  function fbm(x, y, octaves = 3, lacunarity = 2, persistence = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise2d(x * freq, y * freq) * amp;
      norm += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  return { noise2d, fbm };
}

const terrainNoise = createPerlin2D(CONFIG.worldSeed);
const coastNoiseGen = createPerlin2D(CONFIG.worldSeed + 101);

// Precompute Catmull-Rom river spline polyline for fast zero-allocation queries
const RIVER_SAMPLES = 72;
const riverPoints = new Float32Array((RIVER_SAMPLES + 1) * 2);
const riverTangents = new Float32Array((RIVER_SAMPLES + 1) * 2);

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

(function buildRiverSpline() {
  const pts = CONFIG.landmarks.river.points;
  const segCount = pts.length - 1;
  for (let i = 0; i <= RIVER_SAMPLES; i++) {
    const u = (i / RIVER_SAMPLES) * segCount;
    const seg = Math.min(segCount - 1, Math.floor(u));
    const localT = u - seg;
    const p0 = pts[Math.max(0, seg - 1)];
    const p1 = pts[seg];
    const p2 = pts[Math.min(segCount, seg + 1)];
    const p3 = pts[Math.min(segCount, seg + 2)];
    riverPoints[i * 2] = catmullRom(p0[0], p1[0], p2[0], p3[0], localT);
    riverPoints[i * 2 + 1] = catmullRom(p0[1], p1[1], p2[1], p3[1], localT);
  }
  for (let i = 0; i <= RIVER_SAMPLES; i++) {
    const prev = Math.max(0, i - 1);
    const next = Math.min(RIVER_SAMPLES, i + 1);
    const tx = riverPoints[next * 2] - riverPoints[prev * 2];
    const tz = riverPoints[next * 2 + 1] - riverPoints[prev * 2 + 1];
    const len = Math.hypot(tx, tz) || 1;
    riverTangents[i * 2] = tx / len;
    riverTangents[i * 2 + 1] = tz / len;
  }
})();

export function getRiverPoints() {
  return riverPoints;
}

export function getRiverDistance(x, z) {
  let bestDistSq = Infinity;
  for (let i = 0; i < RIVER_SAMPLES; i++) {
    const ax = riverPoints[i * 2];
    const az = riverPoints[i * 2 + 1];
    const bx = riverPoints[(i + 1) * 2];
    const bz = riverPoints[(i + 1) * 2 + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const abLenSq = abx * abx + abz * abz;
    const t = abLenSq > 0 ? clamp(((x - ax) * abx + (z - az) * abz) / abLenSq, 0, 1) : 0;
    const px = ax + abx * t;
    const pz = az + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) bestDistSq = dSq;
  }
  return Math.sqrt(bestDistSq);
}

export function getRiverTangentAt(x, z, out) {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i <= RIVER_SAMPLES; i++) {
    const dx = x - riverPoints[i * 2];
    const dz = z - riverPoints[i * 2 + 1];
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  out.x = riverTangents[bestIdx * 2];
  out.z = riverTangents[bestIdx * 2 + 1];
  return out;
}

export function getIslandMask(x, z) {
  const lm = CONFIG.landmarks;
  const r = Math.hypot(x, z);
  const cNoise = coastNoiseGen.fbm(x * 0.012 + 3.7, z * 0.012 - 2.1, 2, 2, 0.5);

  const dNwX = x - lm.beach_nw.x;
  const dNwZ = z - lm.beach_nw.z;
  const nwPeninsula = Math.exp(-(dNwX * dNwX + dNwZ * dNwZ) / (46 * 46)) * 0.16;

  const dMtX = x - lm.mountain.x;
  const dMtZ = z - lm.mountain.z;
  const nePeninsula = Math.exp(-(dMtX * dMtX + dMtZ * dMtZ) / (56 * 56)) * 0.48;

  const dDockX = x - (lm.dock_w.x - 16);
  const dDockZ = z - lm.dock_w.z;
  const westCove = Math.exp(-(dDockX * dDockX + dDockZ * dDockZ) / (26 * 26)) * 0.25;

  const effRadius = 158 + cNoise * 24;
  const radial = Math.exp(-Math.pow(r / Math.max(96, effRadius), 3.0));
  const raw = radial + nwPeninsula + nePeninsula - westCove;

  const boxDist = Math.max(Math.abs(x), Math.abs(z));
  const edgeFade = smoothstep(199, 186, boxDist);
  return clamp(raw * edgeFade, 0, 1);
}

export function getGroundHeight(x, z) {
  const lm = CONFIG.landmarks;
  const tCfg = CONFIG.terrain;
  const mask = getIslandMask(x, z);

  // Base 3-octave Perlin terrain scaled by island mask
  const n = terrainNoise.fbm(
    x * tCfg.baseFreq + 11.3,
    z * tCfg.baseFreq - 7.9,
    tCfg.octaves,
    tCfg.lacunarity,
    tCfg.persistence,
  );
  const rawLandY = 2.6 + n * (tCfg.baseAmp * 0.55);
  const landBlend = smoothstep(0.02, 0.2, mask);
  let y = lerp(-2.1, rawLandY * (0.45 + 0.55 * mask), landBlend);

  // Authored Mountain at (+80, -170) rising to y ~ 22
  const mtDx = x - lm.mountain.x;
  const mtDz = z - lm.mountain.z;
  const mtR = lm.mountain.radius;
  const mtDistSq = mtDx * mtDx + mtDz * mtDz;
  const mtGauss = Math.exp(-mtDistSq / (mtR * mtR));
  const mtRidge = Math.exp(-mtDistSq / (18 * 18));
  y += mtGauss * lm.mountain.peakHeight + mtRidge * 3.8;

  // Waterfall cliff shoulder just north of waterfall (+72, -100)
  const wfDx = x - (lm.waterfall.x + 2);
  const wfDz = z - (lm.waterfall.z - 12);
  y += Math.exp(-(wfDx * wfDx + wfDz * wfDz) / (15 * 15)) * 7.8;

  // Subtle red canyon plateau lift at (-105, +85)
  const canDx = x - lm.canyon.x;
  const canDz = z - lm.canyon.z;
  y += Math.exp(-(canDx * canDx + canDz * canDz) / (34 * 34)) * 1.4;

  // Low-lying marsh depression around swamp ruins (+110, +100)
  const swDx = x - lm.swamp_ruins.x;
  const swDz = z - lm.swamp_ruins.z;
  const swFactor = Math.exp(-(swDx * swDx + swDz * swDz) / (34 * 34));
  y = lerp(y, 0.85, swFactor * 0.65);

  // Flatten cave entrance apron (-40, -60) so the rock arch sits flush
  const cvDx = x - lm.cave.x;
  const cvDz = z - lm.cave.z;
  const cvDist = Math.hypot(cvDx, cvDz);
  if (cvDist < 18) {
    const cvFlat = smoothstep(18, 8, cvDist);
    y = lerp(y, 2.4, cvFlat);
  }

  // Gentle sandy slope at NW beach (-145, -110)
  const bwDx = x - lm.beach_nw.x;
  const bwDz = z - lm.beach_nw.z;
  const bwFactor = Math.exp(-(bwDx * bwDx + bwDz * bwDz) / (26 * 26));
  y = lerp(y, 0.9, bwFactor * 0.55);

  // Carve North Lake bowl (-55, -130) with central islet
  const lkDx = x - lm.lake_n.x;
  const lkDz = z - lm.lake_n.z;
  const lkDist = Math.hypot(lkDx, lkDz);
  if (lkDist < lm.lake_n.radius + 6) {
    const bowl = smoothstep(lm.lake_n.radius + 5, lm.lake_n.radius - 7, lkDist);
    y = lerp(y, -lm.lake_n.depth + 0.8, bowl);
    if (lkDist < lm.lake_n.isletRadius + 3) {
      const islet = smoothstep(lm.lake_n.isletRadius + 2.5, lm.lake_n.isletRadius - 1.5, lkDist);
      y = lerp(y, 1.0, islet);
    }
  }

  // Carve small East Forest pond (+115, 0)
  const epDx = x - lm.forest_e.pondX;
  const epDz = z - lm.forest_e.pondZ;
  const epDist = Math.hypot(epDx, epDz);
  if (epDist < lm.forest_e.pondRadius + 4) {
    const pond = smoothstep(lm.forest_e.pondRadius + 3.5, lm.forest_e.pondRadius - 3.5, epDist);
    y = lerp(y, -1.2, pond);
  }

  // Carve river channel from waterfall to (+38, +90)
  const riverDist = getRiverDistance(x, z);
  const halfRiver = lm.river.width * 0.5;
  if (riverDist < halfRiver + 6) {
    const carve = smoothstep(halfRiver + 5.5, halfRiver - 0.6, riverDist);
    y = lerp(y, lm.river.depth - 0.15, carve);
  }

  return y;
}

// Precompute bridge deck geometry & walkability transforms once
const _tmpTan = { x: 0, z: 1 };
const bridgeSpecs = [CONFIG.landmarks.bridge_n, CONFIG.landmarks.bridge_s].map((b) => {
  getRiverTangentAt(b.x, b.z, _tmpTan);
  const tx = _tmpTan.x;
  const tz = _tmpTan.z;
  // Normal across the river channel
  const nx = -tz;
  const nz = tx;
  const halfLen = b.length * 0.5;
  const halfWid = b.width * 0.5;
  const bankA = getGroundHeight(b.x + nx * (halfLen + 1.5), b.z + nz * (halfLen + 1.5));
  const bankB = getGroundHeight(b.x - nx * (halfLen + 1.5), b.z - nz * (halfLen + 1.5));
  const deckY = Math.max(0.95, Math.max(bankA, bankB) + 0.15);
  return {
    id: b.id,
    x: b.x,
    z: b.z,
    tx,
    tz,
    nx,
    nz,
    length: b.length,
    width: b.width,
    halfLen,
    halfWid,
    deckY,
    angle: Math.atan2(nx, nz),
  };
});

export function getBridgeSpecs() {
  return bridgeSpecs;
}

function getBridgeDeckAt(x, z) {
  for (let i = 0; i < bridgeSpecs.length; i++) {
    const b = bridgeSpecs[i];
    const dx = x - b.x;
    const dz = z - b.z;
    const along = Math.abs(dx * b.nx + dz * b.nz);
    const across = Math.abs(dx * b.tx + dz * b.tz);
    if (along <= b.halfLen + 0.6 && across <= b.halfWid) {
      // Smooth ramp near bridge ends
      const ramp = smoothstep(b.halfLen + 0.6, b.halfLen - 1.6, along);
      const ground = getGroundHeight(x, z);
      return Math.max(ground, lerp(ground, b.deckY, ramp));
    }
  }
  return -Infinity;
}

export function isOnBridge(x, z) {
  for (let i = 0; i < bridgeSpecs.length; i++) {
    const b = bridgeSpecs[i];
    const dx = x - b.x;
    const dz = z - b.z;
    const along = Math.abs(dx * b.nx + dz * b.nz);
    const across = Math.abs(dx * b.tx + dz * b.tz);
    if (along <= b.halfLen + 0.6 && across <= b.halfWid) {
      return true;
    }
  }
  return false;
}

export function isWaterAt(x, z) {
  if (isOnBridge(x, z)) return false;

  const mask = getIslandMask(x, z);
  if (mask < CONFIG.world.islandMaskEdge) return true;

  const lm = CONFIG.landmarks;
  if (getRiverDistance(x, z) < lm.river.width * 0.5) return true;

  const lkDist = Math.hypot(x - lm.lake_n.x, z - lm.lake_n.z);
  if (lkDist < lm.lake_n.radius - 2.5 && lkDist > lm.lake_n.isletRadius + 0.5) return true;

  const epDist = Math.hypot(x - lm.forest_e.pondX, z - lm.forest_e.pondZ);
  if (epDist < lm.forest_e.pondRadius - 1.5) return true;

  return getGroundHeight(x, z) <= CONFIG.water.level + 0.05;
}

export function isWalkable(x, z) {
  const hs = CONFIG.world.halfSize;
  if (Math.abs(x) >= hs - 2 || Math.abs(z) >= hs - 2) return false;
  return !isWaterAt(x, z);
}

export function getWalkHeight(x, z) {
  const bridgeY = getBridgeDeckAt(x, z);
  if (bridgeY > -Infinity) return bridgeY;
  return getGroundHeight(x, z);
}

// Moves an entity in place toward (nextX, nextZ), sliding along water/coast boundaries.
export function stepWalkable(entity, nextX, nextZ, edgeMargin = 4) {
  const limit = CONFIG.world.halfSize - edgeMargin;
  const cx = clamp(nextX, -limit, limit);
  const cz = clamp(nextZ, -limit, limit);

  if (isWalkable(cx, cz)) {
    entity.x = cx;
    entity.z = cz;
    return true;
  }
  if (isWalkable(cx, entity.z)) {
    entity.x = cx;
    return true;
  }
  if (isWalkable(entity.x, cz)) {
    entity.z = cz;
    return true;
  }
  return false;
}

export function createTerrain(scene, initialZone, groundColorFn = null) {
  const hs = CONFIG.world.halfSize;
  const segs = CONFIG.world.terrainSegments;
  const tCfg = CONFIG.terrain;

  let geometry = new THREE.PlaneGeometry(hs * 2, hs * 2, segs, segs);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setY(i, getGroundHeight(posAttr.getX(i), posAttr.getZ(i)));
  }

  geometry = geometry.toNonIndexed();
  const triPos = geometry.attributes.position;
  const colors = new Float32Array(triPos.count * 3);

  const loColor = new THREE.Color(initialZone.lo);
  const hiColor = new THREE.Color(initialZone.hi);
  const snowColor = new THREE.Color(tCfg.snowColor);
  const rockColor = new THREE.Color(tCfg.rockColor);
  const sandColor = new THREE.Color(tCfg.sandColor);
  const riverbedColor = new THREE.Color(tCfg.riverbedColor);
  const tempColor = new THREE.Color();
  const rand = createRng(CONFIG.world.terrainSeed);

  for (let i = 0; i < triPos.count; i += 3) {
    const cx = (triPos.getX(i) + triPos.getX(i + 1) + triPos.getX(i + 2)) / 3;
    const cy = (triPos.getY(i) + triPos.getY(i + 1) + triPos.getY(i + 2)) / 3;
    const cz = (triPos.getZ(i) + triPos.getZ(i + 1) + triPos.getZ(i + 2)) / 3;
    const mask = getIslandMask(cx, cz);
    const jitter = (rand() - 0.5) * tCfg.colorJitter;

    if (cy > tCfg.snowHeight) {
      tempColor.copy(snowColor);
    } else if (cy > tCfg.rockHeight) {
      const rockT = smoothstep(tCfg.rockHeight, tCfg.snowHeight, cy);
      tempColor.copy(rockColor).lerp(snowColor, rockT * 0.35);
    } else if (mask < CONFIG.world.sandMaskThreshold) {
      tempColor.copy(sandColor);
    } else if (cy < 0.05 && getRiverDistance(cx, cz) < CONFIG.world.riverWidth * 0.7) {
      tempColor.copy(riverbedColor);
    } else if (groundColorFn) {
      groundColorFn(cx, cz, cy, mask, tempColor);
    } else {
      const rawT = (cy - tCfg.colorMinY) / tCfg.colorRangeY + jitter;
      const clampedT = clamp(rawT, 0, 1);
      tempColor.copy(loColor).lerp(hiColor, clampedT);
    }

    // Subtle per-triangle facet variation for crisp low-poly look
    const shade = 1 + jitter * 0.25;
    const r = clamp(tempColor.r * shade, 0, 1);
    const g = clamp(tempColor.g * shade, 0, 1);
    const b = clamp(tempColor.b * shade, 0, 1);

    for (let k = 0; k < 3; k++) {
      const idx = (i + k) * 3;
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Animated water plane at y = -0.1 with single sine vertex wave (amp 0.1, period 4s)
  const wCfg = CONFIG.water;
  const waterGeo = new THREE.PlaneGeometry(wCfg.size, wCfg.size, wCfg.segments, wCfg.segments);
  waterGeo.rotateX(-Math.PI / 2);

  const waterUniforms = {
    uTime: { value: 0 },
  };
  const omega = ((Math.PI * 2) / wCfg.wavePeriodSec).toFixed(6);
  const amp = wCfg.waveAmplitude.toFixed(4);

  const waterMat = new THREE.MeshLambertMaterial({
    color: wCfg.color,
    transparent: true,
    opacity: wCfg.opacity,
    fog: false,
    flatShading: true,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.y += sin(transformed.x * 0.16 + transformed.z * 0.14 + uTime * ${omega}) * ${amp};`,
    );
  };

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = wCfg.level;
  waterMesh.receiveShadow = false;
  scene.add(waterMesh);

  function updateWater(timeSec) {
    waterUniforms.uTime.value = timeSec;
  }

  return {
    mesh,
    waterMesh,
    updateWater,
  };
}
