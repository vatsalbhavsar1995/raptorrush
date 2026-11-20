import { CONFIG } from '../config.js';
import { createGroundColorBlender } from './biomes.js';
import { createTerrain } from './terrain.js';
import { placeLandmarks } from './landmarks.js';
import { createWorldProps } from './props.js';

export function createIslandWorld({ scene, zones, initialZone, config = CONFIG, groundColorFn = null }) {
  const colorBlender = groundColorFn || (zones ? createGroundColorBlender(zones) : null);
  const terrain = createTerrain(scene, initialZone, colorBlender);
  const landmarks = placeLandmarks(scene, config);
  const props = createWorldProps(scene, initialZone, zones);

  function update(timeSec) {
    terrain.updateWater(timeSec);
    landmarks.update(timeSec);
  }

  return {
    terrain,
    landmarks,
    props,
    update,
  };
}
