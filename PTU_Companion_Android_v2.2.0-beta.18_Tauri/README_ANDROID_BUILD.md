# PTU Companion Android v2.2.0-beta.18 — Tauri 2 build

Esta é a build Android canônica. Não use o APK `beta.3-compat` para diagnosticar runtime: ele usa um wrapper Android artesanal criado apenas para isolar o problema de instalação e pode falhar em execução.

## Pré-requisito

- Docker Desktop em execução no Windows.
- Execute os comandos a partir da raiz deste projeto.

## 1. Validar o Compose

```powershell
docker compose config
```

Esse comando deve terminar exibindo a configuração resolvida, sem `additional properties`.

## 2. Verificar a toolchain

```powershell
docker compose run --rm doctor
```

Na primeira execução o Docker precisará montar a imagem com Rust, Tauri CLI, Java, Android SDK 36, Build Tools 36.0.0 e NDK 28.2.

## 3. Gerar o APK ARM64 release

```powershell
docker compose run --rm android-arm64-release-apk
```

Ou:

```powershell
.\scripts\build-android-arm64-release.ps1
```

Saída esperada:

```text
dist/android/PTU-Companion-v2.2.0-beta.18-arm64-release.apk
```

O pipeline executa `zipalign -P 16`, `apksigner sign` e `apksigner verify` antes de concluir.

## Assinatura beta

Esta revisão mantém a chave de teste `android-signing/ptu-beta.keystore` usada pelo APK de compatibilidade. Isso é deliberado para que a primeira build Tauri possa substituir o APK beta já instalado sem conflito de assinatura. **A chave é somente para betas privadas e não deve ser publicada em um repositório público.** Para uma release pública, gere uma keystore de release própria e guarde-a fora do código-fonte.

## Galaxy S25

O S25 usa ARM64, portanto use o arquivo `*-arm64-release.apk`.

O antigo `com.ptu.companion` compatibility APK pode permanecer instalado: esta revisão usa o mesmo certificado beta para permitir atualização. Se o Android ainda rejeitar a atualização, desinstale a compatibility build e instale o APK Tauri limpo.

## Capturar crash do APK Tauri

Se o APK Tauri instalar mas fechar sozinho, conecte o celular por ADB e execute antes de reproduzir o crash:

```powershell
adb logcat -c
adb logcat
```

Depois de o app fechar, interrompa com Ctrl+C e salve as linhas contendo `FATAL EXCEPTION`, `AndroidRuntime`, `com.ptu.companion`, `RustStdoutStderr` ou `chromium`.
