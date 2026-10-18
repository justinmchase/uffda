# Publishing libraries to crates.io

Product CLI binaries ship on **GitHub Releases**. These crates ship on
**crates.io**:

| Crate | Role |
|-------|------|
| `uffda-heap-derive` | GC derive macros |
| `uffda-heap` | Collector heap |
| `uffda-build` | `build.rs` embed helper for declaration JSON |
| `uffda-runtime` | Runtime library (no product grammars by default) |

CI publishes them from `.github/workflows/publish.yml` using **OIDC trusted
publishing** (`rust-lang/crates-io-auth-action`). No long-lived
`CARGO_REGISTRY_TOKEN` secret is required after the one-time setup below.

## One-time setup (crate owner)

### 1. First publish (manual)

Trusted publishing can only be attached to crates that already exist. From a
clean checkout at the version you want (e.g. `0.10.0`):

```sh
cargo login   # crates.io API token, once on this machine
cargo publish -p uffda-heap-derive --manifest-path rust/Cargo.toml --locked
cargo publish -p uffda-heap --manifest-path rust/Cargo.toml --locked
cargo publish -p uffda-build --manifest-path rust/Cargo.toml --locked
cargo publish -p uffda-runtime --manifest-path rust/Cargo.toml --locked
```

### 2. Trusted publishing on crates.io

For **each** of the four crates → Settings → Trusted Publishing:

- **Repository**: `justinmchase/uffda`
- **Workflow filename**: `publish.yml`
- **Environment**: `crates-io` (must match the job `environment:` in the workflow)

### 3. GitHub Environment

Repo → Settings → Environments → create `crates-io` (optional protection rules
such as required reviewers).

After that, publishing a GitHub Release (or `workflow_dispatch` on Publish) runs
the crates.io job with a short-lived OIDC token.

## Versioning

Crate versions in `rust/**/Cargo.toml` must match the GitHub Release tag (bare
SemVer, optional `v` prefix stripped). The Publish workflow fails the crates.io
job on mismatch.
