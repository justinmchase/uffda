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

pub fn location(
    source: impl Into<crate::text::RuntimeString>,
    start: usize,
    end: usize,
) -> SourceLocation {
    let source = source.into();
    let mut line = 0;
    let mut column = 0;
    let mut offset = 0;
    for unit in source.as_utf16() {
        if offset >= start {
            break;
        }
        offset += 1;
        if *unit == 0x0a {
            line += 1;
            column = 0;
        } else {
            column += 1;
        }
    }
    SourceLocation {
        offset,
        end_offset: Some(end.min(source.len())),
        line,
        column,
    }
}

pub fn collect(
    runtime: &Runtime,
    source: impl Into<crate::text::RuntimeString>,
    recovery_code: &str,
    failure_code: &str,
    phase: &'static str,
) -> Result<Vec<SourceDiagnostic>, crate::coercion::StringCoercionError> {
    let source = source.into();
    let encoding_error = std::cell::Cell::new(false);
    let diagnostics = runtime
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
            match error.to_utf8() {
                Ok(error) => Some(error),
                Err(_) => {
                    encoding_error.set(true);
                    None
                }
            }
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
                    location(&source, diagnostic.span.start, diagnostic.span.end)
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
        .collect();
    if encoding_error.get() {
        Err(crate::coercion::StringCoercionError::NonScalarText)
    } else {
        Ok(diagnostics)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:runtime-strings-002
    fn utf16_locations_accept_lossless_text_without_scalar_conversion() {
        let source = crate::text::RuntimeString::from_utf16(vec![0xd800, 0x0a, 0xdfff]);
        let point = location(source, 2, 3);
        assert_eq!((point.offset, point.line, point.column), (2, 1, 0));
        assert_eq!(point.end_offset, Some(3));
    }

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
