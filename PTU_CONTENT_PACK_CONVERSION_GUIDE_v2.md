# PTU Companion — Guia atualizado para criação de Content Packs (`.ptucp`)

**Contrato do formato:** `ptu-content-pack` / `format_version: 1`  
**Aplicação de referência:** Windows `v2.1.0-beta.17+` / Android `v2.2.0-beta.18+`  
**Revisão deste guia:** 2026-09-18  
**Objetivo:** permitir que uma pessoa, script ou futura instância do ChatGPT crie/atualize conteúdo do PTU Companion sem editar o programa quando a mudança puder ser representada como dados.

> **INSTRUÇÃO PARA FUTURAS INSTÂNCIAS DO CHATGPT**  
> Se o usuário fornecer este guia junto de PDFs, texto, wiki, imagens ou regras homebrew e pedir um `.ptucp`, trate este documento como o contrato de interoperabilidade. Preserve fonte e texto mecânico, automatize somente o que o app realmente suporta, use IDs estáveis, valide o ZIP final e entregue o `.ptucp` junto de um relatório curto de conversão. Se uma regra exigir comportamento que o Rules Engine ainda não possui, não invente um operador: preserve-a como efeito contextual/manual e informe que automação total exige alteração do app.

---

## 1. O que é um `.ptucp`

Um `.ptucp` é um **arquivo ZIP normal renomeado para `.ptucp`**. O `manifest.json` fica na raiz do arquivo.

Estrutura típica:

```text
meu-pack.ptucp
├── manifest.json
├── content/
│   ├── moves.ndjson
│   ├── abilities.ndjson
│   ├── capabilities.ndjson
│   ├── features.ndjson
│   ├── edges.ndjson
│   ├── poke_edges.ndjson
│   ├── items.ndjson
│   ├── species.ndjson
│   └── datasets/
│       ├── ptu_evolution_edges.json
│       └── ptu_evolution_families.json
└── assets/
    ├── items/
    │   └── exemplo.png
    └── species/
        └── examplemon.webp
```

Somente os arquivos realmente necessários precisam existir.

### Tipos de definição aceitos pelo importador atual

| Arquivo | `definition_kind` interno |
|---|---|
| `content/moves.ndjson` | `moves` |
| `content/abilities.ndjson` | `abilities` |
| `content/capabilities.ndjson` | `capabilities` |
| `content/features.ndjson` | `features` |
| `content/edges.ndjson` | `edges` |
| `content/poke_edges.ndjson` | `poke_edges` |
| `content/items.ndjson` | `items` |
| `content/species.ndjson` | `species` |

Datasets especiais atualmente suportados:

- `content/datasets/ptu_evolution_edges.json`
- `content/datasets/ptu_evolution_families.json`

Arquivos adicionais dentro de `content/` que não correspondam a estes contratos podem ser ignorados e gerar warning.

---

## 2. Quando usar pack e quando alterar o app

Use `.ptucp` para mudanças de **conteúdo/dados**, como:

- Species/Fakemon;
- Moves;
- Abilities;
- Capabilities;
- Classes e Trainer Features;
- Edges e Poké Edges;
- Items, armas, armaduras, acessórios e ferramentas;
- preços e lojas;
- artwork local de Species e Items;
- linhas de evolução;
- homebrew;
- errata/rebalance;
- versões de uma definição que devem vencer outra por prioridade/Ruleset.

Uma alteração do **app** é necessária quando o conteúdo pede um comportamento que o Rules Engine ainda não sabe executar. Exemplos:

- novo tipo de trigger de combate;
- nova ação/botão/estado persistente;
- interação automática com alvo/posição/clima que não possui handler;
- nova operação de cálculo;
- novo slot de equipamento não reconhecido;
- nova categoria de loja com lógica própria;
- novo tipo de asset ou dataset não suportado.

Nesses casos, o pack ainda deve preservar a regra em `effect_text`, `raw_text` e/ou `contextualEffects`, mas a automação total depende de atualização de código.

---

## 3. Princípios obrigatórios

### 3.1. A fonte é soberana

Não corrigir ou completar silenciosamente regras com conhecimento externo. Preservar, quando existirem:

- nome;
- prerequisites;
- activation/frequency;
- target;
- trigger;
- effect;
- special/extra/bonus;
- preço;
- tags;
- números;
- tabela;
- página/origem.

Normalizações seguras podem ser usadas nos campos estruturados, mas `raw_text` deve manter uma transcrição fiel.

### 3.2. Não automatizar além da evidência

`+2 Athletics enquanto equipado` pode ser automatizado diretamente.  
`+2 Athletics apenas ao escalar ruínas antigas` não deve virar bônus permanente.

Se houver contexto, alvo, trigger, uso por Scene, escolha temporária, duração, posição ou interpretação humana, mantenha a cláusula contextual a menos que exista handler explícito.

### 3.3. Provenance é obrigatória

Cada definição deve ser rastreável por:

- `source_id`;
- `source_title`;
- `source_kind`;
- `source_page` quando aplicável;
- `definition_version_id`;
- `content_pack_id` coerente com o pack.

O importador normaliza `content_pack_id` para o `manifest.id`, mas o arquivo fonte deve escrevê-lo corretamente quando possível.

### 3.4. IDs são estáveis

Depois de publicado:

```text
athletics-shoes
```

não renomear em versões futuras para:

```text
athletics-shoes-v2
```

O mesmo `logical_id` deve representar a mesma entidade lógica ao longo das atualizações.

### 3.5. Atualização não é novo pack

Para atualizar um pack já instalado:

- manter o mesmo `manifest.id`;
- aumentar `manifest.version`;
- manter os mesmos `logical_id`s;
- atualizar `definition_version_id` quando apropriado.

Exemplo:

```text
campaign-homebrew-specialty-shoes
1.0.0 -> 1.1.0 -> 1.2.0
```

---

## 4. Limites e segurança do arquivo ZIP

O importador atual impõe estes limites:

- arquivo `.ptucp`: máximo **128 MB** compactado;
- conteúdo expandido: máximo **256 MB**;
- máximo **512 entradas** no ZIP;
- ZIP64 não é suportado;
- entradas criptografadas não são suportadas;
- compressão suportada: **Stored (0)** ou **Deflate (8)**;
- caminhos absolutos, drive letters e `..` são rejeitados;
- entradas duplicadas são rejeitadas.

Para imagens embutidas de Item/Species:

- PNG, JPEG/JPG ou WebP;
- máximo **5 MB por imagem**.

---

## 5. `manifest.json`

Exemplo recomendado:

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
  "source_ids": ["campaign-example-source"],
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
    "items": 2
  },
  "files": {
    "content/items.ndjson": {
      "sha256": "<sha256 lowercase>",
      "bytes": 1234,
      "records": 2,
      "media_type": "application/x-ndjson"
    }
  },
  "generated_at": "2026-09-18",
  "notes": "Converted for PTU Companion."
}
```

### Campos essenciais

O importador exige diretamente:

- `format = "ptu-content-pack"`;
- `format_version = 1`;
- `id` válido;
- `name` não vazio;
- `version` não vazia.

Para um pack produzido corretamente, também sempre forneça:

- `priority`;
- `kind`;
- `browse_only`;
- `source_ids`;
- `dependencies`;
- `definition_resolution`;
- `content_counts`;
- `files` com hash/tamanho/contagem;
- `generated_at`;
- `notes` quando necessário.

### IDs permitidos no manifest

O `manifest.id` deve usar caracteres compatíveis com:

```text
A-Z a-z 0-9 . _ : -
```

Recomendação prática: minúsculas com hífen.

### Prioridade recomendada

| Faixa | Uso típico |
|---:|---|
| 100 | Core oficial |
| 110–169 | suplementos, playtests, materiais posteriores |
| 170–179 | errata/rebalance |
| 180 | homebrew normal |
| 190+ | override deliberado |

Não aumentar prioridade apenas para “forçar” vitória sem justificativa semântica.

---

## 6. `manifest.files`

Cada arquivo relevante deve ter metadata consistente.

### NDJSON

```json
"content/items.ndjson": {
  "sha256": "...",
  "bytes": 2327,
  "records": 2,
  "media_type": "application/x-ndjson"
}
```

### JSON array/dataset

```json
"content/datasets/ptu_evolution_edges.json": {
  "sha256": "...",
  "bytes": 900,
  "records": 2,
  "media_type": "application/json"
}
```

### Imagem

```json
"assets/items/custom-sword.png": {
  "sha256": "...",
  "bytes": 183240,
  "media_type": "image/png"
}
```

Não use `records` para imagem.

O importador verifica `bytes`, `sha256` e `records` quando estes campos são declarados.

---

## 7. NDJSON

Cada arquivo de definição é **NDJSON**: um objeto JSON independente por linha.

Correto:

```text
{"id":"item-a","name":"Item A",...}
{"id":"item-b","name":"Item B",...}
```

Incorreto:

```json
[
  {"id":"item-a"},
  {"id":"item-b"}
]
```

Use UTF-8. Linhas vazias são toleradas, mas não são recomendadas.

---

## 8. Campos comuns das definições

Modelo recomendado:

```json
{
  "id": "example-item",
  "logical_id": "example-item",
  "definition_version_id": "items:example-item@campaign-homebrew-example-v1.0.0",
  "content_pack_id": "campaign-homebrew-example",

  "source_id": "campaign-example-source",
  "source_title": "Campaign Example",
  "source_kind": "homebrew",
  "source_priority": 180,
  "source_page": null,

  "name": "Example Item",
  "tags": ["Homebrew"],
  "effect_text": "The exact mechanical description.",
  "raw_text": "Original or faithful source text.",
  "needs_review": false,

  "compiled_effects": [],
  "semantic_automation": {
    "level": "structured",
    "notes": "Deterministic parts are automated; contextual parts remain textual."
  }
}
```

### `definition_version_id`

Formato recomendado:

```text
<kind>:<logical-id>@<source-or-pack-token>
```

Exemplos:

```text
items:athletics-shoes@campaign-homebrew-specialty-shoes-v1.0.0
features:hacker@especial-classes-v1
species:chickute@campaign-chickute-v1
moves:custom-burst@my-homebrew-1.2.0
```

---

## 9. `compiled_effects`: operadores atualmente seguros

Use `compiled_effects` apenas para semântica que o runtime conhece.

### 9.1. Conceder entidade

Moves, Abilities e Capabilities:

```json
{
  "kind": "grant_entity",
  "entity_kind": "ability",
  "entity_id": "cloud-nine",
  "entity_name": "Cloud Nine",
  "confidence": "high",
  "source_text": "Granted while the equipment is equipped."
}
```

`entity_kind` suportado pelo Trainer resolver:

- `move`
- `ability`
- `capability`

Quando a origem é equipamento, a ficha é recalculada a partir do equipamento atual; portanto o grant desaparece naturalmente ao desequipar.

### 9.2. Modifier

Exemplo:

```json
{
  "kind": "modifier",
  "target_path": "combat.damage_bonus",
  "value": 5,
  "confidence": "high",
  "source_text": "+5 Damage while active."
}
```

Targets interpretados diretamente pelo Trainer Engine atual:

```text
capabilities.<key>
skills.<skill>.check_bonus
stats.<stat>
combat.accuracy
combat.damage_bonus
combat.damage_reduction
combat.evasion
```

Um modifier com `duration: "contextual"` ou `mode: "contextual"` é listado como regra contextual em vez de aplicado permanentemente.

### 9.3. Escolha e grant

O engine também reconhece:

```json
{
  "kind": "choose_and_grant_entity",
  "entity_kind": "move",
  "count": 1,
  "options": ["move-a", "move-b"]
}
```

Use somente quando a UI/fluxo correspondente realmente captura a seleção.

### 9.4. Recursos de build

```json
{
  "kind": "grant_build_resource",
  "resource": "edge",
  "amount": 1
}
```

### 9.5. Operadores contextuais

`apply_status` e `type_defense_rule` atualmente são preservados/surfaced como contexto no Trainer Engine; não assumir aplicação automática completa.

### Regra de ouro

Se não houver operador conhecido, não inventar `kind`. Use texto/contexto e documente a limitação.

---

## 10. Prerequisite semantics para Features/Edges

A aplicação usa uma AST simples para prerequisites.

### Feature

```json
{
  "op": "leaf",
  "kind": "has_feature",
  "raw": "Hacker",
  "name": "Hacker",
  "id": "hacker"
}
```

### Edge

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

Ranks do projeto:

| Rank | Valor |
|---|---:|
| Pathetic | 1 |
| Untrained | 2 |
| Novice | 3 |
| Adept | 4 |
| Expert | 5 |
| Master | 6 |
| Virtuoso | 8 |

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
  "children": []
}
```

### OR

```json
{
  "op": "any",
  "raw": "Adept Athletics or Adept Occult Education",
  "children": []
}
```

### Condição manual

```json
{
  "op": "leaf",
  "kind": "manual",
  "raw": "Own an Unown of at least Level 20"
}
```

Se houver qualquer folha manual, marcar o prerequisite como parcial.

---

## 11. Moves

Preserve ao menos:

```json
{
  "id": "thunder-fang",
  "logical_id": "thunder-fang",
  "definition_version_id": "moves:thunder-fang@example-source",
  "name": "Thunder Fang",
  "type": "Electric",
  "frequency_text": "At-Will",
  "ac": 3,
  "damage_base": 6,
  "class": "Physical",
  "range_text": "Melee, 1 Target",
  "effect_text": "...",
  "contest_type": "Smart",
  "contest_effect": "Steady Performance",
  "raw_text": "..."
}
```

Não omitir `range_text`, classe, DB, AC ou Contest quando a fonte possuir esses campos.

---

## 12. Items: campos de catálogo

Modelo mínimo recomendado:

```json
{
  "id": "athletics-shoes",
  "logical_id": "athletics-shoes",
  "definition_version_id": "items:athletics-shoes@campaign-homebrew-specialty-shoes-v1.0.0",
  "content_pack_id": "campaign-homebrew-specialty-shoes",
  "source_id": "campaign-homebrew-specialty-shoes",
  "source_title": "Campaign Homebrew — Specialty Shoes",
  "source_kind": "homebrew",
  "name": "Athletics Shoes",
  "category": "Trainer Gear",
  "price": 2000,
  "effect_text": "While equipped, the user gains +2 to Athletics Checks and +1 Overland.",
  "trainer_usable": true,
  "pokemon_held_usable": false,
  "equipment_slots": ["feet"],
  "equip_slot": "feet",
  "consumable": false,
  "tags": ["Feet Slot", "Homebrew"],
  "mechanics": {
    "kind": "equipment",
    "skillBonuses": [{"skill": "Athletics", "value": 2}],
    "capabilityBonuses": {"overland": 1},
    "contextualEffects": []
  },
  "compiled_effects": [],
  "raw_text": "...",
  "needs_review": false
}
```

### Slots reconhecidos

```text
head
body
mainHand
offHand
feet
accessory
```

Aliases internos existem para alguns nomes, mas packs novos devem usar exatamente os nomes acima.

### Item com vários slots possíveis

Isto significa **alternativas**, não ocupação simultânea:

```json
"equipment_slots": ["mainHand", "offHand"]
```

O usuário escolhe onde equipar aquela cópia.

### Item de duas mãos

Para ocupar Main Hand e reservar Off Hand:

```json
"equipment_slots": ["mainHand"],
"equip_slot": "mainHand",
"mechanics": {
  "kind": "equipment",
  "hands": 2
}
```

Não simular duas mãos apenas no texto.

---

## 13. Equipment mechanics — contrato atual

Para equipamento genérico:

```json
"mechanics": {
  "kind": "equipment"
}
```

Campos atualmente reconhecidos pelo Trainer Engine:

| Campo | Exemplo | Efeito |
|---|---|---|
| `damageReduction` | `5` | DR geral |
| `damageReductionByClass.physical` | `5` | DR contra ataques Physical |
| `damageReductionByClass.special` | `5` | DR contra ataques Special |
| `evasionBonus` | `2` | bônus de Evasion |
| `accuracyBonus` | `1` | bônus de Accuracy |
| `saveCheckBonus` | `2` | bônus geral de Save Checks |
| `saveCheckBonusVolatile` | `2` | bônus de Save contra Volatile |
| `effectRangeBonus` | `1` | bônus de Effect Range |
| `defaultCombatStages` | `{"speed":-2}` | altera Default State de Combat Stage |
| `defaultCombatStageFromConfig` | `{"field":"stat","value":1}` | CS default baseado em configuração |
| `skillBonuses` | `[... ]` | bônus em checks de Skill |
| `statBonuses` | `[... ]` | bônus em Stats |
| `capabilityBonuses` | `{"overland":1}` | bônus numérico em Capability |
| `capabilityGrants` | `["Darkvision"]` | concede Capability enquanto equipado |
| `dynamicCapability` | `"Naturewalk ($config.biome)"` | Capability construída a partir de config |
| `skillAdvantages` | `["Perception"]` | registra vantagem/re-roll sem transformar em flat bonus |
| `initiativeBonus` | `5` | bônus fixo de Initiative |
| `initiativeDiceBonus` | `"+1d10"` | exibido como contexto |
| `conditionalDamageBonuses` | `[{"value":5,"condition":"..."}]` | exibido como contexto |
| `contextualEffects` | `["..."]` | regras não determinísticas/contextuais |
| `hands` | `2` | reserva mão adicional ao equipar em Main Hand |

### Skill bonus

```json
"skillBonuses": [
  {"skill": "Athletics", "value": 2}
]
```

Com cap:

```json
"skillBonuses": [
  {"skill": "Stealth", "value": 4, "cap": 4}
]
```

### Stat bonus

```json
"statBonuses": [
  {"stat": "Attack", "value": 5, "afterCombatStages": true}
]
```

### Capability numérica

```json
"capabilityBonuses": {
  "overland": 1,
  "swim": 2
}
```

Capabilities numéricas comuns na ficha atual:

```text
power
overland
swim
highJump
longJump
throwingRange
```

### Conceder Capability textual

Pode usar `capabilityGrants`, `compiled_effects`, ou ambos quando a definição precisa aparecer também como entidade resolvida:

```json
"mechanics": {
  "kind": "equipment",
  "capabilityGrants": ["Darkvision"]
},
"compiled_effects": [
  {
    "kind": "grant_entity",
    "entity_kind": "capability",
    "entity_id": "darkvision",
    "entity_name": "Darkvision",
    "confidence": "high"
  }
]
```

### Efeitos condicionais

Não transformar isto em bônus sempre ativo:

```text
+5 Damage only when the target is weak to Fire.
```

Use:

```json
"mechanics": {
  "kind": "equipment",
  "conditionalDamageBonuses": [
    {"value": 5, "condition": "target takes Super Effective Fire damage"}
  ]
}
```

ou `contextualEffects` se a estrutura não for suficiente.

---

## 14. Equipamentos configuráveis (`equipment_config`)

Quando uma cópia precisa guardar uma escolha feita ao equipar, use `equipment_config`.

Exemplo — Academic Uniform:

```json
"equipment_config": {
  "fields": [
    {
      "name": "skill",
      "label": "Education Skill",
      "type": "select",
      "options": [
        "General Education",
        "Medicine Education",
        "Occult Education",
        "Pokémon Education",
        "Technology Education"
      ]
    }
  ]
},
"mechanics": {
  "kind": "equipment",
  "skillBonuses": [
    {"skill": "$config.skill", "value": 4}
  ]
}
```

A cópia equipada guarda a seleção em `config`; o Rules Engine resolve `$config.<campo>`.

### Tipos de campo da UI

O formulário atual suporta:

- `select`
- `text`
- `number`
- `textarea`

Para regras fechadas (Skill/Stat/Type/Biome), prefira `select` com opções explícitas.

### Stat escolhido

```json
"equipment_config": {
  "fields": [
    {
      "name": "stat",
      "label": "Focus Stat",
      "type": "select",
      "options": ["HP", "Attack", "Defense", "Special Attack", "Special Defense", "Speed"]
    }
  ]
},
"mechanics": {
  "kind": "equipment",
  "statBonuses": [
    {"stat": "$config.stat", "value": 5, "afterCombatStages": true}
  ]
}
```

### Capability dinâmica

```json
"mechanics": {
  "kind": "equipment",
  "dynamicCapability": "Naturewalk ($config.biome)"
}
```

---

## 15. Weapon mechanics

Armas importadas usam o mesmo resolvedor de armas da aplicação.

Exemplo físico:

```json
"mechanics": {
  "kind": "weapon",
  "quality": "Fine",
  "weaponClass": "large_melee",
  "hands": 2,
  "metal": true,
  "range": "Melee",
  "minimumRange": null,
  "acModifier": 1,
  "dbModifier": 2,
  "damageClass": "Physical",
  "arcane": false,
  "qualification": {
    "baseSkill": "Combat",
    "allowFeatureSubstitutions": true
  },
  "weaponMoveRanks": {
    "adept": 4,
    "master": 6
  },
  "weaponMoves": {
    "adept": "wounding-strike",
    "master": "slice"
  },
  "tags": ["Melee", "Large Melee", "Two-Handed", "Sword"],
  "specialRules": [],
  "contextualEffects": []
}
```

### Classes de arma reconhecidas

```text
small_melee
large_melee
short_range
long_range
arcane_small_melee
arcane_large_melee
arcane_short_range
arcane_long_range
```

### Duas mãos

Use sempre:

```json
"hands": 2
```

A UI reserva a Off Hand quando a arma é equipada em Main Hand.

### Qualificação de Weapon Moves

Arma normal:

```json
"qualification": {
  "baseSkill": "Combat",
  "allowFeatureSubstitutions": true
}
```

Não hard-code uma Feature específica no pack. O resolver do app avalia as substituições suportadas pelas Features atuais, incluindo casos como Apparition, Steelheart, Herald of Pride e Cutthroat quando as condições da arma são compatíveis.

### Arcane Weapon

```json
"mechanics": {
  "kind": "weapon",
  "weaponClass": "arcane_large_melee",
  "arcane": true,
  "damageClass": "Special",
  "hands": 2,
  "qualification": {
    "baseSkill": "Occult Education",
    "allowFeatureSubstitutions": false
  },
  "weaponMoveRanks": {
    "adept": 4,
    "master": 6
  }
}
```

Na aplicação de referência, Arcane Weapons usam **Occult Education**, Special damage e tiers **Adept/Master** conforme a regra revisada adotada pelo app.

### Move/Ability especial independente do rank

Não colocar em `weaponMoves` se deve ser concedido simplesmente por equipar.

```json
"compiled_effects": [
  {
    "kind": "grant_entity",
    "entity_kind": "move",
    "entity_id": "chip-away",
    "entity_name": "Chip Away",
    "confidence": "high"
  },
  {
    "kind": "grant_entity",
    "entity_kind": "ability",
    "entity_id": "hustle",
    "entity_name": "Hustle",
    "confidence": "high"
  }
]
```

Assim, o Move/Ability aparece enquanto a arma está equipada e desaparece ao desequipar.

### Híbridos/Living Weapons

Uma arma pode também carregar campos genéricos de equipamento, como:

```json
"evasionBonus": 2,
"damageReduction": 5
```

O engine atual evita double counting desses campos quando a definição é `kind: "weapon"`.

---

## 16. Artwork de Item

Há três formas de fornecer ícone de Item.

### 16.1. Asset local — recomendado

```json
"icon_asset_path": "assets/items/athletics-shoes.png",
"artwork_assets": [
  {
    "path": "assets/items/athletics-shoes.png",
    "role": "icon",
    "media_type": "image/png"
  }
]
```

Também declarar a imagem em `manifest.files`.

O importador converte o asset para `icon_data_url`, permitindo uso offline.

### 16.2. URL externa

```json
"icon_url": "https://example.org/item.png"
```

Funciona quando a imagem externa estiver acessível, mas não é tão confiável quanto asset local para uso offline.

### 16.3. Fallback simples

```json
"icon": "👟"
```

Use como fallback, não como substituto de artwork quando o pack possui arte própria.

### Onde o ícone aparece

Nas versões de referência, artwork de Item pode ser exibido em:

- Backpack;
- Equipment;
- `+ Add Game Item`;
- Weapon Store;
- Gear Store;
- carrinho/Shop.

---

## 17. Metadados de loja

### Weapon Store

```json
"shop_visible": true,
"shop_categories": ["Weapon Store"],
"shop_sort_group": "Fine Weapons"
```

### Gear Store

```json
"shop_visible": true,
"shop_categories": ["Gear Store"],
"shop_sort_group": "Feet Equipment"
```

Para item que não deve aparecer à venda:

```json
"shop_visible": false,
"shop_categories": []
```

Itens podem continuar disponíveis em `+ Add Game Item` mesmo quando não são vendidos em loja.

**Importante:** packs externos novos devem declarar `shop_categories` explicitamente. Não depender de exceções internas usadas pelos packs bundled oficiais da aplicação.

---

## 18. Exemplo completo de Trainer Gear

```json
{
  "id": "acrobatics-shoes",
  "logical_id": "acrobatics-shoes",
  "definition_version_id": "items:acrobatics-shoes@campaign-homebrew-specialty-shoes-v1.0.0",
  "content_pack_id": "campaign-homebrew-specialty-shoes",
  "source_id": "campaign-homebrew-specialty-shoes",
  "source_title": "Campaign Homebrew — Specialty Shoes",
  "source_kind": "homebrew",
  "source_page": null,
  "name": "Acrobatics Shoes",
  "category": "Trainer Gear",
  "price": 6000,
  "effect_text": "While equipped, the user gains +2 to Acrobatics Checks and +1 Overland.",
  "trainer_usable": true,
  "pokemon_held_usable": false,
  "equipment_slots": ["feet"],
  "equip_slot": "feet",
  "consumable": false,
  "icon": "👟",
  "tags": ["Feet Slot", "Homebrew", "Acrobatics"],
  "mechanics": {
    "kind": "equipment",
    "contextualEffects": [],
    "skillBonuses": [
      {"skill": "Acrobatics", "value": 2}
    ],
    "capabilityBonuses": {
      "overland": 1
    }
  },
  "compiled_effects": [],
  "semantic_automation": {
    "level": "structured",
    "notes": "Deterministic equip effects are resolved automatically while equipped."
  },
  "raw_text": "Acrobatics Shoes cost ₽6,000. While equipped, the user gains +2 to Acrobatics Checks and +1 Overland.",
  "needs_review": false,
  "shop_visible": true,
  "shop_categories": ["Gear Store"],
  "shop_sort_group": "Feet Equipment"
}
```

---

## 19. Species

Preserve quando disponíveis:

- `id`, `display_name`, `name`;
- National Dex Number;
- Types;
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
- habitat/diet;
- evolução;
- `enabled_for_character_creation`;
- `mechanical_completeness`.

Exemplo reduzido:

```json
{
  "id": "examplemon",
  "logical_id": "examplemon",
  "definition_version_id": "species:examplemon@campaign-example-v1",
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

Não inventar referências ausentes. Se necessário, registrar status unresolved/review no dado ou relatório.

---

## 20. Artwork de Species

```json
"portrait_asset_path": "assets/species/examplemon.png",
"artwork_assets": [
  {
    "path": "assets/species/examplemon.png",
    "role": "portrait",
    "media_type": "image/png"
  }
]
```

Também declarar a imagem em `manifest.files`.

Suportado:

- PNG;
- JPEG/JPG;
- WebP;
- até 5 MB por retrato.

Se `portrait_asset_path` estiver declarado e o arquivo faltar, for inválido ou exceder o limite, a importação deve falhar em vez de perder silenciosamente a arte.

---

## 21. Evoluções

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
      {
        "stage": 1,
        "species_name": "Examplemon",
        "species_ref_key": "examplemon",
        "min_level": null,
        "condition_text": null,
        "parse_status": "parsed"
      },
      {
        "stage": 2,
        "species_name": "Examplemon Prime",
        "species_ref_key": "examplemon-prime",
        "min_level": 20,
        "condition_text": "Minimum 20",
        "parse_status": "parsed"
      }
    ],
    "edges_status": "safe",
    "raw_texts": ["Examplemon -> Examplemon Prime Minimum 20"]
  }
]
```

Se a evolução não puder ser determinada com segurança, não fabricar uma edge `safe`.

---

## 22. Features, Classes e Training Features

### Classe

```json
{
  "tags": ["Class", "+Speed"],
  "parent_class": "Hacker"
}
```

Features subordinadas usam o mesmo `parent_class`.

### Training Feature/profissão

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

Se duas Features são mecanicamente independentes, criar duas definições separadas.

---

## 23. Texto contextual versus automação

Use esta decisão:

### Automático

Pode ser estruturado quando for determinístico pela ficha/equipamento atual:

- +2 Skill enquanto equipado;
- +1 Overland;
- +5 DR;
- +1 Accuracy;
- +2 Evasion;
- Ability/Capability/Move concedido enquanto equipado;
- default Combat Stage fixo;
- Weapon Move por rank conhecido;
- slot e número de mãos.

### Contextual

Deve permanecer em `contextualEffects` ou texto quando depender de:

- alvo;
- distância/posição;
- fraqueza/resistência do alvo;
- Critical Hit;
- clima/terreno se o app não modelar o estado correspondente;
- Trigger ou Interrupt;
- `1/Scene`, `1/Day` sem tracker explícito;
- consumo/reação que exige decisão;
- condição narrativa;
- efeito que só acontece depois de ser atingido;
- efeito que altera outro combatente.

Não transforme regra contextual em flat bonus permanente.

---

## 24. Dependências

Exemplo:

```json
"dependencies": [
  {"id": "ptu-core-1.05", "required": true},
  {"id": "ptu-game-of-throhs", "required": false}
]
```

Dependência `required: true` precisa estar instalada para o import ser aceito.

Use dependência obrigatória apenas quando o pack realmente precisa dela para funcionar/resolver suas referências.

---

## 25. Rulesets, prioridade e resolução

O contrato de resolução usado pelos packs atuais é:

```json
"definition_resolution": {
  "logical_id_field": "logical_id",
  "version_id_field": "definition_version_id",
  "strategy": "highest_enabled_priority_then_ruleset_order",
  "version_pinning_supported": true
}
```

Princípios:

- packs não deletam definições pertencentes a outros packs;
- o Ruleset escolhe a definição efetiva;
- desabilitar um pack permite fallback para versão inferior;
- atualizar o mesmo `manifest.id` substitui os registros pertencentes àquele pack;
- a preferência enabled/disabled do usuário é preservada em atualização.

---

## 26. Packs bundled/default do aplicativo

Um `.ptucp` importável **não se torna bundled automaticamente**.

Para fazer parte do app por padrão é necessária uma atualização/build do PTU Companion que coloque o arquivo na área de packs embarcados e atualize o seed/upgrade correspondente.

Portanto:

- **pack externo:** pode ser criado sem alterar o app;
- **pack default/bundled:** requer empacotamento do app, ainda que o conteúdo continue sendo um `.ptucp` normal.

---

## 27. Script recomendado para construir o `.ptucp`

Exemplo em Python 3. Ele calcula hash/tamanho/records, escreve o `manifest.json` por último e cria um ZIP Deflate.

```python
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path("pack_build")
OUT = Path("campaign-homebrew-example-1.0.0.ptucp")

manifest = {
    "format": "ptu-content-pack",
    "format_version": 1,
    "id": "campaign-homebrew-example",
    "name": "Campaign Homebrew — Example",
    "version": "1.0.0",
    "priority": 180,
    "kind": "homebrew",
    "browse_only": False,
    "source_ids": ["campaign-homebrew-example"],
    "dependencies": [{"id": "ptu-core-1.05", "required": True}],
    "definition_resolution": {
        "logical_id_field": "logical_id",
        "version_id_field": "definition_version_id",
        "strategy": "highest_enabled_priority_then_ruleset_order",
        "version_pinning_supported": True,
    },
    "content_counts": {},
    "files": {},
    "generated_at": "2026-09-18",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def count_records(path: Path, data: bytes):
    if path.suffix == ".ndjson":
        return sum(1 for line in data.decode("utf-8").splitlines() if line.strip())
    if path.suffix == ".json":
        value = json.loads(data.decode("utf-8"))
        return len(value) if isinstance(value, list) else 1
    return None

for path in sorted(ROOT.rglob("*")):
    if not path.is_file() or path.name == "manifest.json":
        continue
    rel = path.relative_to(ROOT).as_posix()
    data = path.read_bytes()
    meta = {
        "sha256": sha256(data),
        "bytes": len(data),
    }
    records = count_records(path, data)
    if records is not None:
        meta["records"] = records
    if path.suffix == ".ndjson":
        meta["media_type"] = "application/x-ndjson"
    elif path.suffix == ".json":
        meta["media_type"] = "application/json"
    elif path.suffix.lower() == ".png":
        meta["media_type"] = "image/png"
    elif path.suffix.lower() in {".jpg", ".jpeg"}:
        meta["media_type"] = "image/jpeg"
    elif path.suffix.lower() == ".webp":
        meta["media_type"] = "image/webp"
    manifest["files"][rel] = meta

# Exemplo de content_counts a partir dos arquivos conhecidos.
kind_map = {
    "content/moves.ndjson": "moves",
    "content/abilities.ndjson": "abilities",
    "content/capabilities.ndjson": "capabilities",
    "content/features.ndjson": "features",
    "content/edges.ndjson": "edges",
    "content/poke_edges.ndjson": "poke_edges",
    "content/items.ndjson": "items",
    "content/species.ndjson": "species",
}
for file_name, kind in kind_map.items():
    meta = manifest["files"].get(file_name)
    if meta:
        manifest["content_counts"][kind] = meta.get("records", 0)

(ROOT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for path in sorted(ROOT.rglob("*")):
        if path.is_file():
            z.write(path, path.relative_to(ROOT).as_posix())

print(OUT)
```

**Importante:** compacte o **conteúdo de `pack_build/`**, não a pasta `pack_build` como diretório externo. O ZIP final precisa ter `manifest.json` diretamente na raiz.

---

## 28. Validação obrigatória antes da entrega

Checklist:

- [ ] `.ptucp` abre como ZIP;
- [ ] `manifest.json` está na raiz;
- [ ] `format = "ptu-content-pack"`;
- [ ] `format_version = 1`;
- [ ] `manifest.id` é estável;
- [ ] versão foi incrementada corretamente;
- [ ] dependências são coerentes;
- [ ] cada NDJSON possui um JSON válido por linha;
- [ ] `id` e `logical_id` são estáveis;
- [ ] `definition_version_id` está explícito;
- [ ] `content_pack_id` corresponde ao `manifest.id`;
- [ ] provenance foi preservada;
- [ ] `needs_review` cobre ambiguidades reais;
- [ ] nenhuma regra contextual virou bônus permanente por engano;
- [ ] slots e `hands` estão corretos;
- [ ] armas usam `mechanics.kind = "weapon"`;
- [ ] Arcane Weapon está marcada corretamente;
- [ ] equipment grants desaparecem ao desequipar;
- [ ] Item local icon usa `icon_asset_path` válido;
- [ ] Species portrait usa `portrait_asset_path` válido;
- [ ] imagens têm até 5 MB;
- [ ] assets estão em `manifest.files`;
- [ ] `sha256` confere;
- [ ] `bytes` confere;
- [ ] `records` confere;
- [ ] `content_counts` confere;
- [ ] evolução possui datasets quando necessário;
- [ ] lojas usam `shop_categories` explícito;
- [ ] ZIP foi reaberto após geração;
- [ ] pack foi inspecionado/importado pela versão atual do app quando possível;
- [ ] foi produzido um `CONVERSION_REPORT.md` quando a conversão for não trivial.

---

## 29. Relatório de conversão recomendado

Entregar junto do pack algo como:

```markdown
# Conversion Report

- Pack: campaign-homebrew-example
- Version: 1.0.0
- Source: Example PDF / pages 4–9
- Definitions: 8 Items, 2 Moves
- Assets: 8 Item icons
- Dependencies: ptu-core-1.05

## Automated
- deterministic Skill/Stat/DR bonuses
- equipment slots
- weapon qualification
- grants while equipped

## Contextual/manual
- 1/Scene trigger on Example Item
- target-dependent Fire weakness bonus

## Review
- Item X page 7 has ambiguous duration wording
```

---

## 30. Importação no Desktop e Android

O mesmo `.ptucp` é destinado às duas plataformas.

No Pack Manager:

1. importar `.ptucp`;
2. o app valida o manifest/arquivo;
3. verifica dependências obrigatórias;
4. instala/atualiza as definições;
5. habilita ou preserva o estado do pack no Ruleset;
6. recalcula o catálogo resolvido.

No Desktop, a importação cria backup da base de definições antes de alterar o pack.

Packs podem ser:

- habilitados/desabilitados por Ruleset;
- atualizados pelo mesmo `manifest.id`;
- desinstalados quando são importados/removíveis;
- mantidos como bundled quando vieram incorporados ao app.

---

## 31. Compatibilidade resumida

| Recurso | Windows | Android |
|---|---|---|
| Import `.ptucp` | suportado | suportado |
| Enable/disable Pack Manager | suportado | suportado |
| Species portrait local | beta.9+ | beta.9+ |
| Imported weapon mechanics | beta.13+ | beta.14+ |
| Arcane Weapon resolver | beta.15+ | beta.16+ |
| Weapon Store | beta.16+ | beta.17+ |
| Gear Store | beta.17+ | beta.18+ |
| Item `icon_asset_path` local | beta.17+ | beta.18+ |
| `equipment_config` | beta.17+ | beta.18+ |
| Structured Trainer Gear mechanics | beta.17+ | beta.18+ |

Para packs que usem recursos novos, declarar no relatório a versão mínima necessária do app.

---

## 32. Erros comuns

### `manifest.json` dentro de uma pasta

Errado:

```text
meu-pack.zip
└── meu-pack/
    └── manifest.json
```

Certo:

```text
meu-pack.ptucp
├── manifest.json
└── content/
```

### Arquivo JSON em vez de NDJSON

Não usar array em `content/items.ndjson`.

### Duas mãos só no texto

`"Two-Handed"` em tags não ocupa dois slots. Use `mechanics.hands = 2`.

### Move especial colocado como Weapon Move

Se o Move é concedido independentemente do rank, use `compiled_effects.grant_entity`, não `weaponMoves.adept/master`.

### Hard-code de Combat

Para arma física normal, deixe o Rules Engine avaliar Features substitutas com `allowFeatureSubstitutions: true`.

### Item de loja sem categoria

Para pack externo, marque explicitamente `shop_categories: ["Weapon Store"]` ou `["Gear Store"]`.

### Ícone local sem declarar asset

Se usar `icon_asset_path`, o arquivo precisa existir dentro do ZIP e deve ser declarado no manifest.

### Efeito contextual transformado em estático

Não aplicar `+5 Damage` sempre se a regra só vale contra um tipo/alvo/situação.

### Criar novo pack ID para simples update

Isso causa coexistência/duplicação. Mantenha o `manifest.id` e aumente a versão.

---

## 33. Resumo operacional para uma futura IA

Quando receber material novo:

1. ler integralmente as páginas/tabelas relevantes;
2. enumerar as entidades por tipo;
3. definir `manifest.id`, versão, prioridade e dependências;
4. criar IDs lógicos estáveis;
5. preservar provenance e `raw_text`;
6. estruturar prerequisites seguros;
7. separar efeitos determinísticos de efeitos contextuais;
8. usar apenas mechanics/compiled effects já suportados;
9. adicionar slots, configuração, lojas e assets quando aplicável;
10. criar NDJSON por tipo;
11. criar datasets de evolução se necessário;
12. calcular SHA-256, bytes e records;
13. gerar `manifest.json` por último;
14. criar o ZIP com `manifest.json` na raiz;
15. renomear para `.ptucp`;
16. reabrir e validar o ZIP;
17. testar com o importador atual sempre que possível;
18. entregar `.ptucp` + relatório de conversão.

> **Regra final:** se o conteúdo cabe no contrato, não altere o app. Se não cabe, preserve a regra no pack e indique de forma explícita qual extensão do Rules Engine seria necessária.

---

## 34. Referências de implementação desta revisão

Este guia foi consolidado com base no contrato efetivamente usado pela aplicação de referência, incluindo:

- importador de Content Packs `format_version: 1`;
- Pack Manager e resolução por Ruleset;
- Species portraits locais;
- Item icons locais;
- armas físicas e arcanas;
- Weapon Store;
- Gear Store;
- equipment configuration;
- Trainer Gear structured mechanics;
- grants automáticos de Move/Ability/Capability enquanto equipado.

O formato de arquivo continua sendo **v1**. As extensões acima são campos adicionais dentro das definições e continuam compatíveis com o container `.ptucp` v1.
