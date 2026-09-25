# Handoff — Stage C: Pokémon Forms UI

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-ui-c`
- Draft PR: `#9`
- Base empilhada: `feature/pokemon-forms-foundation-b`
- Checkpoint Stage B usado como base: `615f6ba9cfa0806fe91a42735d50b0105b114337`
- Stage B já fornecia schema/semântica de Forms, resolver central, requisitos, persistência em `details.formState`, compatibilidade `.ptucp` e o endpoint `/api/pokemon/forms/resolve`.
- Escopo desta etapa: somente **Stage C — interface de Forms e integração dos fluxos existentes**.
- **Stage D — Shiny não foi iniciada.**

## Objetivo da Stage C

Transformar a fundação da Stage B em uma experiência utilizável no Windows e Android, sem duplicar a lógica mecânica de Forms na interface.

A UI sempre consulta o resolver central para decidir se uma Form é válida e para obter a Species efetivamente resolvida. Assim, Types, Base Stats, Ability pool, Capabilities e dados de Moves naturais continuam tendo uma única fonte de verdade.

## Pokémon Builder

Quando uma Species contém Forms permanentes, o fluxo de criação agora exibe **Pokémon Form** com:

- opção `Canonical Base`;
- Forms de modo `permanent` definidas na Species;
- indicação visual da Form permanente selecionada;
- requisitos da Form em linguagem de interface;
- confirmações explícitas para requisitos `manual`;
- erros/warnings devolvidos pelo resolver.

A seleção entra no `/api/pokemon/build-preview`, portanto a prévia de criação já utiliza a Species resolvida antes de calcular Stats, Ability slots e Moves naturais.

Ao criar o Pokémon são persistidos no indivíduo:

```json
{
  "details": {
    "formState": {
      "schemaVersion": 1,
      "baseFormId": "base",
      "activeFormId": null
    },
    "manualFormApprovals": []
  }
}
```

Não foi criado schema de save novo; os campos permanecem em `details_json` no desktop e no JSON/local persistence do Android.

## Creature Sheet

Species com Forms recebem a seção **POKÉMON FORM** na ficha.

Ela mostra:

- Form permanente/base atual;
- transformação temporária ativa, quando houver;
- Types atualmente resolvidos;
- warnings do resolver;
- ação **Manage Forms**.

O modal de gerenciamento permite:

- voltar à `Canonical Base`;
- escolher uma Form permanente;
- ativar uma Form `transformation`;
- desativar a transformação sem trocar a Form permanente;
- visualizar requisitos;
- confirmar condições manuais quando aplicável.

A alteração é submetida a `/api/pokemon/forms/resolve`. Se os requisitos não forem atendidos, a Form não é aplicada. Com GM Override ativo, a regra da Stage B é respeitada e o resultado mantém warnings explícitos.

Depois de uma alteração válida:

- `details.formState` é atualizado;
- confirmações manuais pertinentes permanecem no indivíduo;
- Types exibidos no registro do Pokémon são sincronizados com o resultado;
- a referência mecânica da Creature é invalidada e recarregada;
- a ficha passa a usar imediatamente Stats, Ability pool, Capabilities, Types e demais propriedades resolvidas.

## Recuperação de estado inválido

Uma Form previamente salva pode se tornar inválida se Content Packs, requisitos ou estado da campanha mudarem.

O gerenciador de Forms não depende exclusivamente do carregamento normal da Creature Sheet. Ele também consulta `/api/pokemon/forms/resolve` diretamente para recuperar a lista de Forms da Species base e mostrar os erros atuais.

Dessa forma, um estado inválido não prende o usuário em uma ficha sem saída: é possível selecionar outra Form válida ou retornar para `Canonical Base`.

Foi adicionada regressão para garantir que a mensagem de recuperação **Current Form needs attention** apareça apenas uma vez no modal.

## Separação entre Form permanente e transformação temporária

Uma transformação temporária pode alterar a resolução mecânica durante a referência/combat, mas não deve reescrever decisões permanentes de progressão.

Por isso os seguintes endpoints resolvem a **Form permanente somente**, usando `includeActive:false`:

- `/api/pokemon/progression-preview`;
- `/api/pokemon/ability-correction-preview`;
- `/api/pokemon/restat-preview`;
- `/api/pokemon/training-options`;
- `/api/pokemon/training-action-preview`.

Isso impede que uma transformação momentânea altere permanentemente Stats distribuídos, Ability choices ou opções de treinamento.

## Evolução

A busca da cadeia de evolução continua vinculada à identidade da **Species canônica**, e não ao nome/tipo potencialmente sobrescrito por uma Form.

Ao evoluir para outra Species:

```js
d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};
d.manualFormApprovals=[];
```

A decisão é intencional: Form IDs pertencem à definição da Species anterior e não devem ser carregados silenciosamente para a nova Species.

## Compatibilidade

Não houve:

- migração de banco de campanha;
- bump do save schema;
- bump do `.ptucp format_version`;
- alteração da precedência de Campaign Rulesets;
- alteração da precedência de Content Packs;
- alteração de versão pública do Windows/Android;
- implementação de Shiny.

A Stage C depende da Stage B e por isso o PR é deliberadamente empilhado.

## Arquivos principais

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`
- `PTU_Companion_Windows_Source/server.mjs`
- `PTU_Companion_Android_Tauri/www/mobile-api.mjs`
- `PTU_Companion_Windows_Source/scripts/apply_stage_c_forms_ui.py`
- `PTU_Companion_Windows_Source/scripts/apply_stage_c_forms_followup.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_c_forms_ui.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-c-forms-ui.mjs`
- `.github/workflows/stage-c-forms-ui.yml`
- `PTU_Companion_Windows_Source/package.json`
- `PTU_Companion_Android_Tauri/package.json`

Também foi flexibilizada a regressão de A.9 que verificava a posição exata de `openMoveKeywordInfo` em `Object.assign(window, ...)`. A Stage C adiciona novos handlers ao mesmo objeto; o teste passou a verificar presença/ordem compatível sem exigir adjacência. Isso é apenas manutenção de contrato de teste e não altera o comportamento de Move Keywords.

## Validação final

GitHub Actions run `36150902641` — **success**.

Job: `108123607276`.

Resultados relevantes:

- patch principal Stage C: passou;
- hardening/follow-up Stage C: passou;
- `git diff --check`: passou;
- suíte completa Windows: passou;
- `Stage A.9 Windows Move Keyword regression OK`;
- `Stage B Windows Pokémon Forms foundation regression OK`;
- `Stage C Windows Pokémon Forms UI regression OK`;
- suíte completa Android: passou;
- `Stage A.8 Android Roster focus regression OK`;
- `Stage A.9 Android Move Keyword regression OK`;
- `Stage B Android Pokémon Forms foundation regression OK`;
- `Stage C Android Pokémon Forms UI regression OK`.

Runtime final validado e publicado na branch pelo workflow:

- `c120293a4c9b02ee97c13ccb8fc671ec1dbd3c33` — `feat(stage-c): add Pokemon Forms UI [skip ci]`.

## Execuções intermediárias

O primeiro run Stage C relevante, `36148977521`, chegou à suíte Windows e falhou porque a regressão A.9 exigia que `openMoveKeywordInfo` fosse imediatamente adjacente a `route` no objeto de handlers globais. A Stage C apenas inseriu handlers adicionais nesse objeto. O teste A.9 foi tornado forward-compatible; o runtime de A.9 não mudou.

Durante o hardening houve execuções sobre commits sequenciais e uma delas perdeu a disputa de push para uma execução mais nova. O run final `36150902641` partiu do commit de preparação mais recente, executou as suítes completas e publicou o runtime acima com sucesso.

Antes de fechar a etapa também foi corrigida a idempotência do patch de recuperação de Forms para impedir duplicação visual da mensagem de erro em execuções repetidas.

## Release / merge

Nenhum novo GitHub Release foi criado.

Nenhum merge foi realizado.

O PR `#9` deve permanecer **Draft/Open**, empilhado sobre a Stage B, até nova aprovação explícita do owner.

## Ponto exato de parada

**Stage C — Pokémon Forms UI — está concluída e validada.**

**Stage D — Shiny — ainda não foi iniciada.**
