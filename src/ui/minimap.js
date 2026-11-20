import { CONFIG } from '../config.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const size = CONFIG.hud.minimapSize;
  const radius = size / 2;
  const scale = radius / CONFIG.hud.minimapWorldRadius;
  const pad = CONFIG.hud.minimapEdgePad;
  const rexLim = radius - CONFIG.hud.minimapRexPad;
  const maxSq = (radius - pad) * (radius - pad);
  const colors = CONFIG.hud.minimapColors;
  const TAU = Math.PI * 2;

  function drawLandmarkIcon(type, x, y, clamped) {
    ctx.save();
    ctx.globalAlpha = clamped ? 0.72 : 1;
    ctx.translate(x, y);
    if (type === 'mountain') {
      ctx.fillStyle = colors.mountain;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6.5, 5);
      ctx.lineTo(-6.5, 5);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'cave') {
      ctx.fillStyle = colors.cave;
      ctx.strokeStyle = colors.caveStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'beach_nw') {
      ctx.fillStyle = colors.fossil;
      ctx.beginPath();
      ctx.ellipse(-3.2, 0, 3.2, 4.2, 0, 0, TAU);
      ctx.ellipse(3.2, 0, 3.2, 4.2, 0, 0, TAU);
      ctx.fillRect(-3.2, -1.8, 6.4, 3.6);
      ctx.fill();
    } else if (type === 'dock_w') {
      ctx.fillStyle = colors.dock;
      ctx.fillRect(-5, -5, 10, 10);
    }
    ctx.restore();
  }

  const landmarkKeys = ['mountain', 'cave', 'beach_nw', 'dock_w'];

  function draw({ zones, currentZone, landmarks, player, camYaw, berries, eggs, npcs, rexes }) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 3, 0, TAU);
    ctx.clip();

    const zoneTintHex = currentZone && (currentZone.tree || (currentZone.leaf && currentZone.leaf[0]));
    if (zoneTintHex) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = zoneTintHex;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = colors.zoneTint;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const dx = (z.cx - player.x) * scale;
      const dz = (z.cz - player.z) * scale;
      ctx.beginPath();
      ctx.arc(radius + dx, radius + dz, z.r * scale, 0, TAU);
      ctx.fill();
    }

    ctx.translate(radius, radius);
    ctx.rotate(camYaw);
    ctx.translate(-radius, -radius);

    // Draw landmark icons (clamped to rim when distant so players can navigate by landmarks)
    if (landmarks) {
      for (let i = 0; i < landmarkKeys.length; i++) {
        const key = landmarkKeys[i];
        const lm = landmarks[key];
        if (!lm) continue;
        let dx = (lm.x - player.x) * scale;
        let dz = (lm.z - player.z) * scale;
        const dist = Math.hypot(dx, dz);
        let clamped = false;
        if (dist > rexLim) {
          dx *= rexLim / dist;
          dz *= rexLim / dist;
          clamped = true;
        }
        drawLandmarkIcon(key, radius + dx, radius + dz, clamped);
      }
    }

    ctx.fillStyle = colors.berry;
    for (let i = 0; i < berries.length; i++) {
      const b = berries[i];
      const dx = (b.x - player.x) * scale;
      const dz = (b.z - player.z) * scale;
      if (dx * dx + dz * dz > maxSq) continue;
      ctx.beginPath();
      ctx.arc(radius + dx, radius + dz, 3.5, 0, TAU);
      ctx.fill();
    }

    if (eggs) {
      ctx.fillStyle = colors.egg;
      for (let i = 0; i < eggs.length; i++) {
        const e = eggs[i];
        if (!e.active) continue;
        const dx = (e.x - player.x) * scale;
        const dz = (e.z - player.z) * scale;
        if (dx * dx + dz * dz > maxSq) continue;
        ctx.beginPath();
        ctx.arc(radius + dx, radius + dz, 4.5, 0, TAU);
        ctx.fill();
      }
    }

    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.dead) continue;
      const dx = (n.x - player.x) * scale;
      const dz = (n.z - player.z) * scale;
      if (dx * dx + dz * dz > maxSq) continue;
      const isTrike = n.type === 'trike';
      ctx.fillStyle = isTrike ? colors.trike : colors.compy;
      ctx.beginPath();
      ctx.arc(radius + dx, radius + dz, isTrike ? 6 : 4, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = colors.rex;
    for (let i = 0; i < rexes.length; i++) {
      const q = rexes[i];
      let dx = (q.x - player.x) * scale;
      let dz = (q.z - player.z) * scale;
      const dist = Math.hypot(dx, dz);
      if (dist > rexLim) {
        dx *= rexLim / dist;
        dz *= rexLim / dist;
      }
      ctx.beginPath();
      ctx.arc(radius + dx, radius + dz, q.boss ? 12 : 7, 0, TAU);
      ctx.fill();
    }

    ctx.translate(radius, radius);
    ctx.rotate(-player.a + Math.PI);
    ctx.fillStyle = colors.player;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(9, 10);
    ctx.lineTo(-9, 10);
    ctx.fill();
    ctx.restore();
  }

  return { draw };
}
