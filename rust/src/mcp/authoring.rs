//! Stateless `uffda_authoring_context` — task-oriented, evidence-backed
//! authoring help (parity with Deno `src/cli/mcp.authoring_context.ts`;
//! `req:mcp-server-013`).

use serde_json::{json, Value};
use std::collections::{BTreeSet, HashSet};
use std::path::PathBuf;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EvidenceKind {
    Syntax,
    Semantics,
    Restriction,
    Capability,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CapabilityStatus {
    Supported,
    Unsupported,
    Uncertain,
}

struct SourceSpec {
    path: &'static str,
    anchor: &'static str,
    excerpt: Option<&'static str>,
}

struct Evidence {
    id: &'static str,
    keywords: &'static [&'static str],
    languages: &'static [&'static str],
    kind: EvidenceKind,
    status: Option<CapabilityStatus>,
    capability: Option<&'static str>,
    summary: &'static str,
    examples: &'static [&'static str],
    sources: &'static [SourceSpec],
}

const EVIDENCE: &[Evidence] = &[
    Evidence {
        id: "expr-invocation-syntax",
        keywords: &["expression", "invocation", "call", "syntax", "global"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Syntax,
        status: None,
        capability: None,
        summary: "ExpressionLang has no infix operators; calls are `(callee arg …)`. Arrays are `[elem …]`.",
        examples: &["(add 1 2)", "(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))"],
        sources: &[SourceSpec {
            path: "src/lang/expression/expression.md",
            anchor: "Sequence =",
            excerpt: Some("Sequence = ( callee args… ) → invocation"),
        }],
    },
    Evidence {
        id: "expr-lambda-syntax",
        keywords: &["lambda", "callback", "reduce", "map", "filter", "expression"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Syntax,
        status: Some(CapabilityStatus::Supported),
        capability: Some("inline lambdas in expressions"),
        summary: "Lambdas are `<ParameterList> -> Primary`, used as call arguments.",
        examples: &["<acc:any x:any> -> (add acc x)"],
        sources: &[SourceSpec {
            path: "src/lang/expression/lambda.uff",
            anchor: "rule Lambda =",
            excerpt: None,
        }],
    },
    Evidence {
        id: "global-compare",
        keywords: &["compare", "sort", "sorting", "order", "number", "lt", "gt"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Supported),
        capability: Some("numeric/string three-way compare (`compare`, `lt`, `gt`, …)"),
        summary: "`(compare left right)` returns -1/0/1 for numbers or strings.",
        examples: &["(compare 1 2)", "(lt a b)"],
        sources: &[SourceSpec {
            path: "src/runtime/globals/compare.ts",
            anchor: "Returns `-1` if `left` sorts before `right`",
            excerpt: None,
        }],
    },
    Evidence {
        id: "global-reduce-map",
        keywords: &["reduce", "map", "filter", "scan", "fold", "array", "sort"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Supported),
        capability: Some("collection fold/map/filter (`reduce`, `map`, `filter`, `scan`)"),
        summary: "`reduce`/`map`/`filter`/`scan` fold and project collections; callbacks may be lambdas.",
        examples: &["(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))"],
        sources: &[SourceSpec {
            path: ".agents/specifications/standard-library.spec.md",
            anchor: "| `reduce(value, initial, fn)`",
            excerpt: None,
        }],
    },
    Evidence {
        id: "global-array-ops",
        keywords: &["array", "at", "slice", "pack", "length", "swap", "sort"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Supported),
        capability: Some("array indexing and construction (`at`, `slice`, `pack`, `length`)"),
        summary: "`at`/`slice`/`length`/`pack` read/build arrays; there is no swap global.",
        examples: &["(at items 0)", "(pack a b c)"],
        sources: &[SourceSpec {
            path: ".agents/specifications/standard-library.spec.md",
            anchor: "| `at(value, index)`",
            excerpt: None,
        }],
    },
    Evidence {
        id: "no-sort-global",
        keywords: &["sort", "sorting", "order", "ordered", "array", "list"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Unsupported),
        capability: Some("built-in `sort` global"),
        summary: "The default global inventory has no `sort` helper.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/standard-library.spec.md",
            anchor: "The default runtime environment provides the following 36 callable globals.",
            excerpt: None,
        }],
    },
    Evidence {
        id: "no-inplace-mutation",
        keywords: &["mutation", "mutate", "swap", "inplace", "in-place", "array", "sort"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Unsupported),
        capability: Some("in-place array mutation or element swap"),
        summary: "Wrapped values are immutable; authors rebuild arrays rather than swapping in place.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/runtime/value-provenance.spec.md",
            anchor: "Wrapped values MUST be immutable.",
            excerpt: None,
        }],
    },
    Evidence {
        id: "sort-algorithm-uncertain",
        keywords: &["sort", "sorting", "bubble", "quicksort", "algorithm"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Uncertain),
        capability: Some("complete comparison-sort algorithm authored in Uffda"),
        summary: "Primitives for a functional comparison sort exist, but no reference sort is in-tree.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/standard-library.spec.md",
            anchor: "| `compare(left, right)`",
            excerpt: Some("compare exists; sort does not appear in the inventory."),
        }],
    },
    Evidence {
        id: "left-recursion",
        keywords: &["recursion", "recursive", "left-recursion", "dlr", "rule"],
        languages: &["pattern", "uffda"],
        kind: EvidenceKind::Capability,
        status: Some(CapabilityStatus::Supported),
        capability: Some("direct/indirect left recursion in rules"),
        summary: "Rules support direct and indirect left recursion with a progress requirement.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/runtime/left-recursion.spec.md",
            anchor: "Direct left recursion (DLR) is a left-recursive cycle in which the invocation",
            excerpt: None,
        }],
    },
    Evidence {
        id: "global-when-eager",
        keywords: &["when", "conditional", "branch", "eager"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Restriction,
        status: Some(CapabilityStatus::Supported),
        capability: Some("conditional values via eager `when`"),
        summary: "`when` selects a value but evaluates all three arguments eagerly.",
        examples: &["(when (lt i n) (at a i) fallback)"],
        sources: &[SourceSpec {
            path: "src/runtime/globals/when.ts",
            anchor: "Arguments are evaluated eagerly (expression invocation semantics).",
            excerpt: None,
        }],
    },
    Evidence {
        id: "pattern-no-statements",
        keywords: &[
            "if", "else", "loop", "for", "while", "let", "return", "control", "statement",
        ],
        languages: &["pattern", "uffda"],
        kind: EvidenceKind::Restriction,
        status: Some(CapabilityStatus::Unsupported),
        capability: Some("statement-like control flow in patterns (`if`/`let`/loops)"),
        summary: "Pattern syntax must not introduce statement-like control flow such as `if`, `else`, `let`, `return`, or loop syntax.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/languages/pattern-syntax.spec.md",
            anchor: "Pattern syntax MUST NOT introduce statement-like control flow such as `if`,",
            excerpt: None,
        }],
    },
    Evidence {
        id: "std-globals-inventory",
        keywords: &["global", "builtin", "stdlib", "expression", "map", "reduce", "filter"],
        languages: &["expression", "uffda"],
        kind: EvidenceKind::Semantics,
        status: Some(CapabilityStatus::Supported),
        capability: Some("closed set of 36 default expression globals"),
        summary: "Default ExpressionLang environments expose a fixed inventory of 36 callable globals.",
        examples: &[],
        sources: &[SourceSpec {
            path: ".agents/specifications/standard-library.spec.md",
            anchor: "The default runtime environment provides the following 36 callable globals.",
            excerpt: None,
        }],
    },
];

const STOP: &[&str] = &[
    "a", "an", "the", "to", "of", "in", "on", "for", "and", "or", "with", "from", "using", "that",
    "this", "want", "needs", "need", "implement", "write", "create", "make", "how", "can", "i", "my",
];

fn expand(token: &str) -> &'static [&'static str] {
    match token {
        "sort" | "sorting" => &[
            "sort", "sorting", "order", "compare", "array", "reduce", "mutation", "swap", "when",
        ],
        "bubble" => &["sort", "compare", "array", "swap", "mutation"],
        "swap" | "mutate" | "mutation" => &["swap", "mutation", "immutable", "array"],
        "recurse" | "recursion" | "recursive" => &["recursion", "left-recursion", "func"],
        "array" | "list" => &["array", "pack", "slice", "at", "length", "reduce", "map"],
        "compare" | "comparison" => &["compare", "lt", "gt", "number"],
        "numbers" | "number" => &["number", "compare", "add", "sub"],
        _ => &[],
    }
}

fn task_tokens(task: &str) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();
    for raw in task.to_lowercase().split(|c: char| !c.is_ascii_alphanumeric() && c != '_' && c != '+' && c != '-')
    {
        if raw.len() <= 1 || STOP.contains(&raw) {
            continue;
        }
        tokens.insert(raw.to_string());
        for extra in expand(raw) {
            tokens.insert((*extra).to_string());
        }
    }
    tokens
}

fn score(entry: &Evidence, tokens: &BTreeSet<String>) -> f64 {
    let hits = entry
        .keywords
        .iter()
        .filter(|k| tokens.contains(**k))
        .count();
    if hits == 0 {
        return 0.0;
    }
    let boost = match entry.kind {
        EvidenceKind::Capability => 2.0,
        EvidenceKind::Restriction => 1.5,
        _ => 1.0,
    };
    hits as f64 * boost + hits as f64 / entry.keywords.len() as f64
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("crate in rust/")
        .to_path_buf()
}

fn resolve_source(spec: &SourceSpec) -> Value {
    let excerpt = spec
        .excerpt
        .unwrap_or(spec.anchor)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let full = repo_root().join(spec.path);
    match std::fs::read_to_string(&full) {
        Ok(text) => match text.find(spec.anchor) {
            Some(index) => {
                let start_line = text[..index].bytes().filter(|b| *b == b'\n').count() + 1;
                let end_line = start_line + spec.anchor.bytes().filter(|b| *b == b'\n').count();
                json!({
                    "path": spec.path,
                    "startLine": start_line,
                    "endLine": end_line,
                    "excerpt": excerpt,
                })
            }
            None => json!({ "path": spec.path, "excerpt": excerpt, "unresolved": true }),
        },
        Err(_) => json!({ "path": spec.path, "excerpt": excerpt, "unresolved": true }),
    }
}

fn matches_language(entry: &Evidence, language: Option<&str>) -> bool {
    let Some(language) = language else {
        return true;
    };
    let allowed: &[&str] = match language {
        "pattern" => &["pattern", "uffda"],
        "expression" => &["expression", "uffda"],
        _ => &["uffda", "pattern", "expression"],
    };
    entry.languages.iter().any(|lang| allowed.contains(lang))
}

fn relevant_globals(tokens: &BTreeSet<String>) -> Value {
    let mut out = Vec::new();
    for (name, global) in crate::globals::GLOBALS {
        let meta = global.metadata();
        let hay = format!(
            "{} {} {}",
            name,
            meta.description,
            meta.parameters
                .iter()
                .map(|p| p.name)
                .collect::<Vec<_>>()
                .join(" ")
        )
        .to_lowercase();
        if !tokens.iter().any(|t| t == name || hay.contains(t)) {
            continue;
        }
        out.push(json!({
            "name": name,
            "description": meta.description,
            "parameters": meta.parameters.iter().map(|p| {
                let mut obj = json!({ "name": p.name });
                if p.optional {
                    obj["optional"] = json!(true);
                }
                if p.rest {
                    obj["rest"] = json!(true);
                }
                obj
            }).collect::<Vec<_>>(),
        }));
    }
    out.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .cmp(b["name"].as_str().unwrap_or(""))
    });
    Value::Array(out)
}

const TOPIC_CATALOG: &[(&str, &[&str], &str, &str, &str, &[&str])] = &[
    (
        "repetition",
        &["repetition", "bounded", "exact", "quantifier-bounds"],
        "Exact and bounded repetition",
        "`P*n..m` sets both min and max. `P*n` alone is a minimum of `n` with no upper bound. Exact count needs equal bounds: `P*10..10`.",
        "Digit*10..10  // exactly ten digits\nDigit*10     // at least ten digits",
        &["`Digit*10` is not an exact count — use `Digit*10..10`."],
    ),
    (
        "pipeline",
        &["pipeline", "|>", "into", "stage"],
        "Pipeline stages and into",
        "`A |> B` feeds B a derived stream with exactly one scalar item. Use `[P]` (`into`) when that value is iterable.",
        "chars:any*\n|> [ plus:(\"+\"?) digits:Digit*7..15 end -> (join (flat (pack plus digits)) \"\") ]",
        &["Pipelines must not implicitly iterate arrays/strings; omit `[…]` and the whole array/string is one item."],
    ),
    (
        "projection",
        &["projection", "precedence", "group"],
        "Projection versus pipeline precedence",
        "Nest a projection inside `(…)`, `[…]`, or `{…}` when it must apply before a surrounding pipeline, or use a named helper rule.",
        "(digits:Digit+ -> (join digits \"\")) |> length:any",
        &["`A B -> E` projects the sequence `A B`, not only `B`.", "Do not confuse `|>` (pipeline) with `->` (projection)."],
    ),
    (
        "skip-quantifier",
        &["skip", "quantifier", "collect", "count"],
        "Skip and quantifiers",
        "`skip P` matches without contributing its value to ordered collections. Skipped repetitions still count toward min/max.",
        "sep:skip \",\"  items:(value:any (skip \",\" value:any)*)",
        &["Counting and collecting are separate."],
    ),
    (
        "character-class",
        &["character-class", "character", "class", "digit", "ascii", "unicode"],
        "Character classes versus ASCII digits",
        "Shared `Digit` is `\\cNd`. ASCII-only digits are `\"0\"..\"9\"`.",
        "import \"../common/characters/digit.uff\" Digit;  // \\cNd\nrule AsciiDigit = \"0\"..\"9\";",
        &[
            "`Digit` / `\\cNd` accepts more than ASCII `0`-`9`.",
            "This topic is about character matching syntax, not statement control flow.",
        ],
    ),
    (
        "capture-scope",
        &["capture", "binding", "variable", "scope", "duplicate"],
        "Capture scope and repeated bindings",
        "`name:Pattern` binds `name`. A second binding of the same name errors.",
        "x:Digit x:Digit  // error: duplicate binding of x",
        &["Failed exploratory paths must not leak bindings."],
    ),
    (
        "exports",
        &["export", "exports", "module", "entry"],
        "Module exports",
        "`export Name;` declares which rules/funcs are visible.",
        "export Normalize;\nrule Normalize = …;",
        &["`uffda_experiment` invokes an exported rule for full modules."],
    ),
];

/// Topic cards (`req:mcp-server-015`).
fn topic_cards(requested: &[String]) -> Vec<Value> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for raw in requested {
        let key = raw.trim().to_ascii_lowercase();
        for (id, aliases, title, syntax, example, caveats) in TOPIC_CATALOG {
            if seen.contains(id) {
                continue;
            }
            if key == *id || aliases.iter().any(|alias| *alias == key) {
                seen.insert(*id);
                out.push(json!({
                    "id": id,
                    "title": title,
                    "syntax": syntax,
                    "example": example,
                    "caveats": caveats,
                    "sources": [],
                }));
            }
        }
    }
    out
}

fn detect_topics_from_task(task: &str) -> Vec<String> {
    let lower = task.to_ascii_lowercase();
    let mut found = Vec::new();
    for (id, aliases, ..) in TOPIC_CATALOG {
        if aliases
            .iter()
            .any(|alias| alias.len() > 2 && lower.contains(alias))
        {
            found.push((*id).to_string());
        }
    }
    found
}

fn wants_topic_mode(task: &str, explicit: &[String]) -> bool {
    if !explicit.is_empty() {
        return true;
    }
    let detected = detect_topics_from_task(task);
    if detected.is_empty() {
        return false;
    }
    let lower = task.to_ascii_lowercase();
    lower.contains("how")
        || lower.contains("syntax")
        || lower.contains("example")
        || lower.contains("what is")
        || lower.contains("explain")
}

fn topic_mode_result(task: &str, topic_ids: &[String]) -> Value {
    let cards = topic_cards(topic_ids);
    let language_facts: Vec<Value> = cards
        .iter()
        .filter_map(|card| {
            let id = card.get("id")?.as_str()?;
            let syntax = card.get("syntax")?.as_str()?;
            Some(json!(format!("{id}: {syntax}")))
        })
        .collect();
    let implementation_evidence: Vec<Value> = cards
        .iter()
        .filter_map(|card| {
            let id = card.get("id")?.as_str()?;
            let example = card.get("example")?.as_str()?.lines().next()?;
            Some(json!(format!("{id}: verified example — {example}")))
        })
        .collect();
    json!({
        "ok": true,
        "task": if task.is_empty() { Value::Null } else { json!(task) },
        "topics": cards,
        "syntax": [],
        "semantics": [],
        "restrictions": [],
        "expressibility": {
            "status": "uncertain",
            "summary": "Topic mode returns curated language facts and verified examples. It does not infer impossibility from unrelated restrictions.",
            "supported": [],
            "unsupported": [],
            "uncertain": [],
        },
        "sources": [],
        "relevantGlobals": [],
        "layers": {
            "languageFacts": language_facts,
            "implementationEvidence": implementation_evidence,
            "unverified": [
                "Absence of a reference implementation for a domain feature is not proof the underlying pattern/expression surface cannot express it."
            ]
        }
    })
}

/// Builds the JSON payload for `uffda_authoring_context`.
pub fn authoring_context_with_topics(
    task: &str,
    topics: &[String],
    language: Option<&str>,
) -> Value {
    let task = task.trim();
    let topic_ids = if topics.is_empty() {
        detect_topics_from_task(task)
    } else {
        topics.to_vec()
    };
    if wants_topic_mode(task, topics) && !topic_ids.is_empty() {
        return topic_mode_result(task, &topic_ids);
    }
    authoring_context(task, language)
}

/// Builds the JSON payload for `uffda_authoring_context`.
pub fn authoring_context(task: &str, language: Option<&str>) -> Value {
    let task = task.trim();
    if task.is_empty() {
        return json!({
            "ok": false,
            "error": {
                "code": "MCP_AUTHORING_CONTEXT_INVALID_TASK",
                "phase": "validate",
                "message": "provide a non-empty task and/or topics describing what to look up"
            }
        });
    }

    let tokens = task_tokens(task);
    let mut scored: Vec<(&Evidence, f64)> = EVIDENCE
        .iter()
        .map(|entry| (entry, score(entry, &tokens)))
        .filter(|(entry, s)| *s > 0.0 && matches_language(entry, language))
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut syntax = Vec::new();
    let mut semantics = Vec::new();
    let mut restrictions = Vec::new();
    let mut supported = Vec::new();
    let mut unsupported = Vec::new();
    let mut uncertain = Vec::new();
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    for (entry, _) in scored {
        // Restrictions must hit a specific keyword, not only broad terms, so
        // character-class questions are not classified unsupported via if/loops.
        if entry.kind == EvidenceKind::Restriction {
            let specific = entry.keywords.iter().any(|k| {
                *k != "pattern" && *k != "syntax" && *k != "expression" && tokens.contains(*k)
            });
            if !specific {
                continue;
            }
        }

        let entry_sources: Vec<Value> = entry.sources.iter().map(resolve_source).collect();
        for source in &entry_sources {
            let key = format!(
                "{}:{}:{}",
                source["path"].as_str().unwrap_or(""),
                source["startLine"].as_u64().unwrap_or(0),
                source["excerpt"].as_str().unwrap_or("")
            );
            if seen.insert(key) {
                sources.push(source.clone());
            }
        }

        let snippet = json!({
            "id": entry.id,
            "topic": entry.capability.unwrap_or(entry.id),
            "summary": entry.summary,
            "examples": entry.examples,
            "sources": entry_sources,
        });
        match entry.kind {
            EvidenceKind::Syntax if syntax.len() < 6 => syntax.push(snippet.clone()),
            EvidenceKind::Semantics | EvidenceKind::Capability if semantics.len() < 6 => {
                semantics.push(snippet.clone())
            }
            EvidenceKind::Restriction if restrictions.len() < 6 => restrictions.push(snippet),
            _ => {}
        }

        if let (Some(status), Some(capability)) = (entry.status, entry.capability) {
            let claim = json!({
                "capability": capability,
                "status": match status {
                    CapabilityStatus::Supported => "supported",
                    CapabilityStatus::Unsupported => "unsupported",
                    CapabilityStatus::Uncertain => "uncertain",
                },
                "note": entry.summary,
                "sources": entry_sources,
            });
            match status {
                CapabilityStatus::Supported => supported.push(claim),
                CapabilityStatus::Unsupported => unsupported.push(claim),
                CapabilityStatus::Uncertain => uncertain.push(claim),
            }
        }
    }

    let (status, summary) = if supported.is_empty() && unsupported.is_empty() && uncertain.is_empty()
    {
        (
            "uncertain",
            "No curated evidence matched this task closely enough to assess expressibility.",
        )
    } else if !unsupported.is_empty() && !supported.is_empty() {
        (
            "partially_supported",
            "Some required pieces appear supported, but others are missing or out of contract.",
        )
    } else if !unsupported.is_empty() {
        (
            "unsupported",
            "The task implies capabilities that are not present in Uffda as implemented.",
        )
    } else if !uncertain.is_empty() {
        (
            "uncertain",
            "Matched evidence supports related primitives, but at least one capability remains unproven.",
        )
    } else {
        (
            "supported",
            "Matched evidence indicates the behavior can be expressed with the current surface.",
        )
    };

    let mut result = json!({
        "ok": true,
        "task": task,
        "syntax": syntax,
        "semantics": semantics,
        "restrictions": restrictions,
        "expressibility": {
            "status": status,
            "summary": summary,
            "supported": supported,
            "unsupported": unsupported,
            "uncertain": uncertain,
        },
        "sources": sources,
        "relevantGlobals": relevant_globals(&tokens),
    });
    if let Some(language) = language {
        result["language"] = json!(language);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:mcp-server-013
    fn empty_task_fails_validate() {
        let result = authoring_context("  ", None);
        assert_eq!(result["ok"], false);
        assert_eq!(
            result["error"]["code"],
            "MCP_AUTHORING_CONTEXT_INVALID_TASK"
        );
    }

    #[test]
    // req:mcp-server-013
    fn sorting_task_flags_missing_sort_and_mutation() {
        let result = authoring_context(
            "sort an array of numbers (bubble sort with element swaps)",
            Some("expression"),
        );
        assert_eq!(result["ok"], true);
        assert_eq!(result["expressibility"]["status"], "partially_supported");
        let unsupported = result["expressibility"]["unsupported"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["capability"].as_str().unwrap_or(""))
            .collect::<Vec<_>>();
        assert!(
            unsupported.iter().any(|c| c.contains("`sort`")),
            "{unsupported:?}"
        );
        assert!(
            unsupported
                .iter()
                .any(|c| c.contains("mutation") || c.contains("swap")),
            "{unsupported:?}"
        );
        let supported = result["expressibility"]["supported"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["capability"].as_str().unwrap_or(""))
            .collect::<Vec<_>>();
        assert!(
            supported.iter().any(|c| c.contains("compare")),
            "{supported:?}"
        );
        let globals = result["relevantGlobals"].as_array().unwrap();
        assert!(!globals.iter().any(|g| g["name"] == "sort"));
        assert!(globals.iter().any(|g| g["name"] == "compare"));
    }

    #[test]
    // req:mcp-server-015
    fn topic_mode_returns_exact_syntax_without_unrelated_unsupported() {
        let repetition = authoring_context_with_topics("", &["repetition".to_string()], None);
        assert_eq!(repetition["ok"], true);
        assert_eq!(repetition["topics"][0]["id"], "repetition");
        let syntax = repetition["topics"][0]["syntax"].as_str().unwrap();
        assert!(syntax.contains("*n..m") || syntax.contains("*10..10"), "{syntax}");
        assert!(repetition["topics"][0]["example"]
            .as_str()
            .unwrap()
            .contains("Digit*10..10"));
        assert_eq!(
            repetition["expressibility"]["unsupported"]
                .as_array()
                .unwrap()
                .len(),
            0
        );

        let classes = authoring_context_with_topics(
            "how do I write a character class for digits?",
            &["character-class".to_string()],
            None,
        );
        assert_eq!(classes["ok"], true);
        assert_eq!(classes["topics"][0]["id"], "character-class");
        assert_eq!(classes["expressibility"]["status"], "uncertain");
        assert_eq!(
            classes["expressibility"]["unsupported"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
        let blob = classes.to_string().to_ascii_lowercase();
        assert!(
            !blob.contains("statement-like"),
            "character-class topic must not pull unrelated if/loop restrictions"
        );

        let free_form = authoring_context_with_topics(
            "explain character classes versus ASCII digits",
            &[],
            None,
        );
        assert_eq!(free_form["ok"], true);
        assert!(
            free_form.get("topics").is_some(),
            "free-form explain should enter topic mode: {free_form}"
        );
        assert_eq!(
            free_form["expressibility"]["unsupported"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
    }
}
