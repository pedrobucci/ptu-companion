#!/usr/bin/env bash
# Runs inside the android-builder container (see android-builder.Dockerfile).
# Builds the arm64-v8a release APK and copies it to the bind-mounted
# dist-android/ directory on the host, with its SHA-256 recorded alongside.
set -euo pipefail

cd /workspace/app
npm ci
npx tauri android init --ci
npx tauri android build --target aarch64 --apk --ci

apk=$(find src-tauri/gen/android -type f -name "*.apk" -path "*release*" | head -n1)
if [ -z "$apk" ]; then
  echo "No release APK found under src-tauri/gen/android" >&2
  exit 1
fi

mkdir -p /workspace/dist-android
out="/workspace/dist-android/$(basename "$apk")"
cp "$apk" "$out"
sha256sum "$out" | tee "$out.sha256"
ls -l "$out"
