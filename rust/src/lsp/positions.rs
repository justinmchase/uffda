//! Conversion between absolute UTF-16 offsets and LSP `{line, character}`
//! positions. LSP counts `character` in UTF-16 code units, the same unit the
//! runtime's character origins use, so no re-encoding of spans is needed.

use serde_json::{Value, json};

/// A zero-based LSP position.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

impl Position {
    pub fn from_json(value: &Value) -> Option<Self> {
        Some(Self {
            line: value.get("line")?.as_u64()? as usize,
            character: value.get("character")?.as_u64()? as usize,
        })
    }

    pub fn to_json(self) -> Value {
        json!({ "line": self.line, "character": self.character })
    }
}

/// A source text as UTF-16 code units, for offset arithmetic.
pub fn utf16(source: &str) -> Vec<u16> {
    source.encode_utf16().collect()
}

/// Absolute UTF-16 offset of `position`. A line past the end clamps to the end
/// of the document and a character past the end of its line clamps to the
/// line's end.
#[allow(dead_code)]
pub fn position_to_offset(source: &str, position: Position) -> usize {
    position_to_offset_units(&utf16(source), position)
}

pub fn position_to_offset_units(units: &[u16], position: Position) -> usize {
    let mut offset = 0usize;
    let mut line = 0usize;
    while line < position.line {
        match units[offset..].iter().position(|unit| *unit == 0x0a) {
            Some(next) => offset += next + 1,
            None => return units.len(),
        }
        line += 1;
    }
    let line_length = units[offset..]
        .iter()
        .position(|unit| *unit == 0x0a)
        .unwrap_or(units.len() - offset);
    offset + position.character.min(line_length)
}

/// Inverse of [`position_to_offset`]; offsets past the end clamp to the end.
#[allow(dead_code)]
pub fn offset_to_position(source: &str, offset: usize) -> Position {
    offset_to_position_units(&utf16(source), offset)
}

pub fn offset_to_position_units(units: &[u16], offset: usize) -> Position {
    let clamped = offset.min(units.len());
    let mut line = 0usize;
    let mut line_start = 0usize;
    for (index, unit) in units[..clamped].iter().enumerate() {
        if *unit == 0x0a {
            line += 1;
            line_start = index + 1;
        }
    }
    Position {
        line,
        character: clamped - line_start,
    }
}

/// An LSP `Range` JSON object for the half-open offset span `[start, end)`.
pub fn range_json(units: &[u16], start: usize, end: usize) -> Value {
    json!({
        "start": offset_to_position_units(units, start).to_json(),
        "end": offset_to_position_units(units, end).to_json(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:cli-language-server-006
    fn offsets_and_positions_round_trip() {
        let source = "ab\ncde\n\nf";
        for offset in 0..=source.len() {
            let position = offset_to_position(source, offset);
            assert_eq!(position_to_offset(source, position), offset);
        }
        assert_eq!(
            offset_to_position(source, 4),
            Position {
                line: 1,
                character: 1
            }
        );
    }

    #[test]
    // req:cli-language-server-006
    fn characters_count_utf16_code_units() {
        // "😀" is two UTF-16 code units; "é" is one.
        let source = "😀é\nx";
        assert_eq!(
            offset_to_position(source, 2),
            Position {
                line: 0,
                character: 2
            }
        );
        assert_eq!(
            offset_to_position(source, 3),
            Position {
                line: 0,
                character: 3
            }
        );
        assert_eq!(
            position_to_offset(
                source,
                Position {
                    line: 1,
                    character: 1
                }
            ),
            5
        );
    }

    #[test]
    // req:cli-language-server-006
    fn out_of_range_positions_clamp() {
        let source = "ab\ncd";
        assert_eq!(
            position_to_offset(
                source,
                Position {
                    line: 9,
                    character: 0
                }
            ),
            5
        );
        assert_eq!(
            position_to_offset(
                source,
                Position {
                    line: 0,
                    character: 99
                }
            ),
            2
        );
        assert_eq!(
            offset_to_position(source, 99),
            Position {
                line: 1,
                character: 2
            }
        );
    }
}
