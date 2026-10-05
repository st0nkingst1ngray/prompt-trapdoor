#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Optional: HARNESS_JOB=<id> npm run android:apk  → status flips apk_building → apk_ready / failed
# so the player (playing on web meanwhile) sees the APK progress in the harness strip.
if [[ -n "${HARNESS_JOB:-}" ]]; then
  node scripts/harness.mjs set "$HARNESS_JOB" apk_building --note "Gradle assembleDebug running — keep playing on web"
  trap 'node scripts/harness.mjs set "$HARNESS_JOB" failed --note "APK build failed — see Grok Bot log" || true' ERR
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  if [[ -x /usr/lib/jvm/java-21-openjdk-amd64/bin/java ]]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
  fi
fi
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${PATH}"
npm run cap:sync
cd android
./gradlew assembleDebug --no-daemon
cd ..
if [[ -n "${HARNESS_JOB:-}" ]]; then
  node scripts/harness.mjs set "$HARNESS_JOB" apk_ready --note "android/app/build/outputs/apk/debug/app-debug.apk" --result app-debug.apk
fi
