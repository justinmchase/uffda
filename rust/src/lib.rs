#![forbid(unsafe_code)]

pub mod coercion;
pub mod environment;
pub mod evaluate;
pub mod expression;
pub mod pattern;
mod program;
pub mod provenance;
pub mod resolver;
pub mod value;

#[cfg(test)]
mod gc_tests;
