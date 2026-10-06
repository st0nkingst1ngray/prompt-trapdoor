# Android debug APK

Hunter Association wrapped with Capacitor: Prompt Trapdoor, Token Heist, AKCP, and BashMissions. The WebView loads the Vite `dist/` build, including `bashmissions/curriculum.json`, so grading stays in the WebView with just-bash. Progress stays in `bash-missions-save-v1` (WebView local storage). GitHub Pages still uses base `/prompt-trapdoor/` via `npm run build`. The mobile build sets `CAPACITOR=1` so Vite emits relative `./` asset URLs.

On a phone browser, the BashMissions goal banner (Goal / Constraints / Attempt / Next action) stays open at the top of a level. Scrolling down into the briefing, checks, or editor collapses it upward. Scrolling back up opens it again. The activity uses `adjustResize` so the script field stays above the keyboard.

- Package: `io.github.st0nkingst1ngray.prompttrapdoor`
- App name: Hunter Association
- Version: `0.1.0` (versionCode 1, from the Capacitor Android project)

## Toolchain on this box

These are not in the repo. Install once:

- JDK 21 for Gradle. Capacitor Android 7.6 compiles its library as Java 21 (`invalid source release: 21` on JDK 17). Debian package `openjdk-21-jdk-headless` at `/usr/lib/jvm/java-21-openjdk-amd64`. Temurin 17 is also at `/opt/jdk-17` but is not enough for this wrap.
- Android SDK at `/opt/android-sdk` (`ANDROID_HOME`): cmdline-tools, platform-tools, `platforms;android-35`, build-tools 35 (Gradle also pulls build-tools 34 if the Android Gradle Plugin asks).

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

`android/local.properties` points Gradle at the SDK. That file is gitignored.

No emulator was installed. Instrumented UI tests were not run. Unit tests plus APK zip/`aapt` checks are the functional gate.

## Rebuild the debug APK

From the repo root:

```bash
npm install
npm run android:apk
```

Output:

`android/app/build/outputs/apk/debug/app-debug.apk`

Harness: `HARNESS_JOB=<job id> npm run android:apk` flips that job to `apk_building`, then `apk_ready` (or `failed`), so the player sees progress in the hub while playing on web. See `docs/HARNESS.md`.

`android:apk` (`scripts/android-apk.sh`) sets `JAVA_HOME` to JDK 21 if it is unset, then runs `build:android` (relative base), `cap sync`, and `./gradlew assembleDebug`.

## Install

With a device or emulator and `adb` on `PATH` (platform-tools):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Tests

```bash
npm test          # vitest: E/D/C gates, unlocks, gate UI DOM, harness queue + CLI, hub boot
npm run test:web  # pages build keeps /prompt-trapdoor/; android build uses ./assets/
npm run test:apk  # APK exists, valid zip, package name via aapt
```

`npm test` does not need the Android SDK. `test:apk` needs a debug APK already built.
