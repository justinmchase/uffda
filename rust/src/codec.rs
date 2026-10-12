//! Incremental byte framing for Uffda data records.
//!
//! This layer identifies record boundaries and preserves their raw source. It
//! deliberately does not parse values, decode native tags, or evaluate code.

use std::error::Error;
use std::fmt;
use std::ops::ControlFlow;

pub const DEFAULT_MAX_RECORD_BYTES: usize = 16 * 1024 * 1024;
pub const DEFAULT_MAX_NESTING: usize = 1_024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CodecOptions {
    pub max_record_bytes: usize,
    pub max_nesting: usize,
}

impl Default for CodecOptions {
    fn default() -> Self {
        Self {
            max_record_bytes: DEFAULT_MAX_RECORD_BYTES,
            max_nesting: DEFAULT_MAX_NESTING,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ByteSpan {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frame {
    pub source: String,
    pub span: ByteSpan,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CodecErrorKind {
    InvalidOptions,
    InvalidUtf8,
    UnterminatedString,
    MismatchedDelimiter { actual: u8, expected: Option<u8> },
    RecordTooLarge { limit: usize },
    NestingTooDeep { limit: usize },
    TruncatedContainer { expected: u8 },
    OffsetOverflow,
    Finished,
    Cancelled,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CodecError {
    pub kind: CodecErrorKind,
    pub offset: usize,
}

impl fmt::Display for CodecError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.kind {
            CodecErrorKind::InvalidOptions => {
                write!(f, "codec limits must both be nonzero")
            }
            CodecErrorKind::InvalidUtf8 => {
                write!(f, "invalid UTF-8 at byte {}", self.offset)
            }
            CodecErrorKind::UnterminatedString => {
                write!(f, "unterminated string at byte {}", self.offset)
            }
            CodecErrorKind::MismatchedDelimiter { actual, expected } => {
                let actual = char::from(*actual);
                if let Some(expected) = expected {
                    write!(
                        f,
                        "mismatched delimiter {actual:?} at byte {}; expected {:?}",
                        self.offset,
                        char::from(*expected)
                    )
                } else {
                    write!(
                        f,
                        "unmatched closing delimiter {actual:?} at byte {}",
                        self.offset
                    )
                }
            }
            CodecErrorKind::RecordTooLarge { limit } => write!(
                f,
                "record exceeds the {limit}-byte limit at byte {}",
                self.offset
            ),
            CodecErrorKind::NestingTooDeep { limit } => write!(
                f,
                "nesting exceeds the {limit}-delimiter limit at byte {}",
                self.offset
            ),
            CodecErrorKind::TruncatedContainer { expected } => write!(
                f,
                "unfinished container at byte {}; expected {:?}",
                self.offset,
                char::from(*expected)
            ),
            CodecErrorKind::OffsetOverflow => {
                write!(f, "codec stream byte offset overflow")
            }
            CodecErrorKind::Finished => write!(f, "codec stream is already finished"),
            CodecErrorKind::Cancelled => write!(f, "codec stream was cancelled"),
            CodecErrorKind::Failed => write!(f, "codec stream has failed; reset it first"),
        }
    }
}

impl Error for CodecError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Lifecycle {
    Open,
    Finished,
    Cancelled,
    Failed,
}

#[derive(Clone, Copy, Debug)]
struct Delimiter {
    open: u8,
    offset: usize,
}

/// Incrementally frames newline-separated raw data records.
///
/// `push_some` invokes its callback synchronously for each complete frame and
/// stops when the callback requests it, allowing the caller to apply
/// backpressure. `feed` likewise invokes synchronously but consumes the entire
/// supplied chunk. Neither method retains previously delivered records.
pub struct RecordDecoder {
    options: CodecOptions,
    lifecycle: Lifecycle,
    next_offset: usize,
    record_start: Option<usize>,
    record: Vec<u8>,
    delimiters: Vec<Delimiter>,
    in_string: bool,
    string_start: usize,
    escaped: bool,
    in_comment: bool,
    utf8_pending: [u8; 4],
    utf8_len: usize,
    utf8_expected: usize,
    utf8_start: usize,
}

impl Default for RecordDecoder {
    fn default() -> Self {
        Self::new()
    }
}

impl RecordDecoder {
    pub fn new() -> Self {
        Self::with_options(CodecOptions::default()).expect("the default codec limits are nonzero")
    }

    pub fn with_options(options: CodecOptions) -> Result<Self, CodecError> {
        if options.max_record_bytes == 0 || options.max_nesting == 0 {
            return Err(CodecError {
                kind: CodecErrorKind::InvalidOptions,
                offset: 0,
            });
        }
        Ok(Self {
            options,
            lifecycle: Lifecycle::Open,
            next_offset: 0,
            record_start: None,
            record: Vec::new(),
            delimiters: Vec::new(),
            in_string: false,
            string_start: 0,
            escaped: false,
            in_comment: false,
            utf8_pending: [0; 4],
            utf8_len: 0,
            utf8_expected: 0,
            utf8_start: 0,
        })
    }

    /// Consume as much of a byte slice as possible and synchronously deliver
    /// each completed frame.
    ///
    /// Return value is the number of input bytes consumed. If `emit` returns
    /// `ControlFlow::Break` after a frame, the caller can resume by supplying
    /// the remaining suffix. This bounds output backlog without making the
    /// framer retain completed frames. Any framing error poisons the stream;
    /// call [`RecordDecoder::reset`] before reusing it.
    pub fn push_some(
        &mut self,
        input: &[u8],
        mut emit: impl FnMut(Frame) -> ControlFlow<()>,
    ) -> Result<usize, CodecError> {
        self.ensure_open()?;
        let stopped = std::cell::Cell::new(false);
        let mut deliver = |frame| {
            if matches!(emit(frame), ControlFlow::Break(())) {
                stopped.set(true);
            }
        };
        for (index, &byte) in input.iter().enumerate() {
            let offset = self.next_offset;
            self.next_offset = match offset.checked_add(1) {
                Some(next) => next,
                None => {
                    let error = self.error(CodecErrorKind::OffsetOverflow, offset);
                    return self.poison(error);
                }
            };
            if let Err(error) = self.accept_byte(byte, offset, &mut deliver) {
                return self.poison(error);
            }
            if stopped.get() {
                return Ok(index + 1);
            }
        }
        Ok(input.len())
    }

    /// Consume a full chunk and synchronously deliver all completed frames.
    ///
    /// This method does not pause when the callback is invoked. Use
    /// [`RecordDecoder::push_some`] when the consumer needs backpressure.
    pub fn feed(&mut self, input: &[u8], mut emit: impl FnMut(Frame)) -> Result<(), CodecError> {
        let consumed = self.push_some(input, |frame| {
            emit(frame);
            ControlFlow::Continue(())
        })?;
        debug_assert_eq!(consumed, input.len());
        Ok(())
    }

    /// Finish the stream and deliver its final complete record, if present.
    pub fn finish(&mut self, mut emit: impl FnMut(Frame)) -> Result<(), CodecError> {
        self.ensure_open()?;
        if self.utf8_len != 0 {
            let error = self.error(CodecErrorKind::InvalidUtf8, self.utf8_start);
            return self.poison(error);
        }
        if self.in_string {
            let error = self.error(CodecErrorKind::UnterminatedString, self.string_start);
            return self.poison(error);
        }
        if let Some(delimiter) = self.delimiters.last() {
            let error = self.error(
                CodecErrorKind::TruncatedContainer {
                    expected: closing_delimiter(delimiter.open),
                },
                delimiter.offset,
            );
            return self.poison(error);
        }
        if self.record_start.is_some() {
            self.emit_frame(self.next_offset, &mut emit);
        }
        self.lifecycle = Lifecycle::Finished;
        Ok(())
    }

    /// Cancel the current stream and discard its unfinished record.
    pub fn cancel(&mut self) -> Result<(), CodecError> {
        self.ensure_open()?;
        self.clear_record();
        self.utf8_len = 0;
        self.utf8_expected = 0;
        self.lifecycle = Lifecycle::Cancelled;
        Ok(())
    }

    /// Begin a new stream, clearing buffered source and restarting byte offsets.
    pub fn reset(&mut self) {
        self.clear_record();
        self.lifecycle = Lifecycle::Open;
        self.next_offset = 0;
        self.utf8_len = 0;
        self.utf8_expected = 0;
        self.utf8_start = 0;
    }

    fn ensure_open(&self) -> Result<(), CodecError> {
        let kind = match self.lifecycle {
            Lifecycle::Open => return Ok(()),
            Lifecycle::Finished => CodecErrorKind::Finished,
            Lifecycle::Cancelled => CodecErrorKind::Cancelled,
            Lifecycle::Failed => CodecErrorKind::Failed,
        };
        Err(self.error(kind, self.next_offset))
    }

    fn error(&self, kind: CodecErrorKind, offset: usize) -> CodecError {
        CodecError { kind, offset }
    }

    fn poison<T>(&mut self, error: CodecError) -> Result<T, CodecError> {
        self.clear_record();
        self.utf8_len = 0;
        self.utf8_expected = 0;
        self.lifecycle = Lifecycle::Failed;
        Err(error)
    }

    fn clear_record(&mut self) {
        self.record_start = None;
        self.record = Vec::new();
        self.delimiters = Vec::new();
        self.in_string = false;
        self.string_start = 0;
        self.escaped = false;
        self.in_comment = false;
    }

    fn accept_byte(
        &mut self,
        byte: u8,
        offset: usize,
        emit: &mut impl FnMut(Frame),
    ) -> Result<(), CodecError> {
        if self.utf8_len == 0 {
            if byte.is_ascii() {
                return self.process_byte(byte, offset, emit);
            }
            let expected = match byte {
                0xc2..=0xdf => 2,
                0xe0..=0xef => 3,
                0xf0..=0xf4 => 4,
                _ => return Err(self.error(CodecErrorKind::InvalidUtf8, offset)),
            };
            self.utf8_pending[0] = byte;
            self.utf8_len = 1;
            self.utf8_expected = expected;
            self.utf8_start = offset;
            return Ok(());
        }

        if !(0x80..=0xbf).contains(&byte) {
            return Err(self.error(CodecErrorKind::InvalidUtf8, offset));
        }
        self.utf8_pending[self.utf8_len] = byte;
        self.utf8_len += 1;
        if self.utf8_len != self.utf8_expected {
            return Ok(());
        }
        if std::str::from_utf8(&self.utf8_pending[..self.utf8_len]).is_err() {
            return Err(self.error(CodecErrorKind::InvalidUtf8, self.utf8_start));
        }

        let bytes = self.utf8_pending;
        let len = self.utf8_len;
        let start = self.utf8_start;
        self.utf8_len = 0;
        self.utf8_expected = 0;
        for (index, byte) in bytes[..len].iter().copied().enumerate() {
            self.process_byte(byte, start + index, emit)?;
        }
        Ok(())
    }

    fn process_byte(
        &mut self,
        byte: u8,
        offset: usize,
        emit: &mut impl FnMut(Frame),
    ) -> Result<(), CodecError> {
        if self.in_string {
            if byte == b'\n' {
                return Err(self.error(CodecErrorKind::UnterminatedString, self.string_start));
            }
            self.append(byte, offset)?;
            if self.escaped {
                self.escaped = false;
            } else if byte == b'\\' {
                self.escaped = true;
            } else if byte == b'"' {
                self.in_string = false;
            }
            return Ok(());
        }

        if self.in_comment {
            if byte == b'\n' {
                if !self.delimiters.is_empty() {
                    self.append(byte, offset)?;
                    self.in_comment = false;
                } else {
                    self.emit_frame(offset, emit);
                    self.in_comment = false;
                }
            } else if self.record_start.is_some() {
                self.append(byte, offset)?;
            }
            return Ok(());
        }

        if byte == b'\n' {
            if !self.delimiters.is_empty() {
                self.append(byte, offset)?;
            } else {
                self.emit_frame(offset, emit);
            }
            return Ok(());
        }

        if byte == b'#' {
            if self.record_start.is_some() {
                self.append(byte, offset)?;
            }
            self.in_comment = true;
            return Ok(());
        }

        match byte {
            b'"' => {
                if self.record_start.is_none() {
                    self.begin_record(byte, offset)?;
                } else {
                    self.append(byte, offset)?;
                }
                self.open_string(offset);
                Ok(())
            }
            b'[' | b'{' => {
                if self.record_start.is_none() {
                    self.begin_record(byte, offset)?;
                } else {
                    self.append(byte, offset)?;
                }
                self.push_delimiter(byte, offset)
            }
            b']' | b'}' => {
                let Some(delimiter) = self.delimiters.last() else {
                    return Err(self.error(
                        CodecErrorKind::MismatchedDelimiter {
                            actual: byte,
                            expected: None,
                        },
                        offset,
                    ));
                };
                let expected = closing_delimiter(delimiter.open);
                if byte != expected {
                    return Err(self.error(
                        CodecErrorKind::MismatchedDelimiter {
                            actual: byte,
                            expected: Some(expected),
                        },
                        offset,
                    ));
                }
                self.append(byte, offset)?;
                self.delimiters.pop();
                Ok(())
            }
            _ if self.record_start.is_none() && is_horizontal_space(byte) => Ok(()),
            _ if self.record_start.is_none() => self.begin_record(byte, offset),
            _ => self.append(byte, offset),
        }
    }

    fn begin_record(&mut self, byte: u8, offset: usize) -> Result<(), CodecError> {
        self.record_start = Some(offset);
        self.append(byte, offset)
    }

    fn open_string(&mut self, offset: usize) {
        self.in_string = true;
        self.string_start = offset;
        self.escaped = false;
    }

    fn push_delimiter(&mut self, open: u8, offset: usize) -> Result<(), CodecError> {
        if self.delimiters.len() >= self.options.max_nesting {
            return Err(self.error(
                CodecErrorKind::NestingTooDeep {
                    limit: self.options.max_nesting,
                },
                offset,
            ));
        }
        self.delimiters.push(Delimiter { open, offset });
        Ok(())
    }

    fn append(&mut self, byte: u8, offset: usize) -> Result<(), CodecError> {
        if self.record.len() >= self.options.max_record_bytes {
            return Err(self.error(
                CodecErrorKind::RecordTooLarge {
                    limit: self.options.max_record_bytes,
                },
                offset,
            ));
        }
        self.record.push(byte);
        Ok(())
    }

    fn emit_frame(&mut self, end: usize, emit: &mut impl FnMut(Frame)) {
        if let Some(start) = self.record_start.take() {
            let source = String::from_utf8(std::mem::take(&mut self.record))
                .expect("only validated UTF-8 is retained in a record");
            emit(Frame {
                source,
                span: ByteSpan { start, end },
            });
        }
        self.delimiters.clear();
        self.in_string = false;
        self.escaped = false;
        self.in_comment = false;
    }
}

fn closing_delimiter(open: u8) -> u8 {
    match open {
        b'[' => b']',
        b'{' => b'}',
        _ => unreachable!("only square and curly delimiters are pushed"),
    }
}

fn is_horizontal_space(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t' | b'\r' | 0x0b | 0x0c)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collect(decoder: &mut RecordDecoder, input: &[u8], frames: &mut Vec<Frame>) {
        decoder.feed(input, |frame| frames.push(frame)).unwrap();
    }

    fn finish(decoder: &mut RecordDecoder, frames: &mut Vec<Frame>) {
        decoder.finish(|frame| frames.push(frame)).unwrap();
    }

    #[test]
    // req:data-codec-001
    fn frames_are_invariant_at_every_byte_split_in_utf8_strings_escapes_and_comments() {
        let source = r##"  "é\"#still-string" # first
[1
 # nested comment
{"k": "😀"}
]
true"##;
        let bytes = source.as_bytes();
        let mut baseline_decoder = RecordDecoder::new();
        let mut baseline = Vec::new();
        collect(&mut baseline_decoder, bytes, &mut baseline);
        finish(&mut baseline_decoder, &mut baseline);
        assert_eq!(baseline.len(), 3);
        assert_eq!(baseline[0].source, r##""é\"#still-string" # first"##);
        assert_eq!(
            baseline[1].source,
            "[1\n # nested comment\n{\"k\": \"😀\"}\n]"
        );
        assert_eq!(baseline[2].source, "true");

        for split in 0..=bytes.len() {
            let mut decoder = RecordDecoder::new();
            let mut frames = Vec::new();
            collect(&mut decoder, &bytes[..split], &mut frames);
            collect(&mut decoder, &bytes[split..], &mut frames);
            finish(&mut decoder, &mut frames);
            assert_eq!(frames, baseline, "split at byte {split}");
        }

        for (frame, expected_start) in baseline.iter().zip([2, 30, bytes.len() - 4]) {
            assert_eq!(frame.span.start, expected_start);
            assert_eq!(
                frame.span.end - frame.span.start,
                frame.source.len(),
                "frame source and UTF-8 byte span must correspond"
            );
        }
    }

    #[test]
    // req:data-codec-001
    fn comments_blank_lines_final_eof_and_incremental_delivery_preserve_offsets() {
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        collect(
            &mut decoder,
            b"\n  # only a comment\n  value # trailing\nnext",
            &mut frames,
        );
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].source, "value # trailing");
        assert_eq!(frames[0].span, ByteSpan { start: 22, end: 38 });
        finish(&mut decoder, &mut frames);
        assert_eq!(frames[1].source, "next");
        assert_eq!(frames[1].span, ByteSpan { start: 39, end: 43 });
    }

    #[test]
    // req:data-codec-001
    fn arbitrary_source_atoms_are_framed_without_claiming_value_validation() {
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        collect(&mut decoder, b"not-a-value\n", &mut frames);
        assert_eq!(frames[0].source, "not-a-value");
        assert_eq!(frames.len(), 1);
    }

    #[test]
    // req:data-codec-001
    fn framing_preserves_multiple_values_and_unsettled_tag_syntax_for_the_parser() {
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        collect(
            &mut decoder,
            b"1 2\n@bytes \"YQ==\"\n@error {name: \"x\"}\n",
            &mut frames,
        );
        assert_eq!(frames.len(), 3);
        assert_eq!(frames[0].source, "1 2");
        assert_eq!(frames[1].source, "@bytes \"YQ==\"");
        assert_eq!(frames[2].source, "@error {name: \"x\"}");
    }

    #[test]
    // req:data-codec-001
    fn invalid_utf8_is_detected_across_chunks_and_at_eof() {
        let mut decoder = RecordDecoder::new();
        decoder
            .feed(&[b'"', 0xf0, 0x9f], |_| {})
            .expect("an incomplete multibyte sequence waits for more input");
        let error = decoder.finish(|_| {}).unwrap_err();
        assert_eq!(error.kind, CodecErrorKind::InvalidUtf8);
        assert_eq!(error.offset, 1);

        decoder.reset();
        let error = decoder.feed(&[0xe0, 0x80, 0x80], |_| {}).unwrap_err();
        assert_eq!(error.kind, CodecErrorKind::InvalidUtf8);
        assert_eq!(error.offset, 0);
        assert_eq!(
            decoder.feed(b"later\n", |_| {}).unwrap_err().kind,
            CodecErrorKind::Failed
        );
    }

    #[test]
    // req:data-codec-001
    fn malformed_records_fail_with_offsets_and_do_not_resynchronize() {
        let cases: &[(&[u8], CodecErrorKind, usize, bool)] = &[
            (b"\"open\n", CodecErrorKind::UnterminatedString, 0, false),
            (
                b"[}\n",
                CodecErrorKind::MismatchedDelimiter {
                    actual: b'}',
                    expected: Some(b']'),
                },
                1,
                false,
            ),
            (
                b"]\n",
                CodecErrorKind::MismatchedDelimiter {
                    actual: b']',
                    expected: None,
                },
                0,
                false,
            ),
            (
                b"[1",
                CodecErrorKind::TruncatedContainer { expected: b']' },
                0,
                true,
            ),
        ];
        for (source, kind, offset, on_finish) in cases {
            let mut decoder = RecordDecoder::new();
            let mut frames = Vec::new();
            let error = if *on_finish {
                collect(&mut decoder, source, &mut frames);
                decoder.finish(|frame| frames.push(frame)).unwrap_err()
            } else {
                decoder
                    .feed(source, |frame| frames.push(frame))
                    .unwrap_err()
            };
            assert_eq!(&error.kind, kind, "source: {source:?}");
            assert_eq!(error.offset, *offset, "source: {source:?}");
            assert!(frames.is_empty());
            assert_eq!(
                decoder.feed(b"valid\n", |_| {}).unwrap_err().kind,
                CodecErrorKind::Failed
            );
        }
    }

    #[test]
    // req:data-codec-001
    fn configured_record_and_nesting_limits_are_enforced_and_nonzero() {
        let options = CodecOptions {
            max_record_bytes: 4,
            max_nesting: 2,
        };
        assert!(
            RecordDecoder::with_options(CodecOptions {
                max_record_bytes: 0,
                max_nesting: 1,
            })
            .is_err()
        );
        assert!(
            RecordDecoder::with_options(CodecOptions {
                max_record_bytes: 1,
                max_nesting: 0,
            })
            .is_err()
        );

        let mut decoder = RecordDecoder::with_options(options).unwrap();
        let mut frames = Vec::new();
        collect(&mut decoder, b"true\n", &mut frames);
        assert_eq!(frames[0].source, "true");
        decoder.reset();
        let error = decoder.feed(b"false\n", |_| {}).unwrap_err();
        assert_eq!(
            error.kind,
            CodecErrorKind::RecordTooLarge {
                limit: options.max_record_bytes
            }
        );
        assert_eq!(error.offset, 4);

        let mut decoder = RecordDecoder::with_options(CodecOptions {
            max_record_bytes: 10,
            max_nesting: options.max_nesting,
        })
        .unwrap();
        let error = decoder.feed(b"[[[0]]]\n", |_| {}).unwrap_err();
        assert_eq!(
            error.kind,
            CodecErrorKind::NestingTooDeep {
                limit: options.max_nesting
            }
        );
        assert_eq!(error.offset, 2);
    }

    #[test]
    // req:data-codec-001
    fn cancellation_reset_and_finish_enforce_stream_lifecycle() {
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        collect(&mut decoder, b"[unfinished", &mut frames);
        assert!(decoder.record.capacity() > 0);
        assert!(decoder.delimiters.capacity() > 0);
        decoder.cancel().unwrap();
        assert_eq!(decoder.record.capacity(), 0);
        assert_eq!(decoder.delimiters.capacity(), 0);
        assert_eq!(
            decoder.feed(b"ignored\n", |_| {}).unwrap_err().kind,
            CodecErrorKind::Cancelled
        );

        decoder.reset();
        collect(&mut decoder, b"[unfinished", &mut frames);
        assert!(decoder.record.capacity() > 0);
        assert!(decoder.delimiters.capacity() > 0);
        decoder.reset();
        assert_eq!(decoder.record.capacity(), 0);
        assert_eq!(decoder.delimiters.capacity(), 0);
        collect(&mut decoder, b"ok\n", &mut frames);
        assert_eq!(frames.last().unwrap().span, ByteSpan { start: 0, end: 2 });
        finish(&mut decoder, &mut frames);
        assert_eq!(
            decoder.finish(|_| {}).unwrap_err().kind,
            CodecErrorKind::Finished
        );
        assert_eq!(
            decoder.feed(b"later", |_| {}).unwrap_err().kind,
            CodecErrorKind::Finished
        );

        decoder.reset();
        assert_eq!(decoder.next_offset, 0);
        assert!(decoder.record.is_empty());
        assert!(decoder.delimiters.is_empty());
    }

    #[test]
    // req:data-codec-001
    fn byte_offset_overflow_fails_instead_of_repeating_spans() {
        let mut decoder = RecordDecoder::new();
        decoder.next_offset = usize::MAX;
        let error = decoder.feed(b"x", |_| {}).unwrap_err();
        assert_eq!(error.kind, CodecErrorKind::OffsetOverflow);
        assert_eq!(error.offset, usize::MAX);
        assert_eq!(
            decoder.feed(b"later", |_| {}).unwrap_err().kind,
            CodecErrorKind::Failed
        );
    }

    #[test]
    // req:data-codec-001
    fn completed_frames_are_delivered_without_retaining_prior_source() {
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        collect(&mut decoder, b"one\ntwo", &mut frames);
        assert_eq!(frames.len(), 1);
        assert_eq!(decoder.record, b"two");
        assert_eq!(decoder.record_start, Some(4));
        finish(&mut decoder, &mut frames);
        assert_eq!(
            frames.iter().map(|f| f.source.as_str()).collect::<Vec<_>>(),
            ["one", "two"]
        );
    }

    #[test]
    // req:data-codec-001
    fn push_some_stops_at_a_frame_and_reports_the_consumed_prefix() {
        let input = b"one\ntwo\nthree\n";
        let mut decoder = RecordDecoder::new();
        let mut frames = Vec::new();
        let first = decoder
            .push_some(input, |frame| {
                frames.push(frame);
                ControlFlow::Break(())
            })
            .unwrap();
        assert_eq!(first, 4);
        assert_eq!(frames[0].source, "one");

        let second = decoder
            .push_some(&input[first..], |frame| {
                frames.push(frame);
                ControlFlow::Break(())
            })
            .unwrap();
        assert_eq!(second, 4);
        assert_eq!(frames[1].source, "two");

        collect(&mut decoder, &input[first + second..], &mut frames);
        finish(&mut decoder, &mut frames);
        assert_eq!(
            frames.iter().map(|f| f.source.as_str()).collect::<Vec<_>>(),
            ["one", "two", "three"]
        );
    }
}
pub mod data;
