# Known limitations — v0.3

- Definition browsing is read-only.
- `.ptucp` installation is not yet wired into the live definition database.
- the Core-only ruleset contains no Species records in this seed, because the supplied Core book is not the Pokédex source; use the all-provided-material profile to browse the supplied Gen8ish Species definitions.
- existing sample campaign Pokémon are still fictional visual/interaction fixtures and are not yet instantiated from Species definitions.
- Trainer/Pokémon Move Instances are not yet bound to resolved Move definitions.
- semantic effects are visible through definition data but are not yet applied to character state by a full Modifier/Rules Engine.
- the no-build `static-preview` is the tested functional path. The React/Vite source remains a development scaffold and requires npm dependencies before compilation.
