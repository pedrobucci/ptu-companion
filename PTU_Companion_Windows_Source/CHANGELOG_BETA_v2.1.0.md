# Changelog — Beta v2.1.0-beta.6

## Content Pack updates without reinstalling the app

- Adds Desktop-only `.ptucp` import in **Pokédex & Rules → Desktop Content Packs**.
- Definition data now lives in persistent `%LOCALAPPDATA%\PTU Companion Beta\data\definitions\ptu_definitions.sqlite3`.
- Import validates `manifest.json`, SHA-256, byte sizes, record counts and required dependencies.
- Import is transactional and creates a SQLite backup before changing definitions.
- Imported packs are enabled automatically in the currently active Ruleset.
- Installed archives and import history are retained under the persistent definitions directory.
- Bundled seed definitions are never mutated by an import.
- Adds `docs/PTU_CONTENT_PACK_CONVERSION_GUIDE.md`, a self-contained handoff contract for future ChatGPT sessions to convert PDFs/homebrew/data into `.ptucp` archives.

## beta.5 — Pokémon Move Range & Contest data

- A visualização de Moves do Pokémon agora exibe **Range** diretamente junto às métricas do Move.
- Moves com dados de Contest passam a exibir **Contest Type** e **Contest Effect** em um bloco separado do efeito de combate.
- O contrato de definições de Move passa a expor `contestType` e `contestEffect`, preservando `null` quando a fonte não fornece dados de Contest.
- O layout é responsivo: no celular, Frequency/AC/DB usam a grade compacta e Range ocupa uma linha legível; Contest continua separado para não confundir regras de batalha e Contest.


## beta.4 — Campaign content / Sunglasses / Pokémon progression UI

- Importa o conteúdo homebrew dos PDFs fornecidos como definições estruturadas do Ruleset: Hacker, Police Officer, Conjurer, Enhancer, Writer, Ronin, Without Evolution Ace, respectivas Features, Human Form/Human Speech, Pokemon Understanding e Species Highbrow.
- As profissões de `Especial Classes.pdf` passam a ser tratadas como **Training Features**, incluindo as duas Features independentes de Plutocrata.
- `Sunglasses`, quando equipado no slot Head, agora aplica mecanicamente `+1 Charm`, `+1 Guile` e `+1 Intimidate` no resolved Trainer; remover o item remove os bônus.
- Corrige a tela de Progressão/Evolução de Pokémon: a grade de Stats não é mais sobrescrita pelo CSS da progressão de Trainer, os controles `− / pontos / +` ficam em um único stepper alinhado e `Sp. Attack`/`Sp. Defense` deixam de aparecer como nomes internos `special_attack`/`special_defense`.
- Reorganiza o wizard de Progressão de Pokémon para reduzir áreas vazias: Experience e Evolution dividem a primeira linha, Stats ocupa a largura total, Abilities/ Moves dividem a linha seguinte e Review & Apply ocupa a largura total.
- Em telas estreitas, a tabela de Stats mantém as colunas legíveis com rolagem horizontal em vez de quebrar cada Stat em duas linhas.




## beta.3 — Poké Edges / Trainer & NPC portraits

- `Underdog's Strength` agora soma +1 a cada Base Stat do Pokémon no modelo resolvido, recalcula os Stats finais/Max HP e bloqueia Evolution enquanto o Edge estiver presente.
- `Realized Potential` passa a conceder `45 - Species Base Stat Total` Bonus Stat Points, sem reduzir esse valor por modificadores como Underdog's Strength; os pontos entram no resolved Pokémon e seguem Base Stat Relations.
- `Mixed Sweeper` passa a exigir e aplicar seus 3 Stat Points por Rank apenas entre HP, Defense, Special Defense e Speed.
- `Skill Improvement` agora lista as Skills reais da Species, mostra o valor atual e o próximo Rank, impede selecionar novamente a mesma Skill e aplica o aumento no resolved Pokémon.
- Upload de retrato para Trainer e NPCs em JPEG/PNG/WebP. A imagem é redimensionada para no máximo 384 px e convertida localmente para WebP antes de salvar.
- Retrato do Trainer aparece também no seletor de perfis; retratos de NPC aparecem na lista e no detalhe.
- Schema SQLite atualizado para v5 com `portrait_data_url` em Trainer/NPC. Retratos ficam fora dos snapshots de revisão para evitar duplicação de imagens no banco e são preservados ao restaurar revisões.

## beta.3 — Backpack / Equipment metadata

- Corrige o layout dos controles de quantidade e da ação principal dos itens na Backpack; os botões `−`, quantidade, `＋` e `Equip/Use` permanecem alinhados na mesma área de ações.
- O catálogo e a Backpack agora exibem explicitamente se o item é utilizável por Trainer, se pode ser Held Item de Pokémon e quais Equipment Slots são válidos.
- Corrige e complementa slots determinísticos ausentes na extração do Core, incluindo `Sunglasses → Head`, roupas/armaduras → Body, calçados → Feet, goggles/masks → Head e `Mega Ring → Accessory`.
- Garante `Focus Sash → Accessory` (assim como os demais Held Items compatíveis com Trainer) mesmo ao carregar saves legados sem metadados.
- Itens de mão com múltiplos slots, como Iron Ball e Focus, agora permitem escolher o slot ao equipar.
- Equipamentos explicitamente descritos como two-handed (Fishing Rods, Glue Cannon, Hand Nets e Weighted Nets) reservam a Off Hand quando equipados na Main Hand.
- Saves antigos são hidratados automaticamente a partir das definições do Ruleset, recuperando `definitionId`, descrição, flags de uso e slots sem alterar quantidades.

## Desktop Windows

- Primeira distribuição Beta em `PTU Companion Beta.exe` (Windows x64 GUI).
- Launcher de arquivo único com bundle interno da aplicação.
- Instalação/extração em LocalAppData na primeira execução.
- Janela standalone via Microsoft Edge App Mode, sem UI normal de navegador.
- Instalação automática opcional de Node.js LTS via `winget` quando Node 22+ não está disponível.
- Dados permanentes separados dos arquivos da versão.
- Migração inicial de `data/ptu_companion.sqlite3` quando o EXE está dentro da pasta completa da versão anterior/beta.

## Pokémon

- Retratos automáticos para Pokémon ligados a Species do Ruleset.
- Sprites compactos obtidos sob demanda e armazenados em cache local.
- Fallback para PokéAPI e, por último, retrato local/padrão.

## Items / Backpack

- Novo endpoint de catálogo de Items baseado no Ruleset ativo.
- Catálogo inclui as 351 definições de Item atualmente fornecidas pelo PTU 1.05 Core.
- Backpack agora mostra somente itens possuídos (`qty > 0`).
- Busca e adição de qualquer Item catalogado diretamente pela Backpack.
- Controles de quantidade +/−.
- Descrição/efeito e fonte do Item exibidos no inventário e no seletor.
- Metadados dos itens continuam persistindo em `inventory_items.details_json`; a beta.3 eleva o schema geral para v5 para suportar retratos de Trainer/NPC.

## Custom Item

- Novo Custom Item com nome, descrição e quantidade.
- Sem aplicação mecânica automática por design.

## Compatibilidade

- Preservadas as correções e regras verificadas da v2.0.1.
- Saves antigos são migrados pelo schema SQLite existente.


## beta.2 hotfix — Windows launcher

- Corrige `ERR_CONNECTION_REFUSED` que podia ocorrer quando o Microsoft Edge entregava a janela `--app` a outro processo e o launcher encerrava o servidor Node junto com o processo inicial.
- O servidor desktop agora usa heartbeat da interface e encerra automaticamente após a janela ficar fechada/inativa.
- O processo do servidor fica desacoplado do processo transitório do Edge, mantendo `127.0.0.1` disponível enquanto a aplicação estiver aberta.
- `server.log` passa a ser preservado entre execuções para facilitar diagnóstico.