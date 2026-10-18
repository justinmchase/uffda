fn main() {
    let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("languages.rs");
    uffda_build::embed(uffda_build::Embed {
        artifact_root: manifest.join("artifacts"),
        authored_root: None,
        logical_root: "grammar".into(),
        out_file: out,
    })
    .expect("embed consumer declaration fixtures");
}
