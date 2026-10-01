# Recuperação dos Pokémon dos PDFs Books

## Escopo

Varredura dos 35 PDFs fornecidos por Pedro em `Documents/Pokémon/Books`. O inventário versionado registra nome, SHA-256 e páginas com ficha de espécie. Regras e retratos vieram exclusivamente desses PDFs; os três stats ausentes de Lopunny (Omega) seguem a decisão explícita de Pedro.

50 fichas recuperadas: 38 novas espécies/variantes e 12 fichas PTU para cadastros externos de Scarlet/Violet. 43 habilitadas para criação; 7 preservadas na biblioteca, sem criação até as decisões abaixo. Inclui 9 Moves, 5 Abilities e Smith; 22 vínculos evolutivos seguros.

## Integração

- Pack `campaign-books-species`, versão de conteúdo `1.0.0`, prioridade 180, habilitado em `all-provided-material`. Não há incremento de versão do aplicativo nem publicação de release.
- Windows: seeds versionados + atualização do banco de definições existente pelo mecanismo com backup; saves/campanhas não foram editados.
- Android: mesmo arquivo `.ptucp` e registros embutidos antes do bootstrap; controle de pack/importações continua pelo mecanismo existente.
- Versões antigas das espécies e regras continuam disponíveis. As 12 fichas Scarlet/Violet substituem os stubs na resolução do ruleset, sem apagar os registros antigos.
- Variantes recebem nomes distintos para evitar substituir espécies normais. Waifu Pool usa qualificadores 1/2/3 porque os títulos do PDF são homônimos.
- Retratos extraídos das imagens originais dos PDFs com máscaras de transparência; não são imagens geradas.

## Decisão já aplicada

Lopunny (Omega): Pedro pediu os valores da Lopunny normal para os campos em branco. Defense **8**, Special Attack **5**, Special Defense **10**, da fonte Gen 8ish. HP 9, Attack 11 e Speed 11 continuam da ficha Omega. O JSON registra a origem de cada substituição.

## Decisões pendentes

| Fonte | Divergência | Tratamento atual |
|---|---|---|
| Aron Desert p.3 | Título Hydrusa; evolução indica Aggron | Hydrusa (Desert), criação suspensa; sem vínculo Lairon → terminal |
| Budice p.3 | Título Aromint; linha evolutiva Aromist | Aromint, criação suspensa; sem vínculo Fromint → terminal |
| Waifu Pool p.9 | Psychic/Poison na ficha; linha anterior Dark/Fairy | Gardevoir (Waifu Pool 3), criação suspensa |
| Scarlet/Violet p.6 | Skeledirge apenas Fire | Criação suspensa, sem substituir tipos por conhecimento externo |
| Scarlet/Violet pp.10–12 | Tinkatink/Tinkatuff/Tinkaton Ice/Psychic | Criação suspensa, sem corrigir para tipos externos |
| Eudemown pp.1–2 | Evolução nível 30 ou 25, ambas Loyalty 6 | Fichas disponíveis; evolução automática adiada |
| Waifu Pool p.3 | Primeiro estágio Icynib; pp.1–2 indicam Ralts | Fichas disponíveis; evolução automática dessa linha adiada |

A ficha Lopunny (Delta Alternative) menciona Buneary (Delta), cuja ficha não está nos PDFs fornecidos. Nenhuma ficha dessa pré-evolução foi inventada.

## Referências sem definição suficiente

Alguns PDFs apenas citam nomes sem fornecer regras completas, e o catálogo existente também não tem essas definições. Os nomes e textos originais foram preservados, marcados para revisão; nenhuma regra externa foi completada:

- Ability **Wind Force** (Grifflet/Gryphault/Seismogryph).
- Capabilities **Breathless** e **Dig**.
- Moves **Glow**, **Wave Clash**, **Trailblaze** e **Pounce**.

**Concealed Power** traz `3d12+10 / 30`, mas não informa um Damage Base numérico; os dados de dano foram preservados e nenhum DB foi deduzido. As Abilities novas e Smith preservam efeitos contextuais/manual; automação nova de combate/crafting não faz parte da recuperação do catálogo. A Mega de Fire Giant Aegislash preserva stats/Ability com ativação manual, pois o PDF não identifica item/requisitos de ativação.

## Conteúdo já presente / outras fontes

Gen 8ish: todas as páginas identificadas de espécie já têm entrada correspondente. Fakemon, Chickute, Knight, Needlene e Paldean Pidgey já estão representados pelos packs existentes e não foram duplicados. PDFs de regras/classes foram varridos e não trazem fichas de espécies ausentes no formato detectado. `Pokemon detetive` é uma lista de indivíduos/contatos; `Maverick` é uma ficha individual de Pokebot nível 100, sem dados suficientes para inferir uma espécie nova.

## Fichas recuperadas

| Pokémon | Fonte / página | Criação |
|---|---|---|
| Lilligant Alternate | Alola Lilligant.pdf p.1 | Disponível |
| Aron (Desert) | Aron Desert.pdf p.1 | Disponível |
| Lairon (Desert) | Aron Desert.pdf p.2 | Disponível |
| Hydrusa (Desert) | Aron Desert.pdf p.3 | Aguardando decisão |
| Babee | Babee.pdf p.1 | Disponível |
| Budice | Budice.pdf p.1 | Disponível |
| Fromint | Budice.pdf p.2 | Disponível |
| Aromint | Budice.pdf p.3 | Aguardando decisão |
| Unown (Eudemown) | Eudemown.pdf p.1 | Disponível |
| Eudemown | Eudemown.pdf p.2 | Disponível |
| Fire Giant Honedge | Fire Giant Honedge.pdf p.1 | Disponível |
| Fire Giant Doublade | Fire Giant Honedge.pdf p.2 | Disponível |
| Fire Giant Aegislash | Fire Giant Honedge.pdf p.3 | Disponível |
| Grifflet | Grifflet.pdf p.1 | Disponível |
| Gryphault | Grifflet.pdf p.2 | Disponível |
| Seismogryph | Grifflet.pdf p.3 | Disponível |
| Icynib | Icynib.pdf p.1 | Disponível |
| Featherice | Icynib.pdf p.2 | Disponível |
| Wintryplume | Icynib.pdf p.3 | Disponível |
| Izaguiraze | Izaguiraze.pdf p.1 | Disponível |
| Buneary (Iceland) | Lopunny.pdf p.1 | Disponível |
| Lopunny (Iceland) | Lopunny.pdf p.2 | Disponível |
| Lopunny (Delta Alternative) | Lopunny.pdf p.3 | Disponível |
| Buneary (Omega) | Lopunny.pdf p.4 | Disponível |
| Lopunny (Omega) | Lopunny.pdf p.5 | Disponível |
| Miroboros | Miroboros.pdf p.1 | Disponível |
| Shieldra | Miroboros.pdf p.2 | Disponível |
| Hydrusa | Miroboros.pdf p.3 | Disponível |
| Noirela | Noirela.pdf p.1 | Disponível |
| Sprigatito | Scarlet and Violet.pdf p.1 | Disponível |
| Floragato | Scarlet and Violet.pdf p.2 | Disponível |
| Meowscarada | Scarlet and Violet.pdf p.3 | Disponível |
| Fuecoco | Scarlet and Violet.pdf p.4 | Disponível |
| Crocalor | Scarlet and Violet.pdf p.5 | Disponível |
| Skeledirge | Scarlet and Violet.pdf p.6 | Aguardando decisão |
| Quaxly | Scarlet and Violet.pdf p.7 | Disponível |
| Quaxwell | Scarlet and Violet.pdf p.8 | Disponível |
| Quaquaval | Scarlet and Violet.pdf p.9 | Disponível |
| Tinkatink | Scarlet and Violet.pdf p.10 | Aguardando decisão |
| Tinkatuff | Scarlet and Violet.pdf p.11 | Aguardando decisão |
| Tinkaton | Scarlet and Violet.pdf p.12 | Aguardando decisão |
| Ralts (Waifu Pool 1) | Waifu Pool.pdf p.1 | Disponível |
| Kirlia (Waifu Pool 1) | Waifu Pool.pdf p.2 | Disponível |
| Gardevoir (Waifu Pool 1) | Waifu Pool.pdf p.3 | Disponível |
| Ralts (Waifu Pool 2) | Waifu Pool.pdf p.4 | Disponível |
| Kirlia (Waifu Pool 2) | Waifu Pool.pdf p.5 | Disponível |
| Gardevoir (Waifu Pool 2) | Waifu Pool.pdf p.6 | Disponível |
| Ralts (Waifu Pool 3) | Waifu Pool.pdf p.7 | Disponível |
| Kirlia (Waifu Pool 3) | Waifu Pool.pdf p.8 | Disponível |
| Gardevoir (Waifu Pool 3) | Waifu Pool.pdf p.9 | Aguardando decisão |

## Validação do conteúdo

- ZIP e manifest: contagens, tamanhos, hashes e referências de artwork validados pelo importador; nenhum warning.
- Os arquivos Windows/Android são idênticos; todos os 65 registros resolvidos têm JSON mecânico idêntico nos dois runtimes.
- 50 retratos offline presentes; os 50 arquivos de imagens foram revisados visualmente em folha de contato.
- SQLite quick_check OK nos dois seeds; registros reaparecem após reabertura.
- Instalação em uma cópia do banco anterior, idempotência e preservação do pack desabilitado verificadas.
- Validação visual interativa nos aplicativos instalados ainda pendente. Nenhuma suite de testes foi acrescentada ou executada manualmente nesta tarefa.

## Reprodução da conversão

Os dados revisados e retratos estão em `seed/content-packs/campaign-books-species`; o build comum não precisa dos PDFs.

```powershell
python PTU_Companion_Windows_Source/scripts/build_books_species_pack.py
node PTU_Companion_Windows_Source/scripts/install_books_species_pack.mjs
```

Para extrair novamente (isso sobrescreve o JSON revisado; preservar as decisões antes), use Python com pdfplumber/Pillow e Poppler no PATH:

```powershell
python PTU_Companion_Windows_Source/scripts/build_books_species_pack.py --extract --books "C:\Users\Usuário\Documents\Pokémon\Books"
```

Depois da extração, revisar nomes, referências, decisões de Pedro e evolução antes de gerar os packs. O comando de instalação altera apenas os dois seeds versionados e guarda backups na pasta temporária; a migração do runtime faz seu próprio backup do banco de definições existente.
