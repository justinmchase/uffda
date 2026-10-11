use crate::runtime::{DiagnosticKind, Runtime};
use crate::value::Value;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceLocation {
    pub offset: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_offset: Option<usize>,
    pub line: usize,
    pub column: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDiagnostic {
    #[serde(skip)]
    pub kind: DiagnosticKind,
    pub code: String,
    pub phase: &'static str,
    pub message: String,
    pub location: SourceLocation,
}

pub fn location(source: &str, start: usize, end: usize) -> SourceLocation {
    let mut line = 0;
    let mut column = 0;
    let mut offset = 0;
    for character in source.chars() {
        if offset + character.len_utf16() > start {
            break;
        }
        offset += character.len_utf16();
        if character == '\n' {
            line += 1;
            column = 0;
        } else {
            column += character.len_utf16();
        }
    }
    SourceLocation {
        offset,
        end_offset: Some(end.min(source.encode_utf16().count())),
        line,
        column,
    }
}

pub fn collect(
    runtime: &Runtime,
    source: &str,
    recovery_code: &str,
    failure_code: &str,
    phase: &'static str,
) -> Vec<SourceDiagnostic> {
    runtime
        .diagnostics_with(|declaration| {
            let Value::Object(metadata) = declaration.metadata.raw() else {
                return None;
            };
            let Value::Object(documentation) = metadata.borrow().get("Documentation")?.raw() else {
                return None;
            };
            let Value::String(error) = documentation.borrow().get("error")?.raw() else {
                return None;
            };
            Some((*error).clone())
        })
        .into_iter()
        .map(|diagnostic| SourceDiagnostic {
            kind: diagnostic.kind,
            code: if diagnostic.kind == DiagnosticKind::Recovery {
                recovery_code
            } else {
                failure_code
            }
            .into(),
            phase,
            message: diagnostic.message,
            location: {
                let mut location = if phase == "parse" {
                    location(source, diagnostic.span.start, diagnostic.span.end)
                } else {
                    SourceLocation {
                        offset: diagnostic.span.start,
                        end_offset: Some(diagnostic.span.end),
                        line: 0,
                        column: 0,
                    }
                };
                if !matches!(diagnostic.kind, DiagnosticKind::Recovery) {
                    location.end_offset = None;
                }
                location
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:cli-fmt-001 req:cli-command-model-001
    fn locations_use_utf16_offsets_and_preserve_lines() {
        let location = location("a\n😀z", 4, 5);
        assert_eq!(location.line, 1);
        assert_eq!(location.column, 2);
        assert_eq!(location.offset, 4);
        assert_eq!(location.end_offset, Some(5));
    }
}
