# Android beta.35 — Aegislash: troca completa de stats

Build de validação da issue #58. Corrige Sword Stance para transpor os valores completos de Attack/Defense e Special Attack/Special Defense após calcular Base Stats, natureza, alocações e bônus de Poke Edges. Os Combat Stages continuam vinculados ao atributo nomeado.

- Android ARM64, versionCode 2002035.
- Instale por cima da beta.34 para verificar a atualização preservando os dados, ou faça uma instalação limpa.
- Teste em Aegislash com natureza e alocações diferentes entre Attack/Defense e Sp. Attack/Sp. Defense.
- Compare Shield e Sword Stance na ficha: os valores finais dos pares devem inverter integralmente.
- Confirme HP e Speed inalterados e confira os valores usados no cálculo de dano físico/especial.
- Volte manualmente à Shield Stance e confirme que os valores retornam, sem alteração dos dados salvos ou dos Combat Stages.

A issue permanece aberta em Aguardando validação. Não é uma release pública.
