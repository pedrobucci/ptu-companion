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
| #69 | Parcial, em andamento | Bind/AP e parte dos efeitos de combate já entregues. Permanecem efeitos que exigem estado/fluxos próprios: itens concedidos, runas, tokens, vínculos sensoriais, escolhas de Stance, efeitos defensivos/por tipo/por evento, iniciativa e alterações de range/crit/effect. Não declarar completa com base apenas na reserva de AP ou exibição de texto. |
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

## Verificação e limites

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

## Armazenamento

Antes: C: 18,50 GiB livres; E: 238,39 GiB. Após testes/fontes: C: 17,68 GiB;
E: 238,39 GiB. O Docker estava desligado e seu breakdown inicialmente indisponível;
o Docker Desktop foi iniciado e o breakdown confirmou 12,34 GB de imagens,
9,48 GB de volumes e 5,23 GB de build cache (recursos compartilhados, preservados).
C: passou a 13,71 GiB livres após a inicialização. A sintaxe do script de build
foi validada no builder existente. Não foi iniciada compilação pesada,
limpeza de caches ou instalação de toolchain. Recursos de outros projetos,
campanhas e identidades de assinatura foram preservados.
