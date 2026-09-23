# Handoff — Etapa A.3: excluir Trainer

## Estado inicial

- Repositório: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-roster-qol`
- PR: `#6` (draft/open; não fazer merge sem aprovação explícita do owner)
- Ponto inicial desta etapa: commit `2b9cc79922e31a597f13170b94b313a5c7328b21`, após a conclusão da Etapa A.2.
- Escopo desta etapa: somente o item 3 da Etapa A — **excluir Trainer**.

## Situação encontrada

A UI já possuía um fluxo parcial de exclusão no Trainer Switcher, porém a persistência ainda impedia a remoção do último perfil e faltava um contrato completo para exclusão de perfil, troca automática de perfil ativo e criação segura de um novo Trainer vazio quando o último perfil fosse apagado.

A Etapa A.3 consolidou esse comportamento em Windows e Android sem alterar o formato dos saves nem o formato dos content packs.

## Implementação realizada

### Persistência Windows

`PTU_Companion_Windows_Source/persistence/repository.mjs`

- `deleteProfile(profileId)` agora remove o perfil selecionado dentro de transação.
- Dependências associadas ao Trainer são removidas pelas relações existentes do banco, incluindo Pokémon, rosters, inventory, NPCs, GM Grants, histórico e revisões daquele perfil.
- Os demais perfis permanecem intactos.
- Se o Trainer excluído era o ativo e ainda existem outros Trainers, um perfil remanescente passa automaticamente a ser o ativo.
- Se não resta nenhum perfil, `active_profile_id` é limpo em vez de manter um ID inválido.
- Configurações globais, como `active_ruleset_id`, não são apagadas.

### API Windows

`PTU_Companion_Windows_Source/server.mjs`

- Foi formalizado `DELETE /api/profiles/:id`.
- Quando há outro Trainer, a resposta retorna o perfil ativo substituto.
- Ao excluir o último Trainer, o servidor cria imediatamente um novo estado vazio usando `blankTrainerState({name:'New Trainer', title:'Trainer'})`, mantendo a aplicação em estado utilizável.
- A resposta identifica esse caminho por `replacementCreated`.

### UI Windows e Android

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`

O fluxo agora:

1. expõe `Delete Trainer` na ficha do Trainer e `Delete Active Trainer` no Trainer Switcher;
2. usa o modal estilizado padrão da aplicação, sem `window.confirm`;
3. explica que os dados pertencentes ao Trainer selecionado serão removidos, enquanto Content Packs/configurações globais permanecem;
4. no Windows, chama `DELETE /api/profiles/:id` e carrega o perfil retornado;
5. em runtime local/Android, deixa um Trainer vazio funcional quando o Trainer corrente é removido e não há outro perfil persistido disponível;
6. invalida dados de referência/progressão ligados ao Trainer anterior antes de renderizar o substituto.

## Compatibilidade

- Save schema continua `version: 2`.
- Nenhuma migração destrutiva de saves existentes foi adicionada.
- Nenhuma mudança em `.ptucp` ou no banco de definitions.
- Exclusão afeta somente os dados pertencentes ao Trainer selecionado.
- Outros Trainers e seus Pokémon/rosters/inventory/NPCs permanecem intactos.
- Configurações globais e Content Packs permanecem instalados/configurados.
- Após apagar o último Trainer, a aplicação nunca fica sem uma ficha utilizável: um `New Trainer` vazio é criado pelo servidor, ou pelo fallback local da UI quando aplicável.

## Regressões adicionadas

### Windows

`PTU_Companion_Windows_Source/scripts/verify_stage_a3_delete_trainer.mjs`

A regressão cria dois Trainers isolados em SQLite e comprova que:

- apagar o Trainer ativo seleciona automaticamente o outro;
- o outro Trainer e seus Pokémon, roster, inventory e NPCs permanecem intactos;
- todas as linhas vinculadas ao Trainer apagado são removidas;
- revisões daquele Trainer são removidas;
- `active_ruleset_id` sobrevive à exclusão;
- apagar o último perfil é permitido no repository e limpa `active_profile_id`;
- servidor possui `DELETE /api/profiles/:id` e cria substituto vazio para o último Trainer;
- UI usa confirmação estilizada e expõe o comando de exclusão.

### Android

`PTU_Companion_Android_Tauri/scripts/verify-stage-a3-delete-trainer.mjs`

Verifica presença e contrato do fluxo de exclusão na UI Android, incluindo modal padrão, botões de exclusão, fallback para Trainer vazio e preservação explícita de Content Packs/configurações globais.

Os verificadores foram adicionados ao `npm run verify` de Windows e Android.

## Automação da etapa

Foram adicionados:

- `PTU_Companion_Windows_Source/scripts/apply_stage_a3_delete_trainer.py`
- `.github/workflows/stage-a3-delete-trainer.yml`

O workflow aplica a alteração de forma reproduzível, executa `git diff --check`, roda as suítes completas das duas plataformas e publica o patch de runtime apenas após sucesso.

## Validação

GitHub Actions run: `35774854752` — **success**.

Resultados relevantes:

- `git diff --check`: passou.
- Windows `npm run verify`: passou integralmente.
- `Stage A.1 Windows Naturewalk regression OK`.
- `Stage A.2 Windows Notifications removal regression OK`.
- `Stage A.3 Windows Trainer deletion regression OK`.
- Android `npm run verify`: passou integralmente.
- `Stage A.1 Android Naturewalk regression OK`.
- `Stage A.2 Android Notifications removal regression OK`.
- `Stage A.3 Android Trainer deletion regression OK`.

Commit de runtime validado:

- `cb5cef16498449c1925b9c0d79981cff30e59a38` — `feat(stage-a3): support deleting Trainer profiles [skip ci]`

## Arquivos alterados na Etapa A.3

Comparação do checkpoint A.2 ao runtime A.3:

1. `.github/workflows/stage-a3-delete-trainer.yml`
2. `PTU_Companion_Windows_Source/persistence/repository.mjs`
3. `PTU_Companion_Windows_Source/server.mjs`
4. `PTU_Companion_Windows_Source/static-preview/app.js`
5. `PTU_Companion_Windows_Source/package.json`
6. `PTU_Companion_Windows_Source/scripts/apply_stage_a3_delete_trainer.py`
7. `PTU_Companion_Windows_Source/scripts/verify_stage_a3_delete_trainer.mjs`
8. `PTU_Companion_Android_Tauri/www/app.js`
9. `PTU_Companion_Android_Tauri/package.json`
10. `PTU_Companion_Android_Tauri/scripts/verify-stage-a3-delete-trainer.mjs`

## Release

Nenhum GitHub Release foi criado. Esta é uma alteração intermediária da Etapa A, não um marco de distribuição de novos `.exe`/`.apk`.

## Pendências da Etapa A

4. Trainer Notes;
5. Pokémon Notes;
6. editar Roster;
7. excluir Roster sem excluir Pokémon;
8. Android Roster: selecionar Pokémon e rolar para ações/detalhes sem navegar para Creatures;
9. descrições de Move Keywords.

## Riscos / observações

- Excluir um Trainer é destrutivo para os dados pertencentes àquele perfil; por isso a confirmação estilizada é obrigatória.
- O comportamento de apagar o último Trainer foi definido deliberadamente para não deixar a aplicação em estado inválido: cria-se um Trainer vazio de substituição.
- Não foi iniciada nenhuma implementação de Notes nesta etapa.
- O PR `#6` deve permanecer draft/open até novo checkpoint e aprovação do owner.

## Ponto exato de parada

**Etapa A.3 concluída e validada. Etapa A.4 — Trainer Notes — ainda não foi iniciada.**
