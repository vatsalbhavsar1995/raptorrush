# RAPTOR RUSH — Living Island, World Phase 01

## Intent

Add broader island elevation and more natural vegetation placement as the first controlled step toward a living island. This phase keeps the existing Three.js terrain mesh, low-poly style, fixed prop populations, instanced rendering, controls, and game systems.

## What changed

- Replaced the small repetitive terrain waves with wider, overlapping elevation contours.
- Added three configurable raised landforms centered on the existing volcanic, swamp, and tundra regions. These create readable terrain landmarks without adding models or geometry batches.
- Concentrated 68% of generated tree placements around weighted biome clusters; the remaining placements retain broad background coverage. The existing tree count and InstancedMesh batches remain in use.

## Files modified

- `src/config.js` — landform and vegetation cluster coordinates/weights/radii.
- `src/world/terrain.js` — multi-scale height function and configurable landform lift.
- `src/world/props.js` — clustered tree placement while keeping current instance batching and total capacity.
- `RAPTOR_RUSH_AUDIT_02.md` — audit and baseline results.
- `RAPTOR_RUSH_WORLD_PHASE_01.md` — this record.

No combat, AI, survival, player movement, difficulty, HUD, dinosaur models, or external dependencies were changed. User-provided reference assets and the standalone HTML were left untouched.

## Verification and performance

- `npm ci`: passed from the existing lockfile after stopping two project Vite processes that had locked Rollup's native binary.
- Baseline `npm run build`: passed.
- Post-change `npm run build`: passed with Vite 6.4.1; 27 modules transformed. Updated JS is 562.58 KB minified / 145.29 KB gzip. The existing non-blocking Vite chunk-size warning remains; gzip is under 500 KB.
- Baseline browser smoke check: title screen opened; Start hunting entered active play and the nearest-berry HUD appeared. This was before the world edit, not a full playthrough.
- Post-change development server smoke check: `/` and the transformed `/src/main.js` both returned HTTP 200.
- No full mobile viewport, multi-minute survival, combat, boss, settings, or post-change visual browser run was completed in this phase.
- Performance impact is bounded: three extra smooth landform evaluations per height query; terrain is sampled when constructing the existing mesh/props and for the camera height. Tree count and draw batching are unchanged, and no new per-frame objects or systems were introduced.

## Known limitations

This is a first terrain/vegetation pass, not a completed island redesign. Coastline shaping, beach transitions, water materials, biome blending, and additional landmark silhouettes are not implemented yet. The square play boundary and current placement rules remain. Vegetation clustering can change local tree obstruction patterns even though population and gameplay values are unchanged.

The clean install reported one high-severity npm advisory and an esbuild install-script approval warning; dependency versions were not changed as part of this world phase.

## Recommended next milestone

World Phase 02: shape a walkable irregular shoreline and coastal transition, add a low-cost ocean surface, and constrain world props/spawns to land while preserving the existing movement feel. Validate at desktop and 390×844 portrait before adding denser landmarks or biome-specific vegetation.
