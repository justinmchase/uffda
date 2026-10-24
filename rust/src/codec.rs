//! Standalone codec framing re-exports and runtime value adapters.
pub use uffda_codec::{
    ByteSpan, CodecError, CodecErrorKind, CodecOptions, DEFAULT_MAX_NESTING,
    DEFAULT_MAX_RECORD_BYTES, Frame, RecordDecoder,
};
pub mod data;
pub mod declaration;
