use crate::resolver::{ModuleResolutionError, Resolver};
use url::Url;

include!(concat!(env!("OUT_DIR"), "/languages.rs"));

/// Registers unmodified published-compiler artifacts as explicit declaration data.
///
/// Product builds enable `embed-languages` so [`DECLARATIONS`] is this repo's
/// `./bin` tree. Library consumers leave that feature off and register their
/// own compiled JSON via [`Resolver::insert_declaration_source`] instead.
pub fn register(resolver: &mut Resolver) -> Result<Url, ModuleResolutionError> {
    let root = Url::parse(if cfg!(windows) {
        "file:///C:/uffda/builtin/"
    } else {
        "file:///uffda/builtin/"
    })
    .expect("static builtin identity");
    for (path, source) in DECLARATIONS {
        let url = root.join(path).map_err(|error| ModuleResolutionError {
            module_url: (*path).into(),
            message: "invalid embedded language identity".into(),
            cause: Some(error.to_string()),
            import_chain: Vec::new(),
        })?;
        resolver.insert_declaration_source(url, source);
    }
    Ok(root)
}

#[cfg(all(test, feature = "embed-languages"))]
mod tests {
    use super::*;
    use crate::resolver::decode_declaration;

    #[test]
    // req:cli-bootstrap-015
    fn every_embedded_artifact_is_unmodified_declaration_data() {
        let mut resolver = Resolver::from_cwd().unwrap();
        let root = register(&mut resolver).unwrap();
        assert!(!DECLARATIONS.is_empty());
        assert_eq!(resolver.declaration_count(), 0);
        for (path, source) in DECLARATIONS {
            let url = root.join(path).unwrap();
            let actual = resolver.load_declaration(&url).unwrap();
            let expected = decode_declaration(&url, source).unwrap();
            assert_eq!(actual.rules, expected.rules);
            assert_eq!(actual.imports, expected.imports);
            assert_eq!(actual.exports, expected.exports);
            assert_eq!(actual.funcs, expected.funcs);
            assert_eq!(actual.decorators, expected.decorators);
        }
    }

    #[test]
    // req:cli-bootstrap-015 req:cli-bootstrap-004
    fn embedded_language_graph_links_without_source_or_artifact_reads() {
        let mut resolver = Resolver::from_cwd().unwrap();
        let root = register(&mut resolver).unwrap();
        for entry in [
            "src/lang/expression/expression.lang.uff",
            "src/lang/pattern/pattern.lang.uff",
            "src/lang/uffda/uffda.lang.uff",
            "src/lang/uffda/runtime.compiler.uff",
        ] {
            let graph = resolver.load_graph(&root.join(entry).unwrap()).unwrap();
            assert!(graph.modules.contains_key(&graph.entry));
            assert!(!graph.modules[&graph.entry].exports.is_empty());
        }
    }
}
