//! Lossless text adapter: shared codec strings with runtime collector metadata.
use std::ops::{Deref, DerefMut};
pub use uffda_codec::text::{CodePoints, JsonStringError, JsonStringErrorKind, Wtf8Error};
use uffda_heap::Collect;
#[derive(
    Clone,
    Debug,
    Default,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    Collect,
    serde::Serialize,
    serde::Deserialize,
)]
#[collect(require_static)]
#[serde(transparent)]
pub struct RuntimeString(uffda_codec::text::RuntimeString);
impl Deref for RuntimeString {
    type Target = uffda_codec::text::RuntimeString;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DerefMut for RuntimeString {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
impl RuntimeString {
    pub fn codec_text(&self) -> &uffda_codec::text::RuntimeString {
        &self.0
    }

    pub fn from_utf16(units: Vec<u16>) -> Self {
        Self(uffda_codec::text::RuntimeString::from_utf16(units))
    }
    pub fn from_wtf8(bytes: &[u8]) -> Result<Self, Wtf8Error> {
        uffda_codec::text::RuntimeString::from_wtf8(bytes).map(Self)
    }
    pub fn from_json_string(text: &str) -> Result<Self, JsonStringError> {
        uffda_codec::text::RuntimeString::from_json_string(text).map(Self)
    }
}
impl From<uffda_codec::text::RuntimeString> for RuntimeString {
    fn from(value: uffda_codec::text::RuntimeString) -> Self {
        Self(value)
    }
}
impl From<&str> for RuntimeString {
    fn from(value: &str) -> Self {
        Self(value.into())
    }
}
impl From<&&str> for RuntimeString {
    fn from(value: &&str) -> Self {
        Self::from(*value)
    }
}
impl From<String> for RuntimeString {
    fn from(value: String) -> Self {
        Self(value.into())
    }
}
impl From<&String> for RuntimeString {
    fn from(value: &String) -> Self {
        Self::from(value.as_str())
    }
}
impl From<&RuntimeString> for RuntimeString {
    fn from(value: &RuntimeString) -> Self {
        value.clone()
    }
}
impl PartialEq<str> for RuntimeString {
    fn eq(&self, other: &str) -> bool {
        self.0 == other
    }
}
impl PartialEq<&str> for RuntimeString {
    fn eq(&self, other: &&str) -> bool {
        self == *other
    }
}
impl PartialEq<String> for RuntimeString {
    fn eq(&self, other: &String) -> bool {
        self == other.as_str()
    }
}
impl PartialEq<RuntimeString> for uffda_codec::text::RuntimeString {
    fn eq(&self, other: &RuntimeString) -> bool {
        self == &other.0
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    #[test]
    // req:runtime-strings-002
    fn code_point_cursor_uses_unit_offsets_without_scanning_prefixes() {
        let text = RuntimeString::from_utf16(vec![0xd800, 0xdc00, 0xdfff]);
        assert_eq!(text.code_point_at(0), Some(&[0xd800, 0xdc00][..]));
        assert_eq!(text.code_point_at(2), Some(&[0xdfff][..]));
        assert_eq!(text.code_point_at(3), None);
        assert_eq!(RuntimeString::default(), RuntimeString::from(""));
    }

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
            assert_eq!(serde_json::from_str::<RuntimeString>(&json).unwrap(), value);
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
            serde_json::from_str(include_str!("../tests/rust/string-fixtures.json")).unwrap();
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
    fn typed_json_fields_and_property_keys_preserve_surrogates() {
        #[derive(serde::Deserialize)]
        struct Input {
            text: RuntimeString,
            properties: std::collections::BTreeMap<RuntimeString, RuntimeString>,
        }
        let input: Input = serde_json::from_str(
            r#"{"text":"\ud800","properties":{"\udfff":"\ud83d\ude00","x":"\udc00"}}"#,
        )
        .unwrap();
        assert_eq!(input.text.as_utf16(), &[0xd800]);
        assert_eq!(
            input.properties[&RuntimeString::from_utf16(vec![0xdfff])],
            RuntimeString::from("😀")
        );
        assert_eq!(
            input.properties[&RuntimeString::from("x")].as_utf16(),
            &[0xdc00]
        );
        for invalid in ["null", "12", "[1]", "\"\\uZZZZ\""] {
            assert!(serde_json::from_str::<RuntimeString>(invalid).is_err());
        }
    }

    #[test]
    // req:runtime-strings-001
    fn explicit_wtf8_boundary_validates_bytes_without_replacement() {
        assert_eq!(
            RuntimeString::from_wtf8(&[0xed, 0xa0, 0x80])
                .unwrap()
                .as_utf16(),
            &[0xd800]
        );
        assert_eq!(
            RuntimeString::from_wtf8("a😀".as_bytes()).unwrap(),
            RuntimeString::from("a😀")
        );
        for bytes in [
            &[0xff][..],
            &[0xc0, 0x80],
            &[0xe0, 0x80, 0x80],
            &[0xf4, 0x90, 0x80, 0x80],
            &[0xe2, 0x82],
            &[0xed, 0xa0, 0],
            &[0xed, 0xa0],
        ] {
            assert_eq!(RuntimeString::from_wtf8(bytes).unwrap_err().offset, 0);
        }
    }

    #[test]
    // req:runtime-strings-001
    fn collection_preserves_lossless_units() {
        use uffda_heap::{Arena, Gc, Rootable};
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
        let astral = RuntimeString::from("😀");
        let bmp = RuntimeString::from("\u{e000}");
        assert!(astral < bmp);
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
