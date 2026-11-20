import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { addBoxPart } from './player.js';
import { createRexMesh } from './enemy.js';

export function createBossMesh(scene, bossDef, rexStats) {
  const group = createRexMesh(scene, rexStats);
  const tintColor = new THREE.Color(bossDef.tint);

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.material.color.multiply(tintColor);
    }
  });

  if (bossDef.sailColor) {
    addBoxPart(0.15, 1.7, 2.4, bossDef.sailColor, 0, 3.9, -0.1, group);
  }
  if (bossDef.spikes) {
    const spikeColor = bossDef.spikeColor || '#ff7a1a';
    for (let i = 0; i < 4; i++) {
      addBoxPart(0.3, 0.8, 0.3, spikeColor, 0, 3.4, -1.2 + i * 0.9, group);
    }
  }

  group.scale.setScalar(bossDef.scale);
  return group;
}

export function createStompRing(scene) {
  const sim = CONFIG.simulation;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(sim.ringInnerRadius, sim.ringOuterRadius, sim.ringSegments),
    new THREE.MeshBasicMaterial({
      color: sim.ringColor,
      transparent: true,
      opacity: sim.ringOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  return ring;
}
