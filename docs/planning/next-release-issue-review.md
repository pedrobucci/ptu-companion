# Revisão de issues para a próxima release — 2026-10-08

Base: pré-release Windows beta.31 / Android beta.37, commit `1e4132c`.
Consulta de todas as issues abertas e comentários; nenhuma PR aberta ao iniciar.
Issues #83, #59, #57, #29, #28 e #19 já possuem implementação entregue e não
entram neste lote. Estados de validação anteriores permanecem registrados no roadmap.

| Grupo | Issues ainda sem implementação | Condição |
| --- | --- | --- |
| Bugs de Home/GM/Edges | #75, #77, #78, #76 | Prioridade superior a melhorias. #75 reproduzida no HTML gerado; demais relatos ainda precisam de contexto ou fontes. |
| Gestão de Pokémon | #71, #27 | Decisões aprovadas; bom lote futuro por compartilhar preservação de dados, prévias e correção de escolhas. |
| Modificadores e AP | #21, #69 | Escopo aprovado; cada efeito precisa ser mapeado nas fontes PTU e na precedência ativa. Não agrupar ambos indiscriminadamente por serem amplos. |
| Quests | #24, #85 | #24 pronta; #85 relacionada, com decisões sobre checklist e anotações pendentes. |
| Identidade visual | #13 | Direção aprovada; preparar proposta revisável antes de entregar assets. |
| Alterações fora de combate | #74, #89 | Breeder/Pokecenter/Mentor têm relação, mas contratos e fontes pendentes. |
| Visibilidade de GM | #88 | Indicador ON/OFF explícito; pequeno complemento ao lote prioritário Home/GM. |

## Lote iniciado

- #75: a Home usa `i.icon` como texto cru; URLs e imagens embutidas não são
  renderizadas como imagens. Reutilizar `itemIconHtml`, inclusive escape e fallback,
  como nas telas Items/Shop. Reproduzido por execução da função real `dashboard`
  nos dois clientes, sem afirmar reprodução da captura original indisponível.
- #88: indicador global GM ON/OFF, com rótulo acessível, baseado no estado existente.
  Evitar o texto ambíguo “available” na ficha do Trainer.
- #77: verificar o fluxo existente com GM desligado/ligado, cancelamento e
  confirmação; a correção da interface não prova a causa do relato original.

## Pendências que impedem incluir outros bugs neste lote

- #77: se o problema ocorrer com GM ligado, informar plataforma, ação após a
  confirmação e presença do grant após reiniciar. O caminho esperado está coberto
  por regressão; o relato original permanece em Triagem.
- #78: confirmar Ruleset e fonte/página aplicável para a incompatibilidade entre
  Mystic Senses e Elemental Connection; não alterar regras por interpretação do nome.
- #76: confirmar fonte/página e se Field Clinic é Edge ou Feature no Ruleset ativo.

## Verificação e entrega

Regressão executa funções reais dos clientes: imagens remotas/embutidas, ícones
textuais, escape, fallback, dados de inventário preservados, indicador GM,
toggle salvo, remoção bloqueada/cancelada/confirmada e payload de persistência.
O navegador e o payload SQLite são exercitados com armazenamento isolado.
Não representa validação visual em Android instalado nem atualização por APK.
Preparar PR revisável; merge, versão e publicação seguem o checklist do projeto.
`npm run verify` completo aprovado em Windows e Android. A primeira execução Android concorrente falhou por conexão recusada no servidor de porta fixa 42132 usado pela regressão #32; a repetição isolada passou. Executar essas suítes sequencialmente. `node --check` e `git diff --check` aprovados.
