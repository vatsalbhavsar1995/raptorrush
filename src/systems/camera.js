import { CONFIG } from '../config.js';
import { getWalkHeight } from '../world/terrain.js';

export function createCameraController(camera) {
  const cfg = CONFIG.camera;
  let cx = 0;
  let cz = 0;
  let yaw = 0;
  let pitch = cfg.initialPitch;
  let dist = cfg.distances[1];
  let lastView = -1;

  function applyViewSetting(viewIndex) {
    if (viewIndex !== lastView) {
      dist = cfg.distances[viewIndex] ?? cfg.distances[1];
      lastView = viewIndex;
    }
  }

  function handleDrag(deltaX, deltaY) {
    yaw -= deltaX * cfg.dragYawSens;
    pitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, pitch + deltaY * cfg.dragPitchSens));
  }

  function handleWheel(deltaY) {
    dist = Math.max(cfg.minDist, Math.min(cfg.maxDist, dist + deltaY * cfg.wheelSens));
  }

  function updateYaw(dt, keys, followMode, playerAngle, moving) {
    yaw += (keys.e ? -1 : 0) * cfg.keyYawSpeed * dt;
    if (followMode && moving) {
      const delta = ((playerAngle + Math.PI - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw += delta * Math.min(1, dt * cfg.followYawRate);
    }
  }

  function updateRender(targetX, targetZ, groundY, shakeAmount, shakeEnabled, frameDt) {
    const smooth = 1 - Math.pow(1 - cfg.followLerp, Math.max(0, frameDt) * 60);
    cx += (targetX - cx) * smooth;
    cz += (targetZ - cz) * smooth;

    const sk = shakeEnabled ? shakeAmount * cfg.shakeScale : 0;
    const cp = Math.cos(pitch);
    const camX = cx + Math.sin(yaw) * cp * dist + (Math.random() - 0.5) * sk;
    const camZ = cz + Math.cos(yaw) * cp * dist;
    let camY = groundY + Math.sin(pitch) * dist + (Math.random() - 0.5) * sk;
    const minGroundY = Math.max(CONFIG.water.level, getWalkHeight(camX, camZ)) + cfg.groundClearance;
    if (camY < minGroundY) camY = minGroundY;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(cx, groundY + cfg.lookAtYOffset, cz);
  }

  function resetPosition(x, z) {
    cx = x;
    cz = z;
  }

  return {
    applyViewSetting,
    handleDrag,
    handleWheel,
    updateYaw,
    updateRender,
    resetPosition,
    getYaw: () => yaw,
  };
}
