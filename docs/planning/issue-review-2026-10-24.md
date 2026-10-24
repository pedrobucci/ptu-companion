# Revisão das issues — 24/10/2026

Base: release Windows beta.37 / Android beta.43, commit `3229108`.
Foram consultadas as 23 issues abertas e seus comentários. O checkout original,
com 1.278 arquivos rastreados ausentes, foi preservado. O lote está na branch
`codex/resolve-open-issues-oct24`, em worktree isolado.

| Issue | Situação após a revisão | Trabalho / condição de conclusão |
| --- | --- | --- |
| #13 | Implementada neste lote | Pedro aprovou a proposta visual. Ícones PTU em PNG/ICO, launcher Android em cinco densidades e variante adaptativa. O build atualiza também projetos Android já inicializados. Nome, identificador e assinatura não foram alterados. Falta validar instalação. |
| #19 | Entregue anteriormente | Egg Moves de toda a linha evolutiva e uso único de Egg Tutor. Regressão existente mantida; falta validação de Pedro no app. |
| #21 | Entregue anteriormente | Itens com modificadores estruturados de Skills/stats/combate. Regressões de resolução e persistência mantidas; falta validação no app. |
| #24 | Alteração neste lote | Quests já validadas por Pedro; novo pedido troca calendário por prazo descritivo (anos/meses/dias/horas). Campo `deadline` preservado, incluindo valores antigos e JSON. |
| #27 | Entregue anteriormente | Edição de origem/custo de Moves. Testes de regras, reembolso e persistência mantidos; falta validação no app. |
| #28 | Entregue anteriormente | Custom Held Items e equipamento customizado. Falta validação no app. |
| #29 | Entregue anteriormente | Silent Assassin, bônus passivo e Bind. Regressão preservada; falta validação no app. |
| #33 | Índice permanente | Permanece aberto como roadmap. |
| #57 | Correção complementar | Cluster Mind já entregue. Encontrada divergência no motor Android: comparação com o objeto `moveLimit`, em vez de `moveLimit.effective`, na progressão. Corrigida, com teste negativo de limite. Falta validação no app. |
| #59 | Entregue anteriormente | Combat Stages. Regressões mantidas; falta validação no app. |
| #69 | Parcial, ampliada neste lote e nas continuações | Pedro escolheu entidades próprias com estado e controles. PR #108: Glyph/Alarm Runes, pessoa externa/Mark of Vision e arma/Soul Bond/Soul Investment. PR #109: Channeler/Shared Senses. Continuação atual: Spirit Boost com cinco resultados, escolhas por alvo, limites de Stratagem, AP e efeitos nos cálculos. Permanecem itens/gadgets concedidos, tokens, escolhas de Stance e demais efeitos defensivos/por tipo/por evento, iniciativa condicional e alterações de range/crit/effect. Explosive Runes cobre a explosão automática do Alarm Rune; ativação independente e resolução completa do ataque ainda não estão automatizadas. |
| #71 | Entregue anteriormente | JSON de Pokémon, cópia/substituição e preservação de vínculos. Falta validação no app. |
| #74 | Implementada neste lote | Pais opcionais, decisão de Pedro em 24/10. Criação usa o builder existente e confirma traits antes de registrar o Pokémon/consumir uso. Edição acessível pela ficha, inclusive fora de roster. Reutiliza This One’s Special e seus limites já aprovados; dados individuais, sem alterar catálogo. |
| #76 | Entregue anteriormente | Field Clinic na categoria Edge e com gating de Ruleset. Falta validação no app. |
| #77 | Não reproduzida | Pedro informou em 24/10 que ainda não testou a versão atual. Regressão de GM OFF/ON, cancelamento, confirmação e persistência passou. Nenhuma causa inventada ou correção declarada. |
| #78 | Entregue anteriormente | Exclusividade Mystic Senses / Elemental Connection. Falta validação no app. |
| #85 | Validada por Pedro | Pedro confirmou quests funcionando em 24/10. Checklist/notas já entregues; a mudança adicional de prazo segue na #24. |
| #89 | Entregue anteriormente | Recovery/Caretaking. Reutilizado e ampliado pelo fluxo #74; regressão de limites, traits, persistência e cancelamento mantida. Falta validação no app. |
| #98 | Validação recebida; complementos neste lote | Pedro confirmou status funcionando. Conferência dos PDFs encontrou ajustes adicionais: Burn+Poison separados, Bad Sleep também no Save bem-sucedido, sono impede três outros Saves, timing/limiar de Infatuation/Confusion do Playtest e mensagem correta de Paralysis. Complementos exigem revisão e validação. |
| #99 | Corrigida neste lote | Texto multilinha/AST de Basic Ranged Attacks e Aura Pulse reconstruídos do registro Core conferido no PDF; seis alternativas e alvo obrigatório sem repetição. Capabilities efetivas entram na elegibilidade. Aura Reading da p.205 corresponde à capability Aura Reader da p.303; condição do Trainer avaliada separadamente. Efeito contextual não representado exige confirmação manual, sem conceder automaticamente ou bloquear pela ausência de estado. |
| #100 | Correção anterior verificada | Harnesses Silent Assassin/Trainer já corrigidos na PR #97 integrada; testes #29/#66 e suítes atuais passam. É um problema de verificação, sem necessidade de novo fluxo de produto. |
| #106 | Implementada neste lote | Special dos Moves conhecidos resolve capabilities numéricas e especiais na ficha Pokémon/Trainer, incluindo Moves de Features. Bônus aditivos, concessões mínimas e deduplicação por Move; retirada ao esquecer; origem exibida. Efeitos temporários do campo Effect continuam dependendo de seu fluxo de uso/combate. |
| #107 | Implementada neste lote | Categoria Status Afflictions na Pokédex, busca, filtros Persistent/Volatile e detalhes com efeito, recuperação, duração e fonte. Compartilha referência com o painel de status e respeita o pack ativo. |

## Fontes conferidas

- PTU Core 1.05 p.205: Poké Edges e suas alternativas/condições.
- PTU Core 1.05 p.303: Aura Reader e Aura Pulse.
- PTU Core 1.05 p.338: aprender/esquecer Move concede/remove seu Special.
- PTU Core 1.05 p.374: Fly — Grants Sky +3.
- PTU Core 1.05 pp.246–247: Status Afflictions e recuperação.
- February 2016 Playtest Packet **p.2**: cinco revisões de status. O histórico
  anterior citava p.1; o texto das regras está na segunda página do PDF fornecido.
- PTU 1.05 Editation pp.13–14: Caretaking, reutilizado da entrega #89.
- PTU 1.05 Editation p.42, pp.47–50 e pp.54–55: Mark of Vision, Glyph,
  Alarm/Explosive Runes, Arcanist, Soul Investment e opções de Arcane Weapon Moves.

## Entidades da #69

Decisão recebida de Pedro: criar entidades próprias com estado e controles
específicos. As entidades ficam em `trainer.details.boundEntities`, com histórico
e foco próprios, preservados pelo save SQLite/Android existente.

- Glyph: consome Cleanse Tag, HP igual ao nível, limite por Occult Education,
  colocação Extended ou Swift por 1 AP, visibilidade, dano/destruição e Channel.
- Alarm Runes: múltiplos alvos, trigger registrado, alcance de 30 m, uma ativação
  por Scene, silenciar como Free Action. Explosão automática registra Hidden Power
  com stats do Trainer, custa 1 AP e respeita um Glyph por rodada. Falta de AP,
  Move ou disponibilidade da explosão mantém o disparo do alarme.
- Pessoa externa: consentimento, posição, Mark of Vision limitado à metade de
  Perception, um foco sensorial por vez. Negar acesso mantém AP reservado;
  retirar consentimento encerra o vínculo e devolve AP.
- Arma: definição Arcane do Ruleset, vínculo físico opcional a uma mão equipada,
  distância/portador, Soul Bond único, beckon até 10 m com conferência do teste
  oposto quando necessário. Soul Investment exige escolhas Adept/Master válidas;
  os Moves usam a arma correta e ficam indisponíveis se ela não estiver empunhada.
  Outra arma idêntica em outra mão não é afetada pela distância da primeira.
- Toda alteração passa por prévia/confirmação e verificação de estado concorrente.
  Cancelamento preserva AP/inventário; destruição, exclusão e troca de Soul Bond
  liberam os vínculos correspondentes sem consumir recursos de outro alvo.

Os controles são assistidos pela mesa: não detectam deslocamento/consentimento
automaticamente nem resolvem ataques contra alvos ausentes da campanha. A #69
permanece aberta pelos efeitos restantes acima.

## Verificação e limites

- `verify_issue69_bound_entities.mjs`: APIs reais Windows/Android, custos/limites,
  destruição, alarme sem explosão, consentimento/foco, arma/distância/teste oposto,
  escolhas de Moves, mão vinculada, save/reload, cancelamento e prévia obsoleta.
  Incluído nas duas suítes `npm run verify`, ambas aprovadas nesta continuação.
  Logs em `E:\ptu-docker-maintenance\entities-{windows,android}-verify.log`.
- Navegador real validou os novos formulários e controles, AP e reload em Windows
  e Android 390 px, sem erro JavaScript ou overflow horizontal. Evidências
  `windows-bound-entities.png` e `android-bound-entities.png` na pasta abaixo.
- `verify_issue99_106_107.mjs`: APIs Windows/Android, Special de Moves,
  Trainer/Pokémon, deduplicação, valor mínimo, alternativas, alvo inválido/repetido,
  condição desconhecida do Trainer, fonte ativa dos status, cancelamento e criação
  atômica de Breeder, pais opcionais e dimensões dos ícones.
- Regressões de status/quests ampliadas com prazo descritivo no JSON e os casos
  de timing/dano acima. Harness antigo de keywords passou a testar o valor
  efetivamente renderizado; removido comentário JavaScript que vazava na UI.
- Verificação visual por navegador real, com persistência isolada: Windows
  desktop e Android em viewport de 390 px; categorias, prazo e Breeder sem erros
  JavaScript. Evidências em `E:\ptu-docker-maintenance\backlog-oct24-ui`.
- Suítes completas executadas sequencialmente para evitar portas concorrentes.
  Logs finais em `E:\ptu-docker-maintenance\backlog-oct24-{windows,android}-final.log`.
- Testes usam estado isolado. Bancos/backup gerados pela suíte no worktree não
  fazem parte da entrega. Nenhum teste representa instalação física ou atualização
  por APK; não encerrar pendências de validação por inferência.
- Nenhum pacote de instalação foi gerado por este lote; versões permanecem as
  da base. Merge e publicação seguem aprovação do proprietário em `AGENTS.md`.

## Continuação após o merge da PR #108

Base: merge `1065db0`, de 24/10/2026. Branch `codex/bind-sensory-links`.
Fonte conferida diretamente no PDF: Core 1.05 p.179, incluindo o parágrafo
Mechanic de Channeler que não consta no texto reduzido do catálogo.

- Channeler vincula Pokémon já existentes na campanha. Ativação Swift, limite
  por Intuition, Check DC 15 para hostis, parar como Free e distância de 20 m.
  Posição, hostilidade e aliança são informações fornecidas pela mesa.
- Shared Senses aceita somente Pokémon Channeled e reserva 1 AP por Imprint.
  Permite múltiplos Imprints, remove o limite de distância e mantém um foco
  sensorial, com uma escolha de Pokémon por rodada (chave dia/Scene/round).
  Encerrar concentração não libera a escolha para trocar novamente na rodada.
- Parar Channeling, desmaiar, excluir o Pokémon/vínculo ou retirar Channeler
  encerra Imprints e devolve AP. Outros vínculos que exigem alvo Channeled também
  são liberados. Remover Imprint a mais de 20 m encerra Channeling imediatamente.
- Regras de limpeza compartilhadas entre API e UI, com histórico e save/reload.
  Fichas antigas sem entidades Pokémon novas mantêm os vínculos legados até
  liberação explícita; esta continuação não presume migração de Channeling.
- Corrigida concorrência no carregamento da ficha: resposta antiga ou calculada
  para uma versão anterior do Trainer não substitui o modelo atual. O navegador
  reproduziu perda de um AP reembolsado devido ao limite disponível desatualizado;
  a correção preserva o saldo e é coberta com respostas fora de ordem.
- Nomes dos alvos Bound priorizam a entidade correta sobre o fallback do Pokémon
  selecionado, evitando mostrar o mesmo nome em dois vínculos distintos.

Verificação: duas suítes completas `npm run verify` aprovadas; regressão #69
ampliada e reexecutada após os ajustes finais de limpeza/rótulos. O harness de
compatibilidade passou a carregar os scripts da página antes de `app.js`.
Navegador real validou Windows e Android 390 px: cadastro, Check, Channel,
Imprints, foco, distância, unbind, desmaio com AP e reload, sem erros JavaScript
ou overflow horizontal. Logs `E:\ptu-docker-maintenance\channel-{windows,android}-verify.log`;
evidências `backlog-oct24-ui/{windows,android}-shared-senses.png`.

A #69 permanece parcial pelos demais efeitos listados na tabela. Não foram
alteradas versões nem gerados novos APK/EXE nesta continuação.

## Spirit Boost após o merge da PR #109

Base: merge `6b29691`. Branch `codex/bind-spirit-boost`.
Core 1.05 p.179 define as cinco opções; p.61 define os limites de Stratagem.

- A seleção oferece alvo Channeled no combate ativo e referência Channeled,
  que pode ser o próprio alvo. A API calcula os Combat Stats da referência com
  o resolvedor existente: espécie/formas, Poké Edges, Held Item e Combat Stages,
  incluindo penalidades de Burn/Poison/Paralysis segundo o pack ativo.
- Só o maior atributo pode ser selecionado; empates oferecem escolha. O atributo
  e os valores de referência são registrados no Bind por alvo, enquanto o valor
  do bônus acompanha o Rank efetivo atual de Intuition. A escolha feita ao usar
  a Feature não muda silenciosamente por alterações posteriores da referência.
- Attack/Special Attack aplicam Bonus Damage apenas na classe correspondente;
  Defense/Special Defense aplicam DR apenas contra a classe correspondente.
  Speed entra no valor de iniciativa exibido para o combatente ativo, com os
  Combat Stages e a redução de Paralysis do Ruleset considerado.
- Cada alvo reserva 2 AP e recebe sua própria escolha. Impede outro Stratagem
  no mesmo alvo e Bind fora de combate. Unbind, fim de combate e término de
  Channeling no alvo removem escolhas/bônus e devolvem os AP correspondentes.
  Vínculo legado sem escolha válida é exibido como pendente, sem bônus presumido.
- Dados de combate são invalidados ao salvar mudanças e respostas antigas são
  descartadas por sequência/snapshot. Assim, retirar Bind não deixa um bônus
  antigo no próximo ataque. Prévias continuam protegidas contra alterações
  reais de ficha/inventário/cena; recálculos de `trainer.derived`, que o motor
  não usa como entrada, não provocam cancelamento indevido da confirmação.

`verify_issue69_spirit_boost.mjs` foi incluído nas duas suítes. Testa APIs reais
Windows/Android, cinco efeitos e classes, maior Stat/empate, referência própria,
penalidade de status/CS, escolhas independentes, AP, conflitos, persistência,
remoção, cancelamento, fim de combate e respostas fora de ordem. O teste de
entidades também cobre recálculo de valores de exibição durante confirmação.

Navegador real nas duas plataformas (Android 390 px): escolha de empate,
DR físico reduzindo dano de 40 para 35, remoção do bônus restaurando dano 40,
iniciativa 59 + 5 = 64, devolução dos AP no fim de combate e persistência após
reload. Sem erros JavaScript/overflow. Evidências `backlog-oct24-ui/*-spirit-boost-*.png`;
logs `E:\ptu-docker-maintenance\spirit-{windows,android}-verify.log` e
`spirit-ui-final.log`. Suítes completas aprovadas em execução sequencial.

A #69 continua aberta pelo escopo restante da tabela; nenhum APK/EXE ou versão
nova foi gerado nesta etapa.

## Armazenamento

Antes: C: 18,50 GiB livres; E: 238,39 GiB. Após testes/fontes: C: 17,68 GiB;
E: 238,39 GiB. O Docker estava desligado e seu breakdown inicialmente indisponível;
o Docker Desktop foi iniciado e o breakdown confirmou 12,34 GB de imagens,
9,48 GB de volumes e 5,23 GB de build cache (recursos compartilhados, preservados).
C: passou a 13,71 GiB livres após a inicialização. A sintaxe do script de build
foi validada no builder existente. Não foi iniciada compilação pesada,
limpeza de caches ou instalação de toolchain. Recursos de outros projetos,
campanhas e identidades de assinatura foram preservados.
