# PTU Companion — Especificação Técnica Android

## Versão alvo

**PTU Companion v2.2.0-android-beta.19**

A edição Android é a edição de uso em mesa/campanha do PTU Companion. Ela compartilha os dados e o motor mecânico da edição Windows, mas **não expõe ferramentas de autoria/edição de conteúdo**.

## 1. Objetivos

- Executar como APK Android instalável e utilizável sem abrir navegador externo.
- Manter a experiência de jogo disponível no Windows: Trainer, Pokémon, Rosters, Backpack/Equipment, Storage, Shop, NPCs, Level Up, Rules/Pokédex e Save Tools.
- Funcionar majoritariamente offline depois de instalada.
- Manter o mesmo contrato mecânico do Rules Engine desktop.
- Adaptar a UI aos mockups mobile fornecidos: cabeçalho azul, cards claros, chips, navegação inferior e conteúdo em uma coluna no telefone.
- Não permitir criação/edição de Moves, Abilities, Species, Features, Edges, Poké Edges, Items ou Content Packs no Android.

## 2. Escopo funcional

### Incluído

- Home / Dashboard.
- Trainer Sheet e troca de Trainer.
- Creatures / ficha individual do Pokémon.
- Moves, Abilities, Species, Type e Pokédex/Rules de cada Pokémon.
- Rosters múltiplos.
- Backpack e Equipment de Trainer.
- Held Items de Pokémon.
- Storage.
- Shop.
- NPC Journal / Notes.
- Progressão/Level Up de Trainer.
- Progressão/Evolution de Pokémon.
- Tutor Points, Poké Edges e Move Training.
- GM Override para operações suportadas.
- Save/Import/Export quando o wrapper/plataforma disponibilizar o seletor de arquivo.
- Retratos de Pokémon e retratos locais do Trainer/NPC.

### Excluído

- Move Editor.
- Ability Editor.
- Species Editor.
- Feature/Edge/Poké Edge Editor.
- Item Editor.
- Content Pack authoring/publishing.
- Ruleset Builder avançado.
- Ferramentas de validação destinadas à autoria de conteúdo.

## 3. Navegação mobile

A navegação principal usa uma barra inferior com cinco destinos:

1. **Home**
2. **Creatures**
3. **Rosters**
4. **Items**
5. **More**

`More` concentra Trainer, Storage, Shop, Pokédex & Rules, NPCs, Level Up, Save Tools e Settings.

Em tablets, a aplicação pode usar mais de uma coluna, mas o mesmo conteúdo e as mesmas ações devem permanecer disponíveis.

## 4. Visualização de Moves do Pokémon

A aba **Moves** deve separar claramente regras de batalha de regras de Contest.

Cada Move conhecido deve mostrar, quando disponível:

- Name;
- Type;
- origem do Move;
- Frequency;
- AC efetivo;
- Damage Base;
- **Range**;
- dano resolvido quando aplicável;
- Battle Effect;
- **Contest Type**;
- **Contest Effect**.

`Contest Type` e `Contest Effect` somente aparecem quando a definição do Move contém esses dados. Eles ficam em um bloco visual independente do Battle Effect para não sugerir que um efeito de Contest também se aplica em combate.

No telefone, Frequency/AC/DB são compactados em uma grade de duas colunas e Range ocupa a largura disponível para evitar truncamento de valores como `Ranged 6, 1 Target, Push`.

## 5. Arquitetura

### 5.1 UI

A UI é HTML/CSS/JavaScript adaptada da aplicação funcional desktop. O mesmo conjunto de componentes funcionais é reutilizado, mas a folha de estilos Android contém breakpoints e navegação específica para toque.

### 5.2 Rules Engine

O Android incorpora localmente:

- Pokémon Rules Engine;
- Trainer Rules Engine;
- Modifier Engine;
- Held Item Engine;
- Trainer Progression Engine;
- metadados de Items/Equipment.

O APK não depende de um servidor Node rodando no telefone.

### 5.3 Definitions bundle

As definições do Ruleset são exportadas do banco de definições do desktop durante o build e incorporadas ao APK. Na beta atual o bundle contém, entre outros:

- 1.105 Species;
- 754 Moves;
- 477 Abilities;
- 93 Capabilities;
- 882 Features;
- 62 Edges;
- 22 Poké Edges;
- 351 Items.

Os registros de Move incluem `range`, `contestType` e `contestEffect`.

### 5.4 API local simulada

Para maximizar reaproveitamento da interface, chamadas da UI para `/api/...` são interceptadas dentro do próprio WebView por uma API JavaScript local. A resposta é construída a partir das definições embarcadas e do save local.

### 5.5 Compatibilidade com file://

O runtime Android é empacotado também como um JavaScript clássico (`mobile-runtime.js`). Isso evita depender de ES Modules carregados diretamente por `file://`, comportamento que pode variar entre versões do Android System WebView.

## 6. Persistência

Nesta beta Android, o estado da campanha é persistido pelo armazenamento local do WebView. Os dados iniciais são derivados do banco da edição Windows usado no build.

Requisitos para a evolução pós-beta:

- migrar a persistência Android para SQLite nativo;
- manter um formato de exportação/importação JSON comum entre Windows e Android;
- preservar IDs de Trainer/Pokémon/Ruleset na migração;
- não duplicar blobs de retrato em snapshots de histórico.

## 7. Imagens

- Pokémon oficiais usam sprites compactos quando disponíveis.
- Trainer/NPC usam retratos fornecidos pelo usuário.
- O layout deve fornecer fallback quando a imagem não estiver disponível.
- A UI nunca deve depender de uma imagem externa para permitir editar HP, Moves, Items ou qualquer outra informação mecânica.

## 8. Segurança e permissões

A beta requer `INTERNET` para buscar sprites remotos/fallbacks. O save e Rules Engine permanecem locais.

Nenhuma ferramenta de autoria é habilitada no Android, reduzindo o risco de modificar acidentalmente definições/regras durante a sessão de jogo.

## 9. Build APK

O APK contém:

- `AndroidManifest.xml`;
- `classes.dex` com a Activity/WebView;
- assets HTML/CSS/JS;
- definitions bundle;
- Rules Engine;
- runtime local da API.

A Activity abre diretamente `file:///android_asset/index.html` dentro do WebView e habilita JavaScript, DOM storage e acesso aos assets locais.

## 10. Critérios de homologação beta.1

- APK instala e abre sem navegador externo.
- Fechar/reabrir mantém alterações do save local.
- Home e bottom navigation respondem ao toque.
- Editors não são acessíveis no Android.
- Trainer e Pokémon podem ser consultados normalmente.
- Range aparece nos Moves conhecidos.
- Moves com Contest exibem Contest Type/Effect; Moves sem Contest não exibem bloco vazio.
- Level Up de Trainer e Pokémon abre e calcula previews.
- Backpack/Equipment e Held Items carregam.
- Rosters, Storage, Shop e NPCs abrem sem erro.
- Ruleset `all-provided-material` resolve o conteúdo homebrew da beta desktop atual.

## 11. Limitações conhecidas da beta.1

- O APK desta etapa é uma build de homologação/sideload, não uma publicação Google Play.
- A persistência Android ainda usa o storage local do WebView; SQLite nativo é meta posterior.
- O fluxo de file picker para import/export e retratos depende da integração do wrapper Android e deve ser homologado em aparelho físico.
- O APK é assinado com uma chave de beta local, destinada apenas a testes.



## Canonical Android packaging (beta.3+)

Starting with `v2.2.0-android-beta.3`, the canonical Android package is a Tauri 2 application generated through Gradle/Android SDK rather than a hand-built APK. The reproducible Docker pipeline mirrors the proven PTU Level Simulator setup: Tauri CLI 2.11.4, Android API 36, Build Tools 36.0.0, NDK 28.2.13676358, `aarch64-linux-android`, `zipalign -P 16`, and `apksigner` verification.

The Android edition is player-facing. Content authoring/Editors are hidden on Android; Trainer/Pokémon correction flows, progression, inventory, equipment, rosters, storage, shop, NPCs, Rules/Pokédex, save tools and campaign gameplay remain available.

### Pokémon Move presentation

Known Pokémon Moves must expose `Frequency`, `AC`, `DB`, and `Range` in the move card. When available, Contest information must be shown in a dedicated block with `Contest Type` and `Contest Effect`, visually separated from the battle Effect. On narrow screens, Range spans the full metric row to avoid truncation.

## Data-only Content Pack updates

From `v2.2.0-android-beta.6`, Android consumes the same `.ptucp` contract as Desktop.

### Native import boundary

The WebView reads the selected file and sends it to the Tauri command `import_content_pack`. Rust validates and persists the archive metadata under the application data directory. On startup, `load_content_packs` returns installed pack payloads before `app.js` is loaded; the mobile definition repository overlays these records onto the embedded database export.

The importer accepts definition files for `moves`, `abilities`, `capabilities`, `features`, `edges`, `poke_edges`, `items`, `species`, plus `ptu_evolution_edges.json` and `ptu_evolution_families.json` datasets.

### Save dependencies

JSON exports include a `contentDependencies` array of `{ packId, minVersion }`. Import checks those dependencies against bundled and installed packs. Older saves without the field are partially protected by scanning stored `contentPackId` / `speciesContentPackId` provenance.

### Android UI rule

Android may install and consume content, but authoring/editing remains Desktop-only.
