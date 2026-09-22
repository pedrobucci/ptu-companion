# Handoff — Etapa A.6: editar Roster

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-roster-qol`
- PR: `#6` (draft/open; não fazer merge sem aprovação explícita do owner)
- Ponto inicial desta etapa: commit `450b4103018bf45400d9fbd1109c5218fabd9ea7`, após a conclusão da Etapa A.5 (Pokémon Notes).
- Escopo desta etapa: somente o item 6 da Etapa A — **editar Roster**.

## Implementação realizada

Windows/Desktop e Android/Tauri agora possuem uma ação `✎ Edit Roster` na tela de Rosters.

A edição permite alterar, sem recriar o Roster:

- nome;
- papel (`COMBAT`, `COMPANY`, `MOUNT`, `INVESTIGATION`, `OTHER`);
- limite máximo de membros;
- status de exibição no dashboard (`Active` / `Hidden`);
- cor do Roster.

O objeto existente é alterado in-place, mantendo o mesmo `id`. Isso preserva as referências `pokemon[].rosterIds` e, portanto, os vínculos de todos os Pokémon já associados.

O limite máximo não pode ser reduzido para abaixo da quantidade atual de membros. Nesse caso a edição é rejeitada com mensagem de erro e nenhum Pokémon é removido automaticamente.

Rosters marcados como `Hidden` deixam de aparecer na seção de Rosters ativos do dashboard, mas continuam presentes e gerenciáveis na tela de Rosters. A lista de seleção mostra um chip `HIDDEN` para tornar o estado explícito.

## Persistência e compatibilidade

Não foi criada migração de banco nem mudança no save schema.

Os campos editados já faziam parte do modelo persistido de Roster:

- `name`;
- `role`;
- `maxMembers`;
- `active`;
- `color`.

No SQLite do Windows eles continuam usando as colunas normalizadas existentes (`name`, `role`, `max_members`, `active`, `color`).

Como o `id` do Roster não muda, `roster_memberships` e `pokemon[].rosterIds` permanecem válidos. Nenhum Content Pack ou `.ptucp` foi alterado.

## Arquivos alterados

Comparação entre `450b4103018bf45400d9fbd1109c5218fabd9ea7` e o runtime validado `3f2e93e97f771c2b6b0a6d2e24b290cc83dfc9f8`:

1. `.github/workflows/stage-a6-edit-roster.yml`
2. `PTU_Companion_Windows_Source/static-preview/app.js`
3. `PTU_Companion_Windows_Source/package.json`
4. `PTU_Companion_Windows_Source/scripts/apply_stage_a6_edit_roster.py`
5. `PTU_Companion_Windows_Source/scripts/verify_stage_a6_edit_roster.mjs`
6. `PTU_Companion_Android_Tauri/www/app.js`
7. `PTU_Companion_Android_Tauri/package.json`
8. `PTU_Companion_Android_Tauri/scripts/verify-stage-a6-edit-roster.mjs`

## Validação

Workflow final: GitHub Actions run `35787825988` — **success**.

Validações executadas:

- `git diff --check`: passou;
- Windows `npm run verify`: passou a suíte completa;
- Android `npm run verify`: passou a suíte completa;
- `Stage A.6 Windows Roster edit regression OK`;
- `Stage A.6 Android Roster edit regression OK`.

O teste Windows cobre round-trip real em SQLite e confirma que editar metadados do Roster preserva a lista de Pokémon membros.

O runtime validado foi publicado pelo workflow no commit:

- `3f2e93e97f771c2b6b0a6d2e24b290cc83dfc9f8` — `feat(stage-a6): support editing Rosters [skip ci]`.

### Observação sobre a primeira execução

A primeira execução da etapa (`35787745587`) falhou apenas em uma asserção de teste porque `node:sqlite` devolveu a linha SQL com protótipo nulo, embora todos os valores fossem exatamente os esperados. O teste foi corrigido para comparar uma cópia de objeto comum (`{...row}`); nenhuma alteração de runtime foi necessária por causa dessa falha. A segunda execução (`35787825988`) passou integralmente.

## Decisões

- Editar um Roster não recria o objeto e não muda seu `id`.
- Reduzir a capacidade abaixo do número atual de membros é bloqueado em vez de remover Pokémon implicitamente.
- `active=false` representa apenas ocultação da seção de Rosters ativos do dashboard; o Roster continua existindo e pode ser reativado.
- A cor é editável usando o controle nativo `input type="color"` já suportado pelo formulário padrão.

## Release

Nenhum GitHub Release foi criado. A.6 é um checkpoint intermediário e não um marco executável de distribuição.

## Próxima etapa do plano

**Etapa A.7 — excluir Roster sem excluir Pokémon.**

Ela ainda não foi iniciada.

## Ponto exato de parada

**Etapa A.6 concluída e validada. Parar antes de iniciar A.7 — delete Roster without deleting Pokémon.**
