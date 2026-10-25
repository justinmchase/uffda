#![forbid(unsafe_code)]

pub mod builtins;
pub mod cli;
#[path = "codec_runtime/mod.rs"]
pub mod codec;
pub mod coercion;
pub mod compile;
pub mod diagnostics;
pub mod environment;
pub mod evaluate;
pub mod expression;
pub mod format;
pub mod globals;
pub mod highlight;
pub mod languages;
pub mod lsp;
pub mod mcp;
pub mod module;
pub mod output;
pub mod pattern;
mod program;
pub mod project;
pub mod provenance;
pub mod resolver;
pub mod runtime;
mod selective_memo;
pub mod source_paths;
pub mod text;
pub mod value;

#[cfg(test)]
mod gc_tests;
pub mod json;
#[cfg(test)]
mod lang_tests;
#[cfg(test)]
mod test_sync;
#[cfg(test)]
mod traceability_tests;

#[cfg(test)]
mod string_acceptance {
    #[test]
    // req:runtime-strings-002
    fn public_lossless_decoder_and_value_execution_survive_collection() {
        let ast = crate::json::from_str(r#"{"kind":"value","value":"\ud800"}"#).unwrap();
        let mut evaluation = crate::evaluate::Evaluation::new(ast);
        let value = evaluation.finish().unwrap();
        evaluation.collect();
        assert_eq!(
            evaluation
                .read(&value, |value| crate::coercion::string_text(value)
                    .unwrap()
                    .as_utf16()
                    .to_vec())
                .unwrap(),
            vec![0xd800]
        );
    }
}
