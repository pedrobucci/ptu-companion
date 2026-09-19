# PTU Companion Android v2.2.0-beta.14

## Correções

### Exportação JSON nativa

- `Export JSON Save` não depende mais do mecanismo de download por `<a download>`, que não é confiável no Android WebView.
- O Android usa agora o seletor nativo de destino do sistema via Tauri Dialog e grava o JSON selecionado via Tauri FS.
- Cancelar o seletor não gera arquivo nem mensagem falsa de sucesso.
- Erros de gravação são mostrados como `Export failed`.
- O JSON continua incluindo `contentDependencies` dos Content Packs usados pelo save.

### Content Pack Manager visível no Android

- Nova entrada direta `More -> Content Packs`.
- Novo botão `Manage Packs` em `Pokédex & Rules`.
- Novo botão `Content Packs` em Settings.
- `Save Tools` agora aponta para o Pack Manager dedicado.
- O Pack Manager lista packs incorporados no APK e packs importados por `.ptucp`.
- Packs incorporados opcionais podem ser Enabled/Disabled por Ruleset.
- O estado de packs incorporados é persistido no armazenamento local do Android.
- O pack `ptu-core-1.05` permanece bloqueado e não pode ser desativado.
- Packs importados podem ser Enabled/Disabled e também Uninstalled.
- Packs incorporados não são apagados do APK; `Disable` apenas os retira do Ruleset ativo.
- Dependências continuam protegidas: um pack não pode ser desativado/removido enquanto outro pack ativo depender dele.

## Versão

- App: `2.2.0-beta.14`
- Android `versionCode`: `2002014`
