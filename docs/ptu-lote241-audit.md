# Auditoria do PTU Companion com o Lote 241

Base `3ea88dd`. Windows `2.1.0-beta.42` e Android `2.2.0-beta.49`.

## Regras corrigidas

| Funcionalidade | Fonte e perfil | Comportamento no Windows e no Android |
|---|---|---|
| Aflições e Poké Center | Core 1.05 pp. 246–247, regras consolidadas §39.5 | Badly Poisoned começa em 5 PV e dobra a cada turno aplicável. Remover, curar ou desmaiar reinicia o contador. Desfazer uma cura restaura o contador anterior. O Poké Center limpa as aflições tanto na ficha quanto no registro de combate. Disabled bloqueia o Move indicado e permite instâncias independentes. Suppressed ajusta a frequência de Moves e preserva a de Abilities. |
| Cura, PV temporários e lesões | Regras consolidadas §§42–44 | A cura respeita o limite de lesões, preserva PV temporários existentes e permite recuperar PV abaixo de zero. A ficha oferece uma ação separada para registrar PV temporários, mantendo o maior valor e respeitando bloqueios da forma ativa. Ataques recebidos contabilizam Massive Damage, marcos de PV e perda adicional quando o Pokémon está Heavily Injured. A rotina de avançar o turno aplica os marcos das perdas passivas e a perda adicional de Heavily Injured quando o usuário confirma uma Standard Action. |
| Ataques recebidos e críticos | Regras consolidadas §§20–21 e §§24–27 | O resolvedor recebe o d20 natural e o total de Accuracy, resolve falha no 1 e acerto no 20, e considera a evasão da ficha, itens e aflições conhecidas. O teste de crítico verifica a duplicação da rolagem de DB e a adição única do atributo e dos bônus externos. |
| Damage Base contextual | Core pp. 397 e 405, perfis `move:frustration` e `move:return`. Editation p. 63, `move:stored_power` e `move:power_trip`, GM_DECISION_60. | Return e Frustration usam Lealdade. Stored Power e Power Trip usam a soma dos estágios positivos dos cinco atributos, com teto intrínseco de DB 20 antes de STAB. Moves cujo DB depende de um dado ou de outro insumo não registrado apresentam a regra e pedem o dano resolvido na mesa. |
| Aprendizado e progressão | Regras consolidadas §§8.2–8.7 | Uma linha sem nível na lista da espécie deixa de ser elegível no nível inicial. Os testes conferem Base Stat Relations com HP excluído, pontos de Tutor a cada cinco níveis e slots de Ability nos níveis 20 e 40. As suítes também cobrem pré-requisitos, origens de aprendizado, reversão de progressão e evolução. |
| Campos de Moves do Core | Core pp. 351, 366, 368, 386, 397, 405, 406 e 409 | AC restaurado para Fling, Frustration, Magnitude, Return, Round, Spit Up e Triple Kick. Mat Block identificado como Status. |
| Campos de Moves da Editation | Editation p. 63, com origem SuMo quando aplicável | Corrigidos 16 Moves entre frequência, DB, AC e alcance. Overrides de resolução exigem a Editation ativa e preservam variantes fixadas por versão. Steam Eruption recupera AC e DB da própria entrada Editation. |
| Itens e lojas | Perfis `item:capture_styler`, `item:master_ball`, `item:snag_machine`, `item:shock_collar`, `item:winter_cloak` | A triagem comparou os preços com os perfis. Os três primeiros valores são referências restritas ou de mercado negro. Os dois últimos resolvem para um pack de campanha com preço próprio. Essas cinco divergências não viraram alterações de preço de loja. |

## Decisões de fechamento

| Perfil | Fonte e decisão | Aplicação |
|---|---|---|
| `move:focus_punch` | Core p. 365, GM_DECISION_92 | O texto informa que um ataque que causa ao usuário pelo menos 25% dos seus PV máximos interrompe a execução sem consumir frequência. Declaração e interrupção são confirmadas na mesa. |
| `move:mind_reader` | Core p. 402, GM_DECISION_93 | Registra que Read pode ser consumido para acertar o alvo lido ou para fazê-lo errar o usuário. Telepathy e Mindlock continuam explícitos. O alvo e o consumo são acompanhados na mesa. |
| `move:roar` | Core p. 406, GM_DECISION_94 | O texto direciona os alvos atingidos para longe do usuário e em direção ao treinador, quando possível. Deslocamento e Recall dependem da posição na mesa. |
| `move:spider_web` | Core p. 348, GM_DECISION_95 | O jogador pode registrar o acerto no combatente acompanhado. Limpar Stuck manualmente ou com Electrodash remove o Trapped vinculado. Armadilhas independentes persistem e Ghost continua imune. |
| `ability:mummy` | Core p. 324 e Playtest de fevereiro de 2016 p. 7, GM_DECISION_96 | O perfil do playtest especifica uma Ability do atacante até o fim da Scene ou até a troca. A escolha e a desativação são acompanhadas na mesa. |
| `item:luxury_ball` | Core pp. 210–211 e 272, GM_DECISION_97 | O catálogo informa modificador de captura −5, felicidade inicial narrativa e Lealdade inicial definida pelo mestre. A captura continua sendo resolvida na mesa. |

## Cobertura e limites

- A triagem do catálogo ativo cruzou, por nome, 755 Moves, 475 Abilities e 367 itens no Windows, e 754 Moves, 475 Abilities e 367 itens no Android. O cruzamento por nome é uma triagem. Variantes, condições e efeitos textuais exigem correspondência de perfil e validação por fluxo.
- A auditoria incluiu a resolução de ataques recebidos e as fórmulas que a ficha já calcula. Os botões de ajuste manual alteram o valor de PV e permitem corrigir a ficha. Os marcos desses ajustes e a decisão de morte conforme o tipo de combate são avaliados na mesa.
- A biblioteca local contém perfis, contratos descritos e índices dos avaliadores. O pacote executável citado no índice é separado e o link exige uma sessão autenticada. A validação desta entrega usa as fontes locais e os testes do aplicativo.
- Os formatos de save e de `.ptucp` foram mantidos. A validação inclui importação de packs, salvamento, exportação de Pokémon e reversão de progressão. Não houve build ou publicação de instaladores.

## Resultado dos testes

| Verificação | Windows | Android |
|---|---|---|
| Suíte da base `3ea88dd` | Aprovada | Aprovada |
| Suíte após as correções | 56 scripts aprovados | 56 scripts aprovados |
| Oito verificações suplementares de combate e formas com código das duas plataformas | Aprovadas | Aprovadas |
