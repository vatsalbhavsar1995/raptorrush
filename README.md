# Raptor Rush

A low-poly dinosaur survival game for the browser built with Vite, vanilla JavaScript (ES modules), and Three.js (`0.187.0`). Stage 1 ported the prototype into a modular, data-driven architecture; Stage 2 added a 6-dinosaur picker with distinct low-poly models, stat multipliers, and active abilities; Stage 3 added evolution-by-eating with visual stage growth and a chunky flat-card HUD; Stage 4 replaces the prototype terrain with a deterministic 400×400 low-poly island featuring 12 landmarks, smooth 5-biome blending, biome ecology, collectible eggs, and a 4-minute day/night cycle.

## How to run

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (defaults to `http://localhost:3000`). Append `?debug` to the URL to show the performance and entity-count overlay (`FPS`, draw calls, triangles, entity counts).

## Build and test

```sh
npm run build
npm run preview
npm test
```

Production builds output to `dist/` using relative asset paths (`base: './'`) so the game stays self-contained when deployed inside a subfolder.

## Controls

- **Dino Picker:** click any of the 6 dinosaur tabs, click **← / →**, press **Left / Right arrow keys**, or swipe the 3D preview; click **Start as …** or press **Enter** to jump in (saved in `localStorage` under `rr_dino`)
- **WASD / Arrow keys:** move relative to the camera
- **Shift:** sprint
- **Space:** bite
- **Q:** trigger your dinosaur's active ability (Pounce, Charge, Tail Whip, Lunge, Club Slam, or Roar)
- **Esc / P:** pause or resume (includes **Change dino**)
- **Mouse drag / E:** orbit the camera
- **Mouse wheel:** zoom camera distance
- **Touch:** drag left half for movement joystick, drag right half to look around, use **Sprint**, **Bite**, and **Ability** buttons

Pause settings (Shadows, Quality, Minimap, Screen shake, Difficulty, Camera distance, Camera mode) persist in `localStorage` under `rr_set`. Difficulty scales incoming damage (`Easy: 0.7×`, `Normal: 1.0×`, `Hard: 1.3×`) and stacks with each dinosaur's armor stat. Eating berries, eggs, compies, Triceratops, and bosses fills the Evolution meter (Stages 0–5: Hatchling → Legend), stacking capped stat buffs, growing your dino +12% per stage, tinting your model toward its accent color at Stage 3+, and adding a Legend glow at Stage 5. Nighttime tightens fog, shifts lighting to moonlight, and increases hunger drain by `1.3×`.

## Folder map

```text
index.html                  Page shell, Dino Picker dashboard, and chunky flat-card HUD markup
vite.config.js              Vite build and dev server config (port 3000)
src/
  main.js                   Boot, 30 Hz fixed-timestep simulation, interpolated render loop
  config.js                 Gameplay, evolution, ability, world, landmarks, water, day/night, and HUD constants
  data/
    dinos.json              6 playable dinosaurs (stats, abilities, colors, scale)
    foods.json              Food table (berry, compy, trike, egg, fish, boss) with evolution buffs
    zones.json              Five island biomes (Jungle, Swamp, Red Canyon, Tundra, Fossil Beach)
    bosses.json             Four cycling boss definitions and abilities
  world/
    index.js                Island world coordinator (terrain, water, landmarks, props)
    terrain.js              Seeded Perlin 400×400 island heightmap, river spline, bridges, walkability, animated water
    landmarks.js            12 handcrafted low-poly landmarks (mountain, waterfall, cave, bridges, fossil arch, dock, canyon, ruins)
    biomes.js               Continuous 5-biome vertex blending and 5-second atmospheric lerp
    props.js                Seeded Poisson-disc biome props (broadleaf, pine, dead swamp, palm, rocks, ferns)
  entities/
    models.js               Unified buildDinoModel() low-poly builder with material tracking
    player.js               Dino selection, stat/evolution scaling, stage visuals, and 6 abilities
    enemy.js                T. rex low-poly model wrapper
    npc.js                  Compy and Triceratops model builders + kill evolution hook
    boss.js                 Boss variant builder and stomp shockwave ring
    pickups.js              Biome-aware InstancedMesh berries and 8 collectible eggs near cave & fossil beach
  systems/
    input.js                Keyboard, mouse, and mobile touch joystick/button input
    camera.js               Orbit/follow camera with walk-surface clamping and shake
    combat.js               Bite cone, 360° area damage, food collection, difficulty × armor scaling
    evolution.js            Evolution meter, capped food buffs, stage thresholds, and reset
    environment.js          4-minute Dawn/Day/Dusk/Night cycle, sun arc, moonlight, and night hunger multiplier
    spawn.js                Biome-aware dry-land spawners and Central Cave boss spawning
  ui/
    hud.js                  Chunky vitals + SVG icons, evolution hero bar, boss skull, time-of-day, ?debug overlay
    minimap.js              2D canvas minimap rotating with camera yaw, zone tint, and landmark icons
    menu.js                 Integrated start-page Dino Selection dashboard with isolated 3D preview
    pause.js                Pause overlay (including Change dino) and localStorage settings
    styles.css              Chunky flat HUD, Dino Picker dashboard, and mobile (390x844/428x926) layout
test/
  stage1.test.js            Automated unit tests for Stages 1–4 (data, models, abilities, evolution, island world, ecology, day/night)
ASSETS.md                   External asset source and licence table
README.md                   Project guide
```
