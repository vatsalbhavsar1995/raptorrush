# Raptor Rush

A low-poly dinosaur survival game that runs in the browser. Stage 1 ports the existing prototype into a Vite and vanilla JavaScript project while keeping its current gameplay.

## Run it

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To build and preview the production version:

```sh
npm run build
npm run preview
```

Run the automated regression checks with:

```sh
npm test
```

## Controls

- **WASD / arrow keys:** move relative to the camera
- **Shift:** sprint
- **Space:** bite
- **Esc / P:** pause or resume
- **Mouse drag:** orbit the camera
- **Q / E:** rotate the camera
- **Mouse wheel:** zoom
- **Touch:** left half moves, right half looks; use Sprint and Bite buttons

Pause settings include shadows, quality, minimap, screen shake, difficulty, camera distance, and camera mode. They are saved in `localStorage` under `rr_set`.

Append `?debug` to the URL to show FPS, draw calls, triangles, and entity counts.

## Folder map

- `index.html` — page shell and HUD elements
- `src/main.js` — game boot, state, simulation loop, and scene orchestration
- `src/config.js` — gameplay and rendering constants
- `src/data/` — dinosaur, food, zone, and boss data tables
- `src/world/` — terrain height, zone selection, and instanced props
- `src/entities/` — player, enemy, NPC, boss, and pickup builders
- `src/systems/` — input, camera, combat, and spawn helpers
- `src/ui/` — HUD, minimap, menu, pause settings, and styles
- `README.md` — this guide
- `ASSETS.md` — asset source and licence ledger

Three.js is pinned in `package.json`. The Google Fonts stylesheet link is retained from the prototype; the game makes no other runtime network requests.
