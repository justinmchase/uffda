#![forbid(unsafe_code)]

pub mod builtins;
pub mod cli;
pub mod codec;
pub mod coercion;
pub mod compile;
pub mod diagnostics;
pub mod environment;
pub mod evaluate;
pub mod expression;
pub mod format;
pub mod globals;
pub mod languages;
pub mod module;
pub mod output;
pub mod pattern;
mod program;
pub mod project;
pub mod provenance;
pub mod resolver;
pub mod runtime;
pub mod source_paths;
pub mod text;
pub mod value;

#[cfg(test)]
mod gc_tests;
