//! Downstream consumer: no dependency on this repository's `src/lang`, `bin`,
//! or product `embed-languages` feature. Artifacts live under `./artifacts`.

#[cfg(test)]
mod tests {
    use uffda_runtime::module::CompiledModuleGraph;
    use uffda_runtime::pattern::MatchKind;
    use uffda_runtime::resolver::{ModuleResolutionError, Resolver};
    use uffda_runtime::runtime::{InputMode, Runtime};
    use url::Url;

    include!(concat!(env!("OUT_DIR"), "/languages.rs"));

    fn register(resolver: &mut Resolver) -> Result<Url, ModuleResolutionError> {
        let root = Url::parse("file:///consumer/builtin/").expect("static identity");
        assert!(
            !DECLARATIONS.is_empty(),
            "consumer build must embed at least one declaration"
        );
        for (path, source) in DECLARATIONS {
            let url = root.join(path).map_err(|error| ModuleResolutionError {
                module_url: (*path).into(),
                message: "invalid embedded language identity".into(),
                cause: Some(error.to_string()),
                import_chain: Vec::new(),
            })?;
            resolver.insert_declaration_codec_source(url, source);
        }
        Ok(root)
    }

    #[test]
    // req:data-codec-005
    fn consumer_embeds_own_codec_and_runs_without_product_bin() {
        let mut resolver = Resolver::from_cwd().unwrap();
        let root = register(&mut resolver).unwrap();
        let entry = root.join("grammar/main.uff").unwrap();
        let graph = resolver.load_graph(&entry).unwrap();
        let graph = std::rc::Rc::new(CompiledModuleGraph::compile(graph).unwrap());
        let mut runtime = Runtime::with_mode(
            graph,
            &entry,
            None,
            serde_json::json!("ok"),
            InputMode::Scalar,
        )
        .unwrap();
        runtime.run().unwrap();
        runtime.read(|execution| {
            let result = execution.result().unwrap();
            assert_eq!(result.kind, MatchKind::Ok);
        });
    }
}
