# Handoff — classificação de formas PTU

Data: 2026-09-26  
Repositório: `pedrobucci/ptu-companion`  
Checkout: `fix/android-pokedex-artwork-beta20-apk`  
Commit-base: `465e7f5`

## Estado confirmado

Este checkout não contém a branch `content/ptu-parametrized-forms-catalog`, o Draft PR #11, `docs/PTU_FORMS_INVENTORY.md` ou `HANDOFF_PTU_FORMS_INVENTORY.md`. Portanto, a etapa de classificação solicitada ainda não foi aplicada neste checkout.

O último estado de conteúdo conhecido, vindo do contexto da conversa, é:

- inventário inicial validado com 956 registros de espécies;
- 48 Mega Forms pertencentes a 46 espécies;
- 2 Primal Reversions: Groudon e Kyogre;
- 81 candidatos de formas alternativas ainda pendentes de classificação família por família;
- correções já relatadas para Mega Swampert, Mega Beedrill e Mega Metagross;
- Mega Pinsir requer override de Capability (`Sky 6`) separado da Ability;
- Mega Evolution e Primal Reversion devem ser modeladas como `transformations`;
- Charizard X/Y e Mewtwo X/Y precisam permanecer como variantes distintas;
- os packs padrão não devem ser alterados enquanto houver família ambígua.

## Pendências da etapa

1. Recuperar ou abrir o checkout que contém `content/ptu-parametrized-forms-catalog` e o Draft PR #11.
2. Classificar os 81 candidatos usando exclusivamente as fontes PTU fornecidas, marcando falsos positivos com justificativa.
3. Auditar assets locais para artwork normal, forma e shiny; não criar URLs ausentes.
4. Versionar a classificação e scripts determinísticos capazes de gerar `forms[]` compatíveis com Stage B.
5. Adicionar testes/Actions de completude.
6. Atualizar o PR #11 e criar novo handoff. Não fazer merge nem release.

## Como retomar

```powershell
git fetch origin
git branch -a
git switch content/ptu-parametrized-forms-catalog
git status --short --branch
```

Se a branch não existir no remoto, localizar o checkout/PR #11 antes de implementar. Não usar este branch Android como base para a classificação.

## Integridade do checkout

No momento do handoff, havia uma pasta não rastreada:

`PTU_Companion_Android_v2.2.0-beta.19_Tauri/`

Ela foi preservada e não foi incluída neste commit por ser independente desta etapa.

