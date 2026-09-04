# Reproducible Android (arm64-v8a) release build for PTU Companion.
# Versions are pinned to what this project's generated Tauri Android
# project actually declares/needs, not chosen arbitrarily:
#   - JDK 17 matches the Temurin 17 already required by Tauri's Android
#     tooling and used for local development.
#   - Android Platform 36 / Build-Tools 36.0.0 match
#     app/src-tauri/gen/android/app/build.gradle.kts (compileSdk/targetSdk = 36).
#   - NDK 29.0.14206865 matches the NDK Tauri's own `android init` selected
#     and pinned for this project on the reference host.
#   - Gradle/AGP are NOT installed here — the project's own Gradle wrapper
#     (gradle-wrapper.properties) fetches the exact pinned Gradle version.
FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    ANDROID_PLATFORM=36 \
    ANDROID_BUILD_TOOLS=36.0.0 \
    NDK_VERSION=29.0.14206865 \
    NODE_MAJOR=20

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates unzip git build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/opt/cargo/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup target add aarch64-linux-android

RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
    && curl -fsSL -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip \
    && unzip -q /tmp/cmdline-tools.zip -d /tmp/extracted \
    && mv /tmp/extracted/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest" \
    && rm -rf /tmp/cmdline-tools.zip /tmp/extracted \
    && yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null \
    && sdkmanager --sdk_root="$ANDROID_HOME" \
         "platform-tools" \
         "platforms;android-${ANDROID_PLATFORM}" \
         "build-tools;${ANDROID_BUILD_TOOLS}" \
         "ndk;${NDK_VERSION}"

ENV NDK_HOME=/opt/android-sdk/ndk/29.0.14206865

WORKDIR /workspace/app
ENTRYPOINT ["bash", "/workspace/docker/android-build.sh"]
