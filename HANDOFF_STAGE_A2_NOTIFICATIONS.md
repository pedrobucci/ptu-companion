# Handoff — Etapa A.2: remover Notifications

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-roster-qol`
- PR: `#6` (draft/open; não fazer merge sem aprovação explícita do owner)
- Ponto inicial desta etapa: commit `6910417e2cc04f1525f556eb6e044857442de5e6`, após a conclusão da Etapa A.1 (Naturewalk com múltiplos terrenos).
- Escopo desta etapa: somente o item 2 da Etapa A — **remover Notifications**.

## Implementação realizada

O botão visual de Notifications (`🔔` com badge `1`) foi removido da `topbar` nas duas UIs de jogador:

- Windows/Desktop: `PTU_Companion_Windows_Source/static-preview/app.js`
- Android/Tauri: `PTU_Companion_Android_Tauri/www/app.js`

A remoção é deliberadamente pequena: não altera save schema, estado persistido, content packs, Trainer/Pokémon data nem rotas de API. Os controles vizinhos de Settings e troca de Trainer permanecem intactos.

Foi criado um aplicador idempotente para tornar a alteração reproduzível e recusar uma edição ampla caso o markup esperado mude:

- `PTU_Companion_Windows_Source/scripts/apply_stage_a2_notifications.py`

Também foram adicionadas regressões específicas nas duas plataformas. Elas verificam que o botão legado/bell não é mais renderizado e que Settings e Trainer Switcher continuam presentes:

- `PTU_Companion_Windows_Source/scripts/verify_stage_a2_notifications.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-a2-notifications.mjs`

Os verificadores foram anexados aos respectivos `npm run verify` em:

- `PTU_Companion_Windows_Source/package.json`
- `PTU_Companion_Android_Tauri/package.json`

A automação da etapa está em:

- `.github/workflows/stage-a2-notifications.yml`

## Arquivos alterados nesta etapa

Comparação entre `6910417e2cc04f1525f556eb6e044857442de5e6` e `d85b76de15b2e0c1557e925de7177b2c9e900deb`:

1. `.github/workflows/stage-a2-notifications.yml`
2. `PTU_Companion_Windows_Source/static-preview/app.js`
3. `PTU_Companion_Windows_Source/package.json`
4. `PTU_Companion_Windows_Source/scripts/apply_stage_a2_notifications.py`
5. `PTU_Companion_Windows_Source/scripts/verify_stage_a2_notifications.mjs`
6. `PTU_Companion_Android_Tauri/www/app.js`
7. `PTU_Companion_Android_Tauri/package.json`
8. `PTU_Companion_Android_Tauri/scripts/verify-stage-a2-notifications.mjs`

## Validação

GitHub Actions run: `35773731106` — **success**.

Validações executadas:

- `git diff --check`: passou.
- Windows `npm run verify`: passou a suíte completa, incluindo:
  - `Stage A.1 Windows Naturewalk regression OK`
  - `Stage A.2 Windows Notifications removal regression OK`
- Android `npm run verify`: passou a suíte completa, incluindo:
  - `Stage A.1 Android Naturewalk regression OK`
  - `Stage A.2 Android Notifications removal regression OK`

O workflow aplicou e publicou a alteração de runtime no commit:

- `d85b76de15b2e0c1557e925de7177b2c9e900deb` — `feat(stage-a2): remove Notifications control [skip ci]`

## Compatibilidade e decisões

- Nenhuma migração de save foi necessária.
- Nenhum dado persistido foi removido.
- Nenhuma mudança em `.ptucp` ou no banco de definições foi necessária.
- Windows e Android receberam a mesma alteração visual.
- A implementação não introduz um substituto para Notifications; o item do plano determina sua remoção.
- Não foi criado GitHub Release, pois A.2 é um checkpoint intermediário e não um marco de distribuição de executáveis.

## Pendências do plano

A sequência restante da Etapa A continua, sem ter sido iniciada nesta etapa:

3. excluir Trainer;
4. Trainer Notes;
5. Pokémon Notes;
6. editar Roster;
7. excluir Roster;
8. Android Roster → scroll para seção de ações;
9. descrições de Move Keywords.

## Riscos / observações

- A remoção afeta somente o controle visual legado de Notifications que não possuía ação associada no shell atual.
- Qualquer futura funcionalidade real de notificações deverá ser tratada como um recurso novo, e não depender deste botão removido.
- O PR `#6` deve permanecer draft/open até novo checkpoint e aprovação do owner.

## Ponto exato de parada

**Etapa A.2 concluída e validada. Etapa A.3 — excluir Trainer — ainda não foi iniciada.**
