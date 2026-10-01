# Releasing Inaudio

Merging or pushing to `main` starts the release workflow. The workflow reads stable GitHub release tags and the commits since the newest stable tag. `feat:` creates a minor release, `!` or `BREAKING CHANGE:` creates a major release, and other commits create a patch release. With no prior release, the `package.json` version (`1.0.0`) is the baseline.

The workflow first runs the reusable CI workflow on Windows, Linux, and macOS. Each runner applies the planned version in its disposable checkout, packages the application, and emits installers plus SHA-256 manifests. A separate publisher job has the only `contents: write` permission. It creates a draft release with GitHub generated notes, uploads all verified artifacts, and publishes the draft.

A rerun for a commit that already has a public release exits without changing its assets. A partially uploaded draft can be resumed when its existing assets match their local checksums. Conflicting assets, tags, release targets, or checksums fail closed; remove the failed draft manually after investigating before retrying. Published assets are never overwritten.

Artifacts are Windows x64 Squirrel installers (`.exe`, `.nupkg`, and `RELEASES`), Linux x64 `.deb` and `.rpm` packages, and an Apple Silicon macOS `.zip`. Intel macOS and Linux ARM64 are not built. Checksums and platform-prefixed filenames prevent collisions. The Squirrel `RELEASES` file is supplied for inspection; this pipeline does not configure an automatic update feed.

Use conventional commit messages in the commits that actually reach `main` (including squash merge titles). For example, an initial `fix:` commit produces `v1.0.1`, while an initial `feat:` produces `v1.1.0`. No version commit is pushed back to the repository. GitHub notes are grouped using `.github/release.yml`; labels affect notes, while commit messages determine versions.

Protect `main` with required PR review and the `Lint and typecheck` and three `Package (...)` checks. Restrict who can change workflows and publish releases. Never run untrusted PR code using `pull_request_target` or give build jobs secrets. PR workflows use read-only permissions and checkout credentials are not persisted.

The release concurrency group serializes active releases. GitHub may replace an older pending run with a newer push, so multiple rapid merges can be combined into one release. A failed gate publishes nothing. Manually created tags or drafts that conflict with the computed version require investigation; the automation never moves an existing tag.

## Manual operation

Use **Run workflow** only when a push to `main` was not delivered. The workflow still uses the selected commit on `main`; do not run it from a feature branch. `GITHUB_TOKEN` needs repository Actions permission to read releases and contents write permission is granted only to the publisher job.

The macOS runner creates `assets/icons/icon.icns` from the checked-in PNG because the repository does not currently contain an ICNS source. Signing, notarization, and platform-specific code signing are intentionally not configured; add those credentials to protected GitHub Actions environments before enabling them. Build jobs do not receive release secrets.

Action references in the workflows are immutable commit SHAs. Update them only after checking the upstream release tag and commit with `gh api` or `git ls-remote`, then update the adjacent version comment.
