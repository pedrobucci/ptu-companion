# Handoff — Release de teste após Stage A.7

## Estado publicado

- Repositório: `pedrobucci/ptu-companion`
- PR integrado: `#6`
- Commit fonte em `main`: `7f5afff3eeda1ed307186065df536d8ea14a398a`
- Tag: `release-2.1.0-beta.20-2.2.0-beta.22`
- Release: `PTU Companion Test — Windows 2.1.0-beta.20 / Android 2.2.0-beta.22`
- URL: `https://github.com/pedrobucci/ptu-companion/releases/tag/release-2.1.0-beta.20-2.2.0-beta.22`
- Tipo: prerelease/teste

A tag foi criada apontando para o commit exato de `main` acima. Os workflows auxiliares posteriores permanecem apenas na branch de release e não alteram o commit fonte dos binários.

## Versões

- Windows: `2.1.0-beta.20`
- Android ARM64: `2.2.0-beta.22`
- Android `versionCode`: `2002022`

## Escopo funcional incluído

O Release contém o estado do projeto até a conclusão da Stage A.7:

1. correção de Hisuian Zorua/Zoroark para `Normal / Ghost` nos defaults de campanha;
2. Naturewalk com múltiplos terrenos;
3. remoção do controle legado Notifications;
4. exclusão de Trainer;
5. Trainer Notes;
6. Pokémon Notes;
7. edição de Roster;
8. exclusão de Roster sem excluir Pokémon.

**Stage A.8 não está incluída e ainda não foi iniciada neste checkpoint.**

## Artefatos principais

### Windows

`PTU-Companion-Windows-v2.1.0-beta.20.exe`

SHA-256:

`368f57e0cf8484546c7ea2d12af43178b4ef1c926d3196c8eabd81df0346d54a`

### Android ARM64

`PTU-Companion-v2.2.0-beta.22-arm64-release.apk`

SHA-256:

`1d0a875356c2bdbbbcf9e9b4642a152f4ca199dbf52fc1f646d0ad4e49252850`

O Release também contém `SHA256SUMS.txt`, arquivos `.sha256` individuais, build-info, `BUILD_SOURCE.txt`, `ANDROID_SIGNING_CERT.txt` e `ANDROID_SIGNING_CONTINUITY.txt`.

## Validação

### Preparação antes do merge

GitHub Actions `35818380420` — **success**.

- metadata de Windows `2.1.0-beta.20` validada;
- metadata de Android `2.2.0-beta.22` / `versionCode 2002022` validada;
- `npm run verify` completo de Windows — success;
- `npm run verify` completo de Android — success.

### Build Android

Run `35818570958`:

- checkout do commit fonte exato — success;
- regressões Android — success;
- build ARM64 assinado — success;
- artefato Android e metadata — success.

O job Windows desse primeiro workflow de build encontrou `EBUSY` ao tentar remover um SQLite temporário aberto durante a limpeza de `verify_beta_v210.mjs` no runner Windows. Uma segunda tentativa apresentou o mesmo comportamento. O erro ocorreu na remoção do arquivo temporário `ptu_definitions.sqlite3`, não em uma asserção de regra/aplicação. Por isso ele foi tratado como uma incompatibilidade/flake de cleanup do harness no runner Windows, e não ocultado como teste aprovado.

### Build Windows de conclusão

Run `35819822543`:

- checkout do commit fonte exato — success;
- versão/checkpoint — success;
- smoke checks não-SQLite — success;
- rebuild do runtime embutido — success;
- compilação do executável Windows — success;
- upload do artefato — success.

O primeiro passo de publicação desse run falhou apenas porque o `.sha256` produzido dentro do container Android registrava o caminho absoluto `/app/dist/android/...`, inexistente no runner de publicação. Os bytes e o digest não estavam incorretos.

### Publicação final

Run `35819959908` — **success**.

A publicação final comparou diretamente o token de digest do `.sha256` Android com o hash calculado sobre o APK baixado, evitando depender do caminho interno do container. Os hashes de Windows e Android foram confirmados antes da criação do Release, e o workflow validou os assets obrigatórios e o alvo da tag.

## Assinatura Android

A comparação com o Release anterior detectou **certificado de assinatura diferente**.

Consequência: o APK beta.22 não deve atualizar o beta.21 diretamente por cima. Para testar no mesmo aparelho, exportar/salvar os dados da campanha antes, desinstalar a versão anterior e então instalar o novo APK. A desinstalação pode remover dados locais do aplicativo.

Para releases futuros com atualização in-place, é necessário configurar e preservar uma única chave de assinatura Android estável no CI (`PTU_ANDROID_KEYSTORE_BASE64` e credenciais correspondentes), em vez de depender de uma chave temporária gerada durante o build.

## Ponto de parada

O Release de teste contendo Priority 0 + Stage A.1 até A.7 está publicado e rastreável ao commit `7f5afff3eeda1ed307186065df536d8ea14a398a`.

**Próxima etapa funcional: Stage A.8 — no Android, tocar em um Pokémon no Roster deve selecioná-lo e rolar até ações/detalhes sem navegar para Creatures. Ela ainda não foi iniciada.**
