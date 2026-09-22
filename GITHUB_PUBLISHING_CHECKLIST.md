# GitHub publishing and release workflow

This document defines the canonical release process for PTU Companion. The goal is to keep `main` as the source of truth, make every distributed binary traceable to an exact commit, and keep generated executables out of the source tree.

## Canonical release flow

1. Implement application/content changes in a dedicated branch.
2. Update the application version metadata before release. Keep all version declarations for the target platform consistent.
3. Open a Pull Request targeting `main` and run the relevant verification/build checks.
4. Merge only after review/approval. The merge commit in `main` becomes the source commit for the release.
5. Create a Git tag that points to that exact `main` commit. A release tag must not be moved later to another commit.
6. Build the Windows and/or Android artifacts from the tagged commit (or from a checkout whose HEAD is exactly that commit).
7. Create a GitHub Release from the tag and attach the generated binaries and verification metadata as Release assets.
8. Verify that the Release page, tag and build metadata all reference the same commit before announcing/distributing the build.

Conceptually:

```text
feature/release branch
        |
        v
Pull Request -> main commit
                  |
                  +-> immutable release tag
                           |
                           +-> GitHub Release
                                |- Windows .exe
                                |- Android .apk
                                |- SHA-256 checksums
                                `- signing/build metadata
```

## Source control versus Release assets

The Git repository should contain source code, build scripts, content definitions and technical documentation. Generated application binaries should normally **not** be committed to `main` or stored in the repository root.

Publish generated files through GitHub Releases instead, including as applicable:

- `PTU-Companion-Windows-v<version>.exe`;
- `PTU-Companion-v<version>-arm64-release.apk`;
- per-file `.sha256` files and/or `SHA256SUMS.txt`;
- non-secret signing certificate fingerprints/build metadata;
- release notes describing important changes and compatibility notes.

This keeps the Git history small while preserving a stable download location for each published version.

## Versioning requirements

Before merging a release PR, update every version declaration used by the corresponding application/runtime and confirm that generated artifact filenames match the released version.

For Android specifically:

- increment the human-readable app version (`versionName` / Tauri package version);
- increment `versionCode` for every installable update;
- never reuse a previously published `versionCode` for a different APK.

For Windows, keep launcher/runtime/application version metadata synchronized so a new application build cannot accidentally reuse stale runtime identifiers.

## Reproducibility and traceability

A published Release must be reproducible from its tag. The release tag, GitHub Release target and source commit used by the build must identify the same commit.

Recommended release checks:

- record the source commit SHA in build/release metadata;
- run the project's verification suites before packaging;
- produce SHA-256 hashes for distributed binaries;
- keep workflow/build scripts versioned in the repository when they are intended to be reused;
- do not rebuild a different binary under the same release tag/version without explicitly replacing the release and documenting why.

If `main` advances after a Release is published, the old tag remains fixed on the historical release commit. This allows future work to continue without changing what an existing version means.

## Android signing and in-place updates

Android only accepts an APK as an update over an installed PTU Companion build when the new APK uses the same application/package identity **and the same signing identity** as the installed build, in addition to having a higher `versionCode`.

Therefore:

- keep private release keystores and passwords outside the Git repository;
- do not upload private signing keys as Release assets;
- publish only non-secret certificate fingerprints/metadata when useful for verification;
- preserve the same release signing identity across sequential Android versions when in-place updates are desired.

Changing the signing identity generally means users must uninstall the previous APK before installing the newly signed one, which can remove application-local data depending on the platform/install path. Treat signing-key continuity as release infrastructure.

## Release naming

Use version-bearing filenames and a tag/release name that makes the target application versions explicit. For combined Windows + Android releases, a tag may identify both application versions, for example:

```text
release-2.1.0-beta.19-2.2.0-beta.21
```

The important rule is not the exact string format; it is that the tag is unique, immutable, documented, and points to the source commit used to produce the attached binaries.

## Repository publishing checklist

Before making or maintaining the repository as public:

- Remove Android beta/release keystores and passwords from the repository and Git history.
- Do not commit private campaign saves or SQLite databases containing campaign data.
- Do not commit copyrighted PTU/Pokémon sourcebook PDFs unless redistribution is explicitly permitted.
- Review bundled `.ptucp` packs and artwork for redistribution rights.
- Keep generated build outputs (`dist/`, APKs, EXEs, local runtimes) out of source control unless there is a deliberate and documented reason to version them.
- Add release binaries to GitHub Releases rather than the repository root.
- Add a license for the application's own source code when appropriate.
- Keep `PTU_CONTENT_PACK_CONVERSION_GUIDE_v2.md` in the repository if external pack authors are expected to follow the same contract.
