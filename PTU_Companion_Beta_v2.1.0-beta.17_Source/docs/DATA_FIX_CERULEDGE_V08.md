# Data correction — Ceruledge typing

The functional prototype's Knight-derived Species record previously exposed Ceruledge as only `Fire` even though its canonical typing metadata already contained `Fire / Ghost`.

For v0.8 the local definition seed was repaired so that:

```json
"types": ["Fire", "Ghost"]
```

The type-defense profile in the local seed was recalculated for the dual typing as well.

This is a prototype data repair and should also be carried into the next generated canonical Content Pack/seed release so the application does not need a runtime special case.
