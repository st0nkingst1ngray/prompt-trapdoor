# Pre-APK test report

Date: 2026-10-05. Tree under test: the box tarball (current game), which is ahead of GitHub `main`. Gradle `assembleDebug` was not run. No release signing.

**Verdict: GO** for a debug APK bake, using `npm run android:apk` (or `npm run cap:sync` and then `assembleDebug`). That path runs `build:android`, which emits relative `./assets/` URLs. A Pages `npm run build` copied into the WebView requests `/prompt-trapdoor/assets/…` and the screen stays blank.

## Commands

| Command | Result |
| --- | --- |
| `npm install` | exit 0. 149 packages added. |
| `npm test` | exit 0. **13 files, 170 passed, 0 failed** (2.50s). |
| `npm run build` | exit 0. `tsc` + Vite. Pages base `/prompt-trapdoor/`. |
| `node scripts/web-base-smoke.mjs pages` | exit 0. `dist/index.html` references `/prompt-trapdoor/assets/index-qJXnm7Nh.js` and `index-BqGrWUM1.css`. |
| `npm run build:android` | exit 0. `CAPACITOR=1 vite build`. |
| `node scripts/web-base-smoke.mjs android` | exit 0. `dist/index.html` references `./assets/index-B8b_lpdt.js` and `./assets/index-BqGrWUM1.css`. |
| `npm run android:apk` / Gradle | **not run** (this pass stops before the APK). |
| `npm run test:apk` | **not run** (no APK on disk). |

`npm test` counts after this pass:

| File | Tests |
| --- | ---: |
| `tests/knowledgePossession.test.ts` | 30 |
| `tests/unlockLadder.test.ts` | 3 |
| `tests/harness.test.ts` | 14 |
| `tests/dgates.test.ts` | 21 |
| `tests/cgates.test.ts` | 18 |
| `tests/bgates.test.ts` | 17 |
| `tests/agates.test.ts` | 19 |
| `tests/sgates.test.ts` | 19 |
| `tests/gateUi.test.ts` | 7 |
| `tests/hub.test.ts` | 4 |
| `tests/hunter.test.ts` | 5 |
| `tests/trapdoor.test.ts` | 7 |
| `tests/tokenHeist.test.ts` | 6 |
| **Total** | **170** |

35 of those assertions are new in this pass (30 knowledge, 3 unlock ladder, 2 harness side moves). The other 135 were already in the box tree and passed unchanged.

`npm audit` reports 2 moderate findings, both in `vitest` / `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, test-runner path traversal, fixed in vitest ≥ 4.1.11). They are devDependencies. They are not bundled into `dist/` or the APK.

## Coverage

### Trapdoor and Token Heist

`tests/trapdoor.test.ts` covers empty input, banned-word boundaries, a banned word that still leaks, a level-1 win, a miss, the word budget, and format-wrapped secrets. `tests/tokenHeist.test.ts` covers tile join, the CAT budget, a corrupted message, the PASSWORD smuggle, spaces inside tiles, and the space glyph. Hunter XP from those clears is in `tests/hunter.test.ts` (40 XP = D from both level 1s; five Trapdoor clears reach C).

### Hunter hub

`tests/hub.test.ts` boots `main.ts` for a Shadow hunter at C, B, A, and S. Each rank section lists that class’s door first, leaves siblings disabled, and opens the door into `#dgate`. The C boot also checks the harness strip. Rank A and Rank S boots check that `.know-strip` is on the opened stage.

### Rank D / C / B / A / S gates

Win and fail cases live in `tests/dgates.test.ts`, `tests/cgates.test.ts`, `tests/bgates.test.ts`, `tests/agates.test.ts`, and `tests/sgates.test.ts`. Door maps match `LEVELS.md`:

| Rank | Shadow | Barrier | Necrotech | Guild | Opens when |
| --- | --- | --- | --- | --- | --- |
| D | shadow | barrier | necrotech | guild | class picked |
| C | runaway | ward | casino | croupier | own D-gate cleared and 100 XP |
| B | margin | shelf | pin | near | own C door cleared and 160 XP |
| A | clap | mirror | forgot | salt | own B door cleared and 220 XP |
| S | whisper | pair | ten | keyring | own A door cleared and 280 XP |

XP steps are +20 per first stage clear. Three stages on a door move the hunter to the next band (100 → 160 → 220 → 280). 340 XP stays rank S (`nextAt` 340, `xpUntilNext(340) === 0`). There is no National rank yet.

`tests/unlockLadder.test.ts` separates the two locks. A save with B-rank XP (160) and no C-door clears keeps Margin shut (`C door`). A save with the C door cleared and 159 XP keeps it shut (`B-rank`); 160 XP opens it. The same one-point edges are checked for A (219/220) and S (279/280), including a B door missing its third stage at 220 XP. Guild (159 vs 160 into Near) and Necrotech (219 into Forgot, 280 into Ten) use the same rules. Siblings stay shut until the own door is complete, including at 340 XP.

### Knowledge possession

Rank A and Rank S are 24 select stages. Each calls `withKnowledge`. Pattern-matching the puzzle is a fail when the defense chip is missing, wrong, or passed as a raw option id without the `know:` prefix. The correct chip keeps a real puzzle win and does not turn a puzzle loss into a win.

Before this pass, several stages only asserted the happy path plus a wrong puzzle (Copied Voice, Long Bow, Canary Bonus, Only the Attack, Body Double, Scratch, The Draft Is Fine). A forgotten `withKnowledge` on those stages would still have been green. `tests/knowledgePossession.test.ts` now runs all 24 stages through bare puzzle, wrong chip, unprefixed correct id, and prefixed correct id. The Clap Trap DOM test runs the winning reply with no Know-it chip and checks that XP stays 0 and the stage is not cleared; adding `know:status` then pays +20. Picking the defense first still leaves the puzzle slot (`2/2` on Clap Trap).

### Harness queue

`TRANSITIONS` in `src/harness/buildQueue.ts` and `scripts/harness.mjs` are the same table (`tests/harness.test.ts`). Covered moves:

| From | To |
| --- | --- |
| inventing | building, failed |
| building | web_ready, failed |
| web_ready | apk_building, building (another pass), failed |
| apk_building | apk_ready, failed |
| apk_ready | building (next iteration) |
| failed | inventing, building |

The new tests walk `web_ready → building`, `web_ready → failed`, `apk_building → failed`, and `apk_ready → building` on both the game queue and the CLI, and they reject `failed → apk_ready`, `apk_building → web_ready`, and `apk_ready → inventing`. The hub strip DOM test still covers prompt → inventing → handoff → pill, then pill removal at `web_ready`.

`mergeRemote` still trusts a newer status file and does not re-check `TRANSITIONS`. That matches the box being the source of truth. A hand-edited `harness-status.json` can skip states.

## Gaps left on purpose

- No device, emulator, or `aapt` check. `npm run test:apk` needs an APK this pass did not build.
- Rank B has logic tests and a hub boot test. It has no click-through DOM test. Rank A/S DOM coverage is the hub boot plus the Clap Trap Know-it strip, not all eight doors.
- Demo difficulty is intentional (`LEVELS.md`, `registry.ts`). Inter-rank bridges are not hardened. A debug APK will feel easier than a later production pass.
- `normalizeForApk` rewrites a baked `apk_building` job to `apk_ready` without moving `updatedAt`. A fresh WebView (empty `localStorage`) stores that as `apk_ready`. A WebView that already saved the same timestamp as `apk_building` keeps `apk_building`, because merge ignores a remote update that is not newer.

## Capacitor WebView risks

1. **Asset base.** `npm run build` keeps `/prompt-trapdoor/`. `npm run build:android` uses `./`. `scripts/android-apk.sh` calls `cap:sync`, which calls `build:android`. Bake with that script. Syncing a Pages `dist/` produces a blank WebView.
2. **Baked harness file.** With `HARNESS_JOB` set, the script writes `apk_building` before `cap sync`, then `apk_ready` after Gradle. The APK therefore contains `apk_building`. `normalizeForApk` is what the installed app uses to show `apk_ready`. The timestamp caveat above applies on upgrade installs that already stored that job.
3. **Storage is per WebView.** Hunter XP, gate clears, and the harness queue live in `localStorage`. The phone will not see progress from the browser session.
4. **No model calls.** The WebView loads local assets. `INTERNET` is in the manifest (Capacitor default). `allowMixedContent` is false. The harness poll reads the baked `harness-status.json` on the same origin. Nothing in this tree sends a prompt to an API.
5. **Backup.** `android:allowBackup="true"`. Progress in `localStorage` can be included in Android backup. There are no API keys in the save.
6. **Toolchain for the bake (not exercised here).** `ANDROID.md` requires JDK 21 (`invalid source release: 21` on JDK 17) and Android SDK 35. `android/app/build.gradle` has a `release` build type and no `signingConfig`. This pass did not create or use a release keystore. The bake Grok Bot runs should stay `assembleDebug`.

## Go / no-go

**GO** for the debug APK.

Unit and DOM tests are green (170/170). Both Vite builds are green, and the Android build’s asset URLs are relative. Remaining items are the Gradle bake itself, a device install, and the known harness timestamp edge on an upgrade install. None of those block starting `assembleDebug`.
