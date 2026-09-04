# Pokémon UI Design Compliance

## Objetivo

Este documento consolida uma referência visual e funcional para avaliar se uma aplicação inspirada em Pokémon utiliza de forma coerente:

- identidade visual geral da franquia;
- cores dos 18 tipos Pokémon;
- cores de categorias de itens;
- cores de atributos (stats);
- cores de categorias de golpes;
- estados visuais de HP;
- elementos e tokens de UI;
- aplicação semântica consistente dessas cores na interface.

> **Observação importante:** não existe um design system público e único da The Pokémon Company que defina todos os componentes de UI e todos os códigos HEX utilizados ao longo da franquia.  
> As cores de tipos, itens, stats e categorias abaixo são baseadas em referências visuais documentadas de jogos oficiais. Já os tokens globais de UI são uma consolidação prática para auditoria e implementação.

---

# 1. Identidade visual geral Pokémon

## 1.1. Paleta associada ao logotipo tradicional

| Papel | HEX |
|---|---|
| Pokémon Yellow | `#FFCB05` |
| Yellow Shadow | `#C7A008` |
| Pokémon Light Blue | `#2A75BB` |
| Pokémon Dark Blue | `#3C5AA6` |

Uso recomendado:

- cabeçalhos;
- navegação principal;
- botões primários;
- foco/seleção;
- destaques globais;
- elementos de identidade da aplicação.

Essas cores devem atuar como identidade geral, sem substituir cores semânticas de tipos, HP, moves ou itens.

---

## 1.2. Paleta inspirada na Poké Ball

| Papel | HEX |
|---|---|
| Poké Ball Red | `#EE1515` |
| Near Black | `#222224` |
| Off White | `#F0F0F0` |

Uso recomendado:

- ações críticas;
- botões destrutivos;
- captura;
- ícones circulares;
- badges especiais;
- elementos que desejem remeter imediatamente à Poké Ball.

---

# 2. Paleta dos 18 tipos Pokémon

A recomendação é manter, para cada tipo, três variantes:

- `light`;
- `base`;
- `dark`.

| Tipo | Light | Base | Dark |
|---|---|---|---|
| Bug | `#B8C26A` | `#91A119` | `#5E6910` |
| Dark | `#998B8C` | `#624D4E` | `#403233` |
| Dragon | `#8D98EC` | `#5060E1` | `#343E92` |
| Electric | `#FCD659` | `#FAC000` | `#A37D00` |
| Fairy | `#F5A2F5` | `#EF70EF` | `#9B499B` |
| Fighting | `#FFAC59` | `#FF8000` | `#A65300` |
| Fire | `#EF7374` | `#E62829` | `#961A1B` |
| Flying | `#ADD2F5` | `#81B9EF` | `#54789B` |
| Ghost | `#A284A2` | `#704170` | `#492A49` |
| Grass | `#82C274` | `#3FA129` | `#29691B` |
| Ground | `#B88E6F` | `#915121` | `#5E3515` |
| Ice | `#81DFF7` | `#3DCEF3` | `#28869E` |
| Normal | `#C1C2C1` | `#9FA19F` | `#676967` |
| Poison | `#B884DD` | `#9141CB` | `#5E2A84` |
| Psychic | `#F584A8` | `#EF4179` | `#9B2A4F` |
| Rock | `#CBC7AD` | `#AFA981` | `#726E54` |
| Steel | `#98C2D1` | `#60A1B8` | `#3E6978` |
| Water | `#74ACF5` | `#2980EF` | `#1B539B` |

## 2.1. Tipo especial Stellar

Opcional para aplicações que representem mecânicas modernas.

| Tipo | Light | Base | Dark |
|---|---|---|---|
| Stellar | `#83CFC5` | `#40B5A5` | `#2A766B` |

## 2.2. Uso recomendado

As cores dos tipos devem afetar componentes como:

- badges de tipo;
- chips;
- bordas de cards;
- fundos suaves;
- ícones;
- filtros;
- cabeçalhos de seção;
- indicadores de resistência, fraqueza ou imunidade;
- cards de Pokémon;
- cards ou listas de moves.

Exemplo:

```css
.type-fire {
  --type-light: #EF7374;
  --type-base:  #E62829;
  --type-dark:  #961A1B;
}
```

---

# 3. Categorias de itens

| Categoria | Light | Base | Dark |
|---|---|---|---|
| Items | `#D89DB7` | `#C86890` | `#82445E` |
| Medicine | `#EBA27E` | `#E07038` | `#924924` |
| Poké Balls | `#DBB26E` | `#C88820` | `#825815` |
| TMs / HMs | `#ACC66E` | `#80A820` | `#536D15` |
| Berries | `#6EC188` | `#20A048` | `#15682F` |
| Battle Items | `#78A2EB` | `#3070E0` | `#1F4992` |
| Key Items | `#B788E6` | `#9048D8` | `#5E2F8C` |
| Mail | `#69B7CC` | `#1890B0` | `#105E72` |
| Treasures | `#F7DB8C` | `#F2C74E` | `#9D8133` |
| Ingredients | `#CA8263` | `#AD3F0F` | `#70290A` |
| Z-Crystals | `#CEB38A` | `#B48A4B` | `#755A31` |
| Apricorns | `#F5C169` | `#F0A018` | `#9C6810` |
| Cologne | `#D2CCDC` | `#BAB1C9` | `#797383` |

Uso recomendado:

- categorias de inventário;
- abas;
- filtros;
- chips;
- ícones;
- cabeçalhos;
- cards de item;
- bordas e indicadores laterais.

Exemplo:

```css
.item-card[data-category="medicine"] {
  --accent-light: #EBA27E;
  --accent:       #E07038;
  --accent-dark:  #924924;
}
```

---

# 4. Atributos / Stats

| Stat | Light | Base | Dark |
|---|---|---|---|
| HP | `#9EE865` | `#69DC12` | `#448F0C` |
| Attack | `#F5DE69` | `#EFCC18` | `#9B8510` |
| Defense | `#F09A65` | `#E86412` | `#97410C` |
| Special Attack | `#66D8F6` | `#14C3F1` | `#0D7F9D` |
| Special Defense | `#899EEA` | `#4A6ADF` | `#304591` |
| Speed | `#E46CCA` | `#D51DAD` | `#8B1370` |

Uso recomendado:

- barras;
- gráficos;
- labels;
- indicadores de crescimento;
- comparação de Pokémon;
- telas de level-up;
- cards de stats.

Exemplo:

```css
--stat-hp:    #69DC12;
--stat-atk:   #EFCC18;
--stat-def:   #E86412;
--stat-spatk: #14C3F1;
--stat-spdef: #4A6ADF;
--stat-speed: #D51DAD;
```

---

# 5. Categorias de golpes

| Categoria | Light | Base | Dark |
|---|---|---|---|
| Physical | `#F29173` | `#EB5628` | `#99381A` |
| Special | `#7D94CD` | `#375AB2` | `#243B74` |
| Status | `#AEAEAE` | `#828282` | `#555555` |

Texto recomendado:

```css
--move-category-text: #FFFFFF;
```

Uso recomendado:

- badge de categoria;
- ícone;
- borda lateral;
- tag;
- pequena faixa no card do golpe.

Um move pode combinar simultaneamente:

- cor do tipo;
- cor da categoria.

Exemplo conceitual:

```text
Flamethrower
Type: Fire      -> #E62829
Category: Special -> #375AB2
```

---

# 6. Estados visuais de HP

A série principal tradicionalmente utiliza mudança visual conforme o percentual de HP.

| Percentual | Estado |
|---|---|
| `> 50%` | Verde |
| `20% – 50%` | Amarelo |
| `< 20%` | Vermelho |
| `0%` | Fainted / Incapacitado |

## 6.1. Verde

Pode utilizar:

```css
--hp-green-light: #9EE865;
--hp-green:       #69DC12;
--hp-green-dark:  #448F0C;
```

## 6.2. Amarelo e vermelho

Para amarelo e vermelho, recomenda-se utilizar tokens semânticos da própria aplicação, garantindo contraste e acessibilidade.

Exemplo:

```css
--hp-warning: #FAC000;
--hp-danger:  #EE1515;
```

## 6.3. Comportamento esperado

```text
100% ████████████████████ GREEN
 48% ██████████           YELLOW
 17% ███                  RED
  0%                      FAINTED
```

O teste deve validar não apenas a existência das cores, mas sua mudança automática conforme o valor de HP.

---

# 7. Design Tokens recomendados

```css
/* ============================================================
   Pokémon Brand
   ============================================================ */

--pk-blue:        #2A75BB;
--pk-blue-dark:   #3C5AA6;
--pk-yellow:      #FFCB05;
--pk-yellow-dark: #C7A008;

--pk-red:         #EE1515;
--pk-black:       #222224;
--pk-white:       #F0F0F0;


/* ============================================================
   Global UI
   ============================================================ */

--ui-primary:      #2A75BB;
--ui-primary-dark: #3C5AA6;

--ui-accent:       #FFCB05;
--ui-accent-dark:  #C7A008;

--ui-danger:       #EE1515;

--ui-text:         #222224;
--ui-surface:      #F0F0F0;


/* ============================================================
   Move categories
   ============================================================ */

--move-physical: #EB5628;
--move-special:  #375AB2;
--move-status:   #828282;


/* ============================================================
   Stats
   ============================================================ */

--stat-hp:    #69DC12;
--stat-atk:   #EFCC18;
--stat-def:   #E86412;
--stat-spatk: #14C3F1;
--stat-spdef: #4A6ADF;
--stat-speed: #D51DAD;


/* ============================================================
   Inventory
   ============================================================ */

--item-general:  #C86890;
--item-medicine: #E07038;
--item-pokeball: #C88820;
--item-tm:       #80A820;
--item-berry:    #20A048;
--item-battle:   #3070E0;
--item-key:      #9048D8;
--item-treasure: #F2C74E;
```

---

# 8. Elementos de UI que devem ser auditados

O teste não deve procurar apenas códigos HEX no CSS.

Uma aplicação pode possuir as cores corretas sem realmente aplicá-las na interface.

Devem ser avaliados, quando presentes:

## 8.1. Navegação

- App Bar;
- Sidebar;
- Tabs;
- Bottom Navigation;
- breadcrumbs;
- menus contextuais.

Critérios:

- uso consistente da identidade azul/amarelo;
- estado ativo claramente distinguível;
- contraste suficiente.

---

## 8.2. Botões

Categorias sugeridas:

- Primary;
- Secondary;
- Accent;
- Danger;
- Confirm;
- Cancel;
- Capture;
- Pokémon-specific action.

Critérios:

- estados `hover`, `active`, `focus`, `disabled`;
- semântica consistente;
- cores Pokémon usadas sem prejudicar legibilidade.

---

## 8.3. Cards

Verificar cards de:

- Pokémon;
- Trainer;
- Move;
- Ability;
- Capability;
- Edge;
- Feature;
- Item;
- Encounter;
- Pokédex.

Critérios:

- tipo do Pokémon deve aparecer visualmente;
- dual-type deve ser representado sem perder legibilidade;
- atributos e categorias devem possuir semântica própria.

---

## 8.4. Badges e Chips

Verificar:

- tipos;
- move category;
- status conditions;
- rarity;
- item category;
- Pokémon state;
- combat state.

---

## 8.5. Forms

Verificar:

- inputs;
- selects;
- checkboxes;
- radio buttons;
- switches;
- autocomplete;
- validation;
- focus states.

A identidade Pokémon pode aparecer em:

- focus ring;
- seleção;
- toggles;
- bordas ativas.

---

## 8.6. Feedback

Verificar:

- success;
- warning;
- danger;
- info;
- loading;
- empty state;
- error state;
- confirmation dialogs.

Nem todos devem obrigatoriamente utilizar cores da franquia.  
A semântica e a acessibilidade são prioritárias.

---

# 9. Critérios de auditoria semântica

O teste deve avaliar:

1. presença das cores;
2. uso real na interface;
3. uso no componente correto;
4. consistência entre telas;
5. contraste e acessibilidade;
6. uso de variantes `light/base/dark`;
7. tipo Pokémon influenciando badges/cards;
8. categoria de move influenciando sua representação;
9. stats usando suas respectivas cores;
10. inventário categorizado visualmente;
11. HP alterando cor de acordo com percentual;
12. identidade azul/amarelo sendo usada como camada global;
13. cores semânticas não sendo sobrescritas por branding;
14. componentes equivalentes usando os mesmos tokens;
15. ausência de códigos arbitrários quando deveria existir token reutilizável.

---

# 10. Níveis de conformidade

| Nível | Descrição |
|---|---|
| Baixo | Apenas azul, amarelo ou vermelho genéricos |
| Parcial | Branding + algumas cores dos tipos |
| Bom | 18 tipos + UI global + HP + Moves |
| Excelente | Tipos + Moves + Stats + Items + HP + Branding + Light/Base/Dark + aplicação semântica consistente |

---

# 11. Sugestão de pontuação

Uma auditoria automática pode utilizar a seguinte divisão:

| Categoria | Peso |
|---|---:|
| 18 tipos | 25% |
| Branding global | 10% |
| Stats | 10% |
| Moves | 10% |
| Items | 10% |
| HP e estados | 10% |
| Componentes de UI | 15% |
| Consistência e tokens | 5% |
| Acessibilidade | 5% |
| **Total** | **100%** |

Sugestão de classificação:

| Score | Classificação |
|---:|---|
| 0–39 | Baixa conformidade |
| 40–59 | Parcial |
| 60–79 | Boa |
| 80–89 | Muito boa |
| 90–100 | Excelente |

---

# 12. Exemplo de estrutura de tokens em JSON

```json
{
  "brand": {
    "blue": "#2A75BB",
    "blueDark": "#3C5AA6",
    "yellow": "#FFCB05",
    "yellowDark": "#C7A008",
    "red": "#EE1515",
    "black": "#222224",
    "white": "#F0F0F0"
  },
  "types": {
    "fire": {
      "light": "#EF7374",
      "base": "#E62829",
      "dark": "#961A1B"
    },
    "water": {
      "light": "#74ACF5",
      "base": "#2980EF",
      "dark": "#1B539B"
    },
    "grass": {
      "light": "#82C274",
      "base": "#3FA129",
      "dark": "#29691B"
    }
  },
  "moves": {
    "physical": "#EB5628",
    "special": "#375AB2",
    "status": "#828282"
  },
  "stats": {
    "hp": "#69DC12",
    "attack": "#EFCC18",
    "defense": "#E86412",
    "specialAttack": "#14C3F1",
    "specialDefense": "#4A6ADF",
    "speed": "#D51DAD"
  },
  "items": {
    "general": "#C86890",
    "medicine": "#E07038",
    "pokeball": "#C88820",
    "tm": "#80A820",
    "berry": "#20A048",
    "battle": "#3070E0",
    "key": "#9048D8",
    "treasure": "#F2C74E"
  }
}
```

---

# 13. Exemplo de interface semanticamente coerente

```text
┌─────────────────────────────────────────┐
│ Pokémon Companion                 ⚙     │
├─────────────────────────────────────────┤
│ CHARIZARD                               │
│ 🔥 FIRE               🪽 FLYING          │
│                                         │
│ HP        ████████████       93         │
│ Attack    ██████████         84         │
│ Defense   ███████            65         │
│ Sp. Atk   ███████████        90         │
│ Sp. Def   ████████           70         │
│ Speed     ██████████         84         │
│                                         │
│ MOVES                                   │
│ 🔥 Flamethrower     SPECIAL             │
│ 🪽 Air Slash        SPECIAL             │
│ 🐉 Dragon Claw      PHYSICAL            │
└─────────────────────────────────────────┘
```

O objetivo não é apenas reproduzir uma paleta, mas construir uma hierarquia visual reconhecível e semanticamente coerente com Pokémon.

---

# 14. Recomendações para auditoria de código

Ao analisar uma aplicação React, CSS, Tailwind ou equivalente, procurar:

- HEX;
- RGB/RGBA;
- HSL;
- CSS custom properties;
- Tailwind arbitrary colors;
- theme configuration;
- Styled Components;
- CSS Modules;
- inline styles;
- SVG fills;
- SVG strokes;
- icon colors;
- chart colors.

Também verificar se os tokens estão efetivamente ligados a componentes.

Exemplos de busca:

```text
#E62829
#2980EF
#3FA129
#FFCB05
#2A75BB
```

Porém a presença isolada não deve contar como conformidade completa.

---

# 15. Exemplo de critérios automatizados

```text
PASS:
- Fire badge utiliza Fire base/light/dark.
- Water badge utiliza Water base/light/dark.
- Physical Move apresenta indicador físico.
- Medicine possui identidade visual própria.
- HP muda para Warning abaixo de 50%.
- HP muda para Danger abaixo de 20%.
- Navbar utiliza branding Pokémon.
- Focus states são visíveis.
- Tokens reutilizáveis centralizam as cores.

WARN:
- Cor próxima, porém fora da referência.
- Cor existe, mas só em código não utilizado.
- Há duplicação de valores HEX em vez de tokens.

FAIL:
- Tipo usa cor arbitrária incompatível.
- HP não muda conforme estado.
- Todos os moves usam a mesma cor.
- Categorias de item são visualmente indistinguíveis.
- Componentes possuem baixo contraste.
```

---

# 16. Fontes de referência

Referências utilizadas como base visual:

- Bulbapedia — Color templates:  
  https://bulbapedia.bulbagarden.net/wiki/Help%3AColor_templates

- Bulbapedia — Health / HP behavior:  
  https://bulbapedia.bulbagarden.net/wiki/Health

- Design Pieces — Pokémon logo color palette:  
  https://www.designpieces.com/palette/pokemon-logo-color-palette-hex-and-rgb/

- Color Hex — Poké Ball palette:  
  https://www.color-hex.com/color-palette/1045

---

# 17. Observação sobre propriedade intelectual

Pokémon, nomes, tipos, imagens, logotipos e demais elementos da franquia são propriedade de seus respectivos titulares.

Este documento deve ser utilizado como referência técnica e visual para desenvolvimento, testes, prototipação ou projetos permitidos, e não representa um design system oficial da The Pokémon Company, Nintendo, Game Freak ou Creatures Inc.
