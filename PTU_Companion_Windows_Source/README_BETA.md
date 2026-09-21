# PTU Companion Beta v2.1.0-beta.19

Current desktop beta includes the approved **Fakemon 1 leva v2.0.0** content as a bundled default: 13 campaign Species, 8 Moves, 3 Abilities and offline Species artwork. The beta.19 launcher uses a new runtime version while preserving the persistent campaign database under `%LOCALAPPDATA%\PTU Companion Beta\data`.

# PTU Companion Beta v2.1.0-beta.15

## beta.15 — Core / Arcane / Living / Alchemy weapon runtime

- imported weapon mechanics now support the full v2 content-pack contract;
- Arcane Weapons use **Occult Education** and **Special** attacks, with the PTU 1.05 Editation **Adept/Master** weapon tiers;
- two-handed imported weapons reserve Main Hand + Off Hand through `hands: 2`;
- Living Weapon hybrids can apply passive Evasion and shield rules while equipped;
- contextual alchemy/legendary weapon effects are surfaced in the resolved Trainer model instead of being silently discarded;
- normal melee weapons continue to honor Feature-based qualification substitutions such as Apparition.


## beta.12 — Trainer Abilities

A ficha do Trainer agora possui a aba **Abilities**, entre Edges e Moves. Ela lista automaticamente Abilities concedidas por Features, Edges e outros efeitos resolvidos pelo Trainer Rules Engine, mostrando origem e texto mecânico quando disponível. Nenhuma migração de save é necessária.


## Hotfix beta.11 — Pokémon Sex

Pokémon creation and **Creature Sheet → Edit Identity** now expose the Sex field again with `None`, `Male`, and `Female`. Existing saves are migrated transparently and keep any legacy `gender`/`sex` value that may already exist.

Esta é a primeira distribuição **Beta para Windows** do PTU Companion funcional.

## Como executar no Windows

1. Dê duplo clique em **`PTU Companion Beta 2.1.0-beta.15.exe`**.
2. Na primeira execução, o launcher instala/extrai o runtime local em `%LOCALAPPDATA%\PTU Companion Beta\runtime`.
3. Os dados persistentes da campanha ficam em `%LOCALAPPDATA%\PTU Companion Beta\data` e não são removidos ao atualizar o executável.

> As instruções e referências de nomes de executável abaixo pertencem às betas históricas descritas em suas respectivas seções.
