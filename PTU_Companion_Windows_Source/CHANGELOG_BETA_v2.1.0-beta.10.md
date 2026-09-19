# PTU Companion Beta v2.1.0-beta.10

## Windows runtime refresh hotfix

- New version number to guarantee a fresh runtime directory after the earlier beta.9 build was replaced under the same version label.
- Trainer XP Bank controls from beta.9 are present in **Trainer → Profile** (`-5`, `-1`, `+1`, `+5`, `Set XP`).
- Static frontend files now use a version query string to avoid stale Edge cache.
- The launcher now fingerprints the embedded `runtime_bundle.zip`; even if a build is accidentally rebuilt with the same semantic version, a changed bundle forces re-extraction.
- The Windows release executable is distributed with the version in its filename to make different builds visually distinct.

All beta.9 functionality remains included: Species images in `.ptucp`, Trainer XP spending, Temporary HP, Pokémon name/Loyalty editing and Content Pack management.
