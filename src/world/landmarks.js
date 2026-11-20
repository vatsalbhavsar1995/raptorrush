import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng, getBridgeSpecs, getGroundHeight } from './terrain.js';

function makeMat(hex, extra = null) {
  return new THREE.MeshLambertMaterial({
    color: hex,
    flatShading: true,
    ...(extra || {}),
  });
}

function addPalmTree(parent, x, z, scale, rotY, trunkMat, frondMat) {
  const g = new THREE.Group();
  const baseY = getGroundHeight(x, z);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);

  // Gently curving segmented trunk
  const segs = 4;
  let curY = 0;
  let curX = 0;
  for (let i = 0; i < segs; i++) {
    const h = 1.65;
    const rTop = 0.28 - i * 0.035;
    const rBot = 0.34 - i * 0.035;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 5), trunkMat);
    cyl.position.set(curX + i * 0.14, curY + h * 0.5, 0);
    cyl.rotation.z = -0.11 * (i + 0.5);
    cyl.castShadow = true;
    g.add(cyl);
    curY += h * 0.96;
    curX += 0.24 + i * 0.06;
  }

  // Radiating low-poly palm fronds
  const frondGeo = new THREE.BoxGeometry(0.65, 0.12, 2.7);
  const crownX = curX + 0.15;
  const crownY = curY + 0.1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(crownX, crownY, 0);
    pivot.rotation.y = a;
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.set(0, 0.1, 1.35);
    frond.rotation.x = 0.36;
    frond.castShadow = true;
    pivot.add(frond);
    g.add(pivot);
  }

  parent.add(g);
}

function addBroadleafTree(parent, x, z, scale, rotY, trunkMat, leafMat) {
  const g = new THREE.Group();
  g.position.set(x, getGroundHeight(x, z), z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.52, 2.6, 5), trunkMat);
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  g.add(trunk);

  const tiers = [
    [2.5, 2.7, 2.5],
    [1.9, 2.3, 4.1],
    [1.2, 2.0, 5.4],
  ];
  for (let i = 0; i < tiers.length; i++) {
    const [r, h, ty] = tiers[i];
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), leafMat);
    cone.position.y = ty;
    cone.castShadow = true;
    g.add(cone);
  }
  parent.add(g);
}

function addCactus(parent, x, z, scale, rotY, cactusMat) {
  const g = new THREE.Group();
  g.position.set(x, getGroundHeight(x, z), z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 3.8, 0.68), cactusMat);
  body.position.y = 1.9;
  body.castShadow = true;
  g.add(body);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), cactusMat);
  armL.position.set(-0.75, 2.35, 0);
  armL.castShadow = true;
  g.add(armL);

  const linkL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.5), cactusMat);
  linkL.position.set(-0.45, 1.85, 0);
  g.add(linkL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.25, 0.5), cactusMat);
  armR.position.set(0.75, 2.65, 0);
  armR.castShadow = true;
  g.add(armR);

  const linkR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.5), cactusMat);
  linkR.position.set(0.45, 2.25, 0);
  g.add(linkR);

  parent.add(g);
}

export function placeLandmarks(scene, config = CONFIG) {
  const lm = config.landmarks;
  const rand = createRng(config.worldSeed + 303);
  const group = new THREE.Group();
  group.name = 'island_landmarks';

  const rockMat = makeMat(0x7c858f);
  const darkRockMat = makeMat(0x4b4750);
  const beachRockMat = makeMat(0x9a8f7c);
  const snowMat = makeMat(0xf2f8ff);
  const mountainMat = makeMat(0x6b7785);
  const ivoryMat = makeMat(0xf0e6c8);
  const palmTrunkMat = makeMat(0x7c5332);
  const palmFrondMat = makeMat(0x4f9a44);
  const lakeLeafMat = makeMat(0x2d7a55);
  const woodMat = makeMat(0x8a5b34);
  const woodDarkMat = makeMat(0x613e22);
  const sailMat = makeMat(0xf4ead2);
  const mesaMat = makeMat(0xc0603c);
  const mesaBandMat = makeMat(0x98472b);
  const cactusMat = makeMat(0x5a8a3a);
  const ruinStoneMat = makeMat(0x575d61);
  const mossRockMat = makeMat(0x4a6a4a);

  const rockGeo = new THREE.DodecahedronGeometry(1, 0);

  // 1. NW Sandy Beach + Giant Fossil Ribcage Arch + 4 Palms + 6 Beach Rocks
  {
    const bx = lm.beach_nw.x;
    const bz = lm.beach_nw.z;
    const by = getGroundHeight(bx, bz);

    const arch = new THREE.Group();
    arch.position.set(bx, by, bz);
    arch.rotation.y = 0.48;

    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 13.5), ivoryMat);
    spine.position.set(0, 6.2, 0);
    spine.castShadow = true;
    arch.add(spine);

    for (let i = 0; i < 6; i++) {
      const zOff = (i - 2.5) * 2.25;
      for (const side of [-1, 1]) {
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.65, 4.3, 0.72), ivoryMat);
        lower.position.set(side * 4.2, 1.9, zOff);
        lower.rotation.z = side * 0.28;
        lower.castShadow = true;
        arch.add(lower);

        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.8, 0.68), ivoryMat);
        upper.position.set(side * 2.2, 5.05, zOff);
        upper.rotation.z = side * 0.92;
        upper.castShadow = true;
        arch.add(upper);
      }
    }
    group.add(arch);

    const palmOffsets = [
      [-12, -8, 1.15, 0.4],
      [11, -10, 1.0, 2.2],
      [-9, 12, 0.95, 4.1],
      [13, 9, 1.2, 5.2],
    ];
    for (let i = 0; i < palmOffsets.length; i++) {
      const [ox, oz, sc, ry] = palmOffsets[i];
      addPalmTree(group, bx + ox, bz + oz, sc, ry, palmTrunkMat, palmFrondMat);
    }

    const beachRockOffsets = [
      [-15, 3, 1.3],
      [-7, -14, 1.0],
      [8, -14, 1.5],
      [15, 1, 1.1],
      [5, 14, 1.4],
      [-12, 14, 0.9],
    ];
    for (let i = 0; i < beachRockOffsets.length; i++) {
      const [ox, oz, sc] = beachRockOffsets[i];
      const m = new THREE.Mesh(rockGeo, beachRockMat);
      m.position.set(bx + ox, getGroundHeight(bx + ox, bz + oz) + sc * 0.25, bz + oz);
      m.rotation.set(rand() * 3, rand() * 3, 0);
      m.scale.set(sc, sc * 0.68, sc * 1.15);
      m.castShadow = true;
      group.add(m);
    }
  }

  // 2. North Lake (-55, -130): small islet rock cluster + 3 shore broadleaf trees
  {
    const lx = lm.lake_n.x;
    const lz = lm.lake_n.z;
    const isletRocks = [
      [0, 0, 1.8],
      [-1.7, 1.1, 1.2],
      [1.5, -1.2, 1.1],
    ];
    for (let i = 0; i < isletRocks.length; i++) {
      const [ox, oz, sc] = isletRocks[i];
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(lx + ox, getGroundHeight(lx + ox, lz + oz) + sc * 0.35, lz + oz);
      m.rotation.set(rand() * 2, rand() * 3, 0);
      m.scale.set(sc, sc * 0.85, sc);
      m.castShadow = true;
      group.add(m);
    }

    const shoreTrees = [
      [lx - 24, lz + 9, 1.15, 0.7],
      [lx + 24, lz + 10, 1.25, 2.3],
      [lx - 6, lz + 26, 1.05, 4.0],
    ];
    for (let i = 0; i < shoreTrees.length; i++) {
      const [tx, tz, sc, ry] = shoreTrees[i];
      addBroadleafTree(group, tx, tz, sc, ry, palmTrunkMat, lakeLeafMat);
    }
  }

  // 3. Snow Mountain Peak (+80, -170): 3 faceted cone peaks (grey -> white cap)
  {
    const mx = lm.mountain.x;
    const mz = lm.mountain.z;
    const peaks = [
      [0, 0, 16, 22, 0.3],
      [-17, 10, 11.5, 16, 1.1],
      [16, 11, 12.5, 17, 2.2],
    ];
    for (let i = 0; i < peaks.length; i++) {
      const [ox, oz, rad, h, ry] = peaks[i];
      const px = mx + ox;
      const pz = mz + oz;
      const baseY = getGroundHeight(px, pz) - 4.5;

      const baseCone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), mountainMat);
      baseCone.position.set(px, baseY + h * 0.5, pz);
      baseCone.rotation.y = ry;
      baseCone.castShadow = true;
      baseCone.receiveShadow = true;
      group.add(baseCone);

      const capH = h * 0.42;
      const capR = rad * 0.44;
      const capCone = new THREE.Mesh(new THREE.ConeGeometry(capR, capH, 6), snowMat);
      capCone.position.set(px, baseY + h - capH * 0.48, pz);
      capCone.rotation.y = ry;
      group.add(capCone);
    }
  }

  // 4. Waterfall (+72, -100): cliff backdrop + animated blue waterfall strip + foam bars
  const waterfallBars = [];
  let waterfallTopY = 10;
  let waterfallBotY = 0;
  {
    const wx = lm.waterfall.x;
    const wz = lm.waterfall.z;
    const cliffY = getGroundHeight(wx + 2, wz - 10);
    waterfallTopY = Math.max(8.5, cliffY - 0.5);
    waterfallBotY = CONFIG.water.level + 0.1;
    const fallH = waterfallTopY - waterfallBotY;

    // Cliff rock shoulders framing the cascade
    const cliffL = new THREE.Mesh(new THREE.BoxGeometry(5.5, fallH + 3, 6), darkRockMat);
    cliffL.position.set(wx - 4.2, waterfallBotY + fallH * 0.5, wz - 4.5);
    cliffL.rotation.y = 0.25;
    cliffL.castShadow = true;
    group.add(cliffL);

    const cliffR = new THREE.Mesh(new THREE.BoxGeometry(5.5, fallH + 3.5, 6), darkRockMat);
    cliffR.position.set(wx + 4.4, waterfallBotY + fallH * 0.5, wz - 4.8);
    cliffR.rotation.y = -0.22;
    cliffR.castShadow = true;
    group.add(cliffR);

    const waterSheetMat = new THREE.MeshBasicMaterial({
      color: 0x4cc7f7,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(5.2, fallH + 0.5), waterSheetMat);
    sheet.position.set(wx, waterfallBotY + fallH * 0.5, wz - 2.3);
    sheet.rotation.x = -0.18;
    group.add(sheet);

    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xeaf8ff,
      transparent: true,
      opacity: 0.85,
    });
    const barGeo = new THREE.BoxGeometry(1.15, 0.75, 0.35);
    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(barGeo, foamMat);
      const laneX = wx + ((i % 3) - 1) * 1.45;
      bar.position.set(laneX, waterfallBotY + (i / 8) * fallH, wz - 2.0);
      group.add(bar);
      waterfallBars.push({
        mesh: bar,
        phase: i / 8,
        x: laneX,
        zTop: wz - 2.9,
        zBot: wz - 1.2,
      });
    }

    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xdcf4ff,
      transparent: true,
      opacity: 0.7,
    });
    const splash = new THREE.Mesh(new THREE.RingGeometry(1.2, 4.4, 10), splashMat);
    splash.rotation.x = -Math.PI / 2;
    splash.position.set(wx, CONFIG.water.level + 0.16, wz - 0.5);
    group.add(splash);
  }

  // 5. Central Cave (-40, -60): keystone rock arch (3 boxes), dark interior, 4 boulders
  {
    const cx = lm.cave.x;
    const cz = lm.cave.z;
    const cy = getGroundHeight(cx, cz);

    const caveGroup = new THREE.Group();
    caveGroup.position.set(cx, cy, cz);
    caveGroup.rotation.y = 0.35;

    const pillarGeo = new THREE.BoxGeometry(3.4, 7.6, 5.4);
    const leftPillar = new THREE.Mesh(pillarGeo, darkRockMat);
    leftPillar.position.set(-4.6, 3.6, 0);
    leftPillar.rotation.z = -0.06;
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    caveGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, darkRockMat);
    rightPillar.position.set(4.6, 3.6, 0);
    rightPillar.rotation.z = 0.06;
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    caveGroup.add(rightPillar);

    const keystone = new THREE.Mesh(new THREE.BoxGeometry(13.2, 3.2, 6.0), darkRockMat);
    keystone.position.set(0, 7.8, 0);
    keystone.castShadow = true;
    keystone.receiveShadow = true;
    caveGroup.add(keystone);

    const darkInterior = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 6.8, 3.2),
      new THREE.MeshBasicMaterial({ color: 0x0b0709 }),
    );
    darkInterior.position.set(0, 3.3, -1.6);
    caveGroup.add(darkInterior);

    const boulderOffsets = [
      [-8.4, 1.4, 2.2],
      [8.5, 1.1, 2.0],
      [-6.5, -4.2, 2.6],
      [6.8, -4.0, 2.4],
    ];
    for (let i = 0; i < boulderOffsets.length; i++) {
      const [ox, oz, sc] = boulderOffsets[i];
      const b = new THREE.Mesh(rockGeo, darkRockMat);
      b.position.set(ox, sc * 0.45, oz);
      b.rotation.set(rand() * 2, rand() * 3, 0);
      b.scale.set(sc, sc * 0.78, sc);
      b.castShadow = true;
      caveGroup.add(b);
    }

    group.add(caveGroup);
  }

  // 6. North & South Wooden Bridges (+30, -20) & (+35, +55) matching terrain bridgeSpecs
  {
    const specs = getBridgeSpecs();
    for (let s = 0; s < specs.length; s++) {
      const b = specs[s];
      const bg = new THREE.Group();
      bg.position.set(b.x, b.deckY, b.z);
      bg.rotation.y = b.angle;

      // Two side beams running along bridge length (local Z)
      const stringerGeo = new THREE.BoxGeometry(0.45, 0.42, b.length + 1.2);
      for (const side of [-1, 1]) {
        const beam = new THREE.Mesh(stringerGeo, woodDarkMat);
        beam.position.set(side * (b.halfWid - 0.55), -0.22, 0);
        beam.castShadow = true;
        bg.add(beam);
      }

      // 7 transverse wooden planks (at least 5 visible chunky planks)
      const plankCount = 7;
      const plankGeo = new THREE.BoxGeometry(b.width, 0.28, (b.length / plankCount) * 0.84);
      for (let i = 0; i < plankCount; i++) {
        const zOff = ((i + 0.5) / plankCount - 0.5) * b.length;
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(0, -0.05, zOff);
        plank.castShadow = true;
        plank.receiveShadow = true;
        bg.add(plank);
      }

      // Rail posts & handrails on both sides
      const postGeo = new THREE.BoxGeometry(0.32, 1.55, 0.32);
      const railGeo = new THREE.BoxGeometry(0.2, 0.2, b.length);
      for (const side of [-1, 1]) {
        const rx = side * (b.halfWid - 0.2);
        for (const pz of [-b.halfLen + 0.5, 0, b.halfLen - 0.5]) {
          const post = new THREE.Mesh(postGeo, woodDarkMat);
          post.position.set(rx, 0.55, pz);
          post.castShadow = true;
          bg.add(post);
        }
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set(rx, 1.12, 0);
        rail.castShadow = true;
        bg.add(rail);
      }

      group.add(bg);
    }
  }

  // 7. East Forest Pond Rim (+115, 0): decorative shore boulders
  {
    const px = lm.forest_e.pondX;
    const pz = lm.forest_e.pondZ;
    const rim = [
      [-10.5, -2, 1.3],
      [9.5, 4.5, 1.4],
      [-3, 10.5, 1.1],
    ];
    for (let i = 0; i < rim.length; i++) {
      const [ox, oz, sc] = rim[i];
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(px + ox, getGroundHeight(px + ox, pz + oz) + sc * 0.25, pz + oz);
      m.rotation.set(rand() * 2, rand() * 3, 0);
      m.scale.set(sc, sc * 0.65, sc);
      m.castShadow = true;
      group.add(m);
    }
  }

  // 8. West Dock (-145, -18): 4 wooden planks + 2 posts + small moored boat
  let boatGroup = null;
  let boatBaseY = CONFIG.water.level + 0.25;
  {
    const dx = lm.dock_w.x;
    const dz = lm.dock_w.z;
    const dockY = Math.max(0.75, getGroundHeight(dx, dz) + 0.15);

    const dock = new THREE.Group();
    dock.position.set(dx, dockY, dz);

    // 4 planks extending westward (-X) into the cove
    const plankGeo = new THREE.BoxGeometry(2.3, 0.26, 3.6);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(plankGeo, woodMat);
      p.position.set(-i * 2.55 - 1.0, 0, 0);
      p.castShadow = true;
      p.receiveShadow = true;
      dock.add(p);
    }

    // Main pier posts at seaward end
    const postGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.6, 5);
    for (const pz of [-1.55, 1.55]) {
      const post = new THREE.Mesh(postGeo, woodDarkMat);
      post.position.set(-9.4, -0.55, pz);
      post.castShadow = true;
      dock.add(post);
    }
    group.add(dock);

    // Small moored wooden boat beside the pier
    boatGroup = new THREE.Group();
    boatBaseY = CONFIG.water.level + 0.22;
    boatGroup.position.set(dx - 9.5, boatBaseY, dz + 4.4);
    boatGroup.rotation.y = 0.28;

    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 2.0), woodDarkMat);
    hull.castShadow = true;
    boatGroup.add(hull);

    const prow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.6, 4), woodMat);
    prow.rotation.z = Math.PI / 2;
    prow.rotation.x = Math.PI / 4;
    prow.position.set(-2.7, 0.05, 0);
    boatGroup.add(prow);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 5), woodMat);
    mast.position.set(0, 2.2, 0);
    mast.castShadow = true;
    boatGroup.add(mast);

    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 2.1), sailMat);
    sail.position.set(-0.35, 2.5, 0);
    sail.rotation.y = 0.2;
    sail.castShadow = true;
    boatGroup.add(sail);

    group.add(boatGroup);
  }

  // 9. Red Mesa Canyon (-105, +85): 4 red mesa pillars (#c0603c) + 6 cacti (#5a8a3a)
  {
    const cx = lm.canyon.x;
    const cz = lm.canyon.z;
    const mesas = [
      [-12, -10, 6.2, 11.5, 5.4, 0.2],
      [11, -8, 7.0, 9.2, 6.0, 0.9],
      [-9, 12, 5.8, 8.0, 5.2, 1.5],
      [13, 11, 7.6, 12.8, 6.4, 2.4],
    ];
    for (let i = 0; i < mesas.length; i++) {
      const [ox, oz, w, h, d, ry] = mesas[i];
      const mx = cx + ox;
      const mz = cz + oz;
      const baseY = getGroundHeight(mx, mz) - 0.6;

      const mg = new THREE.Group();
      mg.position.set(mx, baseY, mz);
      mg.rotation.y = ry;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mesaMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      mg.add(body);

      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.22, d * 1.06), mesaBandMat);
      band.position.y = h * 0.45;
      mg.add(band);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 1.1, d * 0.86), mesaBandMat);
      cap.position.y = h + 0.45;
      cap.castShadow = true;
      mg.add(cap);

      group.add(mg);
    }

    const cactiOffsets = [
      [-2, -14, 1.05, 0.4],
      [-18, 2, 0.9, 1.8],
      [2, 16, 1.15, 2.7],
      [19, -1, 1.0, 3.9],
      [-4, 3, 0.85, 5.1],
      [6, -1, 1.1, 0.9],
    ];
    for (let i = 0; i < cactiOffsets.length; i++) {
      const [ox, oz, sc, ry] = cactiOffsets[i];
      addCactus(group, cx + ox, cz + oz, sc, ry, cactusMat);
    }
  }

  // 10. Swamp Ruins (+110, +100): stone arch (3 dark grey boxes) + 4 mossy boulders + murky water patch
  {
    const sx = lm.swamp_ruins.x;
    const sz = lm.swamp_ruins.z;
    const sy = getGroundHeight(sx, sz);

    const ruins = new THREE.Group();
    ruins.position.set(sx, sy, sz);
    ruins.rotation.y = -0.55;

    const pL = new THREE.Mesh(new THREE.BoxGeometry(1.9, 6.2, 2.0), ruinStoneMat);
    pL.position.set(-3.4, 3.0, 0);
    pL.rotation.z = 0.05;
    pL.castShadow = true;
    ruins.add(pL);

    const pR = new THREE.Mesh(new THREE.BoxGeometry(1.9, 5.8, 2.0), ruinStoneMat);
    pR.position.set(3.4, 2.8, 0);
    pR.rotation.z = -0.08;
    pR.castShadow = true;
    ruins.add(pR);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.65, 2.3), ruinStoneMat);
    lintel.position.set(0, 6.3, 0);
    lintel.rotation.z = -0.04;
    lintel.castShadow = true;
    ruins.add(lintel);

    group.add(ruins);

    const mossOffsets = [
      [-7.2, 4.5, 1.8],
      [7.4, -3.6, 2.1],
      [-5.6, -6.2, 1.5],
      [6.2, 6.8, 1.7],
    ];
    for (let i = 0; i < mossOffsets.length; i++) {
      const [ox, oz, sc] = mossOffsets[i];
      const b = new THREE.Mesh(rockGeo, mossRockMat);
      b.position.set(sx + ox, getGroundHeight(sx + ox, sz + oz) + sc * 0.3, sz + oz);
      b.rotation.set(rand() * 2, rand() * 3, 0);
      b.scale.set(sc, sc * 0.72, sc);
      b.castShadow = true;
      group.add(b);
    }

    const murkyMat = new THREE.MeshLambertMaterial({
      color: 0x2a4d36,
      transparent: true,
      opacity: 0.84,
      flatShading: true,
    });
    const murkyPatch = new THREE.Mesh(new THREE.CircleGeometry(7.2, 10), murkyMat);
    murkyPatch.rotation.x = -Math.PI / 2;
    murkyPatch.position.set(sx + 8.5, getGroundHeight(sx + 8.5, sz + 7.5) + 0.09, sz + 7.5);
    group.add(murkyPatch);
  }

  scene.add(group);

  const fallRange = waterfallTopY - waterfallBotY;

  function update(timeSec) {
    // Animate waterfall foam slats downward with zero allocations
    const speed = 0.55;
    for (let i = 0; i < waterfallBars.length; i++) {
      const item = waterfallBars[i];
      const p = (item.phase + timeSec * speed) % 1;
      item.mesh.position.y = waterfallTopY - p * fallRange;
      item.mesh.position.z = item.zTop + (item.zBot - item.zTop) * p;
    }
    if (boatGroup) {
      boatGroup.position.y = boatBaseY + Math.sin(timeSec * 1.5708) * 0.1;
      boatGroup.rotation.z = Math.sin(timeSec * 1.2) * 0.045;
    }
  }

  return {
    group,
    update,
  };
}
