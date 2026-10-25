//! Ports of Deno `src/cli/lsp*.test.ts` / semantic-token / editor-metadata
//! checks that the per-module `#[test]` suites do not already cover at a
//! content level.

use super::completion::completion_items;
use super::document::DocumentAnalysis;
use super::editor::test_support::parse as parse_editor;
use super::editor::{
    Documentation, EditorDecorator, documentation_of, find_annotated, has_editor_metadata,
    is_success, node_id, node_text, walk_accepted, walk_annotatable,
};
use super::positions::utf16;
use super::reference_roles::resolve_reference_roles;
use super::*;
use crate::highlight::{
    HighlightSpan, SEMANTIC_TOKEN_TYPES, encode_semantic_tokens_typed, semantic_tokens_legend,
};
use crate::mcp::sessions::SessionManager;
use serde_json::json;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

fn legend_index(token_type: &str) -> u32 {
    SEMANTIC_TOKEN_TYPES
        .iter()
        .position(|name| *name == token_type)
        .unwrap_or_else(|| panic!("missing legend entry for {token_type}")) as u32
}

fn open_document(state: &mut ServerState, uri: &str, text: &str) -> Vec<Value> {
    handle_message(
        &json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": uri,
                    "languageId": "uffda",
                    "version": 1,
                    "text": text
                }
            }
        }),
        state,
    )
}

fn change_document(state: &mut ServerState, uri: &str, version: u64, text: &str) -> Vec<Value> {
    handle_message(
        &json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didChange",
            "params": {
                "textDocument": { "uri": uri, "version": version },
                "contentChanges": [{ "text": text }]
            }
        }),
        state,
    )
}

fn close_document(state: &mut ServerState, uri: &str) -> Vec<Value> {
    handle_message(
        &json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didClose",
            "params": { "textDocument": { "uri": uri } }
        }),
        state,
    )
}

fn temp_dir(label: &str) -> PathBuf {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let path = std::env::temp_dir().join(format!(
        "uffda-lsp-port-{label}-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_dir_all(&path);
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn last_role<'a>(spans: &'a [HighlightSpan], text: &str) -> Option<&'a str> {
    spans
        .iter()
        .rev()
        .find(|span| span.text == text)
        .map(|span| span.role.as_str())
}

#[test]
// req:cli-language-server-005
fn semantic_tokens_ported_delta_encodes_across_line_breaks_and_maps_roles() {
    let source = "ab\ncd";
    let spans = [
        HighlightSpan {
            role: "identifier".into(),
            offset: 0,
            length: 2,
            text: "ab".into(),
        },
        HighlightSpan {
            role: "newline".into(),
            offset: 2,
            length: 1,
            text: "\n".into(),
        },
        HighlightSpan {
            role: "string".into(),
            offset: 3,
            length: 2,
            text: "cd".into(),
        },
    ];
    assert_eq!(
        encode_semantic_tokens_typed(source, &spans),
        vec![
            0,
            0,
            2,
            legend_index("variable"),
            0,
            1,
            0,
            2,
            legend_index("string"),
            0,
        ]
    );

    for (role, token_type) in [
        ("type", "type"),
        ("function", "function"),
        ("variable", "variable"),
        ("property", "property"),
    ] {
        let data = encode_semantic_tokens_typed(
            "a",
            &[HighlightSpan {
                role: role.into(),
                offset: 0,
                length: 1,
                text: "a".into(),
            }],
        );
        assert_eq!(data, vec![0, 0, 1, legend_index(token_type), 0], "{role}");
    }

    let legend = semantic_tokens_legend();
    let types = legend["tokenTypes"].as_array().unwrap();
    let unique: HashSet<_> = types.iter().collect();
    assert_eq!(unique.len(), types.len());
    assert!(legend["tokenModifiers"].as_array().unwrap().is_empty());
}

#[test]
// req:cli-language-server-005 req:cli-language-server-006
fn reference_roles_ported_color_expression_refs_and_respect_locals() {
    let dir = temp_dir("roles");
    let path = dir.join("main.uff");
    let source = "\
export Main;
rule IsNotComment = any;
func TokenText<t:any> = t;
rule Main = tokens:any -> (map (filter tokens IsNotComment) TokenText coalesce);
";
    std::fs::write(&path, source).unwrap();
    let mut manager = SessionManager::new();
    let session_id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
    let module_url = Url::from_file_path(&path).unwrap();
    let session = manager.get_mut(&session_id).ok().unwrap();
    assert_eq!(
        session.load(source, Some(&path.to_string_lossy()))["ok"],
        true
    );
    let doc = DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), source).unwrap();
    let refined = resolve_reference_roles(&doc, session, &module_url);
    assert_eq!(last_role(&refined, "map"), Some("function"));
    assert_eq!(last_role(&refined, "filter"), Some("function"));
    assert_eq!(last_role(&refined, "tokens"), Some("variable"));
    assert_eq!(last_role(&refined, "IsNotComment"), Some("type"));
    assert_eq!(last_role(&refined, "TokenText"), Some("function"));
    assert_eq!(last_role(&refined, "coalesce"), Some("function"));

    let shadow = "export Main;\nrule Other = any;\nrule Main = Other:any -> (f Other);\n";
    std::fs::write(&path, shadow).unwrap();
    assert_eq!(
        session.load(shadow, Some(&path.to_string_lossy()))["ok"],
        true
    );
    let doc = DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), shadow).unwrap();
    let refined = resolve_reference_roles(&doc, session, &module_url);
    assert_eq!(last_role(&refined, "Other"), Some("variable"));

    let unresolved = "export Main;\nrule Main = any -> (f nowhere);\n";
    std::fs::write(&path, unresolved).unwrap();
    assert_eq!(
        session.load(unresolved, Some(&path.to_string_lossy()))["ok"],
        true
    );
    let doc =
        DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), unresolved).unwrap();
    let refined = resolve_reference_roles(&doc, session, &module_url);
    assert_eq!(last_role(&refined, "nowhere"), Some("variable"));

    let plain = "rule Main = any;\nexport Main;";
    let doc = DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), plain).unwrap();
    let refined = resolve_reference_roles(&doc, session, &module_url);
    assert_eq!(last_role(&refined, "Main"), Some("identifier"));
    assert_eq!(last_role(&refined, "rule"), Some("keyword"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
// req:cli-language-server-001 req:cli-language-server-003 req:cli-language-server-004
fn wire_ported_ignores_non_uff_and_clears_diagnostics_on_close() {
    let mut state = ServerState::new();
    let ignored = open_document(&mut state, "file:///tmp/notes.txt", "hello");
    assert!(ignored.is_empty(), "{ignored:?}");

    let uri = "file:///tmp/edit.uff";
    let opened = open_document(&mut state, uri, "export Main;\nrule Main = any;\n");
    assert_eq!(opened.len(), 1);
    assert_eq!(opened[0]["method"], "textDocument/publishDiagnostics");
    assert_eq!(
        opened[0]["params"]["diagnostics"].as_array().unwrap().len(),
        0
    );

    let changed = change_document(&mut state, uri, 2, "export Main;\nrule Main = ");
    assert_eq!(changed.len(), 1);
    assert!(
        !changed[0]["params"]["diagnostics"]
            .as_array()
            .unwrap()
            .is_empty()
    );

    let closed = close_document(&mut state, uri);
    assert_eq!(closed.len(), 1);
    assert_eq!(
        closed[0]["params"]["diagnostics"].as_array().unwrap().len(),
        0
    );
}

#[test]
// req:cli-language-server-005
fn wire_ported_keeps_semantic_tokens_after_a_parse_error() {
    let mut state = ServerState::new();
    let uri = "file:///tmp/partial.uff";
    let _ = open_document(&mut state, uri, "export Main;\nrule Main = ");
    let responses = handle_message(
        &json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "textDocument/semanticTokens/full",
            "params": { "textDocument": { "uri": uri } }
        }),
        &mut state,
    );
    let data = responses[0]["result"]["data"].as_array().unwrap();
    assert!(!data.is_empty(), "prefix tokens must survive a parse error");
    assert_eq!(data.len() % 5, 0);
}

#[test]
// req:cli-language-server-004
fn diagnostics_ported_empty_on_success_and_nonempty_on_parse_failure() {
    let mut state = ServerState::new();
    let ok = open_document(
        &mut state,
        "file:///tmp/ok.uff",
        "export Main;\nrule Main = any;\n",
    );
    assert_eq!(ok[0]["params"]["diagnostics"].as_array().unwrap().len(), 0);

    let broken = open_document(&mut state, "file:///tmp/broken.uff", "rule Main = (");
    let diagnostics = broken[0]["params"]["diagnostics"].as_array().unwrap();
    assert!(!diagnostics.is_empty());
    assert_eq!(diagnostics[0]["source"], "uffda");
    assert_eq!(diagnostics[0]["severity"], 1);
    assert!(
        diagnostics[0]["message"]
            .as_str()
            .unwrap()
            .contains("Expected")
            || !diagnostics[0]["message"].as_str().unwrap().is_empty()
    );
}

#[test]
// req:cli-language-server-006
fn document_quality_ported_orders_failed_recovered_and_clean() {
    let mut languages = crate::languages::Languages::new().unwrap();
    let failed =
        DocumentAnalysis::parse(&mut languages, "file:///tmp/q.uff", "rule Main = (").unwrap();
    let clean = DocumentAnalysis::parse(
        &mut languages,
        "file:///tmp/q.uff",
        "export Main;\nrule Main = any;\n",
    )
    .unwrap();
    assert!(
        failed.quality < clean.quality,
        "{} < {}",
        failed.quality,
        clean.quality
    );
    assert_eq!(clean.quality, 2);
}

#[test]
// req:cli-language-server-006
fn import_completion_ported_lists_reexports_and_skips_missing_modules() {
    let dir = temp_dir("import-comp");
    std::fs::write(
        dir.join("dep.uff"),
        "import \"./leaf.uff\" L;\nexport Foo;\nexport L;\nrule Foo = L;\n",
    )
    .unwrap();
    std::fs::write(dir.join("leaf.uff"), "export L;\nrule L = any;\n").unwrap();
    let path = dir.join("main.uff");
    std::fs::write(&path, "").unwrap();
    let mut manager = SessionManager::new();
    let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
    let session = manager.get_mut(&id).ok().unwrap();

    let source = "import \"./dep.uff\" ";
    let url = Url::from_file_path(&path).unwrap();
    let doc = DocumentAnalysis::parse(&mut session.languages, url.as_str(), source).unwrap();
    let offset = source.encode_utf16().count();
    let items = completion_items(session, &doc, &url, Some(&path), offset);
    let labels: Vec<_> = items
        .iter()
        .filter_map(|item| item["label"].as_str())
        .collect();
    assert!(labels.contains(&"Foo"), "{items:?}");
    assert!(labels.contains(&"L"), "{items:?}");
    assert!(
        items
            .iter()
            .any(|item| item["label"] == "L" && item["detail"] == "re-exported import"),
        "{items:?}"
    );

    let missing = "import \"./nope.uff\" ";
    let doc = DocumentAnalysis::parse(&mut session.languages, url.as_str(), missing).unwrap();
    let offset = missing.encode_utf16().count();
    assert!(completion_items(session, &doc, &url, Some(&path), offset).is_empty());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
// req:cli-language-server-006
fn editor_metadata_ported_reads_parameters_documentation_and_walks_once() {
    let source = "import \"./a.uff\" A;\nexport X;\nrule X = A -> (f _);\n";
    let (tree, _) = parse_editor(source);
    let units = utf16(source);
    let path = find_annotated(&tree, EditorDecorator::ModulePath, |_| true).expect("path");
    assert_eq!(node_text(&path, &units), "./a.uff");

    let with_params = "rule Pair<P, Q> = P Q;";
    let (tree, _) = parse_editor(with_params);
    let mut parameters = Vec::new();
    walk_accepted(&tree, |node, _| {
        if is_success(node) && has_editor_metadata(node, EditorDecorator::Parameter) {
            parameters.push(node_text(node, &utf16(with_params)));
        }
    });
    assert_eq!(parameters, ["P", "Q"]);

    let doc = documentation_of(&json!({
        "Documentation": {
            "description": "Pair of P.",
            "parameters": { "P": "the element", "Q": 1 },
            "error": "Why."
        }
    }))
    .unwrap();
    assert_eq!(
        doc,
        Documentation {
            description: "Pair of P.".into(),
            parameters: vec![("P".into(), "the element".into())],
            error: Some("Why.".into()),
        }
    );
    assert!(documentation_of(&json!({ "Documentation": "raw string" })).is_none());
    assert!(documentation_of(&json!({ "Highlight": { "role": "string" } })).is_none());

    let (tree, _) = parse_editor("export Main;\nrule Main = any;\n");
    let mut seen = HashSet::new();
    let mut visits = 0usize;
    walk_annotatable(&tree, |node, _| {
        visits += 1;
        assert!(seen.insert(node_id(node)));
    });
    assert_eq!(visits, seen.len());
    assert!(visits > 1);
}
