# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Development

### Desktop (Windows)

```
npm install
npm run tauri dev      # dev, with hot reload
npm run tauri build    # release: produces target/release/bundle/{msi,nsis}
```

### Android release build (containerized)

The Android arm64-v8a release build runs in Docker so the host never needs
the Android SDK/NDK installed. From the repo root:

```
docker compose run --rm android-builder
```

This builds the frontend, compiles the Rust crate for
`aarch64-linux-android`, and assembles a release APK containing only the
`arm64-v8a` native library. The APK lands in `../dist-android/` on the
host, alongside a `.sha256` file. Re-running the same command is
reproducible: the image layers (JDK 17, Android cmdline-tools, platform
36, build-tools 36.0.0, NDK 29.0.14206865, Rust `aarch64-linux-android`
target — all pinned in `docker/android-builder.Dockerfile` to match what
this project's generated `gen/android` build actually declares) are
cached, and Cargo/Gradle/npm caches are kept in named volumes to speed up
repeat builds without touching the host's own `target/`/`node_modules`.

The output APK from this build is **unsigned** (Gradle's default for a
release build with no signing config) — no signing key of any kind lives
in the image, the compose file, or the repo. To install it anywhere
(emulator or device), sign it first with a local, throwaway key — never a
production/Play Store key for this purpose:

```
keytool -genkeypair -keystore /path/to/local.keystore -alias key0 \
  -keyalg RSA -keysize 2048 -validity 3650
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
  --ks /path/to/local.keystore \
  ../dist-android/app-universal-release-unsigned.apk
```

### Android runtime testing (host, not containerized)

Installing, launching, and smoke-testing the APK happens on the host via
`adb` against a real device or emulator — the container never runs an
emulator (no privileged/KVM/nested virtualization):

```
adb install path/to/signed.apk
adb shell am start -n com.ptucompanion.app/.MainActivity
adb logcat
```

Use a device/emulator running Android 10 (API 29) or newer.
