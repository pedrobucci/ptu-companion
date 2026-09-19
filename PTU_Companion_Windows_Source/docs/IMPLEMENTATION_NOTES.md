# Visual implementation notes

## Shared visual primitives

The prototype intentionally centralizes most of the appearance in `src/styles.css` and keeps JSX relatively semantic.

The first components to extract into a production component library are:

- `Section`
- `TypeBadge`
- `Chip`
- `PrimaryButton`
- `Progress`
- `MiniStat`
- `CreatureCard`
- navigation shell

## Desktop dimensions

The concept is optimized for a wide Windows application, roughly 1366–1920 px wide. The visual shell intentionally resembles a stylized handheld Pokédex without wasting too much content space.

## Data density

PTU character sheets are dense. Do not dramatically simplify the amount of visible information. Prefer tabs, popovers and contextual panels over removing data.

## Editors

Advanced editors are desktop-first. Android can later expose read-only views and imports, but creation/versioning of Moves, Abilities, Species, Items, Edges, Features and Capabilities should prioritize keyboard/mouse workflows.

## Semantic color use

The file `docs/reference/pokemon-ui-design-compliance.md` is the visual token reference. Use semantic tokens rather than arbitrary hex values when moving this prototype into production.
