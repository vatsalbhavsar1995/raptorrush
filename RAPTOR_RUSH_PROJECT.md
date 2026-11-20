# Raptor Rush: Project Brief and Handoff

Low-poly dinosaur survival game for the browser. Open island, eat, bite, grow, survive. Later: pick your dino, evolve, then .io multiplayer.

**Playable build:** https://claude.ai/artifact/1AoJbiModTM1oEaN6iyTev (single HTML file, Three.js r128)
**Status:** prototype. Step B (open world) is built but not playtested. Steps A, C, D are not started.

---

## 1. Vision

- Roam one believable island, no levels. Hunt, flee, bite, eat.
- Eating gives lasting benefits (evolution feel, like "Cell to Singularity: Evolution" / "Dino World").
- Each player picks a dino with its own stats and playstyle.
- Looks like a clean low-poly game (flat colors, soft light, chunky HUD). Reference: the isometric island image supplied (section 7).
- Runs on a phone browser at 60 fps, loads fast, no install.
- Much later: higher-detail pixel look, then real-player .io mode.

## 2. Current build

### Systems that exist
| System | State |
|---|---|
| Terrain | 240 x 240 flat-shaded heightmap from sine functions, one ground color |
| Zones | 4 (Jungle centre, Swamp NW, Volcano NE, Tundra S). Only sky, fog, light and tree color change |
| Player | One raptor (blocky low-poly), walk 10, sprint 16, stamina, bite (Space / button) |
| Food | 55 berries with amber beacon beams; compies (+24 hunger); Triceratops (+45 hunger) |
| Enemies | 4 roaming T. rexes; Triceratops charge; boss every 25 score, cycles 4 bosses |
| Camera | Orbit (drag / Q,E / wheel), Near-Mid-Far setting, Free or Follow mode |
| HUD | Health, Hunger, Stamina bars, score, coins, minimap (rotates with camera), boss bar, toast, pause |
| Settings | Shadows, Quality, Minimap, Shake, Difficulty, Camera distance, Camera mode (saved in localStorage) |

### Key numbers (current)
- World half-size `HS=120`. Population: `POP_REX=4`, `POP_COMPY=12`, `POP_TRIKE=5`, `BERRY_COUNT=55`, `BOSS_EVERY=25`.
- Hunger drain 3/s (+2.5 sprinting). Berry +16 hunger, compy +24, trike +45.
- Stamina drain 36/s sprinting, regen 22/s. Bite cooldown 0.55 s, damage 10.
- T. rex: chase speed 13, detects at 34, chases 7 s then rests 4 s, bite 30 damage. Trike charge 20 damage. Bosses 60 to 90 HP.
- Controls: WASD / arrows move (camera-relative), Shift sprint, Space bite, Esc or P pause. Touch: left half joystick, right half look, Sprint and Bite buttons.

### Known issues / dead code (fix first)
1. **Difficulty setting does nothing** (the damage multiplier was removed in the Step B rewrite).
2. **Coins and the upgrade shop are dead code.** Coins are earned and shown but never spent. Remove, or replace with the Step C system.
3. Ground color is the same in every zone; zone change at the halfway line is abrupt.
4. Terrain is sine waves, so hills look repetitive. No water, rivers or cliffs.
5. Camera on very steep terrain was only lightly guarded (clamped above ground).
6. Not playtested on a real phone. Touch layout, button overlap and frame rate are unverified.
7. Single 700-line HTML file. Hard to extend (see section 11).

## 3. Roadmap

Each step is independent enough to do in one session. Do them in this order.

### Step A: Dino picker
- Character select screen before spawn: 6 dinos (section 4), rotating 3D preview, stat bars.
- Selection persists in localStorage.
- **Done when:** each dino has a distinct model, stats and one active ability; picking changes gameplay.

### Step B: Open world (BUILT, needs playtest and cleanup)
- Levels, goals and shop removed. Population respawns. Boss trigger by score.
- **Cleanup:** remove dead code (known issues 1 and 2).

### Step C: Eating benefits + Cell-to-Singularity style HUD
- Replace coins/shop with the evolution system (section 5).
- Restyle HUD per section 8.
- **Done when:** eating different foods visibly changes the dino (stats and size), the HUD shows an evolution meter, and there are no coins.

### Step D: Richer world
- Rebuild terrain from the reference island (section 7): beach, lake, mountain, river, cave, forest, canyon, swamp ruins.
- Biomes blend smoothly; day/night cycle; landmarks; animals spawn by biome.
- **Done when:** someone seeing a screenshot would call it a place, not a flat field with trees.

### Step E: Assets (can run in parallel with C and D)
- Replace primitive-box models with proper low-poly models (section 9).

### Step F (later): Camera polish, pixel-detail view
- Pinch zoom on touch, collision-aware camera, optional higher-detail look (a pixel or "HD-2D" look: low-res render target upscaled with crisp edges, outline shader, more detailed models).

### Step G (much later): .io multiplayer
- See section 12.

## 4. Dino roster (for Step A)

Start with 6. Stats are relative to the current raptor (1.0 = current).

| Dino | Role | Speed | Health | Bite | Special (active) | Notes |
|---|---|---|---|---|---|---|
| Velociraptor | Fast hunter | 1.0 | 1.0 | 1.0 | Pounce (short dash + bite) | Current model; default |
| Triceratops | Tank | 0.8 | 1.6 | 0.8 | Charge (ram, knockback) | Horns hit things in front |
| Stegosaurus | Defender | 0.7 | 1.4 | 0.7 | Tail whip (360 degree hit) | Plates reduce damage from behind |
| Spinosaurus | Swimmer | 0.9 | 1.2 | 1.2 | Swim and river lunge | Strong near water (needs rivers, Step D) |
| Ankylosaurus | Armor | 0.65 | 1.3 | 0.6 | Tail club (stun) | Takes 30% less damage |
| T. rex | Heavy hitter | 0.85 | 1.5 | 1.6 | Roar (scares small dinos) | Unlock later or hard-mode pick |

Later: Pteranodon (glide), Allosaurus, Carnotaurus, Parasaurolophus. Pteranodon needs flight and camera work, so keep it for after Step F.

Each dino is a JSON entry plus a model builder function. No dino-specific logic in the main loop.

## 5. Eating benefits (evolution) system

No levels, no coins. Eating fills an **Evolution** meter and applies small permanent buffs for the current life.

| Food | Hunger | Evolution | Permanent benefit for this life |
|---|---|---|---|
| Berries | +16 | +1 | Stamina regen +1% each (cap) |
| Compies | +24 | +2 | Speed +1% each (cap) |
| Triceratops / large herbivores | +45 | +6 | Max health +3% each, body size +1% |
| Fish / river food (Step D) | +20 | +3 | Swim speed |
| Eggs / nests (Step D) | +30 | +5 | Bite damage +2% |
| Boss kill | +60 | +25 | Evolve stage (+size, new colour/part, ability upgrade) |

- Evolve stages 1 to 5 at fixed evolution thresholds; each stage grows the model about 12% and unlocks a visible part (spikes, bigger jaw).
- Death resets the life (optionally keep a "best stage" record).
- Keep all values in one data table so they can be tuned without code changes.
- Enemy logic stays as is (see section 6).

## 6. Enemy logic (keep)

| Enemy | Behaviour |
|---|---|
| Compy | Wanders; flees when player is within 16; speed 11 |
| Triceratops | Wanders; charges at 13 range for 2.8 s at speed 15, then rests 3 s |
| T. rex | Patrols; chases at 34 range for 7 s then rests 4 s; trees block it |
| Boss | Always chases; rests after hitting; special per boss (lunge, stomp, chill) |

Rules to keep: every enemy has a rest window the player can exploit, no unavoidable damage, and respawns are far from the player.

## 7. World and map

### 7.1 Reference island (supplied image)
Isometric low-poly island. Layout, with approximate world coordinates for a 240 x 240 world (x east, z south, centre 0,0):

| Landmark | Image position | World (x, z) |
|---|---|---|
| NW sandy beach with giant ribcage fossil arch and palms | top-left | (-82, -64) |
| Northern lake with small islet | top-centre | (-34, -78) |
| Snow mountain range | top-right | (48, -103) |
| Waterfall and river source | right of centre-top | (45, -61) |
| Central cave in rock outcrop (boss lair) | centre | (-25, -36) |
| River with two wooden bridges | centre to south | from (45,-61) to (23, 56) |
| East dense forest, small pond | right | (74, -20), pond (69, 0) |
| West docks | left | (-85, -11) |
| Red mesa canyon with cacti | bottom-left | (-63, 50) |
| Swamp with ruined stone arch | bottom-right | (65, 61) |
| Dirt paths linking all landmarks | whole island | generate from landmarks |

### 7.2 Mapping to existing game content
| Existing zone | New home | Boss (rename to fit) |
|---|---|---|
| Jungle | Central grass and east forest | Alpha Rex in the cave |
| Swamp | SE swamp and ruins | Spinosaur (water edge) |
| Volcano | SW red mesa canyon | Magma Rex (can become "Canyon Rex") |
| Tundra | NE snow mountain | Frost Tyrant |
| (new) | NW beach and fossil arch | none; safe, good for compies and eggs |
| (new) | Lake, river, waterfall | fish, Spinosaur swim |

### 7.3 What makes a map believable
1. **Coherent geography.** The river starts at the mountain waterfall and flows downhill to the sea. Lakes sit in low ground. Cliffs wrap the coast.
2. **Soft biome edges.** Blend colors, tree types and ground over 15 to 25 units instead of a hard line. Decide biome from height, moisture and temperature, not from a circle.
3. **Landmarks you can see from far away.** Mountain, ribcage arch, ruins and cave must be visible from the spawn area so the player can navigate by sight and the minimap marks them.
4. **Paths and bridges.** Dirt paths between landmarks make it feel lived-in and guide movement. Wooden bridges cross the river.
5. **Island shape and shoreline.** Irregular coastline from radial noise, shallow turquoise water ring, white foam line, sand band, then grass. Deep ocean beyond.
6. **Ecology logic.** Herbivores near water and grass, predators near the cave and forest, fish in water, eggs in nests near beach and ruins.
7. **Scale and density.** Player about 3.5 units long, trees 6 to 10 tall, rocks varied. Cluster props (Poisson disc plus biome density), never uniform random.
8. **Light and atmosphere.** Warm sun, soft fog by biome, gentle day/night. Water gets a simple animated flat-colour shader.

### 7.4 Generation pipeline
1. Island mask: radial falloff with simplex noise on the edge.
2. Height: fractal noise (3 to 4 octaves) plus authored bumps (mountain peak at NE, bowl for the lake).
3. Water: sea level plane; lake as a carved bowl; river as a carved path along the downhill line from the waterfall.
4. Biome weights: from height, moisture and temperature, then smooth blend for ground color.
5. Landmarks: place authored props at the coordinates above.
6. Paths: A* between landmarks over terrain, painted as a dirt-colored vertex band.
7. Props: Poisson-disc scatter per biome rules (trees, rocks, cacti, palms, ferns).
8. Spawn tables per biome for dinos, berries, eggs.
9. Bake everything with a fixed seed so the map is identical every run (needed for multiplayer later).

### 7.5 Size
Increase world to about 400 x 400 once terrain is chunked or merged. Keep travel across the island about 40 to 60 seconds at sprint.

## 8. HUD

### 8.1 Style comparison (browser considerations)
| Option | Look | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Minimal flat bars | Thin bars, small text | Fast to build, least clutter | Feels like a prototype | No |
| B. **Chunky flat card HUD** | Rounded or angled cards, thick outlines, bold flat colors, big icons, big numbers | Matches low-poly art, readable on phones, easy in CSS, best "Cell to Singularity" feel | Needs icon set | **Recommended** |
| C. Detailed sci-fi / realistic | Textures, glow, small text | Looks "AAA" in screenshots | Unreadable on mobile, heavy, fights the low-poly style | No |

**Pick B.** Build it in **DOM + CSS**, not drawn in the canvas: crisp text at any DPI, easy touch handling, tiny cost, and native accessibility. Draw only the minimap in a canvas.

### 8.2 Design tokens
| Token | Value |
|---|---|
| Ink (dark) | `#1a0f0c` |
| Bone (text) | `#fff1dc` |
| Amber (primary) | `#ffb23e` |
| Moss (stamina / good) | `#a6e05a` |
| Ember (danger) | `#ff5a3c` |
| Health pink | `#ff7a8a` |
| Water blue | `#3fb4e8` |
| Display font | Bowlby One (fallback Impact) |
| UI font | Barlow Condensed 600 |
| Card | 12 to 16 px radius or 12 px angled clip, 3 px outline, soft drop shadow |
| Min touch target | 44 x 44 px; main action buttons 76 to 88 px |

### 8.3 Layout (portrait phone)
```
+--------------------------------------------+
| [HP ]  [HUNGER]           [ZONE  score]    |
| [STAM]                    [minimap]        |
| [EVOLUTION  stage 2  ====-----]   [pause]  |
|                                            |
|                (game view)                 |
|                                            |
|  (joystick)                 (Bite) (Sprint)|
|           [ nearest food 22 m ]            |
+--------------------------------------------+
```
- Evolution meter is the hero element (wide, bottom or top-centre), with the stage number and a bounce when it fills.
- Show only what changes decisions: health, hunger, stamina, evolution, minimap, boss bar when active.

### 8.4 Rules
- Every number readable at 360 px width; contrast at least 4.5:1.
- Respect safe-area insets (notches, home bar).
- Never put HUD over the joystick or action zones.
- Icons as inline SVG (heart, drumstick, bolt, DNA, skull for boss). No bitmap fonts.
- Animate sparingly (CSS transitions only); respect `prefers-reduced-motion`.
- Toasts for events (boss, evolve, zone entered), one at a time.

## 9. Assets

### 9.1 Strategy
1. **Now:** primitive builders (boxes, cones). Fine for a prototype.
2. **Step E:** proper low-poly models as `.glb`, one material per model using a shared colour palette (vertex colours or one 256 x 256 palette texture). No big textures.
3. Keep models stylised and chunky, so they match the reference island.

### 9.2 Pipeline
- Source: Blender (own models), or CC0 packs (Kenney, Quaternius) for trees, rocks, props; AI-generated concepts are fine as reference, then model in Blender.
- Export glTF binary (`.glb`), compressed with meshopt or Draco, via `gltf-transform`.
- Animations (idle, walk, run, bite, hit, die) baked into the glb; blend in code.
- Place all assets in `/assets/models`, `/assets/ui` (SVG), `/assets/audio`.

### 9.3 Asset list and budgets
| Asset | Triangles (max) | Notes |
|---|---|---|
| Player dino (each of 6) | 1,500 | Rigged, 5 evolve variants via scale and parts |
| T. rex enemy | 1,800 | Reuse rig |
| Boss variants (4) | 2,000 | Tint plus extra parts |
| Compy, Triceratops | 600 / 1,200 | Rigged |
| Trees (pine, broadleaf, palm, dead) | 150 to 300 | Instanced |
| Rocks (3 sizes), cactus, ferns | 50 to 200 | Instanced |
| Landmarks: ribcage arch, ruins, cave, bridge, dock | 800 to 2,500 | Hand-placed |
| Berries, eggs, fish | under 100 | Instanced |
| Ground and water | n/a | Generated meshes |
| HUD icons | n/a | SVG |
| Audio: footsteps, bite, roar, eat, ambience (per biome) | n/a | 44 kHz mono OGG, under 150 KB each |

Total scene budget: under 150k triangles on screen, under 150 draw calls.

### 9.4 Naming
`dino_raptor.glb`, `dino_trex.glb`, `prop_tree_pine_a.glb`, `landmark_cave.glb`, `ui_icon_heart.svg`, `sfx_bite_01.ogg`. Lowercase, underscores, no spaces.

### 9.5 Licensing
Track every external asset in `ASSETS.md` (source, author, licence). Only CC0 or licensed-for-commercial assets if the game may ever be monetised.

## 10. Technical architecture and performance

### Targets
- 60 fps on a mid-range phone; 30 fps minimum on low-end.
- First load under 3 s on 4G; JS under 500 KB gzipped; assets lazy-loaded after the title screen.
- No localStorage dependency for correctness (settings only).

### Techniques
- `InstancedMesh` for trees, rocks, berries (one draw call each).
- Merge static geometry per chunk; frustum culling; chunk streaming if the world grows past 400 x 400.
- Share geometries and materials; avoid per-frame allocations (no `new` in the update loop).
- Cap pixel ratio at 2 (Quality setting already does this); shadows only from the sun, short range.
- Fixed-timestep simulation (e.g. 30 Hz logic, interpolate rendering). Required for multiplayer later.
- Seeded RNG for world generation (done: `rng(seed)`); keep gameplay RNG separate.

## 11. Agent handoff (Codex / Claude Code)

### When to move to an agent
Move **before Step C or D**. The single HTML file is at its limit. A repo-capable agent can refactor, run the game, and test.

### Target repo layout
```
raptor-rush/
  index.html
  package.json            (vite, three)
  src/
    main.js               boot, loop
    config.js             constants
    data/
      dinos.json          roster and stats
      foods.json          food table (section 5)
      zones.json          biomes
      bosses.json
    world/
      terrain.js  biomes.js  water.js  paths.js  props.js  landmarks.js
    entities/
      player.js  enemy.js  npc.js  boss.js  pickups.js
    systems/
      input.js  camera.js  combat.js  evolution.js  spawn.js  audio.js
    ui/
      hud.js  minimap.js  menu.js  pause.js  picker.js  styles.css
  assets/ (models, ui, audio)
  ASSETS.md  README.md
```

### Ordered tasks for the agent
1. Port the current prototype to the layout above with identical behaviour. Acceptance: same gameplay, no console errors, 60 fps desktop.
2. Fix known issues 1 and 2 (section 2); remove coin and shop dead code.
3. Move all numbers into `config.js` and the JSON data files.
4. Step A (dino picker), then Step C (evolution and HUD), then Step D (world).
5. Replace primitives with glb assets (Step E) as they are produced.
6. Add a simple perf overlay (fps, draw calls, triangles) behind a `?debug` URL flag.

### Rules for the agent
- Stay in plain Three.js; no heavy frameworks. Use modern Three (r16x+), not r128.
- No external network calls at runtime other than the CDN or font links already used.
- Do not break mobile touch controls; test at 390 x 844.
- One feature per commit; keep the game playable after each commit.
- **If the game is integrated into vatsal.lol, do not modify that site's shared CSS or JS scaffolding.** Keep the game self-contained in its own folder.

## 12. Later: multiplayer (.io)

- Needs a server. A single artifact page cannot host it. Use Node + WebSocket (e.g. `ws` or Colyseus) on his own hosting.
- Server-authoritative simulation at 20 to 30 Hz; clients send inputs, server sends snapshots; client-side prediction and interpolation.
- Requires: fixed timestep, deterministic world from a seed, data-driven dinos (done in Step A/C), and cheap models.
- Start small: one room, 8 to 16 players, bots fill the world's dinos. Add matchmaking later.
- Anti-cheat basics: server owns health, hunger, position validation.

## 13. Decisions already made (change only if needed)
- Low-poly flat-shaded look, DOM-based chunky HUD.
- No levels; zones on one island; boss every 25 score.
- Enemy AI stays as is.
- Eating gives benefits; coins and shop go away.
- Agent handoff happens before Step C.
- Pixel-detail look and .io multiplayer come last.
