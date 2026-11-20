# RAPTOR RUSH — Stabilization & QA Gate 01

## Gate decision: BLOCKED

The three confirmed code defects were fixed and are covered by automated tests. The available browser checks verified startup/restart, settings persistence, movement response, survival death, desktop/mobile HUD layout, 60 FPS, and a clean console. The gate remains **BLOCKED** because the required live NPC kill/respawn sequence, berry collection, bite hit, and 25-score boss encounter were not completed in the browser. Their code paths were inspected and relevant pure logic was unit-tested where practical, but that is not equivalent to the requested gameplay evidence.

## Inspection before edits

Read `RAPTOR_RUSH_AUDIT_02.md`, `RAPTOR_RUSH_WORLD_PHASE_01.md`, the current active Vite source, package metadata/lockfile, and Git history. Before this gate, commits `af733ed` and earlier did not alter any of the three confirmed bug paths. The separate `raptor-rush-3d.html` remains the legacy prototype; all QA below used the Vite `index.html` entrypoint.

The inspection also found an additional berry initialization defect: `Array.from({length}, newBerry)` passes the destination array as the mapper's second argument, while `newBerry` interprets that argument as an InstancedMesh slot. The Vite setup now explicitly passes a numeric slot.

## Fixes made

1. **Berry placement:** capped random placement at 48 trials. If those fail, a fixed 24×24 world-grid search returns the first clear location; if no clear location exists, it returns the point with best measured tree clearance. Every path terminates. The initial berry array now passes each numeric instance slot explicitly.
2. **NPC respawns:** added a generation-based scheduler that cancels pending timers and rejects callbacks from invalidated generations. New game, restart, title setup, and death invalidate the old run's timers. Pausing leaves the active run's timer generation intact.
3. **Saved settings:** added defaults and allowed choice ranges for all seven settings. Missing, malformed, unreadable, wrong-type, out-of-range, fractional, and unknown fields cannot override defaults. Difficulty damage still maps to the existing 0.7/1/1.3 multipliers.
4. **Demonstrated mobile issue:** at 390 px width, the objective text overlapped the bite hit area. A narrow-screen-only CSS rule moves the objective above touch buttons. No other responsive styling was changed.
5. **Dependency advisory:** patched Vite from 6.4.1 to 6.4.6 and updated the lockfile. npm's audit identified Vite as the high-severity package; Vite is a development dependency, absent from the production runtime bundle. The recommended patched version removed the finding without a major upgrade.
6. Added a Node built-in test command and focused unit coverage. Updated README with `npm test`.

## Files changed

- `src/entities/pickups.js`
- `src/main.js`
- `src/systems/settings.js` (new)
- `src/systems/respawns.js` (new)
- `src/systems/combat.js`
- `src/ui/styles.css`
- `package.json`, `package-lock.json`
- `tests/pickups.test.js`, `tests/respawns.test.js`, `tests/settings.test.js`, `tests/input.test.js` (new)
- `README.md`
- `RAPTOR_RUSH_QA_PHASE_01.md`, `RAPTOR_RUSH_TEST_RESULTS.md` (new)

World Phase 01 code and its prior report were not changed. World Phase 02 was not started. Untracked user reference images and the standalone prototype were preserved.

## Automated verification

- `npm test`: **12 passed, 0 failed**. Coverage includes bounded berry placement and clear fallback, impossible-clearance termination, InstancedMesh numeric slot assignment, same-run NPC respawn and invalidation across restart/title generations, settings validation/defaulting, camera/difficulty value bounds, configured incoming-damage scaling, and camera-relative WASD/arrow axes.
- `npm run build`: **passed** with Vite 6.4.6; 29 modules transformed. Output JS: 563.68 KB minified, 145.83 KB gzip. Vite emits its non-blocking warning because the minified JS chunk exceeds 500 KB; gzip remains below the project's 500 KB target.
- `npm audit --json`: **0 vulnerabilities** after the Vite update.
- `npm audit --omit=dev --json`: **0 vulnerabilities**; the previous Vite advisory was development-only.
- `git diff --check`: passed.

## Browser observations

Tested the Vite app from `http://127.0.0.1:5173/?debug`.

- Title screen loaded; Start hunting entered play. Hunt again restarted a run and reset the timer to 0:00.
- After a browser reload, selected Easy, Far camera distance, and Follow camera mode were still selected. Hard was also selected during the settings interaction. This verifies settings UI persistence for valid data; malformed storage was verified by unit tests, not by browser storage injection.
- A W input changed the nearest-berry readout from 19 m to 12 m. A Shift+W chord and Bite button press were sent during active play; no hit, stamina change, or berry pickup was established from those actions.
- Survival/AI observation: the active run showed a nearby rex warning and ended with “Eaten” at 0:14–0:20 in unattended runs. This confirms a visible rex threat and death/restart flow; it is not a full AI or survival balance test.
- Debug overlay reported 60 FPS on the 390×844 portrait viewport, around 99 draw calls and 32.4k triangles in the captured active frame. Desktop viewport was 1010×835 with no observed HUD overlap.
- At exactly 390×844, canvas filled the viewport; vitals and score remained separated; the minimap and touch buttons were visible. After the CSS adjustment, objective bounds ended at x≈265/y≈714, bite began at y≈728, and sprint occupied x≈286–372; objective and controls no longer overlapped. The objective, vitals, minimap, and labels were readable in the screenshot.
- The starting-camera screenshot showed the raised low-poly terrain and clustered trees. Further island traversal, landmark-specific inspection, collision/obstruction testing, camera orbit/zoom, and joystick movement were not completed.
- Browser console query returned an empty list for warnings and errors during the checks.

## Outstanding QA before passing the gate

- Kill an NPC in live gameplay, observe its delayed respawn, then restart and return to title while a respawn is pending and verify no NPC leaks into the next session. Unit tests cover scheduler cancellation/generation races; live integration is still outstanding.
- Collect a berry in live play and verify hunger/score changes and respawn placement visually.
- Verify a bite hits/kills an NPC and exercise Sprint and touch joystick/button hold in a live run.
- Reach score 25, verify the boss name/health/behavior, defeat it, and verify the next boss cycle.
- Traverse each landmark/biome at desktop and portrait, inspect navigation/tree obstruction and camera behavior.
- Exercise malformed localStorage in a browser context. The pure loader tests pass for malformed/missing values, but actual storage corruption was not injected through the browser UI.

Gate 01 stays **BLOCKED** until the outstanding live checks are performed and documented. Do not start World Phase 02 before then.
