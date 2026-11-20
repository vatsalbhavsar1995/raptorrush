# RAPTOR RUSH — Test Results, Stabilization & QA Gate 01

## Automated tests

Command: `npm test`

Result: **12 passed, 0 failed** (Node `node:test`, 0.13 s).

| Test | Result |
|---|---|
| WASD/arrow input is camera-relative | PASS |
| Berry placement respects bounds and clears trees | PASS |
| Bounded retries reach a clear fallback | PASS |
| Fully obstructed fallback still terminates with a finite point | PASS |
| Initial berry records use numeric instance slots | PASS |
| NPC respawn callback fires once in the same run | PASS |
| Restart/title generation invalidates pending old-run respawns | PASS |
| Queued stale NPC callback is rejected after invalidation | PASS |
| Missing, malformed, non-object, unreadable storage uses defaults | PASS |
| Only allowed integer settings are restored; unknown fields discarded | PASS |
| Difficulty and camera options stay within valid ranges | PASS |
| Easy/Normal/Hard apply 0.7/1/1.3 incoming damage | PASS |

The restart/title scheduler test uses the production scheduler with fake timers and explicitly calls its invalidation method. UI-to-scheduler integration was source-inspected; pending live NPC respawn was not triggered in a browser.

## Build and dependency security

- `npm run build` — **PASS**, Vite 6.4.6, 29 modules.
- Bundle: 563.68 KB minified JS, 145.83 KB gzipped JS. Vite's minified-chunk warning remains; this is under the 500 KB gzip target.
- `npm audit --json` — **0 vulnerabilities** after patching Vite 6.4.1 → 6.4.6.
- `npm audit --omit=dev --json` — **0 vulnerabilities**. The prior high-severity Vite advisory affected the dev server package, which is not in the production bundle.
- `git diff --check` — **PASS**.

## Browser test evidence

Active app tested at `http://127.0.0.1:5173/?debug`.

| Scenario | Observed result |
|---|---|
| New game | Start hunting entered active play; HUD and debug overlay appeared. PASS |
| Restart | Hunt again started a fresh run; timer reset to 0:00. PASS |
| Berry spawning | Debug overlay showed 55 berries; instance slot correctness is covered by automated test. PASS for spawn visibility; live collection not verified. |
| NPC death/respawn | No live NPC kill/respawn completed. NOT TESTED |
| Restart/title with pending live respawn | Scheduler generation/cancellation covered by unit tests. Browser integration NOT TESTED |
| LocalStorage valid settings | Hard/Easy, Far camera, and Follow mode selections persisted over reload. PASS |
| Missing/malformed/out-of-range storage | Loader unit cases pass. Browser storage injection NOT TESTED |
| Camera/difficulty options | Camera distance/mode and difficulty selected in pause UI; valid selections reloaded. PASS. Incoming damage multipliers unit-tested; browser damage comparison NOT TESTED |
| Movement | W input changed nearest berry distance from 19 m to 12 m. PASS for movement response |
| Sprint/bite | Shift+W and Bite button press sent. Distinct sprint effect and successful bite hit/kill not confirmed. PARTIAL |
| Rex/survival | Rex warning shown; unattended runs ended by “Eaten” between 0:14 and 0:20. PARTIAL |
| Boss score 25 and cycle | Score threshold not reached. NOT TESTED |
| Desktop HUD | 1010×835 viewport screenshot; visible and no overlap observed. PASS for layout only |
| Portrait HUD | Exact 390×844 viewport. HUD/canvas/map/touch controls visible; objective moved clear of bite/sprint. PASS for layout |
| Portrait performance | Debug overlay read 60 FPS, about 99 draw calls and 32.4k triangles in the captured frame. One-frame/sample observation, not a sustained performance benchmark. |
| World Phase 01 appearance | Starting-camera view showed low-poly height variation and tree clusters. Full landmark traversal, obstruction and camera orbit checks NOT TESTED |
| Browser console | No warnings or errors returned by the console query. PASS for observed session |

## Failures and limitations

- Initial test run: 8 passed / 1 failed because the test counted one random call per retry although the position sampler requests independent x and z values. The assertion was corrected to count two calls per retry. Final suite: 12/12 passed.
- A real gameplay session repeatedly ended quickly from rex damage when left unattended; this is recorded as observed behavior, not identified as a regression or balance change.
- Berry pickup, real NPC respawn timing, pending timer behavior through actual restart/title UI, boss encounter/cycle, touch joystick operation, and full world navigation remain outstanding.
- Therefore QA Gate 01 is **BLOCKED**, not passed. No World Phase 02 work was started.

## Exact commands

```sh
npm ci
npm run dev
npm test
npm run build
npm audit
npm audit --omit=dev
```
