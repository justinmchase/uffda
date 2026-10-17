//! Parse-derived source highlighting (MCP `uffda_highlight` / LSP semantic tokens).

use crate::diagnostics::SourceDiagnostic;
use crate::pattern::PatternMatch;
use crate::runtime::Runtime;
use crate::value::Value as RuntimeValue;
use serde_json::{Value, json};

pub fn from_runtime(
    runtime: &Runtime,
    source: &str,
    diagnostics: &[SourceDiagnostic],
) -> Value {
    let spans = runtime.read(|execution| {
        let Some(root) = execution.result() else {
            return gap_fill_spans(source, Vec::new());
        };
        let mut tokens = Vec::new();
        collect_highlight_tokens(root, &mut tokens);
        tokens.sort_by_key(|token| (token.offset, token.length));
        build_gap_free_spans(source, tokens)
    });
    if diagnostics.is_empty() {
        json!({ "ok": true, "spans": spans })
    } else {
        let mapped: Vec<_> = diagnostics
            .iter()
            .map(|diagnostic| {
                json!({
                    "code": diagnostic.code,
                    "phase": diagnostic.phase,
                    "message": diagnostic.message,
                    "location": {
                        "offset": diagnostic.location.offset,
                        "line": diagnostic.location.line,
                        "column": diagnostic.location.column
                    }
                })
            })
            .collect();
        json!({
            "ok": false,
            "error": mapped.first().cloned().unwrap_or(json!({
                "code": "CLI_STREAM_PARSE_FAILURE",
                "phase": "parse",
                "message": "parse failed"
            })),
            "diagnostics": mapped,
            "spans": spans
        })
    }
}

struct HighlightToken {
    offset: usize,
    length: usize,
    role: String,
    text: String,
}

fn collect_highlight_tokens(
    node: uffda_heap::Gc<'_, PatternMatch<'_>>,
    out: &mut Vec<HighlightToken>,
) {
    if let Some(role) = highlight_role(node) {
        let length = node.end.saturating_sub(node.start);
        if length > 0 {
            out.push(HighlightToken {
                offset: node.start,
                length,
                role,
                text: String::new(),
            });
        }
    }
    for child in node.children.iter() {
        collect_highlight_tokens(*child, out);
    }
}

fn highlight_role(node: uffda_heap::Gc<'_, PatternMatch<'_>>) -> Option<String> {
    let declaration = node.rule.as_ref()?;
    let RuntimeValue::Object(metadata) = declaration.metadata.raw() else {
        return None;
    };
    let metadata = metadata.borrow();
    if let Some(value) = metadata.get("Highlight")
        && let RuntimeValue::Object(object) = value.raw()
        && let Some(role_value) = object.borrow().get("role")
        && let RuntimeValue::String(role) = role_value.raw()
        && let Ok(role) = role.to_utf8()
    {
        return Some(role);
    }
    if metadata.get("Keyword").is_some() {
        return Some("keyword".into());
    }
    None
}

fn build_gap_free_spans(source: &str, tokens: Vec<HighlightToken>) -> Vec<Value> {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut spans = Vec::new();
    let mut cursor = 0usize;
    for mut token in tokens {
        if token.offset > units.len() {
            continue;
        }
        if token.offset > cursor {
            push_trivia(&units, cursor, token.offset, &mut spans);
            cursor = token.offset;
        }
        if token.offset < cursor {
            continue;
        }
        let end = (token.offset + token.length).min(units.len());
        if end <= token.offset {
            continue;
        }
        token.text = String::from_utf16_lossy(&units[token.offset..end]);
        spans.push(json!({
            "offset": token.offset,
            "length": end - token.offset,
            "role": token.role,
            "text": token.text
        }));
        cursor = end;
    }
    if cursor < units.len() {
        push_trivia(&units, cursor, units.len(), &mut spans);
    }
    if spans.is_empty() && !source.is_empty() {
        return gap_fill_spans(source, Vec::new());
    }
    spans
}

fn push_trivia(units: &[u16], start: usize, end: usize, spans: &mut Vec<Value>) {
    let mut index = start;
    while index < end {
        let ch = units[index];
        if ch == 0x0a {
            spans.push(json!({
                "offset": index,
                "length": 1,
                "role": "newLine",
                "text": "\n"
            }));
            index += 1;
            continue;
        }
        let is_ws = ch == 0x09 || ch == 0x0d || ch == 0x20;
        let mut next = index + 1;
        while next < end {
            let c = units[next];
            if c == 0x0a {
                break;
            }
            let ws = c == 0x09 || c == 0x0d || c == 0x20;
            if ws != is_ws {
                break;
            }
            next += 1;
        }
        let text = String::from_utf16_lossy(&units[index..next]);
        spans.push(json!({
            "offset": index,
            "length": next - index,
            "role": if is_ws { "whitespace" } else { "identifier" },
            "text": text
        }));
        index = next;
    }
}

fn gap_fill_spans(source: &str, spans: Vec<Value>) -> Vec<Value> {
    if !spans.is_empty() {
        return spans;
    }
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut filled = Vec::new();
    push_trivia(&units, 0, units.len(), &mut filled);
    filled
}
