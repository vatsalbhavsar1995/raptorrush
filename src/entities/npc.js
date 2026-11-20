import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyFood } from '../systems/evolution.js';
import { addBoxPart, makeFlatMaterial } from './player.js';

export function handleNpcKill(npc, evo, foods, config = CONFIG, playerTarget = null, onToast) {
  const foodId = npc && npc.type === 'trike' ? 'trike' : 'compy';
  return applyFood(evo, foodId, foods, config, playerTarget, onToast);
}

export function createCompyMesh(scene, compyStats) {
  const c = compyStats.colors;
  const group = new THREE.Group();

  addBoxPart(0.7, 0.6, 1.3, c.body, 0, 0.9, 0, group);
  addBoxPart(0.45, 0.45, 0.6, c.head, 0, 1.35, 0.8, group);
  addBoxPart(0.1, 0.12, 0.12, c.eye, 0.2, 1.5, 1.05, group);
  addBoxPart(0.1, 0.12, 0.12, c.eye, -0.2, 1.5, 1.05, group);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 4), makeFlatMaterial(c.body));
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.9, -1.1);
  group.add(tail);

  addBoxPart(0.15, 0.7, 0.2, c.limb, 0.2, 0.35, 0, group);
  addBoxPart(0.15, 0.7, 0.2, c.limb, -0.2, 0.35, 0, group);

  scene.add(group);
  return group;
}

export function createTrikeMesh(scene, trikeStats) {
  const c = trikeStats.colors;
  const group = new THREE.Group();

  addBoxPart(2.0, 1.8, 3.6, c.body, 0, 2.0, 0, group);
  addBoxPart(1.5, 1.3, 1.4, c.head, 0, 2.2, 2.3, group);
  addBoxPart(2.6, 2.2, 0.35, c.frill, 0, 3.3, 1.5, group);
  addBoxPart(0.22, 0.22, 1.3, c.horn, 0.45, 2.6, 3.2, group);
  addBoxPart(0.22, 0.22, 1.3, c.horn, -0.45, 2.6, 3.2, group);
  addBoxPart(0.22, 0.22, 0.8, c.horn, 0, 2.2, 3.2, group);

  const legOffsets = [
    [0.8, 1.4],
    [-0.8, 1.4],
    [0.8, -1.2],
    [-0.8, -1.2],
  ];
  for (let i = 0; i < legOffsets.length; i++) {
    const [x, z] = legOffsets[i];
    addBoxPart(0.55, 1.2, 0.6, c.limb, x, 0.6, z, group);
  }

  scene.add(group);
  return group;
}
