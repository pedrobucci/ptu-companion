# Handoff — Stage B: Pokémon Forms foundation

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-foundation-b`
- Draft PR: `#8`
- PR empilhado sobre: `feature/android-roster-focus-a8`
- Checkpoint de base no início da Stage B: `40128e648c8cc8232257cdc81fbcb58ab2835b0a`
- A Stage A estava concluída até A.9 antes desta etapa.
- Escopo desta etapa: somente a **fundação do sistema de Pokémon Forms**. A UI completa de Forms fica para Stage C.

## Release no início da Stage B

Não foi criado um novo GitHub Release antes desta etapa.

A razão é de entrega, não técnica: as mudanças A.8/A.9 ainda estavam em Draft PR e não haviam sido integradas ao `main`. O fluxo de release do projeto usa marcos executáveis derivados do `main` integrado; portanto criar um Release intermediário a partir de branches empilhadas não era necessário nem apropriado.

Nenhum merge foi realizado.

## Modelo de Forms

Foi criado um resolver comum para Windows e Android com `POKEMON_FORM_SCHEMA_VERSION = 1`.

O modelo estabelece:

- uma forma canônica implícita chamada `base`;
- **Forms permanentes**, que podem representar a forma permanente/base armazenada para o Pokémon;
- **Forms de transformação**, que podem ser ativadas temporariamente sobre a forma base/permanente;
- estado individual do Pokémon em `details.formState`, com `baseFormId` e `activeFormId`;
- normalização de aliases legados/alternativos como `permanentFormId`, `transformationFormId`, `base_form_id` e `active_form_id`.

A forma `base` é reservada e não pode ser redefinida por um registro de Form.

## Semântica de overrides

Cada Form pode declarar alterações em campos da Species. A ordem de execução é determinística:

1. `replace`;
2. `remove`;
3. `add`.

Isso permite tanto substituições completas quanto alterações incrementais.

Os overrides podem atuar sobre campos como:

- Types;
- Base Stats;
- Ability slots;
- Capabilities;
- Level-Up Moves;
- TM Moves;
- Tutor Moves;
- Egg Moves;
- Skills;
- outros campos de Species compatíveis com o modelo resolvido.

Aliases do formato fonte são convertidos para os nomes do runtime, por exemplo `base_stats -> baseStats`, `ability_slots -> abilities` e `level_up_moves -> levelUpMoves`.

O resolver atualiza também a representação `raw` correspondente. Isso é importante porque partes existentes do Rules Engine ainda consultam campos em `species.raw`.

## Requisitos de Forms

A fundação suporta árvores de requisitos compostas por:

- `all`;
- `any`;
- `not`.

Os requisitos simples atualmente reconhecidos incluem:

- Level mínimo e máximo;
- gender;
- Held Item;
- Ability;
- Capability;
- tag;
- flag de estado;
- condição manual/confirmada pelo usuário ou GM.

Com GM Override, uma Form pode ser resolvida mesmo com requisito não atendido; nesse caso o resolver preserva avisos explícitos em vez de ocultar a inconsistência.

## Resolver central

Windows e Android possuem a mesma semântica de resolução, mantida em módulos byte-idênticos:

- `PTU_Companion_Windows_Source/rules/pokemon-forms.mjs`
- `PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs`

O fluxo é:

1. resolver a Species normal através do Campaign Ruleset;
2. aplicar a Form permanente/base, quando selecionada;
3. aplicar a transformação ativa, quando existente;
4. validar requisitos;
5. devolver a Species efetiva e a lista das Forms aplicadas.

Foi criado o contrato HTTP:

- `POST /api/pokemon/forms/resolve`

em Windows e Android. Esse endpoint foi preparado para ser consumido pela UI da Stage C.

## Integração com mecânicas existentes

A fundação já foi conectada a dois pontos importantes do runtime:

- **Pokémon build preview**: a Species efetiva pode ser resolvida pela Form antes dos cálculos de criação;
- **Creature reference/combat data**: a Species efetiva considera `details.formState`, permitindo que uma transformação ativa altere os dados usados pela ficha e pelas mecânicas resolvidas.

A Stage B não cria ainda controles visuais para selecionar/ativar Forms. Ela prepara o caminho mecânico para a Stage C.

## `.ptucp`

Não houve bump do formato `.ptucp`.

O formato continua:

- `format: "ptu-content-pack"`;
- `format_version: 1`.

Uma Species em `content/species.ndjson` pode incluir `forms` ou `form_definitions`. Durante a importação, as Forms são normalizadas/validadas para detectar IDs duplicados, IDs inválidos, modos inválidos e estrutura incompatível.

A definição fornecida pelo autor continua sendo armazenada no `raw_json`; a Stage B não altera a precedência dos Content Packs ou dos Campaign Rulesets.

## Persistência

Não foi necessária migração da tabela de campanha nem bump do save schema.

O estado da Form fica dentro do Pokémon individual:

```json
{
  "details": {
    "formState": {
      "schemaVersion": 1,
      "baseFormId": "base",
      "activeFormId": null
    }
  }
}
```

No Windows isso utiliza o `pokemon.details_json` já existente. O teste da Stage B faz round-trip real por SQLite usando `CampaignRepository`.

No Android, o objeto permanece dentro do JSON persistido pelo armazenamento local já existente.

## Arquivos principais

- `PTU_Companion_Windows_Source/rules/pokemon-forms.mjs`
- `PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs`
- `PTU_Companion_Windows_Source/definitions/repository.mjs`
- `PTU_Companion_Windows_Source/definitions/pack-importer.mjs`
- `PTU_Companion_Windows_Source/server.mjs`
- `PTU_Companion_Android_Tauri/www/mobile-api.mjs`
- `PTU_Companion_Windows_Source/scripts/apply_stage_b_forms_foundation.py`
- `PTU_Companion_Windows_Source/scripts/prepare_stage_b_forms_patcher.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_b_forms_foundation.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-b-forms-foundation.mjs`
- `.github/workflows/stage-b-forms-foundation.yml`

## Validação final

GitHub Actions run `36046304292` — **success**.

Job: `107790600832`.

Resultados relevantes:

- preparação do patcher: passou;
- aplicação da integração Stage B: passou;
- `git diff --check`: passou;
- suíte completa Windows: passou;
- `Stage B Windows Pokémon Forms foundation regression OK`;
- suíte completa Android: passou;
- `Stage A.8 Android Roster focus regression OK`;
- `Stage A.9 Android Move Keyword regression OK`;
- `Stage B Android Pokémon Forms foundation regression OK`;
- regressões anteriores permaneceram passando.

Runtime validado/committado pelo workflow:

- `28025398fe7a2488f03005a37e1562dd08d7d995` — `feat(stage-b): integrate Pokemon Forms foundation [skip ci]`.

## Execução intermediária

O primeiro run da Stage B, `36046137179`, falhou durante a aplicação do patch porque um anchor de integração de Species aparecia em múltiplos endpoints e o patcher inicial exigia ocorrência única.

A falha aconteceu antes de qualquer commit de runtime da Stage B. O patcher foi ajustado para fazer substituição restrita ao segmento do endpoint e o run final `36046304292` passou integralmente.

Isso foi um problema do harness/patcher de integração, não uma regressão funcional publicada.

## Compatibilidade

A Stage B não alterou:

- schema SQLite da campanha;
- versão do save;
- `format_version` do `.ptucp`;
- precedência de Campaign Rulesets;
- precedência de Content Packs;
- versões públicas dos aplicativos;
- comportamento visual da aplicação, além das integrações internas necessárias para o futuro sistema de Forms.

## Release / merge

Nenhum novo GitHub Release foi criado nesta etapa.

Nenhum merge foi realizado. O PR `#8` deve permanecer **Draft/Open**, empilhado sobre a branch A.8/A.9, até aprovação explícita do owner.

## Ponto exato de parada

**Stage B — fundação de Pokémon Forms — concluída e validada. Parar antes de iniciar Stage C — UI de Forms.**
