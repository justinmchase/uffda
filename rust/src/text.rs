//! Lossless runtime text; integration with AST and value storage is separate.

use std::fmt;

use gc_arena::Collect;

#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Collect)]
#[collect(require_static)]
pub struct RuntimeString(Vec<u16>);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JsonStringErrorKind {
    ExpectedQuote,
    Unterminated,
    ControlCharacter,
    InvalidEscape,
    InvalidUnicodeEscape,
    TrailingInput,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JsonStringError {
    pub kind: JsonStringErrorKind,
    pub offset: usize,
}

impl fmt::Display for JsonStringError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "invalid JSON string at byte {}: {:?}",
            self.offset, self.kind
        )
    }
}

impl std::error::Error for JsonStringError {}

impl From<&str> for RuntimeString {
    fn from(value: &str) -> Self {
        Self(value.encode_utf16().collect())
    }
}

impl RuntimeString {
    pub fn from_utf16(units: Vec<u16>) -> Self {
        Self(units)
    }

    pub fn as_utf16(&self) -> &[u16] {
        &self.0
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn to_utf8(&self) -> Result<String, std::string::FromUtf16Error> {
        String::from_utf16(&self.0)
    }

    pub fn code_points(&self) -> CodePoints<'_> {
        CodePoints(&self.0)
    }

    pub fn write_json_string(&self, output: &mut impl fmt::Write) -> fmt::Result {
        output.write_char('"')?;
        for point in self.code_points() {
            let unit = point[0];
            match unit {
                0x22 => output.write_str("\\\"")?,
                0x5c => output.write_str("\\\\")?,
                0x08 => output.write_str("\\b")?,
                0x0c => output.write_str("\\f")?,
                0x0a => output.write_str("\\n")?,
                0x0d => output.write_str("\\r")?,
                0x09 => output.write_str("\\t")?,
                0x00..=0x1f => write!(output, "\\u{unit:04x}")?,
                0xd800..=0xdfff if point.len() == 1 => write!(output, "\\u{unit:04x}")?,
                _ => {
                    let scalar = if point.len() == 2 {
                        0x10000
                            + ((u32::from(unit) - 0xd800) << 10)
                            + (u32::from(point[1]) - 0xdc00)
                    } else {
                        u32::from(unit)
                    };
                    output
                        .write_char(char::from_u32(scalar).expect("validated code-point item"))?;
                }
            }
        }
        output.write_char('"')
    }

    /// Decode one complete JSON string token, without accepting surrounding data.
    pub fn from_json_string(source: &str) -> Result<Self, JsonStringError> {
        let error = |kind, offset| JsonStringError { kind, offset };
        if !source.starts_with('"') {
            return Err(error(JsonStringErrorKind::ExpectedQuote, 0));
        }
        let bytes = source.as_bytes();
        let mut offset = 1;
        let mut units = Vec::new();
        while offset < bytes.len() {
            match bytes[offset] {
                b'"' => {
                    if offset + 1 != bytes.len() {
                        return Err(error(JsonStringErrorKind::TrailingInput, offset + 1));
                    }
                    return Ok(Self(units));
                }
                b'\\' => {
                    let escape_start = offset;
                    offset += 1;
                    let Some(&escaped) = bytes.get(offset) else {
                        return Err(error(JsonStringErrorKind::InvalidEscape, escape_start));
                    };
                    let unit = match escaped {
                        b'"' => 0x22,
                        b'\\' => 0x5c,
                        b'/' => 0x2f,
                        b'b' => 0x08,
                        b'f' => 0x0c,
                        b'n' => 0x0a,
                        b'r' => 0x0d,
                        b't' => 0x09,
                        b'u' => {
                            let mut unit = 0u16;
                            for index in offset + 1..=offset + 4 {
                                let digit = bytes.get(index).copied().and_then(hex_digit);
                                let Some(digit) = digit else {
                                    return Err(error(
                                        JsonStringErrorKind::InvalidUnicodeEscape,
                                        index,
                                    ));
                                };
                                unit = (unit << 4) | u16::from(digit);
                            }
                            offset += 4;
                            unit
                        }
                        _ => return Err(error(JsonStringErrorKind::InvalidEscape, offset)),
                    };
                    units.push(unit);
                    offset += 1;
                }
                0x00..=0x1f => {
                    return Err(error(JsonStringErrorKind::ControlCharacter, offset));
                }
                _ => {
                    let character = source[offset..].chars().next().expect("remaining UTF-8");
                    let mut encoded = [0; 2];
                    units.extend_from_slice(character.encode_utf16(&mut encoded));
                    offset += character.len_utf8();
                }
            }
        }
        Err(error(JsonStringErrorKind::Unterminated, offset))
    }
}

fn hex_digit(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

pub struct CodePoints<'a>(&'a [u16]);

impl<'a> Iterator for CodePoints<'a> {
    type Item = &'a [u16];

    fn next(&mut self) -> Option<Self::Item> {
        let first = *self.0.first()?;
        let width = if (0xd800..=0xdbff).contains(&first)
            && self
                .0
                .get(1)
                .is_some_and(|next| (0xdc00..=0xdfff).contains(next))
        {
            2
        } else {
            1
        };
        let (point, rest) = self.0.split_at(width);
        self.0 = rest;
        Some(point)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.0.len().div_ceil(2), Some(self.0.len()))
    }
}

impl std::iter::FusedIterator for CodePoints<'_> {}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded(value: &RuntimeString) -> String {
        let mut result = String::new();
        value.write_json_string(&mut result).unwrap();
        result
    }

    #[test]
    // req:runtime-strings-001
    fn every_individual_code_unit_round_trips_without_repair() {
        for unit in 0..=u16::MAX {
            let value = RuntimeString::from_utf16(vec![unit]);
            let json = encoded(&value);
            assert_eq!(RuntimeString::from_json_string(&json).unwrap(), value);
            if (0xd800..=0xdfff).contains(&unit) {
                assert!(value.to_utf8().is_err());
                assert!(json.starts_with("\"\\u"));
            } else {
                assert!(value.to_utf8().is_ok());
            }
        }
    }

    #[test]
    // req:runtime-strings-001
    fn shared_host_fixtures_preserve_identical_units() {
        let fixtures: serde_json::Value =
            serde_json::from_str(include_str!("../../test/rust/string-fixtures.json")).unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let source = fixture["source"].as_str().unwrap();
            let expected: Vec<u16> = fixture["units"]
                .as_array()
                .unwrap()
                .iter()
                .map(|unit| u16::try_from(unit.as_u64().unwrap()).unwrap())
                .collect();
            let value = RuntimeString::from_json_string(source).unwrap();
            assert_eq!(value.as_utf16(), expected, "{source}");
            assert_eq!(
                RuntimeString::from_json_string(&encoded(&value)).unwrap(),
                value
            );
        }
    }

    #[test]
    // req:runtime-strings-001
    fn collection_preserves_lossless_units() {
        use gc_arena::{Arena, Gc, Rootable};
        let mut arena = Arena::<Rootable![Gc<'_, RuntimeString>]>::new(|mc| {
            Gc::new(mc, RuntimeString::from_utf16(vec![0xd800, 0, 0xdc00]))
        });
        arena.finish_cycle();
        arena.mutate(|_, text| {
            assert_eq!(text.as_utf16(), &[0xd800, 0, 0xdc00]);
            assert!(text.to_utf8().is_err());
            assert_eq!(encoded(text), "\"\\ud800\\u0000\\udc00\"");
        });
    }

    #[test]
    // req:runtime-strings-001
    // req:data-codec-001
    fn framed_string_records_keep_lossless_tokens_at_every_byte_split() {
        let source = "\"😀\"\n\"\\ud800\"\n\"\\udc00\"";
        for split in 0..=source.len() {
            let mut decoder = crate::codec::RecordDecoder::new();
            let mut values = Vec::new();
            let mut emit = |frame: crate::codec::Frame| {
                values.push(RuntimeString::from_json_string(&frame.source).unwrap());
            };
            decoder
                .feed(&source.as_bytes()[..split], &mut emit)
                .unwrap();
            decoder
                .feed(&source.as_bytes()[split..], &mut emit)
                .unwrap();
            decoder.finish(&mut emit).unwrap();
            assert_eq!(
                values,
                vec![
                    RuntimeString::from("😀"),
                    RuntimeString::from_utf16(vec![0xd800]),
                    RuntimeString::from_utf16(vec![0xdc00]),
                ],
                "byte split {split}"
            );
        }
    }

    #[test]
    // req:runtime-strings-001
    fn pairs_and_isolated_surrogates_iterate_without_losing_units() {
        let value =
            RuntimeString::from_utf16(vec![0xd800, 0xd83d, 0xde00, 0xdc00, 0x61, 0xd800, 0xdc00]);
        assert_eq!(value.len(), 7);
        assert_eq!(
            value.code_points().collect::<Vec<_>>(),
            vec![
                &[0xd800][..],
                &[0xd83d, 0xde00],
                &[0xdc00],
                &[0x61],
                &[0xd800, 0xdc00]
            ]
        );
        assert_eq!(
            RuntimeString::from_json_string(&encoded(&value)).unwrap(),
            value
        );
        let scalar = RuntimeString::from("a😀");
        assert_eq!(scalar.as_utf16(), &[0x61, 0xd83d, 0xde00]);
        assert_eq!(scalar.to_utf8().unwrap(), "a😀");
        assert!(!scalar.is_empty());
        assert!(RuntimeString::default().is_empty());
    }

    #[test]
    // req:runtime-strings-001
    fn comparison_uses_units_instead_of_unicode_scalar_order() {
        assert!(RuntimeString::from("😀") < RuntimeString::from("\u{e000}"));
        assert_eq!(
            RuntimeString::from_json_string(r#""\ud83d\uDE00""#).unwrap(),
            RuntimeString::from("😀")
        );
    }

    #[test]
    // req:runtime-strings-001
    fn all_json_escapes_and_raw_unicode_are_preserved() {
        let text = RuntimeString::from_json_string(r#""\"\\\/\b\f\n\r\t\u0000é😀""#).unwrap();
        assert_eq!(text.to_utf8().unwrap(), "\"\\/\x08\x0c\n\r\t\0é😀");
        assert_eq!(
            RuntimeString::from_json_string(&encoded(&text)).unwrap(),
            text
        );
        let json = encoded(&RuntimeString::from("normal"));
        assert_eq!(json, "\"normal\"");
    }

    #[test]
    // req:runtime-strings-001
    fn malformed_tokens_report_exact_byte_offsets() {
        for (source, kind, offset) in [
            ("", JsonStringErrorKind::ExpectedQuote, 0),
            ("false", JsonStringErrorKind::ExpectedQuote, 0),
            ("\"abc", JsonStringErrorKind::Unterminated, 4),
            ("\"a\n\"", JsonStringErrorKind::ControlCharacter, 2),
            ("\"\\", JsonStringErrorKind::InvalidEscape, 1),
            ("\"\\x\"", JsonStringErrorKind::InvalidEscape, 2),
            ("\"\\u0\"", JsonStringErrorKind::InvalidUnicodeEscape, 4),
            ("\"\\u000z\"", JsonStringErrorKind::InvalidUnicodeEscape, 6),
            ("\"é\"x", JsonStringErrorKind::TrailingInput, 4),
        ] {
            assert_eq!(
                RuntimeString::from_json_string(source).unwrap_err(),
                JsonStringError { kind, offset },
                "{source:?}"
            );
        }
    }

    #[test]
    // req:runtime-strings-001
    fn output_writer_failures_propagate() {
        struct Failing;
        impl fmt::Write for Failing {
            fn write_str(&mut self, _: &str) -> fmt::Result {
                Err(fmt::Error)
            }
        }
        assert!(
            RuntimeString::from("a")
                .write_json_string(&mut Failing)
                .is_err()
        );
    }
}
