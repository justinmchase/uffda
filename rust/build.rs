//! Product language embed for the Uffda CLI binary / in-tree tests.
//!
//! Library consumers should depend on `uffda-runtime` *without* the
//! `embed-languages` feature and call `uffda_build::embed` from their own
//! `build.rs` against their compiled JSON artifacts.

fn main() {
    let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("languages.rs");
    if std::env::var_os("CARGO_FEATURE_EMBED_LANGUAGES").is_none() {
        uffda_build::write_empty(&out).expect("write empty DECLARATIONS");
        return;
    }
    let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    uffda_build::embed(uffda_build::Embed {
        artifact_root: manifest.join("../bin/ast/src/lang"),
        authored_root: Some(manifest.join("../src/lang")),
        logical_root: "src/lang".into(),
        out_file: out,
    })
    .expect("embed published language artifacts");
}
