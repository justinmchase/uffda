//! Strict standalone Uffda data values and streaming records.
#![forbid(unsafe_code)]

pub mod data;
mod framing;
pub mod text;

pub use framing::{
    ByteSpan, CodecError, CodecErrorKind, CodecOptions, DEFAULT_MAX_NESTING,
    DEFAULT_MAX_RECORD_BYTES, Frame, RecordDecoder,
};

/// Decode exactly one value, accepting surrounding whitespace and hash comments.
pub fn from_str(source: &str) -> Result<data::DataDocument, data::DataError> {
    let mut decoder = data::DataDecoder::new(data::DataLimits::default())?;
    let mut remaining = source.as_bytes();
    let mut document = None;
    while !remaining.is_empty() {
        let (consumed, record) = decoder.push_some(remaining)?;
        remaining = &remaining[consumed..];
        if let Some(record) = record
            && document.replace(record.document).is_some()
        {
            return Err(data::DataError(
                "expected exactly one codec value".into(),
                Some(record.span.start),
            ));
        }
    }
    if let Some(record) = decoder.finish()?
        && document.replace(record.document).is_some()
    {
        return Err(data::DataError(
            "expected exactly one codec value".into(),
            Some(record.span.start),
        ));
    }
    document.ok_or_else(|| {
        data::DataError(
            "expected one codec value; input is empty".into(),
            Some(source.len()),
        )
    })
}

/// Canonical compact value text, with no record-terminating newline.
pub fn to_string(document: &data::DataDocument) -> Result<String, data::DataError> {
    document.encode(false, data::DataLimits::default())
}
