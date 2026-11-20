import { buildDinoModel } from './models.js';

export function createRexMesh(scene, rexStats) {
  const group = buildDinoModel('trex', rexStats.colors.body, rexStats.colors.eye);
  group.scale.setScalar(rexStats.scale);
  scene.add(group);
  return group;
}
