import * as THREE from 'three';

export function makeFlatMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function addBoxPart(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeFlatMaterial(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function shadeColor(hex, factor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return c;
}

function buildQuadrupedLegs(group, legColor, footColor, xOff, frontZ, backZ, legW, legH, legD, footW, footH, footD) {
  const makeLeg = (x, z) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, legH, z);
    addBoxPart(legW, legH, legD, legColor, 0, -legH * 0.5, 0, pivot);
    addBoxPart(footW, footH, footD, footColor, 0, -legH + footH * 0.5, footD * 0.15, pivot);
    group.add(pivot);
    return pivot;
  };
  const frontLeft = makeLeg(xOff, frontZ);
  const frontRight = makeLeg(-xOff, frontZ);
  const backLeft = makeLeg(xOff, backZ);
  const backRight = makeLeg(-xOff, backZ);
  group.userData.legs = [frontLeft, frontRight];
  group.userData.hindLegs = [backLeft, backRight];
}

function buildRaptor(color, accentColor) {
  const bodyColor = color || '#7fb63f';
  const stripeColor = accentColor || '#ffb23e';
  const isDefault =
    typeof bodyColor === 'string' && bodyColor.toLowerCase() === '#7fb63f';
  const headColor = isDefault ? '#93cc4a' : shadeColor(bodyColor, 1.12);
  const limbColor = isDefault ? '#6a9a32' : shadeColor(bodyColor, 0.84);
  const footColor = isDefault ? '#4d7a25' : shadeColor(bodyColor, 0.64);

  const group = new THREE.Group();
  addBoxPart(1.3, 1.2, 2.4, bodyColor, 0, 1.9, 0, group);
  addBoxPart(0.5, 0.12, 1.7, stripeColor, 0, 2.55, 0, group);
  addBoxPart(0.7, 0.9, 0.8, bodyColor, 0, 2.6, 1.3, group).rotation.x = -0.5;
  addBoxPart(0.9, 0.8, 1.3, headColor, 0, 3.2, 1.9, group);
  addBoxPart(0.6, 0.35, 0.8, headColor, 0, 3.05, 2.8, group);
  addBoxPart(0.14, 0.2, 0.2, '#1a0f0c', 0.47, 3.4, 2.2, group);
  addBoxPart(0.14, 0.2, 0.2, '#1a0f0c', -0.47, 3.4, 2.2, group);
  addBoxPart(0.18, 0.5, 0.18, limbColor, 0.5, 2.2, 1.1, group);
  addBoxPart(0.18, 0.5, 0.18, limbColor, -0.5, 2.2, 1.1, group);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.4, 4), makeFlatMaterial(bodyColor));
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 1.9, -2.7);
  tail.castShadow = true;
  group.add(tail);

  const legs = [0.5, -0.5].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.4, -0.1);
    addBoxPart(0.4, 1.4, 0.5, limbColor, 0, -0.7, 0, pivot);
    addBoxPart(0.5, 0.2, 0.9, footColor, 0, -1.4, 0.25, pivot);
    group.add(pivot);
    return pivot;
  });

  group.userData.legs = legs;
  group.userData.tail = tail;
  group.userData.idleOffset = (t) => Math.sin(t * 3.0) * 0.05;
  return group;
}

function buildTriceratops(color, accentColor) {
  const bodyColor = color || '#8d7b5c';
  const frillColor = accentColor || '#c0603c';
  const headColor = shadeColor(bodyColor, 1.1);
  const limbColor = shadeColor(bodyColor, 0.78);
  const footColor = shadeColor(bodyColor, 0.6);
  const hornColor = '#f0e6c8';

  const group = new THREE.Group();
  addBoxPart(2.0, 1.65, 3.2, bodyColor, 0, 1.75, -0.1, group);
  addBoxPart(1.45, 1.18, 1.4, headColor, 0, 1.9, 1.95, group);
  addBoxPart(0.92, 0.72, 0.85, headColor, 0, 1.68, 2.8, group);

  const frill = addBoxPart(2.7, 2.1, 0.35, frillColor, 0, 2.9, 1.35, group);
  frill.rotation.x = -0.22;

  const leftHorn = addBoxPart(0.22, 0.22, 1.65, hornColor, 0.52, 2.45, 2.95, group);
  leftHorn.rotation.x = -0.14;
  const rightHorn = addBoxPart(0.22, 0.22, 1.65, hornColor, -0.52, 2.45, 2.95, group);
  rightHorn.rotation.x = -0.14;
  const noseHorn = addBoxPart(0.22, 0.58, 0.22, hornColor, 0, 2.18, 3.0, group);
  noseHorn.rotation.x = 0.22;

  addBoxPart(0.16, 0.2, 0.2, '#1a0f0c', 0.74, 2.15, 2.15, group);
  addBoxPart(0.16, 0.2, 0.2, '#1a0f0c', -0.74, 2.15, 2.15, group);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.1, 4), makeFlatMaterial(bodyColor));
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 1.55, -2.5);
  tail.castShadow = true;
  group.add(tail);

  buildQuadrupedLegs(group, limbColor, footColor, 0.82, 1.05, -1.15, 0.56, 1.15, 0.6, 0.64, 0.22, 0.74);

  group.userData.tail = tail;
  group.userData.idleOffset = (t) => Math.sin(t * 2.1) * 0.035;
  return group;
}

function buildStegosaurus(color, accentColor) {
  const bodyColor = color || '#557a4a';
  const plateColor = accentColor || '#c8603a';
  const headColor = shadeColor(bodyColor, 1.14);
  const limbColor = shadeColor(bodyColor, 0.78);
  const footColor = shadeColor(bodyColor, 0.58);
  const spikeColor = '#f0e6c8';

  const group = new THREE.Group();
  addBoxPart(1.65, 1.5, 3.5, bodyColor, 0, 1.75, 0, group);
  const neck = addBoxPart(0.68, 0.68, 1.0, bodyColor, 0, 1.58, 2.05, group);
  neck.rotation.x = 0.2;
  addBoxPart(0.66, 0.56, 0.92, headColor, 0, 1.48, 2.8, group);
  addBoxPart(0.12, 0.14, 0.14, '#1a0f0c', 0.34, 1.6, 2.92, group);
  addBoxPart(0.12, 0.14, 0.14, '#1a0f0c', -0.34, 1.6, 2.92, group);

  const plateSpecs = [
    [1.25, 0.58],
    [0.55, 0.86],
    [-0.2, 1.02],
    [-0.95, 0.88],
    [-1.65, 0.64],
  ];
  for (let i = 0; i < plateSpecs.length; i++) {
    const [z, size] = plateSpecs[i];
    const leftPlate = addBoxPart(0.14, size, size, plateColor, 0.34, 2.55 + size * 0.35, z, group);
    leftPlate.rotation.x = Math.PI / 4;
    const rightPlate = addBoxPart(0.14, size, size, plateColor, -0.34, 2.55 + size * 0.35, z - 0.18, group);
    rightPlate.rotation.x = Math.PI / 4;
  }

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 1.68, -1.75);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.58, 3.1, 4), makeFlatMaterial(bodyColor));
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 0, -1.5);
  tailCone.castShadow = true;
  tailGroup.add(tailCone);

  const spikeCoords = [
    [0.42, -2.35, 0.6],
    [-0.42, -2.35, -0.6],
    [0.36, -2.75, 0.65],
    [-0.36, -2.75, -0.65],
  ];
  for (let i = 0; i < spikeCoords.length; i++) {
    const [sx, sz, rz] = spikeCoords[i];
    const spike = addBoxPart(0.14, 0.72, 0.14, spikeColor, sx, 0.25, sz, tailGroup);
    spike.rotation.z = rz;
  }
  group.add(tailGroup);

  buildQuadrupedLegs(group, limbColor, footColor, 0.74, 1.15, -1.1, 0.52, 1.18, 0.56, 0.6, 0.22, 0.68);

  group.userData.tail = tailGroup;
  group.userData.idleOffset = (t) => Math.sin(t * 2.3) * 0.04;
  return group;
}

function buildSpinosaurus(color, accentColor) {
  const bodyColor = color || '#4a7a90';
  const sailColor = accentColor || '#2f9f8a';
  const headColor = shadeColor(bodyColor, 1.14);
  const limbColor = shadeColor(bodyColor, 0.8);
  const footColor = shadeColor(bodyColor, 0.6);

  const group = new THREE.Group();
  addBoxPart(1.5, 1.35, 2.95, bodyColor, 0, 2.05, 0, group);

  // Tall trapezoidal sail along the spine
  addBoxPart(0.18, 1.45, 0.58, sailColor, 0, 3.25, 0.95, group);
  addBoxPart(0.18, 2.15, 0.72, sailColor, 0, 3.6, 0.32, group);
  addBoxPart(0.18, 2.25, 0.72, sailColor, 0, 3.65, -0.35, group);
  addBoxPart(0.18, 1.55, 0.58, sailColor, 0, 3.3, -0.98, group);

  const neck = addBoxPart(0.82, 1.0, 0.92, bodyColor, 0, 2.82, 1.62, group);
  neck.rotation.x = -0.45;
  addBoxPart(0.95, 0.82, 1.45, headColor, 0, 3.42, 2.35, group);
  addBoxPart(0.55, 0.42, 1.45, headColor, 0, 3.26, 3.55, group);
  addBoxPart(0.15, 0.2, 0.2, '#ffe14a', 0.49, 3.62, 2.55, group);
  addBoxPart(0.15, 0.2, 0.2, '#ffe14a', -0.49, 3.62, 2.55, group);

  // Slightly longer clawed arms than raptor
  const armL = addBoxPart(0.24, 0.9, 0.26, limbColor, 0.68, 2.15, 1.35, group);
  armL.rotation.x = -0.35;
  const armR = addBoxPart(0.24, 0.9, 0.26, limbColor, -0.68, 2.15, 1.35, group);
  armR.rotation.x = -0.35;

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.82, 4.1, 4), makeFlatMaterial(bodyColor));
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 2.0, -3.35);
  tail.castShadow = true;
  group.add(tail);

  const legs = [0.62, -0.62].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.55, -0.15);
    addBoxPart(0.5, 1.55, 0.62, limbColor, 0, -0.78, 0, pivot);
    addBoxPart(0.62, 0.24, 1.08, footColor, 0, -1.52, 0.28, pivot);
    group.add(pivot);
    return pivot;
  });

  group.userData.legs = legs;
  group.userData.tail = tail;
  group.userData.idleOffset = (t) => Math.sin(t * 2.7) * 0.05;
  return group;
}

function buildAnkylosaurus(color, accentColor) {
  const bodyColor = color || '#7a6a4a';
  const armorColor = accentColor || '#b8943a';
  const headColor = shadeColor(bodyColor, 1.1);
  const limbColor = shadeColor(bodyColor, 0.76);
  const footColor = shadeColor(bodyColor, 0.58);

  const group = new THREE.Group();
  addBoxPart(2.65, 1.05, 3.05, bodyColor, 0, 1.12, 0, group);
  addBoxPart(2.15, 0.36, 2.45, shadeColor(bodyColor, 0.92), 0, 1.72, 0, group);

  // Domed armored head and cheek horns
  addBoxPart(1.18, 0.82, 1.25, headColor, 0, 1.12, 1.98, group);
  addBoxPart(0.88, 0.28, 0.85, armorColor, 0, 1.58, 1.92, group);
  addBoxPart(0.28, 0.24, 0.32, armorColor, 0.7, 1.08, 1.82, group);
  addBoxPart(0.28, 0.24, 0.32, armorColor, -0.7, 1.08, 1.82, group);
  addBoxPart(0.14, 0.16, 0.16, '#1a0f0c', 0.61, 1.22, 2.22, group);
  addBoxPart(0.14, 0.16, 0.16, '#1a0f0c', -0.61, 1.22, 2.22, group);

  // Armor bump clusters across carapace
  const bumpZs = [-0.85, 0, 0.85];
  const bumpXs = [-0.72, 0, 0.72];
  for (let zi = 0; zi < bumpZs.length; zi++) {
    for (let xi = 0; xi < bumpXs.length; xi++) {
      const h = xi === 1 ? 0.32 : 0.24;
      addBoxPart(0.36, h, 0.38, armorColor, bumpXs[xi], 1.94, bumpZs[zi], group);
    }
    addBoxPart(0.28, 0.22, 0.28, armorColor, 1.42, 1.25, bumpZs[zi], group);
    addBoxPart(0.28, 0.22, 0.28, armorColor, -1.42, 1.25, bumpZs[zi], group);
  }

  // Heavy clubbed tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 1.02, -1.5);
  addBoxPart(0.46, 0.4, 2.2, bodyColor, 0, 0, -1.05, tailGroup);
  addBoxPart(0.96, 0.74, 0.96, armorColor, 0, 0.04, -2.35, tailGroup);
  const clubOuter = addBoxPart(0.78, 0.64, 0.78, shadeColor(armorColor, 1.12), 0, 0.04, -2.35, tailGroup);
  clubOuter.rotation.y = Math.PI / 4;
  group.add(tailGroup);

  buildQuadrupedLegs(group, limbColor, footColor, 1.05, 0.95, -0.95, 0.54, 0.82, 0.56, 0.62, 0.2, 0.66);

  group.userData.tail = tailGroup;
  group.userData.idleOffset = (t) => Math.sin(t * 1.9) * 0.025;
  return group;
}

function buildTrex(color, accentColor) {
  const bodyColor = color || '#a8442c';
  const eyeColor = accentColor || '#ffe14a';
  const isDefault =
    typeof bodyColor === 'string' && bodyColor.toLowerCase() === '#a8442c';
  const headColor = isDefault ? '#b94d32' : shadeColor(bodyColor, 1.1);
  const bellyColor = '#e0a566';
  const limbColor = isDefault ? '#8a3420' : shadeColor(bodyColor, 0.82);
  const footColor = isDefault ? '#5e2416' : shadeColor(bodyColor, 0.56);

  const group = new THREE.Group();
  addBoxPart(1.6, 1.5, 2.8, bodyColor, 0, 2.2, 0, group);
  addBoxPart(1.0, 0.3, 2.0, bellyColor, 0, 1.5, 0.1, group);
  addBoxPart(0.9, 1.1, 1.0, bodyColor, 0, 3.2, 1.5, group).rotation.x = -0.4;
  addBoxPart(1.5, 1.2, 1.8, headColor, 0, 3.9, 2.3, group);
  addBoxPart(1.2, 0.35, 1.5, bellyColor, 0, 3.25, 2.4, group);
  addBoxPart(0.18, 0.22, 0.22, eyeColor, 0.62, 4.2, 2.6, group);
  addBoxPart(0.18, 0.22, 0.22, eyeColor, -0.62, 4.2, 2.6, group);
  addBoxPart(0.2, 0.55, 0.2, limbColor, 0.7, 2.6, 1.4, group);
  addBoxPart(0.2, 0.55, 0.2, limbColor, -0.7, 2.6, 1.4, group);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.95, 4.2, 4), makeFlatMaterial(bodyColor));
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 2.2, -3.4);
  tail.castShadow = true;
  group.add(tail);

  const legs = [0.7, -0.7].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.8, -0.1);
    addBoxPart(0.6, 1.8, 0.7, limbColor, 0, -0.9, 0, pivot);
    addBoxPart(0.7, 0.25, 1.2, footColor, 0, -1.8, 0.3, pivot);
    group.add(pivot);
    return pivot;
  });

  group.userData.legs = legs;
  group.userData.tail = tail;
  group.userData.idleOffset = (t) => Math.sin(t * 2.4) * 0.045;
  return group;
}

export function buildDinoModel(dinoId, color, accentColor) {
  let group;
  switch (dinoId) {
    case 'triceratops':
      group = buildTriceratops(color, accentColor);
      break;
    case 'stegosaurus':
      group = buildStegosaurus(color, accentColor);
      break;
    case 'spinosaurus':
      group = buildSpinosaurus(color, accentColor);
      break;
    case 'ankylosaurus':
      group = buildAnkylosaurus(color, accentColor);
      break;
    case 'trex':
      group = buildTrex(color, accentColor);
      break;
    case 'raptor':
    default:
      group = buildRaptor(color, accentColor);
      break;
  }

  const materials = [];
  const baseColors = [];
  const primaryMaterials = [];
  const primaryBaseColors = [];
  const eyeHex = 0x1a0f0c;

  group.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.color) {
      const mat = obj.material;
      const base = mat.color.clone();
      materials.push(mat);
      baseColors.push(base);
      if (base.getHex() !== eyeHex) {
        primaryMaterials.push(mat);
        primaryBaseColors.push(base);
      }
    }
  });

  group.userData.materials = materials;
  group.userData.baseColors = baseColors;
  group.userData.primaryMaterials = primaryMaterials;
  group.userData.primaryBaseColors = primaryBaseColors;
  group.userData.accentColor = new THREE.Color(accentColor || '#ffb23e');
  group.userData.appliedStage = 0;
  group.userData.wasFlashing = false;
  group.userData.legendLight = null;

  return group;
}

export function disposeObjectTree(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        for (let i = 0; i < obj.material.length; i++) obj.material[i].dispose();
      } else if (obj.material) {
        obj.material.dispose();
      }
    }
  });
}
