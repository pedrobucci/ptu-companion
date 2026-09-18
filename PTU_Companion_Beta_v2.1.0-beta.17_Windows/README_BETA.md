# PTU Companion Beta v2.1.0-beta.17

Current desktop beta adds the Trainer Gear pack contract, Gear Store, real item artwork in equipment UI, configurable equipment effects, and a resolved Struggle Attack card on Trainer Combat.

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
2. O aplicativo instala/extrai seus arquivos internos em `%LOCALAPPDATA%\PTU Companion Beta`.
3. Se Node.js 22+ não estiver disponível, o launcher tenta instalar automaticamente a versão LTS atual usando `winget`.
4. A interface abre em uma janela de aplicativo dedicada, sem abas ou barra de endereço do navegador.

O aplicativo usa o motor do Microsoft Edge em modo `--app` para exibir a UI nesta beta. Ele não abre uma aba de navegador comum. Microsoft Edge é requisito do Windows para esta distribuição.


## Hotfix de identificação da beta.10

A beta.10 usa um número de versão novo de propósito. Uma build beta.9 anterior havia sido substituída mantendo o mesmo número, então o launcher podia reutilizar `%LOCALAPPDATA%\PTU Companion Beta\runtime\2.1.0-beta.9` e continuar exibindo frontend antigo. A beta.10 extrai para um diretório de runtime novo e o launcher também passa a verificar o hash do bundle interno, evitando que isso se repita mesmo em uma recompilação acidental com o mesmo número de versão.

## Dados e atualizações

Os dados permanentes ficam em:

`%LOCALAPPDATA%\PTU Companion Beta\data`

Isso separa o save dos arquivos da versão e permite substituir o executável em futuras betas sem sobrescrever a campanha.

Quando o executável é iniciado **dentro da pasta completa desta distribuição** e ainda não existe banco no LocalAppData, ele procura `data\ptu_companion.sqlite3` ao lado do EXE e importa esse banco uma única vez. Assim, a pasta Beta completa pode continuar o save da versão funcional anterior.

## Retratos de Pokémon

Pokémon ligados a uma definição de Species recebem retrato automaticamente. A aplicação tenta sprites compactos do Pokémon Showdown e usa o sprite `front_default` do PokéAPI como fallback. O primeiro acesso a um retrato ainda não armazenado requer internet; depois de obtido, ele é salvo em `%LOCALAPPDATA%\PTU Companion Beta\data\portraits` e pode ser reutilizado offline.

Pokémon custom/homebrew sem imagem pública compatível continuam usando o retrato padrão/local existente.

## Catálogo e Backpack

A mochila mostra somente itens com quantidade maior que zero. O botão **Add game item** abre um catálogo pesquisável construído diretamente das definições de Items do Ruleset ativo.

A base fornecida atualmente possui **351 definições de Items do PTU 1.05 Core**. O pack de Game of Throhs fornecido no projeto adiciona Moves, Abilities e Features, mas não contém um arquivo de Items; portanto não há itens suplementares omitidos entre os packs atualmente fornecidos.

Adicionar um item do catálogo incrementa sua quantidade na Backpack. Quantidade zero oculta a entrada, sem remover sua definição do catálogo.

Na **beta.3**, cada item também mostra os marcadores de compatibilidade (`TRAINER`, `POKÉMON HELD`) e os Equipment Slots conhecidos (`Head`, `Body`, `Main Hand`, `Off Hand`, `Feet`, `Accessory`). Saves criados antes dessa correção são enriquecidos automaticamente ao carregar; por exemplo, `Sunglasses` passa a poder ser equipado em **Head** e `Focus Sash` em **Accessory**. Itens com mais de um slot possível pedem a escolha do slot ao equipar.

## Custom Item

**Custom Item** é um item coringa para necessidades de campanha. Ele persiste:

- nome;
- descrição livre;
- quantidade.

Por design ele não possui efeito mecânico automático, não é consumível automaticamente e não cria modificadores/equipamentos resolvidos.

## Verificação

A distribuição possui testes para:

- compatibilidade com a v2.0.1;
- regras de Background, Features/Edges repetíveis e armas;
- regressão de Equipment `null`;
- catálogo com todas as 351 definições de Items fornecidas;
- Backpack filtrada por quantidade;
- persistência SQLite do Custom Item;
- metadata de uso/slots, incluindo `Sunglasses → Head` e `Focus Sash → Accessory`;
- aplicação de Poké Edges de Stats e seleção de Species Skills para Skill Improvement;
- persistência de retratos locais de Trainer/NPC no schema SQLite v5;
- endpoint de retratos automáticos de Pokémon;
- presença do executável Windows x64.

Execute `npm run verify` em um ambiente de desenvolvimento com Node.js 22+ para rodar a suíte.


### Hotfix beta.2

A beta.2 corrige um problema de ciclo de vida do launcher que podia abrir a janela e logo em seguida derrubar o servidor local, produzindo `127.0.0.1 refused to connect`. O servidor agora permanece ativo por heartbeat da própria interface e encerra sozinho após a janela ser fechada.

### Ajustes beta.3

A beta.3 corrige o alinhamento dos botões da Backpack e completa os metadados de uso/Equipment Slot de itens de Trainer. Também corrige a aplicação mecânica de Poké Edges como **Underdog's Strength**, **Realized Potential**, **Mixed Sweeper** e **Skill Improvement** no modelo resolvido dos Pokémon.

### Retratos de Trainer e NPC

Trainer e NPCs agora aceitam retratos locais em JPEG, PNG ou WebP. A imagem é redimensionada no próprio aplicativo para no máximo 384 px e convertida para WebP antes de ser persistida, reduzindo o espaço ocupado. O arquivo não é enviado para nenhum serviço externo. O retrato aparece no cabeçalho/perfil do Trainer, no seletor de perfis e nas telas/listagens de NPCs.

Os retratos ficam em colunas próprias do SQLite (schema v5) e não são duplicados no histórico de revisões, evitando crescimento desnecessário do banco. Atualizações da aplicação preservam as imagens junto com o restante do save.

### Ajustes beta.4

A beta.4 adiciona o material homebrew fornecido em `Especial Classes.pdf` e `Classes extras.pdf` ao Ruleset ativo. As profissões do primeiro documento são classificadas como **Training Features**. Efeitos determinísticos foram estruturados quando possível; efeitos contextuais/ambíguos permanecem registrados para resolução manual em vez de serem aplicados como bônus permanentes indevidos.

`Sunglasses` agora aplica seus bônus de equipamento ao resolved Trainer (`+1 Charm`, `+1 Guile`, `+1 Intimidate`) somente enquanto estiver equipado em **Head**.

A tela de Progressão/Evolução de Pokémon recebeu uma correção específica no distribuidor de Stats: os controles de cada Stat ficam agrupados, as quatro colunas (`Stat`, `Existing allocation/Nature Base`, `New points/Re-Stat allocation`, `Final`) permanecem alinhadas e os nomes `Sp. Attack`/`Sp. Defense` são exibidos corretamente. O painel de Stats ocupa a largura total do wizard para facilitar a distribuição de pontos.



### Ajustes beta.5

A aba **Moves** da ficha do Pokémon exibe agora o **Range** de cada Move. Quando a definição possui informações de Contest, a interface também mostra **Contest Type** e **Contest Effect** em uma área visual separada do efeito de combate. A mesma apresentação é utilizada pela edição Android player-only.

## Data-only updates (`.ptucp`)

Starting with beta.6, new rules/content can be installed without replacing the EXE. Open **Pokédex & Rules**, use **Import .ptucp**, and select a compatible PTU Content Pack. The app validates and backs up the persistent definition database before importing.

The conversion contract for future content packs is in `docs/PTU_CONTENT_PACK_CONVERSION_GUIDE.md`.


## Gerenciar Content Packs (beta.7)

Em **Pokédex & Rules → Desktop Content Packs**, cada pack mostra se está **ACTIVE** ou **DISABLED** no Ruleset atual. **Disable** apenas o retira da resolução de regras; o pack continua instalado e pode ser reativado sem importar o arquivo novamente.

Packs importados por `.ptucp` também possuem **Uninstall**. A desinstalação cria primeiro um backup do banco de definições, remove as definições daquele `content_pack_id` e apaga os arquivos importados armazenados. Packs que fazem parte da aplicação não podem ser desinstalados. Dependências obrigatórias impedem desativações ou remoções inseguras.

Ao importar uma atualização com o mesmo `manifest.id`, o estado anterior é preservado: um pack que estava desativado continua desativado depois da atualização.

## Pokémon HP temporário e identidade (beta.8)

Na ficha do Pokémon, os botões `+1` e `+5` primeiro recuperam HP normal até o Máximo. Qualquer valor excedente passa a ser **Temporary HP** e fica salvo com a ficha. Os botões negativos consomem Temporary HP antes de reduzir o HP normal.

No card **Active State**, use **Edit Name & Loyalty** para alterar o nome/apelido da instância e a Lealdade (0–6) sem trocar a Species. Entrar no Storage continua realizando a recuperação completa e agora também zera Temporary HP.

## Species images from Content Packs (beta.9)

A Species inside a `.ptucp` may include a local PNG/JPEG/WebP portrait through `portrait_asset_path`. The importer validates the image (maximum 5 MB), stores it with the definition and serves it offline before trying public sprite fallbacks. The bundled `campaign-homebrew-fakemon-1-leva` is now v1.1.0 and includes portraits for all eight Species from the supplied PDF.

## Trainer Experience Bank (beta.9)

Trainer XP is a persistent Bank visible in the Profile. Normal Level Up spends 10 XP and preserves excess XP. A GM-confirmed Milestone Level Up spends 0 XP. The Features and Edges tabs also expose campaign purchase actions: Edge for 1 XP and Feature for 2 XP. Manual “Add Feature/Edge” remains available as a sheet-correction/GM-entry path and does not silently spend XP.

## Beta.14 — Hustle

Trainer Abilities now resolve Hustle mechanically: while active it applies -2 to all Accuracy Rolls and +10 to all Damage Rolls. These modifiers are exposed in Trainer Stats/Combat and are removed automatically when the equipment source is unequipped.


## beta.16 — complete imported item catalog + Weapon Store

After importing/updating/enabling/disabling a Content Pack, the **Items → + Add game item** cache is invalidated so newly active definitions appear immediately. Weapon packs can opt into the **Weapon Store** using `shop_categories: ["Weapon Store"]`; purchases create the canonical catalog item in the Backpack instead of a stripped copy.
