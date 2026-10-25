//! Lossless UTF-16 runtime text and explicit scalar/WTF-8 boundaries.

use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RuntimeString(Vec<u16>, Option<String>);

impl Default for RuntimeString {
    fn default() -> Self {
        Self::from("")
    }
}

impl From<&&str> for RuntimeString {
    fn from(value: &&str) -> Self {
        Self::from(*value)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Wtf8Error {
    pub offset: usize,
}

impl fmt::Display for Wtf8Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid WTF-8 at byte {}", self.offset)
    }
}

impl std::error::Error for Wtf8Error {}

impl<'de> serde::Deserialize<'de> for RuntimeString {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl serde::de::Visitor<'_> for Visitor {
            type Value = RuntimeString;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a lossless string")
            }

            fn visit_bytes<E: serde::de::Error>(self, bytes: &[u8]) -> Result<Self::Value, E> {
                RuntimeString::from_wtf8(bytes).map_err(E::custom)
            }

            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Self::Value, E> {
                Ok(RuntimeString::from(value))
            }

            fn visit_byte_buf<E: serde::de::Error>(self, bytes: Vec<u8>) -> Result<Self::Value, E> {
                self.visit_bytes(&bytes)
            }
        }
        // serde_json's byte-string path preserves escaped surrogate code units.
        deserializer.deserialize_bytes(Visitor)
    }
}

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
        Self(value.encode_utf16().collect(), Some(value.to_owned()))
    }
}

impl From<String> for RuntimeString {
    fn from(value: String) -> Self {
        let units = value.encode_utf16().collect();
        Self(units, Some(value))
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
        self.0.iter().copied().eq(other.encode_utf16())
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

impl serde::Serialize for RuntimeString {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut token = String::new();
        self.write_json_string(&mut token)
            .map_err(serde::ser::Error::custom)?;
        serde_json::value::RawValue::from_string(token)
            .map_err(serde::ser::Error::custom)?
            .serialize(serializer)
    }
}

impl RuntimeString {
    pub fn push_str(&mut self, other: &Self) {
        self.0.extend_from_slice(&other.0);
        self.1 = String::from_utf16(&self.0).ok();
    }

    pub fn to_wtf8(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        for point in self.code_points() {
            if point.len() == 1 && (0xd800..=0xdfff).contains(&point[0]) {
                let unit = point[0];
                bytes.extend([
                    0xe0 | (unit >> 12) as u8,
                    0x80 | ((unit >> 6) & 0x3f) as u8,
                    0x80 | (unit & 0x3f) as u8,
                ]);
            } else {
                let scalar = if point.len() == 2 {
                    0x10000 + ((u32::from(point[0]) - 0xd800) << 10) + u32::from(point[1]) - 0xdc00
                } else {
                    u32::from(point[0])
                };
                let mut encoded = [0; 4];
                bytes.extend_from_slice(
                    char::from_u32(scalar)
                        .expect("code point")
                        .encode_utf8(&mut encoded)
                        .as_bytes(),
                );
            }
        }
        bytes
    }
    pub fn from_utf16(units: Vec<u16>) -> Self {
        let scalar = String::from_utf16(&units).ok();
        Self(units, scalar)
    }

    pub fn from_wtf8(bytes: &[u8]) -> Result<Self, Wtf8Error> {
        let mut units = Vec::new();
        let mut offset = 0;
        while offset < bytes.len() {
            let first = bytes[offset];
            if first == 0xed
                && bytes
                    .get(offset + 1)
                    .is_some_and(|byte| (0xa0..=0xbf).contains(byte))
                && bytes
                    .get(offset + 2)
                    .is_some_and(|byte| (0x80..=0xbf).contains(byte))
            {
                let unit = (u16::from(first & 0x0f) << 12)
                    | (u16::from(bytes[offset + 1] & 0x3f) << 6)
                    | u16::from(bytes[offset + 2] & 0x3f);
                units.push(unit);
                offset += 3;
                continue;
            }
            let width = match first {
                0..=0x7f => 1,
                0xc2..=0xdf => 2,
                0xe0..=0xef => 3,
                0xf0..=0xf4 => 4,
                _ => return Err(Wtf8Error { offset }),
            };
            let point = bytes
                .get(offset..offset + width)
                .ok_or(Wtf8Error { offset })?;
            let text = std::str::from_utf8(point).map_err(|_| Wtf8Error { offset })?;
            units.extend(text.encode_utf16());
            offset += width;
        }
        Ok(Self::from_utf16(units))
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
        if let Some(scalar) = &self.1 {
            return Ok(scalar.clone());
        }
        String::from_utf16(&self.0)
    }

    /// A checked borrowed scalar view; absent for isolated surrogates.
    pub fn as_scalar_str(&self) -> Option<&str> {
        self.1.as_deref()
    }

    pub fn code_points(&self) -> CodePoints<'_> {
        CodePoints(&self.0)
    }

    pub fn code_point_at(&self, offset: usize) -> Option<&[u16]> {
        let first = *self.0.get(offset)?;
        let paired = (0xd800..=0xdbff).contains(&first)
            && self
                .0
                .get(offset + 1)
                .is_some_and(|unit| (0xdc00..=0xdfff).contains(unit));
        Some(&self.0[offset..offset + if paired { 2 } else { 1 }])
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
                    return Ok(Self::from_utf16(units));
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

#[derive(Clone)]
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

    #[test]
    // req:data-codec-006 req:runtime-strings-001
    fn standalone_text_preserves_every_utf16_unit_without_runtime_dependencies() {
        for unit in 0..=u16::MAX {
            let text = RuntimeString::from_utf16(vec![unit]);
            let mut token = String::new();
            text.write_json_string(&mut token).unwrap();
            assert_eq!(RuntimeString::from_json_string(&token).unwrap(), text);
            assert_eq!(RuntimeString::from_wtf8(&text.to_wtf8()).unwrap(), text);
        }
    }
}
