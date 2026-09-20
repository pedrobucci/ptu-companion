# PTU Companion Android v2.2.0-beta.20 — Tauri 2 build

Esta é a build Android canônica. Não use o APK `beta.3-compat` para diagnosticar runtime: ele usa um wrapper Android artesanal criado apenas para isolar o problema de instalação e pode falhar em execução.

## Pré-requisito

- Docker Desktop em execução no Windows.
- Execute os comandos a partir da raiz deste projeto.

Se a imagem Docker já existia antes desta atualização, execute `docker compose build` para incorporar o script beta.20. Para reutilizar a toolchain instalada com o script do checkout atual, use `docker compose run --rm --entrypoint bash android-arm64-release-apk /app/docker/tauri-build.sh android-arm64-release-apk`.

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
dist/android/PTU-Companion-v2.2.0-beta.20-arm64-release.apk
```

O pipeline executa `zipalign -P 16`, `apksigner sign` e `apksigner verify` antes de concluir.

## Assinatura beta

O pipeline reutiliza `android-signing/ptu-beta.keystore` quando ela existe; em um checkout novo, gera uma chave beta local. Uma chave nova não permite atualizar por cima de um APK assinado com outra chave. Para preservar a atualização de uma instalação anterior, configure a chave original por `PTU_ANDROID_DEBUG_KEYSTORE` no ambiente de build. **Não publique chaves no Git.** Para uma release pública, use uma keystore de release própria, guardada fora do código-fonte.

## Galaxy S25

O S25 usa ARM64, portanto use o arquivo `*-arm64-release.apk`.

O antigo `com.ptu.companion` compatibility APK pode permanecer instalado: a atualização exige o mesmo certificado beta. Se o Android ainda rejeitar a atualização, desinstale a compatibility build e instale o APK Tauri limpo.

## Capturar crash do APK Tauri

Se o APK Tauri instalar mas fechar sozinho, conecte o celular por ADB e execute antes de reproduzir o crash:

```powershell
adb logcat -c
adb logcat
```

Depois de o app fechar, interrompa com Ctrl+C e salve as linhas contendo `FATAL EXCEPTION`, `AndroidRuntime`, `com.ptu.companion`, `RustStdoutStderr` ou `chromium`.

## Pokédex offline (beta.20)

Os sprites já estão em `www/pokemon-sprites/` e entram no APK pelo `frontendDist`. A instalação e o primeiro uso não precisam de internet para essas imagens. A ordem é retrato do pack, sprite local pelo ID exato e `creatures/default.svg`. Não há fallback de rede para espécies.

Para regenerar os arquivos, execute `node scripts/prepare-pokemon-sprites.mjs` com internet. As revisões de origem são fixadas no script; confira os aliases e entradas sem sprite antes de atualizar as revisões. Não é uma etapa necessária de build. Consulte `www/pokemon-sprites/README.md` para cobertura e origem.

Execute `npm run verify` para toda a suíte, incluindo `scripts/verify-beta20-pokedex-artwork-mobile.mjs`.
