#!/usr/bin/env bash
set -euo pipefail

PROJECT=/app
TAURI_DIR="$PROJECT/src-tauri"
DIST="$PROJECT/dist"
ANDROID_OUT="$DIST/android"
BUILD_TOOLS="$ANDROID_HOME/build-tools/${ANDROID_BUILD_TOOLS:-36.0.0}"
APKSIGNER="$BUILD_TOOLS/apksigner"
AAPT="$BUILD_TOOLS/aapt"
ZIPALIGN="$BUILD_TOOLS/zipalign"
DEBUG_KEYSTORE="${PTU_ANDROID_DEBUG_KEYSTORE:-$PROJECT/android-signing/ptu-beta.keystore}"
DEBUG_KEY_ALIAS="${PTU_ANDROID_DEBUG_KEY_ALIAS:-ptubeta}"
DEBUG_KEYSTORE_PASSWORD="${PTU_ANDROID_DEBUG_KEYSTORE_PASSWORD:-android}"
DEBUG_KEY_PASSWORD="${PTU_ANDROID_DEBUG_KEY_PASSWORD:-android}"

log() {
  printf '\n\033[1;36m==> %s\033[0m\n' "$*"
}

ensure_project() {
  test -f "$PROJECT/src-tauri/Cargo.toml" || {
    echo "Erro: src-tauri/Cargo.toml não encontrado em /app." >&2
    exit 1
  }
  test -f "$PROJECT/src-tauri/tauri.conf.json" || {
    echo "Erro: src-tauri/tauri.conf.json não encontrado em /app." >&2
    exit 1
  }
}

ensure_android_init() {
  ensure_project
  if [ ! -f "$TAURI_DIR/gen/android/gradlew" ]; then
    log "Inicializando projeto Android do Tauri"
    cargo tauri android init
  fi
}

clean_android_dist() {
  mkdir -p "$ANDROID_OUT"
  rm -f "$ANDROID_OUT"/*.apk "$ANDROID_OUT"/*.aab "$ANDROID_OUT"/*.txt "$ANDROID_OUT"/*.sha256 2>/dev/null || true
}

find_debug_apk() {
  find "$TAURI_DIR/gen/android/app/build/outputs" -type f \
    -name '*debug*.apk' ! -name '*androidTest*' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr | head -n 1 | cut -d' ' -f2-
}

find_release_apk() {
  find "$TAURI_DIR/gen/android/app/build/outputs" -type f \
    -name '*release*.apk' ! -name '*androidTest*' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr | head -n 1 | cut -d' ' -f2-
}

verify_apk() {
  local apk="$1"
  test -f "$apk" || { echo "APK não encontrado: $apk" >&2; exit 1; }

  log "Validando assinatura do APK"
  "$APKSIGNER" verify --verbose --print-certs "$apk"

  log "Validando alinhamento ZIP para páginas de 16 KB"
  "$ZIPALIGN" -c -P 16 -v 4 "$apk" >/dev/null
  echo "zipalign: OK (4 KB + páginas de 16 KB para bibliotecas nativas)"

  log "Compatibilidade declarada"
  "$AAPT" dump badging "$apk" | grep -E "^(package:|sdkVersion:|targetSdkVersion:|native-code:)" || true

  sha256sum "$apk" | tee "$apk.sha256"
}

ensure_debug_keystore() {
  mkdir -p "$(dirname "$DEBUG_KEYSTORE")"

  if keytool -list \
      -keystore "$DEBUG_KEYSTORE" \
      -storepass "$DEBUG_KEYSTORE_PASSWORD" \
      -alias "$DEBUG_KEY_ALIAS" >/dev/null 2>&1; then
    return
  fi

  log "Criando chave local persistente para assinar builds instaláveis"
  rm -f "$DEBUG_KEYSTORE"
  keytool -genkeypair -noprompt \
    -keystore "$DEBUG_KEYSTORE" \
    -storepass "$DEBUG_KEYSTORE_PASSWORD" \
    -keypass "$DEBUG_KEY_PASSWORD" \
    -alias "$DEBUG_KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null
}

copy_installable_apk() {
  local source_apk="$1"
  local output="$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-installable.apk"
  cp -f "$source_apk" "$output"
  verify_apk "$output" | tee "$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-installable-info.txt"
  log "APK pronto para instalar"
  echo "$output"
}

build_android_installable_apk() {
  ensure_android_init
  clean_android_dist
  log "Gerando APK DEBUG universal e assinado para instalação direta"
  # Sem --split-per-abi: o Tauri gera o APK universal por padrão.
  # --debug usa a assinatura de debug do Android/Gradle.
  cargo tauri android build --debug --apk

  local apk
  apk="$(find_debug_apk)"
  if [ -z "$apk" ]; then
    echo "Erro: o build terminou, mas nenhum APK debug foi encontrado." >&2
    find "$TAURI_DIR/gen/android/app/build/outputs" -type f -maxdepth 8 -print 2>/dev/null || true
    exit 1
  fi
  copy_installable_apk "$apk"
}

build_android_arm64_apk() {
  ensure_android_init
  clean_android_dist
  log "Gerando APK DEBUG ARM64 e assinado para celulares Android modernos"
  cargo tauri android build --debug --apk --target aarch64

  local apk
  apk="$(find_debug_apk)"
  if [ -z "$apk" ]; then
    echo "Erro: nenhum APK debug ARM64 foi encontrado." >&2
    exit 1
  fi
  local output="$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-arm64.apk"
  cp -f "$apk" "$output"
  verify_apk "$output" | tee "$ANDROID_OUT/PTU-Level-Simulator-installable-arm64-info.txt"
  log "APK ARM64 pronto: $output"
}

build_android_arm64_release_apk() {
  ensure_android_init
  clean_android_dist
  ensure_debug_keystore

  log "Gerando APK RELEASE otimizado somente para ARM64 (aarch64 / arm64-v8a)"
  CARGO_PROFILE_RELEASE_OPT_LEVEL=z \
  CARGO_PROFILE_RELEASE_LTO=thin \
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1 \
  CARGO_PROFILE_RELEASE_PANIC=abort \
  CARGO_PROFILE_RELEASE_STRIP=symbols \
  CARGO_PROFILE_RELEASE_INCREMENTAL=false \
    cargo tauri android build --apk --target aarch64

  local source_apk
  source_apk="$(find_release_apk)"
  if [ -z "$source_apk" ]; then
    echo "Erro: o build terminou, mas nenhum APK release ARM64 foi encontrado." >&2
    find "$TAURI_DIR/gen/android/app/build/outputs" -type f -maxdepth 8 -print 2>/dev/null || true
    exit 1
  fi

  local aligned_apk="$ANDROID_OUT/.PTU-Companion-v2.2.0-beta.19-arm64-release-aligned.apk"
  local output="$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-arm64-release.apk"

  log "Aplicando zipalign com suporte a páginas de memória de 16 KB"
  "$ZIPALIGN" -P 16 -f -v 4 "$source_apk" "$aligned_apk" >/dev/null

  log "Assinando APK release com a chave local persistente do ambiente Docker"
  "$APKSIGNER" sign \
    --ks "$DEBUG_KEYSTORE" \
    --ks-key-alias "$DEBUG_KEY_ALIAS" \
    --ks-pass "pass:$DEBUG_KEYSTORE_PASSWORD" \
    --key-pass "pass:$DEBUG_KEY_PASSWORD" \
    --out "$output" \
    "$aligned_apk"

  rm -f "$aligned_apk"

  verify_apk "$output" | tee "$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-arm64-release-info.txt"

  if ! "$AAPT" dump badging "$output" | grep -q "native-code: 'arm64-v8a'"; then
    echo "Erro: o APK final não declarou exclusivamente a ABI arm64-v8a." >&2
    exit 1
  fi

  log "APK ARM64 release pronto para instalação"
  echo "$output"
}

build_android_release_apk() {
  ensure_android_init
  log "Gerando APK RELEASE"
  cargo tauri android build --apk
  local apk
  apk="$(find_release_apk)"
  if [ -n "$apk" ]; then
    mkdir -p "$ANDROID_OUT"
    cp -f "$apk" "$ANDROID_OUT/$(basename "$apk")"
    if "$APKSIGNER" verify "$apk" >/dev/null 2>&1; then
      log "APK release possui assinatura válida."
    else
      echo "AVISO: APK release NÃO está assinado para instalação/distribuição." >&2
      echo "Use 'android-installable-apk' para instalar no celular ou configure uma keystore de release." >&2
    fi
  fi
}

build_android_aab() {
  ensure_android_init
  log "Gerando AAB Android"
  cargo tauri android build --aab
  mkdir -p "$ANDROID_OUT"
  find "$TAURI_DIR/gen/android/app/build/outputs" -type f -name '*.aab' -print0 2>/dev/null \
    | while IFS= read -r -d '' f; do cp -f "$f" "$ANDROID_OUT/$(basename "$f")"; done
  find "$ANDROID_OUT" -maxdepth 1 -type f -name '*.aab' -printf '%f\n' || true
}

inspect_apk() {
  local apk="${2:-$ANDROID_OUT/PTU-Companion-v2.2.0-beta.19-installable.apk}"
  verify_apk "$apk"
}

copy_windows_artifacts() {
  mkdir -p "$DIST/windows"
  if [ -f "$TAURI_DIR/target/x86_64-pc-windows-msvc/release/ptu-companion.exe" ]; then
    cp -f "$TAURI_DIR/target/x86_64-pc-windows-msvc/release/ptu-companion.exe" \
      "$DIST/windows/PTU-Companion.exe"
  fi
  find "$TAURI_DIR/target/x86_64-pc-windows-msvc/release/bundle/nsis" \
    -maxdepth 1 -type f -name '*.exe' -print0 2>/dev/null \
    | while IFS= read -r -d '' f; do cp -f "$f" "$DIST/windows/$(basename "$f")"; done
}

run_doctor() {
  ensure_project
  log "Versões do ambiente"
  printf 'Rust:        '; rustc --version
  printf 'Cargo:       '; cargo --version
  printf 'Tauri CLI:   '; cargo tauri --version
  printf 'cargo-xwin:  '; cargo xwin --version || true
  printf 'Java:        '; java -version 2>&1 | head -n 1
  printf 'sdkmanager:  '; sdkmanager --version | head -n 1
  printf 'NDK_HOME:    %s\n' "${NDK_HOME:-}"
  printf 'apksigner:   '; "$APKSIGNER" version
  printf 'NSIS:        '; makensis -VERSION
  log "Targets Rust instalados"
  rustup target list --installed
}

build_windows_exe() {
  ensure_project
  log "Gerando Windows x64 + instalador NSIS por cross-compilation"
  cargo tauri build --bundles nsis --runner cargo-xwin --target x86_64-pc-windows-msvc
  copy_windows_artifacts
  find "$DIST/windows" -maxdepth 1 -type f -name '*.exe' -printf '%f\n' || true
}

case "${1:-doctor}" in
  doctor)
    run_doctor
    ;;
  android-init)
    ensure_android_init
    ;;
  android-installable-apk|android-debug-apk)
    build_android_installable_apk
    ;;
  android-arm64-apk)
    build_android_arm64_apk
    ;;
  android-arm64-release-apk)
    build_android_arm64_release_apk
    ;;
  android-apk)
    build_android_release_apk
    ;;
  android-aab)
    build_android_aab
    ;;
  android-apk-info)
    inspect_apk "$@"
    ;;
  windows-exe)
    build_windows_exe
    ;;
  all)
    build_windows_exe
    build_android_installable_apk
    build_android_aab
    ;;
  shell)
    exec bash
    ;;
  *)
    exec "$@"
    ;;
esac
