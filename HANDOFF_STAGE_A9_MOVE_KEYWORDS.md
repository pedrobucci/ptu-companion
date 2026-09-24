# Handoff — Stage A.9: Move Keyword descriptions

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/android-roster-focus-a8`
- Draft PR: `#7`
- Base da branch: `main` em `7f5afff3eeda1ed307186065df536d8ea14a398a`, checkpoint distribuído Windows `2.1.0-beta.20` / Android `2.2.0-beta.22`.
- Stage A.8 já concluída antes desta etapa; runtime A.8: `71415fc15c4c89b4adf5c5e0ffba3aa7d0327885`.
- Escopo desta etapa: somente **Stage A.9 — descrições/referência de Move Keywords**.

## Fonte de regras

A implementação foi baseada no PDF fornecido pelo owner, **Pokémon Tabletop United 1.05 Core**, seção **Move Keywords**, páginas 339–342.

O catálogo contém exatamente os 33 Move Keywords dessa seção, na ordem do livro:

`Aura`, `Berry`, `Blessing`, `Coat`, `Dash`, `Double Strike`, `Environ`, `Execute`, `Exhaust`, `Fling`, `Friendly`, `Five Strike`, `Groundsource`, `Hazard`, `Illusion`, `Interrupt`, `Pass`, `Pledge`, `Powder`, `Priority`, `Push`, `Reaction`, `Recoil`, `Set-Up`, `Shield`, `Smite`, `Social`, `Sonic`, `Spirit Surge`, `Trigger`, `Vortex`, `Weather` e `Weight Class`.

**Range Keywords não fazem parte desta Stage.** No livro, a seção de Range Keywords começa depois de `Weight Class`; portanto termos como `Burst` não foram misturados ao catálogo de Move Keywords.

As descrições foram mantidas como referência concisa/parafraseada da regra do Core, preservando limiares e valores mecânicos relevantes. Tabelas pequenas necessárias à referência, como Double Strike, Five Strike, Environ/Natural Gift e Weight Class, foram armazenadas em `reference` quando aplicável.

## Implementação

### Fonte de dados local

Foi criado:

- `PTU_Companion_Windows_Source/rules/move-keywords-core-1.05.json`

Esse arquivo é a fonte estática para a Stage A.9. O patcher gera a mesma representação em runtime para Windows e Android.

A decisão de usar um catálogo local foi deliberada: `move_keywords` é uma referência de regras, não uma nova definição substituível da Campaign Ruleset nesta etapa. Isso evita alterar o schema de definitions, o formato `.ptucp` ou a precedência dos Content Packs apenas para adicionar documentação de keywords.

### Pokédex & Rules Library

Windows e Android receberam uma nova categoria:

- `Move Keywords`

Ela oferece:

- lista dos 33 keywords;
- pesquisa local por nome/descrição/referência;
- detalhe com descrição;
- referência complementar quando aplicável;
- indicação explícita `PTU Core 1.05` e página de origem.

A categoria é resolvida localmente e não depende de uma nova tabela/`kind` no SQLite de definitions.

### Moves conhecidos do Pokémon

Na aba de Moves da Creature Sheet, os Moves resolvidos podem exibir referências contextuais de Move Keywords detectadas nos campos disponíveis da definição do Move, incluindo `keyword`, `keywords`, `tags`, `range`, `frequency` e `effect`.

Cada keyword detectado aparece como ação de referência. Ao tocar/clicar, abre o modal padrão com:

- nome do Move Keyword;
- descrição;
- referência adicional quando existente;
- fonte `PTU Core 1.05` e página.

O botão usa `event.stopPropagation()` para não disparar acidentalmente ações do card.

### Limitação intencional

O catálogo dos 33 Move Keywords é explícito e fonte-dirigido. A associação automática entre um Move e um keyword, porém, depende dos campos/texto disponíveis na definição resolvida daquele Move. A Stage A.9 não reescreve todas as definições de Moves para adicionar metadata estruturada nova.

Isso significa que:

- um keyword explicitamente presente nos dados do Move pode ser reconhecido e abrir sua referência;
- a ausência de um texto/tag de keyword em uma definição não é inferida mecanicamente por nome do Move ou conhecimento externo;
- futuras melhorias podem estruturar `keywords` diretamente nas definições/packs sem mudar o catálogo criado aqui.

## Compatibilidade e persistência

Não houve:

- migração SQLite;
- bump do save schema;
- mudança do formato `.ptucp`;
- alteração da precedência de Campaign Rulesets;
- migração de profiles/Pokémon/Rosters;
- mudança de versão do aplicativo nesta etapa.

O catálogo é somente referência e não altera cálculos do Rules Engine.

## Arquivos principais

- `PTU_Companion_Windows_Source/rules/move-keywords-core-1.05.json`
- `PTU_Companion_Windows_Source/scripts/prepare_stage_a9_move_keywords.py`
- `PTU_Companion_Windows_Source/scripts/apply_stage_a9_move_keywords.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_a9_move_keywords.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-a9-move-keywords.mjs`
- `.github/workflows/stage-a9-move-keywords.yml`
- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`
- `PTU_Companion_Windows_Source/package.json`
- `PTU_Companion_Android_Tauri/package.json`

## Validação final

GitHub Actions run `36041816713` — **success**.

Job: `107775557844`.

Resultados relevantes:

- preparação do runtime: passou;
- patch Stage A.9: passou;
- `git diff --check`: passou;
- suíte completa Windows: passou;
- `Stage A.9 Windows Move Keyword regression OK`;
- suíte completa Android: passou;
- `Stage A.8 Android Roster focus regression OK`;
- `Stage A.9 Android Move Keyword regression OK`;
- regressões anteriores também continuaram passando.

Runtime validado/committado pelo workflow:

- `48a53d081f149ded8c6126038a0cdab67c371243` — `feat(stage-a9): add Move Keyword catalog and descriptions [skip ci]`.

## Execuções intermediárias

Antes do run final, as execuções `36040812720`, `36041121142`, `36041277222`, `36041346244` e `36041465840` falharam durante a preparação do patch por anchors do patcher que refletiam assinaturas/layouts antigos do runtime atual.

Essas falhas ocorreram **antes do commit de runtime da Stage A.9**. Os anchors/validadores foram ajustados ao código atual, e o run final `36041816713` passou integralmente. Nenhuma dessas falhas intermediárias indicou defeito funcional já publicado na aplicação.

## Release / merge

Nenhum novo GitHub Release foi criado.

Nenhum merge foi realizado. O PR `#7` deve permanecer **Draft/Open** até nova aprovação explícita do owner.

## Ponto exato de parada

**Stage A está concluída até A.9 e validada. Stage B — fundação de Forms — ainda não foi iniciada.**

O próximo trabalho planejado é a fundação de Forms: schema/semântica de overrides, requisitos, forma base/permanente, transformação ativa, resolver central, persistência e integração com `.ptucp`, antes de construir a UI completa de Forms.
