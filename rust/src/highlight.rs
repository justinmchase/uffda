//! Parse-derived source highlighting (MCP `uffda_highlight` / LSP semantic tokens).
//!
//! Classification mirrors Deno `src/cli/highlight.ts`: leaf `[Highlight]` tokens,
//! inherited roles from enclosing Highlight containers, exact-span `[Keyword]`
//! overrides, then outermost name-refinement recoloring.

use crate::diagnostics::SourceDiagnostic;
use crate::pattern::{MatchKind, PatternMatch};
use crate::runtime::Runtime;
use crate::value::Value as RuntimeValue;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use uffda_heap::Gc;

/// LSP semantic-token type names (same order as the Deno legend).
pub const SEMANTIC_TOKEN_TYPES: &[&str] = &[
    "keyword", "variable", "string", "comment", "operator", "type", "function", "property",
];

const NAME_REFINEMENTS: &[&str] = &["type", "function", "variable", "property"];

/// A classified span of source text (UTF-16 offsets).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HighlightSpan {
    pub role: String,
    pub offset: usize,
    pub length: usize,
    pub text: String,
}

impl HighlightSpan {
    pub fn to_json(&self) -> Value {
        json!({
            "role": self.role,
            "offset": self.offset,
            "length": self.length,
            "text": self.text
        })
    }
}

/// Whether `role` classifies a name (identifier or a refinement of it).
pub fn is_name_role(role: &str) -> bool {
    role == "identifier" || NAME_REFINEMENTS.contains(&role)
}

fn is_name_refinement(role: &str) -> bool {
    NAME_REFINEMENTS.contains(&role)
}

pub fn is_trivia_role(role: &str) -> bool {
    matches!(role, "whitespace" | "newline" | "newLine" | "comment")
}

fn token_type_index(role: &str) -> Option<u32> {
    let name = match role {
        "keyword" => "keyword",
        "identifier" | "variable" => "variable",
        "string" => "string",
        "comment" => "comment",
        "punctuation" => "operator",
        "type" => "type",
        "function" => "function",
        "property" => "property",
        _ => return None,
    };
    SEMANTIC_TOKEN_TYPES
        .iter()
        .position(|entry| *entry == name)
        .map(|index| index as u32)
}

/// Encode gap-free highlight spans as LSP `SemanticTokens.data` (UTF-16
/// offsets, delta-encoded line/character). Trivia roles emit no tokens.
pub fn encode_semantic_tokens(source: &str, spans: &[Value]) -> Vec<u32> {
    let typed: Vec<HighlightSpan> = spans
        .iter()
        .filter_map(|span| {
            Some(HighlightSpan {
                role: span.get("role")?.as_str()?.to_string(),
                offset: span.get("offset")?.as_u64()? as usize,
                length: span.get("length")?.as_u64()? as usize,
                text: span
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            })
        })
        .collect();
    encode_semantic_tokens_typed(source, &typed)
}

pub fn encode_semantic_tokens_typed(source: &str, spans: &[HighlightSpan]) -> Vec<u32> {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut line_starts = vec![0usize];
    for (index, unit) in units.iter().enumerate() {
        if *unit == 0x0a {
            line_starts.push(index + 1);
        }
    }
    let line_at = |offset: usize| -> usize {
        match line_starts.binary_search(&offset) {
            Ok(index) => index,
            Err(index) => index.saturating_sub(1),
        }
    };
    let mut data = Vec::new();
    let mut previous_line = 0usize;
    let mut previous_start = 0usize;
    for span in spans {
        if is_trivia_role(&span.role) && span.role != "comment" {
            continue;
        }
        // Whitespace/newlines never emit; comments do.
        if matches!(span.role.as_str(), "whitespace" | "newline" | "newLine") {
            continue;
        }
        let Some(token_type) = token_type_index(&span.role) else {
            continue;
        };
        let offset = span.offset;
        let length = span.length;
        if length == 0 || offset >= units.len() {
            continue;
        }
        let end = (offset + length).min(units.len());
        let mut segment_start = offset;
        while segment_start < end {
            let line = line_at(segment_start);
            let line_end = if line + 1 < line_starts.len() {
                line_starts[line + 1].saturating_sub(1).min(end)
            } else {
                end
            };
            let segment_end = if line_end < end && units.get(line_end) == Some(&0x0a) {
                line_end
            } else {
                line_end.min(end)
            };
            let segment_len = segment_end.saturating_sub(segment_start);
            if segment_len > 0 {
                let start_char = segment_start - line_starts[line];
                let delta_line = line.saturating_sub(previous_line) as u32;
                let delta_start = if delta_line == 0 {
                    start_char.saturating_sub(previous_start) as u32
                } else {
                    start_char as u32
                };
                data.extend_from_slice(&[
                    delta_line,
                    delta_start,
                    segment_len as u32,
                    token_type,
                    0,
                ]);
                previous_line = line;
                previous_start = start_char;
            }
            if segment_end < end && units.get(segment_end) == Some(&0x0a) {
                segment_start = segment_end + 1;
            } else if segment_len == 0 {
                break;
            } else {
                segment_start = segment_end;
            }
        }
    }
    data
}

pub fn semantic_tokens_legend() -> Value {
    json!({
        "tokenTypes": SEMANTIC_TOKEN_TYPES,
        "tokenModifiers": []
    })
}

pub fn from_runtime(runtime: &Runtime, source: &str, diagnostics: &[SourceDiagnostic]) -> Value {
    let spans = spans_from_runtime(runtime, source);
    let json_spans: Vec<Value> = spans.iter().map(HighlightSpan::to_json).collect();
    if diagnostics.is_empty() {
        json!({ "ok": true, "spans": json_spans })
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
            "spans": json_spans
        })
    }
}

/// Classify gap-free highlight spans from a finished parse runtime.
pub fn spans_from_runtime(runtime: &Runtime, source: &str) -> Vec<HighlightSpan> {
    runtime.read(|execution| {
        let Some(root) = execution.result() else {
            return gap_fill_spans(source);
        };
        highlight_spans_from_match(root, source)
    })
}

/// Identifier covering `offset` (half-open), from name-role highlight spans.
pub fn identifier_at_offset(
    spans: &[HighlightSpan],
    offset: usize,
) -> Option<(String, usize, usize)> {
    spans.iter().find_map(|span| {
        if !is_name_role(&span.role) {
            return None;
        }
        let end = span.offset + span.length;
        if offset >= span.offset && offset < end {
            Some((span.text.clone(), span.offset, end))
        } else {
            None
        }
    })
}

fn highlight_role_of(node: Gc<'_, PatternMatch<'_>>) -> Option<String> {
    let declaration = node.rule.as_ref()?;
    let RuntimeValue::Object(metadata) = declaration.metadata.raw() else {
        return None;
    };
    let metadata = metadata.borrow();
    let Some(value) = metadata.get("Highlight") else {
        return None;
    };
    let RuntimeValue::Object(object) = value.raw() else {
        return None;
    };
    let Some(role_value) = object.borrow().get("role") else {
        return None;
    };
    let RuntimeValue::String(role) = role_value.raw() else {
        return None;
    };
    let role = role.to_utf8().ok()?;
    Some(role)
}

fn has_keyword(node: Gc<'_, PatternMatch<'_>>) -> bool {
    let Some(declaration) = node.rule.as_ref() else {
        return false;
    };
    let RuntimeValue::Object(metadata) = declaration.metadata.raw() else {
        return false;
    };
    metadata.borrow().get("Keyword").is_some()
}

fn is_success(node: Gc<'_, PatternMatch<'_>>) -> bool {
    matches!(node.kind, MatchKind::Ok)
}

fn is_annotatable(node: Gc<'_, PatternMatch<'_>>) -> bool {
    matches!(node.kind, MatchKind::Ok | MatchKind::Fail | MatchKind::Skip)
}

#[derive(Clone)]
struct AnnotatedSpan {
    start: usize,
    end: usize,
    role: String,
}

#[derive(Clone)]
struct CollectedToken {
    offset: usize,
    length: usize,
    text: String,
    role: String,
    ancestor: Option<AnnotatedSpan>,
    inherited_role: Option<String>,
}

#[derive(Clone, Copy)]
struct CollectedKeyword {
    offset: usize,
    length: usize,
}

fn collect_spans<'gc>(
    root: Gc<'gc, PatternMatch<'gc>>,
    source: &str,
) -> (Vec<CollectedToken>, Vec<CollectedKeyword>) {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut leaves = Vec::new();
    let mut containers = Vec::new();
    let mut keywords = Vec::new();
    // Address identity for DAG dedup (pointer equality of Gc cells).
    let mut emitted_by: HashMap<usize, bool> = HashMap::new();

    fn node_key(node: Gc<'_, PatternMatch<'_>>) -> usize {
        Gc::as_ptr(node) as usize
    }

    fn walk(
        node: Gc<'_, PatternMatch<'_>>,
        ancestor: Option<AnnotatedSpan>,
        units: &[u16],
        leaves: &mut Vec<CollectedToken>,
        containers: &mut Vec<AnnotatedSpan>,
        keywords: &mut Vec<CollectedKeyword>,
        emitted_by: &mut HashMap<usize, bool>,
    ) -> bool {
        let key = node_key(node);
        if let Some(known) = emitted_by.get(&key) {
            return *known;
        }
        let emitted = walk_once(
            node, ancestor, units, leaves, containers, keywords, emitted_by,
        );
        emitted_by.insert(key, emitted);
        emitted
    }

    fn walk_once(
        node: Gc<'_, PatternMatch<'_>>,
        ancestor: Option<AnnotatedSpan>,
        units: &[u16],
        leaves: &mut Vec<CollectedToken>,
        containers: &mut Vec<AnnotatedSpan>,
        keywords: &mut Vec<CollectedKeyword>,
        emitted_by: &mut HashMap<usize, bool>,
    ) -> bool {
        if !is_annotatable(node) {
            return false;
        }

        if has_keyword(node) {
            let start = node.origin.start;
            let end = node.origin.end;
            let length = end.saturating_sub(start);
            if length > 0 {
                keywords.push(CollectedKeyword {
                    offset: start,
                    length,
                });
            }
        }

        let own_role = highlight_role_of(node);
        // Character offsets (Deno originalSpan), not token-stream indices.
        let start = node.origin.start;
        let end = node.origin.end;
        let annotated = own_role
            .as_ref()
            .is_some_and(|role| !is_name_refinement(role))
            && is_success(node)
            && end > start;
        let self_span = if annotated {
            Some(AnnotatedSpan {
                start,
                end,
                role: own_role.clone().unwrap(),
            })
        } else {
            None
        };

        let mut emitted = false;
        for child in node.children.iter() {
            if walk(
                *child,
                ancestor.clone().or_else(|| self_span.clone()),
                units,
                leaves,
                containers,
                keywords,
                emitted_by,
            ) {
                emitted = true;
            }
        }

        let Some(self_span) = self_span else {
            return emitted;
        };
        if emitted {
            containers.push(self_span);
            return true;
        }
        let text = if start < units.len() && end <= units.len() && end > start {
            String::from_utf16_lossy(&units[start..end])
        } else {
            String::new()
        };
        leaves.push(CollectedToken {
            offset: start,
            length: end - start,
            text,
            role: self_span.role.clone(),
            ancestor,
            inherited_role: None,
        });
        true
    }

    walk(
        root,
        None,
        &units,
        &mut leaves,
        &mut containers,
        &mut keywords,
        &mut emitted_by,
    );

    let demoted = leaves_containing_another(&leaves);
    for leaf in &demoted {
        containers.push(AnnotatedSpan {
            start: leaf.offset,
            end: leaf.offset + leaf.length,
            role: leaf.role.clone(),
        });
    }
    let demoted_keys: HashSet<(usize, usize, String)> = demoted
        .iter()
        .map(|leaf| (leaf.offset, leaf.length, leaf.role.clone()))
        .collect();
    let mut tokens: Vec<_> = leaves
        .into_iter()
        .filter(|leaf| !demoted_keys.contains(&(leaf.offset, leaf.length, leaf.role.clone())))
        .collect();
    assign_inherited_roles(&mut tokens, &containers);
    (tokens, keywords)
}

fn leaves_containing_another(leaves: &[CollectedToken]) -> Vec<CollectedToken> {
    let mut sorted = leaves.to_vec();
    sorted.sort_by(|a, b| {
        a.offset
            .cmp(&b.offset)
            .then_with(|| b.length.cmp(&a.length))
    });
    let mut found = Vec::new();
    for i in 0..sorted.len() {
        let leaf = &sorted[i];
        let end = leaf.offset + leaf.length;
        for other in sorted.iter().skip(i + 1) {
            if other.offset >= end {
                break;
            }
            if other.offset + other.length <= end && other.length < leaf.length {
                found.push(leaf.clone());
                break;
            }
        }
    }
    found
}

fn assign_inherited_roles(tokens: &mut [CollectedToken], containers: &[AnnotatedSpan]) {
    let mut by_start = containers.to_vec();
    by_start.sort_by_key(|c| c.start);
    let mut ordered: Vec<usize> = (0..tokens.len()).collect();
    ordered.sort_by_key(|&i| tokens[i].offset);
    let mut next = 0usize;
    let mut active: Vec<AnnotatedSpan> = Vec::new();
    for &index in &ordered {
        let token = &tokens[index];
        let end = token.offset + token.length;
        while next < by_start.len() && by_start[next].start <= token.offset {
            active.push(by_start[next].clone());
            next += 1;
        }
        active.retain(|container| container.end > token.offset);

        let mut best = token.ancestor.clone();
        let mut best_length = best
            .as_ref()
            .map(|span| span.end - span.start)
            .unwrap_or(token.length);
        for container in &active {
            let length = container.end - container.start;
            if container.end >= end && length > best_length {
                best = Some(container.clone());
                best_length = length;
            }
        }
        tokens[index].inherited_role = best.map(|span| span.role);
    }
}

fn role_for(token: &CollectedToken, keywords: &[CollectedKeyword]) -> String {
    if let Some(role) = &token.inherited_role {
        return role.clone();
    }
    if keywords
        .iter()
        .any(|k| k.offset == token.offset && k.length == token.length)
    {
        return "keyword".into();
    }
    token.role.clone()
}

fn collect_name_refinements<'gc>(root: Gc<'gc, PatternMatch<'gc>>) -> Vec<AnnotatedSpan> {
    let mut refinements = Vec::new();
    let mut visited = HashSet::new();
    let mut ancestors: Vec<Gc<'gc, PatternMatch<'gc>>> = Vec::new();
    walk_name_refinements(root, &mut ancestors, &mut refinements, &mut visited);
    refinements
}

fn walk_name_refinements<'gc>(
    node: Gc<'gc, PatternMatch<'gc>>,
    ancestors: &mut Vec<Gc<'gc, PatternMatch<'gc>>>,
    refinements: &mut Vec<AnnotatedSpan>,
    visited: &mut HashSet<usize>,
) {
    if !is_annotatable(node) {
        return;
    }
    let key = Gc::as_ptr(node) as usize;
    if !visited.insert(key) {
        return;
    }
    if is_success(node)
        && let Some(role) = highlight_role_of(node)
        && is_name_refinement(&role)
    {
        let nested = ancestors.iter().any(|ancestor| {
            is_success(*ancestor)
                && highlight_role_of(*ancestor).is_some_and(|outer| is_name_refinement(&outer))
        });
        if !nested && node.origin.end > node.origin.start {
            refinements.push(AnnotatedSpan {
                start: node.origin.start,
                end: node.origin.end,
                role,
            });
        }
    }
    ancestors.push(node);
    for child in node.children.iter() {
        if is_success(node) && !is_success(*child) {
            continue;
        }
        walk_name_refinements(*child, ancestors, refinements, visited);
    }
    ancestors.pop();
}

fn refine_names(spans: &mut [HighlightSpan], refinements: &[AnnotatedSpan]) {
    let name_indices: Vec<usize> = spans
        .iter()
        .enumerate()
        .filter(|(_, span)| span.role == "identifier")
        .map(|(i, _)| i)
        .collect();
    let mut refined = HashSet::new();
    for refinement in refinements {
        for &index in &name_indices {
            if refined.contains(&index) {
                continue;
            }
            let span = &spans[index];
            let end = span.offset + span.length;
            if span.offset >= refinement.start && end <= refinement.end {
                spans[index].role = refinement.role.clone();
                refined.insert(index);
            }
        }
    }
}

fn highlight_spans_from_match<'gc>(
    root: Gc<'gc, PatternMatch<'gc>>,
    source: &str,
) -> Vec<HighlightSpan> {
    let (tokens, keywords) = collect_spans(root, source);
    let mut by_offset: HashMap<usize, CollectedToken> = HashMap::new();
    for token in tokens {
        by_offset.entry(token.offset).or_insert(token);
    }
    let mut ordered: Vec<_> = by_offset.into_values().collect();
    ordered.sort_by_key(|token| token.offset);

    let units: Vec<u16> = source.encode_utf16().collect();
    let mut spans = Vec::new();
    let mut cursor = 0usize;
    for token in ordered {
        if token.offset < cursor {
            continue;
        }
        if token.offset > cursor {
            let text = String::from_utf16_lossy(&units[cursor..token.offset.min(units.len())]);
            spans.push(HighlightSpan {
                role: "punctuation".into(),
                offset: cursor,
                length: token.offset - cursor,
                text,
            });
        }
        spans.push(HighlightSpan {
            role: role_for(&token, &keywords),
            offset: token.offset,
            length: token.length,
            text: token.text,
        });
        cursor = token.offset + token.length;
    }
    if cursor < units.len() {
        let text = String::from_utf16_lossy(&units[cursor..]);
        spans.push(HighlightSpan {
            role: "punctuation".into(),
            offset: cursor,
            length: units.len() - cursor,
            text,
        });
    }
    refine_names(&mut spans, &collect_name_refinements(root));
    if spans.is_empty() && !source.is_empty() {
        return gap_fill_spans(source);
    }
    spans
}

fn gap_fill_spans(source: &str) -> Vec<HighlightSpan> {
    let units: Vec<u16> = source.encode_utf16().collect();
    let mut spans = Vec::new();
    let mut index = 0usize;
    while index < units.len() {
        let ch = units[index];
        if ch == 0x0a {
            spans.push(HighlightSpan {
                role: "newLine".into(),
                offset: index,
                length: 1,
                text: "\n".into(),
            });
            index += 1;
            continue;
        }
        let is_ws = ch == 0x09 || ch == 0x0d || ch == 0x20;
        let mut next = index + 1;
        while next < units.len() {
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
        spans.push(HighlightSpan {
            role: if is_ws {
                "whitespace".into()
            } else {
                "identifier".into()
            },
            offset: index,
            length: next - index,
            text,
        });
        index = next;
    }
    spans
}

/// Test/helper: count Keyword-bearing non-empty spans in a finished runtime.

#[cfg(test)]
mod encode_tests {

    use super::*;
    use crate::languages::{Language, Languages};

    #[test]
    fn keyword_rule_is_one_span() {
        let mut languages = Languages::new().unwrap();
        let result = languages
            .highlight("rule Main = any;\nexport Main;\n", Language::Uffda)
            .unwrap();
        let spans = result["spans"].as_array().unwrap();
        let interesting: Vec<_> = spans
            .iter()
            .filter(|s| {
                let role = s["role"].as_str().unwrap_or("");
                !matches!(role, "whitespace" | "newLine" | "newline")
            })
            .map(|s| {
                (
                    s["text"].as_str().unwrap_or("").to_string(),
                    s["role"].as_str().unwrap_or("").to_string(),
                )
            })
            .collect();
        assert!(
            interesting.iter().any(|(t, _)| t == "rule"),
            "expected a single 'rule' span, got {interesting:?}"
        );
        assert!(
            !interesting.iter().any(|(t, _)| t == "r" || t == "ule"),
            "keyword must not split into per-character spans, got {interesting:?}"
        );
    }

    #[test]
    // req:cli-language-server-005
    fn reserved_words_classify_as_keyword() {
        let mut languages = Languages::new().unwrap();
        let result = languages
            .highlight(
                "rule Main = Other;\nrule Other = any;\nexport Main;\n",
                Language::Uffda,
            )
            .unwrap();
        let spans = result["spans"].as_array().unwrap();
        let roles: Vec<_> = spans
            .iter()
            .filter_map(|s| {
                let role = s["role"].as_str()?;
                let text = s["text"].as_str()?;
                if matches!(role, "whitespace" | "newLine" | "newline") {
                    None
                } else {
                    Some((text.to_string(), role.to_string()))
                }
            })
            .collect();
        assert!(
            roles.iter().any(|(t, r)| t == "rule" && r == "keyword"),
            "expected rule as keyword, got {roles:?}"
        );
        assert!(
            roles.iter().any(|(t, r)| t == "any" && r == "keyword"),
            "expected any as keyword, got {roles:?}"
        );
        assert!(
            roles.iter().any(|(t, r)| t == "Main" && is_name_role(r)),
            "expected Main as a name, got {roles:?}"
        );
    }
}
