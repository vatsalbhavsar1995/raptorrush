# RAPTOR RUSH — Audit 02

## Scope and method

Inspected the current Vite source, package metadata, active `index.html` entry point, standalone `raptor-rush-3d.html`, README, ASSETS, project brief, and Git status/history. The requested `RAPTOR_RUSH_IMPROVEMENT_LOG.md` is absent, so Stabilization Pass 01 claims could not be cross-checked against a report. Findings below come from the current source.

## Findings

| Area | Status | Evidence / impact |
|---|---|---|
| Berry placement and fallback | Bug remains | `src/entities/pickups.js` retries forever until it finds a location outside all tree radii. No attempt cap or fallback exists; pathological/crowded arrangements can hang setup or a berry pickup. Berry instances are otherwise reused. |
| NPC respawn tokens | Bug remains | `src/main.js` schedules `setTimeout(() => addNpc(...))` on kills and has no run/session generation token or timer cancellation. A respawn scheduled in one run can add an NPC after title/restart or into a later run. |
| Saved settings validation | Bug remains | `src/main.js` merges arbitrary parsed localStorage fields into settings. It does not validate option indices or booleans. Invalid `view` can set camera distance to `undefined`; invalid `diff` can yield undefined damage multipliers. |
| Mobile HUD | Partial | CSS uses safe-area insets and 76/86 px touch buttons, but there are no responsive media rules. Fixed vitals, score/map/pause positions, objective text, and touch controls can crowd or overlap at narrow/short viewports. No fresh 390×844 check was performed during this source-only audit. |
| Accessibility | Partial | Native buttons and visible keyboard focus exist; Pause has an accessible name. Bite and Sprint lack accessible names, HUD bars lack labels/semantics, canvas has no accessible description, and dynamic status feedback is not exposed as a live region. Keyboard controls exist in source. |
| Gameplay and AI | Present | The active source retains player movement, hunger/health/stamina, berries, compies, charging trikes, roaming rex AI, boss threshold/cycle, bite combat, pause/settings, touch input, and camera controls. No evidence in this pass of changed combat/AI code. Existing gameplay balance is configured in `src/config.js` and JSON data. |
| Active app vs standalone HTML | Important distinction | Vite serves `index.html`, which imports `/src/main.js` and Three.js from npm. `raptor-rush-3d.html` is a separate standalone legacy prototype; it still contains old coin/shop code and is not the active app. Opening it directly does not exercise the Vite implementation. |
| World baseline | Limited world presentation | `src/world/terrain.js` is a small sinusoidal height function over a square plane. There is no water or shoreline, biome selection snaps to nearest zone center, and tree/rock placement is mostly uniform over the square. No environmental landmarks are present. |

## Stabilization assessment

- Correctly implemented: current Vite project structure and module split; Three.js is pinned; instanced tree/rock/berry geometry; debug overlay is gated by `?debug`; settings are persisted; standard keyboard/touch controls and gameplay systems remain.
- Partially implemented: responsive/mobile support, accessibility, settings persistence, and baseline performance documentation. Persistence works for valid values but untrusted values are not normalized.
- Still broken: unbounded berry placement retry; stale NPC respawn callbacks; malformed settings can corrupt runtime values.
- Already resolved in current history/source: berry spawning uses `CONFIG.world.halfSize` (commit `f719dfe`); biome lookup receives zone data (commit `21be2a4`); recent 60 Hz updates are restored (commit `d7b447b`). These fixes do not address the remaining issues above.
- Regressions attributable to Stabilization Pass 01: cannot establish without the missing improvement log or prior source snapshot. No unsupported regression claim is made.

## Repository and baseline notes

Initial Git status showed tracked files clean on `master`; user-provided image/reference files and `raptor-rush-3d.html` are untracked. They are preserved. `npm ci` first failed because two project Vite processes held the Rollup native binary open. After stopping those two servers, `npm ci` succeeded from the existing lockfile (15 packages installed). The clean install reported one high severity npm advisory and an esbuild install-script approval warning.

Baseline `npm run build`: **passed** with Vite 6.4.1; 27 modules transformed. Output: 561.89 KB minified JS / 144.98 KB gzip. Vite prints a non-blocking 500 KB minified-chunk warning; gzip remains below the project's 500 KB target. Started the Vite app in the in-app browser, confirmed the Raptor Rush title screen and clicked **Start hunting**; the game entered active play and showed the nearest-berry HUD. This was a short startup smoke check, not a full multi-minute survival/boss/settings run. No 390×844 viewport test was possible through the available browser viewport controls during this pass.
