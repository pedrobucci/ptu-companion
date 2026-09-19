# PTU Companion — Guia permanente de conversão para Content Packs (`.ptucp`)

**Versão do formato:** `ptu-content-pack` / `format_version: 1`  
**Aplicação de referência:** PTU Companion Desktop Beta `v2.1.0-beta.6+`  
**Finalidade:** permitir que uma futura instância do ChatGPT converta PDFs, textos, tabelas, homebrews ou correções de dados em um pacote importável **sem alterar o código da aplicação**.

> **INSTRUÇÃO PARA UMA FUTURA VERSÃO DO CHATGPT**  
> Quando o usuário entregar este arquivo junto de material de regras e pedir “converta isto para o PTU Companion”, trate este documento como o contrato de interoperabilidade. Gere um arquivo `.ptucp` válido, preserve a origem e a redação mecânica do material, estruture apenas o que for semanticamente seguro e marque ambiguidades com `needs_review: true`. Não altere o executável, JavaScript, Rules Engine ou schema do app para uma atualização que possa ser representada por este formato.

---

## 1. Quando usar um Content Pack

Use `.ptucp` quando a mudança for **somente de dados/regras/conteúdo**, por exemplo:

- novas Species ou Fakemon;
- Moves;
- Abilities;
- Capabilities;
- Trainer Features e Classes;
- Trainer Edges;
- Poké Edges;
- Items;
- profissões representadas como Training Features;
- novas versões/correções de uma definição já existente;
- linhas de evolução PTU;
- homebrew de campanha;
- errata ou rebalance que substitui uma definição por precedência de Ruleset.

**Não** use `.ptucp` se a solicitação exige comportamento novo que o Rules Engine ainda não sabe representar, nova tela, novo campo obrigatório de banco, novo algoritmo, nova ação de combate ou nova operação semântica. Nesses casos:

1. coloque no pack todo o conteúdo que puder ser representado com segurança;
2. mantenha os efeitos não suportados em texto/contextual;
3. informe no relatório de conversão quais efeitos precisariam de alteração de código para automação total.

---

## 2. Princípios obrigatórios

### 2.1. Fonte é soberana

Não “corrija”, reescreva ou complete silenciosamente uma regra usando conhecimento externo. Preserve:

- nome;
- prerequisites;
- activation/frequency;
- target;
- trigger;
- effect;
- special/extra/bonus;
- números;
- tabelas;
- página/origem.

Correções óbvias de ortografia podem ser normalizadas no campo estruturado se o significado não mudar, mas `raw_text` deve preservar a forma original ou uma transcrição fiel.

### 2.2. Não automatizar além da evidência

Um bônus determinístico como “+1 Charm” pode virar um efeito estruturado. Já algo como “+2 enquanto estiver procurando pistas” **não** deve virar `Charm +2` permanente.

Quando houver contexto, trigger, duração, escolha narrativa ou interpretação humana, mantenha o texto e use cobertura parcial/manual.

### 2.3. Toda definição tem provenance

Cada registro deve ser rastreável por:

- `source_id`;
- `source_title`;
- `source_kind`;
- `source_page` quando aplicável;
- `content_pack_id`;
- `definition_version_id`.

### 2.4. Packs não apagam versões de outros packs

O PTU Companion resolve versões pelo Ruleset. Um pack de prioridade maior pode substituir logicamente uma definição de prioridade menor, mas não deve editar destrutivamente o registro de outro pack.

### 2.5. IDs são estáveis

Depois de publicado um `id` lógico, mantenha-o nas versões futuras. Trocar `sunglasses` por `sun-glasses-v2` quebra referências existentes.

---

## 3. Arquivo `.ptucp`

Um `.ptucp` é um **ZIP normal** renomeado para `.ptucp`.

Estrutura mínima:

```text
my-pack.ptucp
├── manifest.json
└── content/
    ├── moves.ndjson
    ├── abilities.ndjson
    ├── capabilities.ndjson
    ├── features.ndjson
    ├── edges.ndjson
    ├── poke_edges.ndjson
    ├── items.ndjson
    ├── species.ndjson
    └── datasets/
        ├── ptu_evolution_edges.json
        └── ptu_evolution_families.json
```

Somente os arquivos necessários precisam existir.

O importador Desktop aceita atualmente estes tipos de definição:

| Arquivo | `definition_kind` |
|---|---|
| `content/moves.ndjson` | `moves` |
| `content/abilities.ndjson` | `abilities` |
| `content/capabilities.ndjson` | `capabilities` |
| `content/features.ndjson` | `features` |
| `content/edges.ndjson` | `edges` |
| `content/poke_edges.ndjson` | `poke_edges` |
| `content/items.ndjson` | `items` |
| `content/species.ndjson` | `species` |

Datasets suportados pelo importador v1:

- `content/datasets/ptu_evolution_edges.json`
- `content/datasets/ptu_evolution_families.json`

Outros datasets existentes no seed principal podem exigir migração de aplicação. Não inventar suporte no pack sem confirmação.

---

## 4. `manifest.json`

Exemplo:

```json
{
  "format": "ptu-content-pack",
  "format_version": 1,
  "id": "campaign-homebrew-example",
  "name": "Campaign Homebrew — Example",
  "version": "1.0.0",
  "priority": 180,
  "kind": "homebrew",
  "browse_only": false,
  "source_ids": ["example-source"],
  "dependencies": [
    {"id": "ptu-core-1.05", "required": true}
  ],
  "definition_resolution": {
    "logical_id_field": "logical_id",
    "version_id_field": "definition_version_id",
    "strategy": "highest_enabled_priority_then_ruleset_order",
    "version_pinning_supported": true
  },
  "content_counts": {
    "features": 2,
    "items": 1
  },
  "files": {
    "content/features.ndjson": {
      "sha256": "<sha256 lowercase>",
      "bytes": 1234,
      "records": 2,
      "media_type": "application/x-ndjson"
    },
    "content/items.ndjson": {
      "sha256": "<sha256 lowercase>",
      "bytes": 567,
      "records": 1,
      "media_type": "application/x-ndjson"
    }
  },
  "generated_at": "2026-09-14",
  "notes": "Converted for PTU Companion. Ambiguous clauses remain manual."
}
```

### Campos obrigatórios

- `format`: sempre `"ptu-content-pack"`;
- `format_version`: sempre `1` nesta especificação;
- `id`: identificador permanente do pack;
- `name`;
- `version`;
- `priority`;
- `files` com hash, tamanho e contagem de todos os arquivos declarados.

### Convenção de prioridade

Use como orientação:

- `100`: Core oficial;
- `110–169`: suplementos, playtests e referências posteriores;
- `170–179`: rebalance/errata de campanha;
- `180`: homebrew de campanha;
- `190+`: override explícito e deliberado.

Não aumente prioridade só para “garantir” que o pack vença. Use a precedência que representa a intenção do material.

### `source_ids`

Use IDs exclusivos do pack sempre que possível. Isto é especialmente importante para linhas de evolução, pois atualizações do mesmo pack substituem datasets com o mesmo `source_id`.

---

## 5. NDJSON

Cada arquivo de definição usa **NDJSON**: um objeto JSON completo por linha.

Correto:

```text
{"id":"feature-a","name":"Feature A",...}
{"id":"feature-b","name":"Feature B",...}
```

Não envolver em `[...]`.

Use UTF-8.

---

## 6. Campos comuns das definições

A forma mais segura é produzir registros compatíveis com o handoff já usado pelo PTU Companion:

```json
{
  "id": "fast-texting",
  "name": "Fast Texting",
  "logical_id": "fast-texting",
  "definition_version_id": "features:fast-texting@campaign-especial-classes-v1",
  "content_pack_id": "campaign-homebrew-especial-classes",

  "source_id": "especial-classes",
  "source_title": "Especial Classes",
  "source_kind": "homebrew",
  "source_priority": 180,
  "source_page": 2,

  "record_kind": "feature",
  "tags": ["+Speed"],
  "parent_class": "Hacker",
  "section": "Trainer Classes",

  "prerequisites_text": "Prerequisite: Hacker",
  "activation_text": "1 AP",
  "cost_text": null,
  "target_text": null,
  "trigger_text": null,
  "effect_text": "You can make the hacking test faster...",
  "special_text": null,
  "bonus_text": null,
  "condition_text": null,
  "extra_text": null,

  "raw_text": "Fast Texting\n[+Speed]\nCost: 1 AP\nPrerequisite: Hacker\nEffect: ...",
  "needs_review": false,

  "compiled_effects": [],
  "prerequisite_semantics": {
    "status": "full",
    "ast": {
      "op": "leaf",
      "kind": "has_feature",
      "raw": "Hacker",
      "name": "Hacker",
      "id": "hacker"
    },
    "rank_asts": [],
    "manual_leaf_count": 0,
    "leaf_count": 1
  },
  "effect_semantics": {
    "unstructured_text": "You can make the hacking test faster...",
    "coverage": "manual",
    "clause_count": 1,
    "structured_clause_count": 0
  },
  "semantic_automation": {
    "level": "manual_text",
    "prerequisite_status": "full",
    "effect_coverage": "manual",
    "semantic_version": "0.4"
  }
}
```

### IDs

Use slug ASCII minúsculo com hífen:

```text
Police Officer         -> police-officer
Porygon's Gift         -> porygon-s-gift
I'm The Storm...       -> im-the-storm-that-is-approaching
```

O `logical_id` normalmente é igual a `id`.

### `definition_version_id`

Formato recomendado:

```text
<kind>:<logical-id>@<source-or-pack-version-token>
```

Exemplos:

```text
features:hacker@especial-classes-v1
items:sunglasses@core
species:chickute@campaign-chickute-v1
moves:custom-burst@my-homebrew-1.2.0
```

O importador consegue gerar fallback se este campo faltar, mas **um pack produzido pelo ChatGPT deve fornecê-lo explicitamente**.

---

## 7. Features, Classes e Training Features

### Classe

A Feature de entrada de uma classe deve ter:

```json
{
  "tags": ["Class", "+Speed"],
  "parent_class": "Hacker"
}
```

Features subordinadas usam o mesmo `parent_class`.

### Profissões que substituem Training Features

No material de campanha em que profissões ocupam a posição de Training Features, usar:

```json
{
  "record_kind": "feature",
  "tags": ["Profession", "Training", "+Speed"],
  "training_feature": true,
  "profession": {
    "salary_weekly": 3600,
    "hours": "8/5",
    "connected_skills": ["Perception", "Intuition"]
  }
}
```

Se uma profissão tiver duas Features independentes, criar **duas definições**, não dois efeitos escondidos em um único registro.

---

## 8. Prerequisite semantics

A aplicação entende uma AST simples.

### Feature obrigatória

```json
{
  "op": "leaf",
  "kind": "has_feature",
  "raw": "Hacker",
  "name": "Hacker",
  "id": "hacker"
}
```

### Edge obrigatório

```json
{
  "op": "leaf",
  "kind": "has_edge",
  "raw": "Basic Skills",
  "name": "Basic Skills",
  "id": "basic-skills"
}
```

### Skill mínima

Ranks numéricos atualmente usados pelo projeto:

| Rank | Valor |
|---|---:|
| Pathetic | 1 |
| Untrained | 2 |
| Novice | 3 |
| Adept | 4 |
| Expert | 5 |
| Master | 6 |
| Virtuoso | 8 |

Exemplo:

```json
{
  "op": "leaf",
  "kind": "skill_rank_min",
  "raw": "Adept Technology Education",
  "skill": "technology-education",
  "skill_name": "Technology Education",
  "rank": "adept",
  "rank_value": 4
}
```

### AND

```json
{
  "op": "all",
  "raw": "Novice Combat, Novice Intuition",
  "children": [ ... ]
}
```

### OR

```json
{
  "op": "any",
  "raw": "Adept Athletics or Adept Occult Education",
  "children": [ ... ]
}
```

### Condição não estruturável

```json
{
  "op": "leaf",
  "kind": "manual",
  "raw": "Own an Unown of at least Level 20"
}
```

Se houver qualquer folha `manual`, use `status: "partial"`.

**Nunca transforme uma condição incerta em uma condição diferente só para a engine conseguir validá-la.**

---

## 9. `compiled_effects`

Use somente para efeitos determinísticos já suportados pelo Rules Engine.

Exemplo conhecido: conceder Ability ao Trainer.

```json
{
  "kind": "grant_entity",
  "entity_kind": "ability",
  "entity_id": "download",
  "entity_name": "Download",
  "confidence": "high",
  "source_text": "Extra: You have the Ability Download."
}
```

Ao criar um pack para uma versão futura, examine exemplos presentes no banco/projeto antes de inventar novos `kind` de `compiled_effects`.

Se o Rules Engine não possui um operador correspondente:

- deixe `compiled_effects: []`;
- mantenha `effect_text` completo;
- use `semantic_automation.level = "manual_text"` ou `"hybrid"`;
- registre a limitação no relatório.

---

## 10. Moves

Preserve especialmente:

```json
{
  "id": "thunder-fang",
  "name": "Thunder Fang",
  "type": "Electric",
  "frequency_text": "At-Will",
  "ac": 3,
  "damage_base": 6,
  "class": "Physical",
  "range_text": "Melee, 1 Target",
  "effect_text": "...",
  "contest_type": "Smart",
  "contest_effect": "Steady Performance"
}
```

`range_text`, `contest_type` e `contest_effect` são usados nas visualizações Desktop e Android. Não omitir quando existirem na fonte.

---

## 11. Items

Um Item deve preservar preço/categoria/efeito e, quando conhecido, metadata de uso.

Exemplo simplificado:

```json
{
  "id": "sunglasses",
  "name": "Sunglasses",
  "category": "Equipment",
  "price": 2000,
  "effect_text": "+1 Charm, Guile, and Intimidate while equipped.",
  "trainer_usable": true,
  "pokemon_held_usable": false,
  "equipment_slots": ["head"],
  "equip_slot": "head"
}
```

Slots padronizados usados pelo Trainer:

- `head`
- `body`
- `mainHand`
- `offHand`
- `feet`
- `accessory`

Um item pode ser simultaneamente Trainer Equipment e Pokémon Held Item se a regra permitir.

Não confundir o **Custom Item de campanha**, criado pelo usuário na Backpack, com definição catalogada de Item. Custom Item é intencionalmente neutro mecanicamente.

### Imported weapon mechanics

Catalogued weapons from a `.ptucp` may provide deterministic runtime mechanics in `mechanics`. Desktop **beta.13+** and Android **beta.14+** preserve this object when the Item is added to the Backpack, so imported weapons follow the same resolver used by built-in weapons.

```json
{
  "mechanics": {
    "kind": "weapon",
    "quality": "Fine",
    "weaponClass": "large_melee",
    "hands": 2,
    "metal": true,
    "range": "Melee",
    "acModifier": 1,
    "dbModifier": 2,
    "weaponMoves": {
      "adept": "wounding-strike",
      "master": "slice"
    }
  }
}
```

Rules for authoring weapons:

- `hands: 2` means the equipment flow reserves **Main Hand + Off Hand** while the weapon is equipped. Do not simulate a two-handed weapon with text alone.
- `weaponMoves.adept` and `weaponMoves.master` are qualified through the Trainer weapon resolver. Do **not** hard-code Combat in a Content Pack; Features/Classes may substitute a valid Skill. For example, Apparition may qualify melee Weapon Moves with Occult Education or Intimidate.
- Equip-only special Moves/Abilities that ignore the qualifying Skill rank belong in `compiled_effects` as `grant_entity`. The Rules Engine applies them while equipped and removes them automatically on unequip because the resolved Trainer sheet is rebuilt from current equipment.
- A weapon may therefore have both normal rank-qualified `weaponMoves` and unconditional `compiled_effects`.

---

## 12. Species

Species são registros maiores. Sempre que possível preservar:

- `display_name` / `name`;
- `national_dex_number` se houver;
- tipos;
- Base Stats;
- Skills;
- Capabilities;
- Ability slots;
- Level-Up Moves;
- TM/HM Moves;
- Tutor Moves;
- Egg Moves;
- tamanho/peso;
- gender ratio;
- habitats/diet;
- evolution data;
- `enabled_for_character_creation`;
- `mechanical_completeness`.

Campos importantes para o runtime atual:

```json
{
  "id": "examplemon",
  "display_name": "Examplemon",
  "name": "Examplemon",
  "types": ["Ghost", "Dark"],
  "base_stats": {
    "hp": 5,
    "attack": 7,
    "defense": 5,
    "special_attack": 8,
    "special_defense": 6,
    "speed": 9
  },
  "skills": [
    {"skill": "Athletics", "dice": 2, "modifier": 0},
    {"skill": "Stealth", "dice": 4, "modifier": 2}
  ],
  "capabilities": [],
  "ability_slots": [],
  "level_up_moves": [],
  "tm_moves": [],
  "tutor_moves": [],
  "egg_moves": [],
  "enabled_for_character_creation": true,
  "mechanical_completeness": "complete"
}
```

Não inventar Move/Ability references ausentes. Marcar `reference_status: "unresolved"` quando necessário.

---

## 13. Linhas de evolução

Quando um pack adiciona Species com evolução, incluir também os dois datasets.

### `ptu_evolution_edges.json`

Array JSON:

```json
[
  {
    "family_id": "evofam-example",
    "from_species_name": "Examplemon",
    "from_ref_key": "examplemon",
    "to_species_name": "Examplemon Prime",
    "to_ref_key": "examplemon-prime",
    "to_min_level": 20,
    "condition_text": "Minimum 20",
    "mapping_confidence": "safe_single_predecessor",
    "source_id": "example-source",
    "family_ids": ["evofam-example"]
  }
]
```

### `ptu_evolution_families.json`

```json
[
  {
    "id": "evofam-example",
    "source_id": "example-source",
    "source_pages": [1, 2],
    "source_species_ids": ["examplemon", "examplemon-prime"],
    "stages": [
      {"stage": 1, "species_name": "Examplemon", "species_ref_key": "examplemon", "min_level": null, "condition_text": null, "parse_status": "parsed"},
      {"stage": 2, "species_name": "Examplemon Prime", "species_ref_key": "examplemon-prime", "min_level": 20, "condition_text": "Minimum 20", "parse_status": "parsed"}
    ],
    "edges_status": "safe",
    "raw_texts": ["Examplemon -> Examplemon Prime Minimum 20"]
  }
]
```

Se a evolução não puder ser determinada com segurança, não fabricar uma edge “safe”. Use estado manual/review.

---

## 14. Workflow recomendado para converter PDFs / documentos

Uma futura instância do ChatGPT deve seguir esta sequência:

1. **Ler integralmente as páginas relevantes**, incluindo tabelas e imagens.
2. Enumerar entidades por tipo: Classes/Features, Edges, Poké Edges, Moves, Abilities, Items, Species etc.
3. Criar IDs estáveis.
4. Transcrever campos mecânicos sem inventar significado.
5. Criar prerequisite AST apenas para partes inequívocas.
6. Criar `compiled_effects` apenas para efeitos suportados e determinísticos.
7. Marcar ambiguidades com `needs_review: true`.
8. Criar NDJSON separado por tipo.
9. Criar datasets de evolução se necessário.
10. Calcular `sha256`, bytes e quantidade de registros de cada arquivo.
11. Gerar `manifest.json` por último.
12. Compactar **o conteúdo interno** diretamente no ZIP; `manifest.json` deve ficar na raiz, não dentro de uma pasta externa.
13. Renomear `.zip` para `.ptucp`.
14. Validar reabrindo o ZIP e recalculando hashes/contagens.
15. Entregar também um `CONVERSION_REPORT.md` curto com:
    - fonte usada;
    - pack ID/versão;
    - contagens;
    - interpretações adotadas;
    - itens `needs_review`;
    - efeitos que permaneceram manuais;
    - dependências.

---

## 15. Atualizando um pack já instalado

Para atualizar conteúdo sem criar um novo pack independente:

- mantenha o mesmo `manifest.id`;
- aumente `manifest.version`;
- mantenha os mesmos `logical_id` para entidades equivalentes;
- atualize `definition_version_id` quando desejar registrar nova origem/versão;
- o importador substitui os registros pertencentes ao **mesmo pack**, mas preserva definições de outros packs;
- o Desktop cria backup do banco de definições antes de cada import.

Exemplo:

```text
campaign-homebrew-especial-classes
1.0.0 -> 1.1.0 -> 1.2.0
```

Não criar `campaign-homebrew-especial-classes-v2` como novo `id` apenas porque houve uma correção, salvo se a intenção for que ambas as versões coexistam como packs independentes.

---

## 16. Importação no PTU Companion Desktop

A partir da beta `v2.1.0-beta.6`:

1. abrir **Pokédex & Rules**;
2. localizar **Desktop Content Packs**;
3. clicar **Import .ptucp**;
4. selecionar o arquivo;
5. o app valida manifest, hashes, tamanhos e contagens;
6. verifica dependências obrigatórias;
7. cria backup do banco de definições;
8. importa dentro de uma transação SQLite;
9. habilita o pack no Ruleset atualmente ativo;
10. recalcula a resolução das definições.

Arquivos persistentes ficam fora da pasta da versão do executável:

```text
%LOCALAPPDATA%\PTU Companion Beta\data\definitions\
├── ptu_definitions.sqlite3
├── backups\
└── installed-packs\
```

Assim, atualizar o EXE não apaga packs importados.

A importação **não altera o save da campanha** (`ptu_companion.sqlite3`). Definições e campanha continuam bancos separados.

---

## 17. Compatibilidade com Android

A partir do PTU Companion Android `v2.2.0-beta.6+`, o mesmo arquivo `.ptucp` usado no Desktop também pode ser importado no Android pelo Pack Manager. O pack fica armazenado no diretório privado da aplicação e pode ser habilitado, desabilitado ou desinstalado sem alterar o arquivo da campanha.

A partir de `v2.2.0-beta.9+`, Species também podem trazer retratos locais dentro do próprio pack. Os assets PNG, JPEG ou WebP declarados por `portrait_asset_path` / `artwork_assets` são validados pela camada nativa Tauri/Rust e persistidos junto da definição para uso offline.

Packs já incorporados ao APK continuam sendo parte da base embarcada. Importar posteriormente uma versão mais nova com o mesmo `manifest.id` funciona como atualização do pack importado, respeitando o sistema de Rulesets e os `logical_id`s estáveis.

---

## 18. Validação antes da entrega

Checklist obrigatório para a instância que gerar um pack:

- [ ] `manifest.json` na raiz;
- [ ] `format = "ptu-content-pack"`;
- [ ] `format_version = 1`;
- [ ] `id` estável;
- [ ] versão incrementada corretamente;
- [ ] `source_ids` únicos/coerentes;
- [ ] dependências listadas;
- [ ] todos os `.ndjson` possuem um JSON válido por linha;
- [ ] todos os registros possuem `id`, `logical_id`, `definition_version_id` e `content_pack_id` coerentes;
- [ ] `content_pack_id` de cada registro coincide com `manifest.id`;
- [ ] páginas de origem preservadas;
- [ ] `needs_review` usado para ambiguidades;
- [ ] nenhum efeito contextual foi transformado em permanente sem base textual;
- [ ] Range/Contest dos Moves preservados;
- [ ] Skills/Capabilities/Ability slots de Species preservados;
- [ ] evolução acompanha datasets quando necessário;
- [ ] SHA-256 correto para cada arquivo;
- [ ] tamanho (`bytes`) correto;
- [ ] `records` correto;
- [ ] `content_counts` coerente;
- [ ] ZIP reaberto e validado depois de criado;
- [ ] `CONVERSION_REPORT.md` entregue junto.

---

## 19. O que entregar ao usuário

Para uma conversão normal, entregar:

```text
<nome-do-pack>-<versao>.ptucp
CONVERSION_REPORT.md
```

Opcionalmente, quando útil para auditoria:

```text
<nome-do-pack>-source-json.zip
```

O usuário **não deve precisar receber uma nova versão do PTU Companion Desktop** para instalar apenas conteúdo que cabe neste contrato.

---

## 20. Resumo para a próxima instância do ChatGPT

Se você recebeu este arquivo e documentos novos, faça isto:

> **Leia a fonte -> modele as entidades -> preserve texto/provenance -> estruture apenas semântica segura -> gere NDJSON -> gere manifest com hashes -> compacte como `.ptucp` -> valide -> entregue pack + relatório.**

Se uma regra exigir uma mecânica que não existe no Rules Engine, **não invente uma automação**. Entregue o dado com `needs_review`/manual e explique que automatizar aquela cláusula exigirá uma alteração de código separada.

Este é o contrato de atualização de conteúdo do PTU Companion.

---

## Android compatibility (PTU Companion v2.2.0-android-beta.6+)

The same `.ptucp` archive generated for Desktop is also installable on Android. Do not create a separate mobile pack format.

Android accepts the same definition files documented above. The Android player edition validates and stores the pack through its Tauri/Rust native layer, then overlays the imported definitions onto the embedded mobile definition bundle. Content editors remain Desktop-only.

When converting content intended to travel with exported characters, preserve provenance fields (`content_pack_id`, `definition_version_id`, `speciesContentPackId` in saved campaign records where applicable). This allows save export/import to identify required packs and prevent silently loading a character with unresolved custom mechanics.

## Species artwork assets (beta.9+)

PTU Companion Desktop `v2.1.0-beta.9+` and Android `v2.2.0-beta.9+` can import a local Species portrait from the same `.ptucp`. Add the image as a ZIP entry outside `content/`, preferably under `assets/species/`, and declare it in `manifest.files`. Supported image formats are PNG, JPEG and WebP, with a maximum of 5 MB per Species portrait.

Example Species fields:

```json
{
  "id": "examplemon",
  "portrait_asset_path": "assets/species/examplemon.png",
  "artwork_assets": [
    {"path": "assets/species/examplemon.png", "role": "portrait", "media_type": "image/png"}
  ]
}
```

Example manifest entry:

```json
"assets/species/examplemon.png": {
  "sha256": "<sha256 lowercase>",
  "bytes": 123456,
  "media_type": "image/png"
}
```

Do **not** add `records` to image metadata. The importer validates the hash/size, embeds the portrait into the installed Species definition for offline use, and gives it priority over web sprite fallbacks. If `portrait_asset_path` is declared but missing, unsupported, or above 5 MB, the pack import is rejected instead of silently losing the image.


## Imported Weapon Mechanics (beta.15+/Android beta.16+)

Weapon item definitions may provide a structured `mechanics` object. The supported fields are:

```json
{
  "kind": "weapon",
  "quality": "Fine",
  "weaponClass": "large_melee",
  "hands": 2,
  "range": "Melee",
  "minimumRange": null,
  "acModifier": 1,
  "dbModifier": 2,
  "damageClass": "Physical",
  "arcane": false,
  "qualification": {"baseSkill":"Combat","allowFeatureSubstitutions":true},
  "weaponMoveRanks": {"adept":4,"master":6},
  "weaponMoves": {"adept":"wounding-strike","master":"slice"},
  "evasionBonus": 0,
  "damageReduction": 0,
  "contextualEffects": []
}
```

Two-handed weapons must use `hands: 2`; the equipment UI reserves the Off Hand while equipped. Normal weapons may permit Feature-based alternate qualification (`allowFeatureSubstitutions: true`), such as Apparition on melee weapons. Arcane weapons use an `arcane_*` weapon class (or `arcane: true`), `damageClass: "Special"`, and Occult Education qualification. The current rules overlay follows PTU 1.05 Editation: Arcane Weapon Moves unlock at Adept and Master rather than the original Game of Throhs Novice/Expert progression. Equip-only Moves and Abilities that ignore weapon-skill rank belong in `compiled_effects` as `grant_entity`; they are automatically removed on unequip. Rules requiring a target, critical hit, weakness, Scene counter, choice, or other event state should be placed in `contextualEffects` unless the combat engine has an explicit deterministic handler.


### Shop catalog metadata (Desktop beta.16+ / Android beta.17+)

A pack may advertise an Item in a named shop preset without pre-seeding it into the Trainer Backpack:

```json
{
  "shop_visible": true,
  "shop_categories": ["Weapon Store"]
}
```

`Weapon Store` reads active Ruleset Item definitions. Purchasing one creates the canonical inventory entry, preserving `mechanics`, provenance, slots and other imported metadata. Content Pack import/enable/disable/uninstall invalidates the Add Game Item cache so the catalog reflects the active Ruleset immediately.
