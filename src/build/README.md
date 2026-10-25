# uffda-build

Build-script helpers for embedding **unmodified** Uffda ModuleDeclaration
artifacts into a Rust binary or library.

Developed with substantial assistance from [Cursor](https://cursor.com); see the
[repository acknowledgments](https://github.com/justinmchase/uffda#acknowledgments).

This crate never parses `.uff`, never re-lowers declarations, and never rewrites
artifact bytes. Compile grammars with a published `uffda compile`, then point a
`build.rs` at the resulting artifact tree. Data-codec ModuleDeclarations use the
**`.uff.ast`** extension; during migration compile also writes
**`.uff.ast.json`** siblings for compatibility. `uffda-build` embeds only the
codec form (`*.uff.ast`); a JSON-only bootstrap fails with guidance to install a
published compiler that emits codec records.

```rust,ignore
// build.rs
fn main() {
    uffda_build::embed(uffda_build::Embed {
        artifact_root: "artifacts".into(),
        authored_root: None,
        logical_root: "grammar".into(),
        out_file: std::env::var_os("OUT_DIR").unwrap().into(),
    })
    .unwrap();
}
```

Then `include!(concat!(env!("OUT_DIR"), "/languages.rs"));` for
`DECLARATIONS: &[(&str, &str)]`, and register them with
`Resolver::insert_declaration_codec_source`. Decoding needs no embedded language
or workspace files.
