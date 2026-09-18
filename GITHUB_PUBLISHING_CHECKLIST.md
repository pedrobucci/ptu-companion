# GitHub publishing checklist

Before making the repository public:

- Remove Android beta/release keystores and passwords from the repository and Git history.
- Do not commit private campaign saves or SQLite databases containing campaign data.
- Do not commit copyrighted PTU/Pokémon sourcebook PDFs unless redistribution is explicitly permitted.
- Review bundled `.ptucp` packs and artwork for redistribution rights.
- Keep generated build outputs (`dist/`, APKs, local runtimes) out of source-control unless you intentionally publish them through GitHub Releases.
- Add a license for your own application source code.
- Add release binaries to GitHub Releases rather than the repository root.
- Keep `PTU_CONTENT_PACK_CONVERSION_GUIDE_v2.md` in the repository if you want external pack authors to follow the same contract.
