# GitHub publishing and release workflow

This document defines the canonical release process for PTU Companion. The goal is to make every distributed binary traceable to an exact reviewed commit and keep generated executables out of the source tree. Releases normally come from `main`; when a release is intentionally based on another reviewed line, a release-candidate branch may be created from the latest published tag and used as the PR target.

## Canonical release flow

1. Implement application/content changes in a dedicated branch.
2. Update the application version metadata before release. Keep all version declarations for the target platform consistent.
3. Open a Pull Request targeting `main`, an explicitly designated release-integration branch, or a temporary release-candidate branch created from the latest published tag. Run the relevant verification/build checks.
4. Merge only after review/approval. The merge commit in the selected release branch becomes the source commit for the release.
5. Confirm the selected branch contains the latest published release tag in its ancestry. If it does not, first reconcile the release history through a reviewed PR; do not publish from a divergent branch or silently replace the previous release baseline. A release-candidate branch is created at that tag, so it preserves a short, auditable path even when ordinary development branches have diverged.
6. Create a Git tag that points to that exact merged commit. A release tag must not be moved later to another commit.
7. Build the Windows and/or Android artifacts from the tagged commit (or from a checkout whose HEAD is exactly that commit).
8. Create a GitHub Release from the tag and attach the generated binaries and verification metadata as Release assets.
9. Verify that the Release page, tag and build metadata all reference the same commit before announcing/distributing the build.

Conceptually:

```text
feature/release branch
        |
        v
Pull Request -> reviewed release branch commit
                  |
                  +-> immutable release tag
                           |
                           +-> GitHub Release
                                |- Windows .exe
                                |- Android .apk
                                |- SHA-256 checksums
                                `- signing/build metadata
```

`main` remains the default release branch. An owner may instead authorize a release-candidate branch rooted at the latest published tag; the fixes are reviewed and merged into that branch before it is tagged. Merging a PR into a feature branch alone does not automatically make that branch a valid release source. The source commit must retain the latest release tag in its ancestry.

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
- build the Windows desktop launcher with `PTU_Companion_Windows_Source/scripts/build-windows-release.ps1` and Android ARM64 with `PTU_Companion_Android_Tauri/scripts/build-android-arm64-release.ps1`;
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

Follow the disk usage policy below before and after local builds.

Before making or maintaining the repository as public:

- Remove Android beta/release keystores and passwords from the repository and Git history.
- Do not commit private campaign saves or SQLite databases containing campaign data.
- Do not commit copyrighted PTU/Pokémon sourcebook PDFs unless redistribution is explicitly permitted.
- Review bundled `.ptucp` packs and artwork for redistribution rights.
- Keep generated build outputs (`dist/`, APKs, EXEs, local runtimes) out of source control unless there is a deliberate and documented reason to version them.
- Add release binaries to GitHub Releases rather than the repository root.
- Add a license for the application's own source code when appropriate.
- Keep `PTU_CONTENT_PACK_CONVERSION_GUIDE_v2.md` in the repository if external pack authors are expected to follow the same contract.

## Disk usage and local artifact retention

This policy applies to manual work and automated runs. Use the existing checkout/worktree and native tools; do not create a separate monitoring service for these checks.

### Before and after builds

- Before packaging, rebuilding a Docker image or downloading a toolchain, measure free space on both the build/output drive and the drive holding Docker's virtual disk. A checkout on E: does not imply Docker uses E:. Repeat the measurements after the build and cleanup.
- On Windows, use `Get-PSDrive` for host free space and `docker system df` for Docker usage. Record the Docker virtual disk path and size when it is growing or host space is low. If Docker is unavailable, report that its image/cache breakdown could not be measured.
- Below **20 GiB free** on either affected drive, notify Pedro with the measured values and planned cleanup. Continue a heavy build only after cleanup restores at least 20 GiB or a justified space estimate leaves at least 10 GiB free.
- Below **10 GiB free**, or when the estimated build cannot leave 10 GiB free, stop heavy builds/downloads until cleanup or Pedro's intervention restores enough space. A new toolchain may need more than this minimum; use its estimated requirement when known. Documentation and other light work may continue.
- Stop retries on `ENOSPC`, read-only filesystem, Docker metadata I/O errors or similar storage failures, even if reported free space exceeds these thresholds. Report the exact error and distinguish suspected disk pressure from a reproduced cause.

### Local installers and worktrees

- Keep one local copy per platform of the **latest published release** and the **current candidate awaiting review/validation**, with checksums and build metadata. Explicitly required regression artifacts may remain until their investigation ends; record why they are retained.
- Verify the retained published release has accessible GitHub Release assets before deleting older local installers. A Git tag/source commit is not a backup of a generated or signed binary.
- After a build/delivery stage, remove older and duplicate generated PTU installers from known output/test directories under the checkout or PTU worktrees. First confirm absolute paths remain within the intended directory and that the files are untracked, ignored and no longer needed. Keep tracked runtime bundles until a reviewed change removes them.
- Do not delete whole worktrees or directories based only on age. Inspect local changes, unpushed commits and ignored files first; archive managed worktrees through the supported worktree tool when their work is complete. Keep campaign databases/saves and signing keys/passwords outside cleanup targets.
- Prefer an existing output location on the drive with sufficient space; avoid copying the same installer into several worktrees. Do not silently change canonical packaging paths or Docker's disk location.

### Docker toolchain and caches

- Reuse `ptu-companion-builder:local` and the Windows build's Go image when their toolchains are unchanged. Rebuild only when the Dockerfile/build arguments or required toolchain change, or when diagnosing a reproduced environment problem; avoid unconditional image rebuilds just to change the application version.
- Use the current compose project's stable volume names. Do not create a new set of Cargo/Gradle/target caches for every application version. Use temporary containers with `--rm`.
- After builds, inspect usage and remove identified obsolete PTU images, stopped temporary PTU containers, duplicate version-specific cache volumes and obsolete build cache. Preserve current toolchain images and useful current Cargo/Gradle/target caches.
- Do not equate Docker's `reclaimable` or zero-container count with permission to delete a resource: build images and named caches can be current despite having no running container. Confirm ownership and use from compose/build configuration. Preserve other projects' images, databases and volumes.
- Never run broad `docker system prune --volumes` or prune all unused images/volumes as routine PTU cleanup. Before removing a volume that may contain signing identities or user data, inspect it and make a verified backup outside Git if needed. Git does not preserve ignored keys or Docker volume contents.
- Scope build-cache cleanup to PTU when possible. A shared builder's global prune also affects other projects' caches; obtain explicit authorization for that scope. Cache size alone does not authorize removal of persistent data.

### When Pedro must intervene

- Notify Pedro when safe cleanup cannot restore the required headroom, Docker cannot start, a resource's ownership/data cannot be established, or disk compaction/relocation requires Windows administrator privileges or UI access unavailable to the agent.
- Include: affected drive and free space, Docker disk size/path and available usage breakdown, exact error/log path, what was removed/preserved, measured space recovered, and the next concrete action Pedro must take. Do not claim success from a command's exit code alone; confirm the resulting disk size and free space.
- Deleting Docker data may free space inside Linux without shrinking the host `.vhdx`. Treat host reclamation as pending until measured. Use a supported compaction/relocation procedure; do not delete the virtual disk or reset Docker to recover space.
- Maintenance scripts must use explicit validated paths, fail clearly when prerequisites are missing, keep logs in an accessible maintenance directory with a unique filename per run, and restore Docker after a stopped-engine operation where possible. Report log creation/write failures explicitly, without masking the original operation error.
- Record the measurements, cleanup and pending intervention in the task/automation memory. Do not repeatedly retry a blocked build or send unchanged alerts every run; report new failures, meaningful space changes, and whether an earlier intervention remains required when work depends on it.
