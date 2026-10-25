# Publishing libraries to crates.io

Developed with substantial assistance from [Cursor](https://cursor.com); see the
[repository acknowledgments](https://github.com/justinmchase/uffda#acknowledgments).

Product CLI binaries ship on **GitHub Releases**. These crates ship on
**crates.io**:

| Crate               | Role                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `uffda-heap-derive` | GC derive macros                                                            |
| `uffda-heap`        | Collector heap                                                              |
| `uffda-build`       | `build.rs` embed helper for unmodified `.uff.ast` declaration codec records |
| `uffda-codec`       | Standalone strict reader/writer, streaming framing and owned native values  |
| `uffda-runtime`     | Runtime library (no product grammars by default)                            |

CI publishes them from `.github/workflows/publish.yml` using **OIDC trusted
publishing** (`rust-lang/crates-io-auth-action`). No long-lived
`CARGO_REGISTRY_TOKEN` secret is required.

## Release publishing

Publishing a GitHub Release runs the Publish workflow. The crates.io job uses a
short-lived OIDC token and publishes in dependency order: heap derive, heap,
build helper, codec, then runtime. Product grammars are not embedded in these
library packages.

## Trusted publishing configuration

Each crate's crates.io trusted publisher uses:

- **Repository**: `justinmchase/uffda`
- **Workflow filename**: `publish.yml`
- **Environment**: `crates-io` (must match the job `environment:` in the
  workflow)

The repository's `crates-io` GitHub Environment may add protection rules such as
required reviewers. Keep its name aligned with the workflow and crates.io
settings.

## Versioning

Crate versions in `Cargo.toml` and `src/**/Cargo.toml` must match the GitHub Release tag (bare
SemVer, optional `v` prefix stripped). Draft Release runs `semver set`, which
applies `.github/version.yml` post hooks to those manifests, then refreshes
`Cargo.lock`. The Publish workflow fails the crates.io job on mismatch.
