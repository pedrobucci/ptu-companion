FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
ARG TAURI_CLI_VERSION=2.11.4
ARG ANDROID_CMDLINE_TOOLS_VERSION=15859902
ARG ANDROID_API=36
ARG ANDROID_BUILD_TOOLS=36.0.0
ARG ANDROID_NDK_VERSION=28.2.13676358

ENV CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    XWIN_CACHE_DIR=/xwin-cache \
    ANDROID_NDK_VERSION=${ANDROID_NDK_VERSION} \
    ANDROID_BUILD_TOOLS=${ANDROID_BUILD_TOOLS}

ENV NDK_HOME=${ANDROID_HOME}/ndk/${ANDROID_NDK_VERSION}
ENV PATH=${CARGO_HOME}/bin:${JAVA_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      wget \
      unzip \
      zip \
      git \
      file \
      build-essential \
      pkg-config \
      libssl-dev \
      clang \
      llvm \
      lld \
      nsis \
      openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# Rust + targets necessários para Android e para cross-build do Windows MSVC.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup target add \
      aarch64-linux-android \
      armv7-linux-androideabi \
      i686-linux-android \
      x86_64-linux-android \
      x86_64-pc-windows-msvc

# CLI oficial do Tauri e cargo-xwin, recomendado pela documentação do Tauri
# para gerar instaladores NSIS Windows a partir de Linux/macOS.
RUN cargo install tauri-cli --version "${TAURI_CLI_VERSION}" --locked \
    && cargo install cargo-xwin --locked

# Android Command-line Tools oficiais do Google.
RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" /tmp/android-tools \
    && wget -q \
      "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" \
      -O /tmp/android-tools.zip \
    && unzip -q /tmp/android-tools.zip -d /tmp/android-tools \
    && mv /tmp/android-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest" \
    && rm -rf /tmp/android-tools /tmp/android-tools.zip \
    && yes | sdkmanager --licenses >/dev/null || true

# Instala um conjunto moderno e compatível com Google Play. Se o Gradle pedir
# outro pacote de SDK, ele poderá baixá-lo automaticamente porque as licenças
# já foram aceitas.
RUN sdkmanager \
      "platform-tools" \
      "platforms;android-${ANDROID_API}" \
      "build-tools;${ANDROID_BUILD_TOOLS}" \
      "ndk;${ANDROID_NDK_VERSION}"

WORKDIR /app

COPY docker/tauri-build.sh /usr/local/bin/ptu-build
RUN chmod +x /usr/local/bin/ptu-build \
    && mkdir -p /xwin-cache

ENTRYPOINT ["ptu-build"]
CMD ["doctor"]
