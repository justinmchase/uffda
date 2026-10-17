//! `textDocument/completion` (requirement 006): what is offered derives from
//! the completion contexts the document's grammar produces for the text before
//! the cursor (see [`super::completion_context`]), never from text patterns:
//!
//! - in a `[ModulePath]`, the importable entries relative to the document;
//! - in an `[ImportedName]`, the names the imported module exports, minus those
//!   the import already binds;
//! - in a `[NameReference]`, the visible local bindings, then the in-scope
//!   declarations of the kinds it names, then (where funcs are named) runtime
//!   globals nothing shadows.
//!
//! Read-only over resolved state: an unresolved module's exports are read from
//! its source without loading it or writing artifacts.

use super::completion_context::{CompletionContext, completion_contexts_at};
use super::document::DocumentAnalysis;
use super::editor::documentation_of;
use super::hover::{format_global_markdown, format_local_binding_markdown};
use super::locals::LocalBinding;
use super::positions::range_json;
use crate::languages::Language;
use crate::mcp::sessions::Session;
use serde_json::{Value, json};
use std::collections::HashSet;
use std::path::Path;
use url::Url;

/// LSP `CompletionItemKind` values.
mod kind {
    pub const METHOD: u32 = 2;
    pub const FUNCTION: u32 = 3;
    pub const VARIABLE: u32 = 6;
    pub const PROPERTY: u32 = 10;
    pub const FILE: u32 = 17;
    pub const REFERENCE: u32 = 18;
    pub const FOLDER: u32 = 19;
}

fn declaration_kind(kind: &str) -> u32 {
    match kind {
        "rule" => kind::FUNCTION,
        "func" => kind::METHOD,
        _ => kind::PROPERTY,
    }
}

/// Re-opens the suggestion list after accepting a directory segment.
fn retrigger() -> Value {
    json!({ "title": "Suggest", "command": "editor.action.triggerSuggest" })
}

/// Completion items for `offset` in `doc`. Empty when no completion context
/// reaches the cursor.
pub fn completion_items(
    session: &mut Session,
    doc: &DocumentAnalysis,
    module_url: &Url,
    doc_path: Option<&Path>,
    offset: usize,
) -> Vec<Value> {
    let offset = offset.min(doc.units.len());
    let prefix_units = &doc.units[..offset];
    let prefix = String::from_utf16_lossy(prefix_units);
    let Ok(analysis) = session.languages.analyze_open(&prefix, Language::Uffda) else {
        return Vec::new();
    };
    let Some(tree) = analysis.tree.map(std::rc::Rc::new) else {
        return Vec::new();
    };
    let contexts = completion_contexts_at(&tree, &analysis.spans, prefix_units);
    let mut items = Vec::new();
    for context in &contexts {
        match context {
            CompletionContext::ModulePath {
                typed,
                extensions,
                replace,
            } => {
                if let Some(path) = doc_path {
                    items.extend(specifier_items(
                        path,
                        doc,
                        typed,
                        extensions.as_deref(),
                        *replace,
                    ));
                }
            }
            CompletionContext::ImportedName {
                module_path,
                listed,
                replace,
            } => {
                if let (Some(path), Some(module_path)) = (doc_path, module_path) {
                    items.extend(imported_name_items(
                        session,
                        doc,
                        path,
                        module_path,
                        listed,
                        *replace,
                    ));
                }
            }
            CompletionContext::NameReference {
                kinds,
                locals,
                replace,
            } => items.extend(name_reference_items(
                session,
                doc,
                module_url,
                kinds.as_deref(),
                locals,
                *replace,
            )),
        }
    }
    items
}

fn text_edit(doc: &DocumentAnalysis, replace: (usize, usize), new_text: &str) -> Value {
    json!({
        "range": range_json(&doc.units, replace.0, replace.1),
        "newText": new_text,
    })
}

/// Directories and modules (files with one of `extensions`, or any file when
/// unrestricted) reachable from the path typed so far, resolved against the
/// importing document's directory. Only relative paths (`./`, `../`) are
/// completed; the document itself and hidden entries are excluded.
fn specifier_items(
    document_path: &Path,
    doc: &DocumentAnalysis,
    typed: &str,
    extensions: Option<&[String]>,
    replace: (usize, usize),
) -> Vec<Value> {
    if typed.is_empty() || typed == "." {
        return ["./", "../"]
            .iter()
            .map(|label| {
                json!({
                    "label": label,
                    "kind": kind::FOLDER,
                    "textEdit": text_edit(doc, replace, label),
                    "command": retrigger(),
                })
            })
            .collect();
    }
    if !typed.starts_with("./") && !typed.starts_with("../") {
        return Vec::new();
    }
    let directory_part = &typed[..typed.rfind('/').map(|index| index + 1).unwrap_or(0)];
    let Some(parent) = document_path.parent() else {
        return Vec::new();
    };
    let directory = parent.join(directory_part);
    let own_name = document_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned());
    let Ok(entries) = std::fs::read_dir(&directory) else {
        return Vec::new();
    };
    let mut items: Vec<Value> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(file_type) = std::fs::metadata(entry.path()).map(|meta| meta.file_type()) else {
            continue;
        };
        if file_type.is_dir() {
            let label = format!("{name}/");
            items.push(json!({
                "label": label,
                "kind": kind::FOLDER,
                "textEdit": text_edit(doc, replace, &label),
                "command": retrigger(),
            }));
        } else if file_type.is_file()
            && extensions.is_none_or(|extensions| extensions.iter().any(|ext| name.ends_with(ext)))
            && !(directory_part == "./" && own_name.as_deref() == Some(name.as_str()))
        {
            items.push(json!({
                "label": name,
                "kind": kind::FILE,
                "textEdit": text_edit(doc, replace, &name),
            }));
        }
    }
    items.sort_by(|a, b| a["label"].as_str().cmp(&b["label"].as_str()));
    items
}

/// The exports of the module `module_path` names (relative to the importing
/// document), minus names already listed. Prefers the session's resolved
/// module; otherwise reads the module's source without loading it (no artifact
/// is written and no session state changes).
fn imported_name_items(
    session: &mut Session,
    doc: &DocumentAnalysis,
    document_path: &Path,
    module_path: &str,
    listed: &[String],
    replace: (usize, usize),
) -> Vec<Value> {
    let Ok(document_url) = Url::from_file_path(document_path) else {
        return Vec::new();
    };
    let Ok(module_url) = document_url.join(module_path) else {
        return Vec::new();
    };
    let exported: Vec<(String, String)> = if let Some(exports) = session.list_exports(&module_url) {
        exports
            .into_iter()
            .map(|export| (export.name, format!("exported {}", export.kind)))
            .collect()
    } else {
        if module_url.scheme() != "file" {
            return Vec::new();
        }
        let Ok(path) = module_url.to_file_path() else {
            return Vec::new();
        };
        let Ok(source) = std::fs::read_to_string(path) else {
            return Vec::new();
        };
        let Some(exports) = session.exports_from_source(&source) else {
            return Vec::new();
        };
        exports
            .into_iter()
            .map(|(name, kind)| {
                let detail = if kind == "import" {
                    "re-exported import".to_string()
                } else {
                    format!("exported {kind}")
                };
                (name, detail)
            })
            .collect()
    };
    let listed: HashSet<&str> = listed.iter().map(String::as_str).collect();
    exported
        .into_iter()
        .filter(|(name, _)| !listed.contains(name.as_str()))
        .map(|(name, detail)| {
            json!({
                "label": name,
                "kind": kind::REFERENCE,
                "detail": detail,
                "textEdit": text_edit(doc, replace, &name),
            })
        })
        .collect()
}

fn name_reference_items(
    session: &mut Session,
    doc: &DocumentAnalysis,
    module_url: &Url,
    kinds: Option<&[String]>,
    locals: &[LocalBinding],
    replace: (usize, usize),
) -> Vec<Value> {
    let metadata = session.metadata_table(module_url);
    let documentation_of_name = |name: &str| {
        metadata
            .as_ref()
            .and_then(|table| table.get(name))
            .and_then(documentation_of)
    };
    let mut shadowed: HashSet<String> = locals
        .iter()
        .map(|binding| binding.name().to_string())
        .collect();

    let mut items: Vec<Value> = locals
        .iter()
        .map(|binding| {
            let description = binding
                .declaration_name()
                .and_then(|declaration| documentation_of_name(declaration))
                .and_then(|documentation| {
                    documentation.parameter(binding.name()).map(str::to_string)
                });
            json!({
                "label": binding.name(),
                "kind": kind::VARIABLE,
                "detail": binding.kind_label(),
                "documentation": {
                    "kind": "markdown",
                    "value": format_local_binding_markdown(binding, &doc.units, description.as_deref()),
                },
                "textEdit": text_edit(doc, replace, binding.name()),
            })
        })
        .collect();

    let mut declarations: Vec<Value> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for declaration in session.list_declarations(module_url).unwrap_or_default() {
        if kinds.is_some_and(|kinds| !kinds.iter().any(|kind| kind == declaration.kind)) {
            continue;
        }
        if shadowed.contains(&declaration.name)
            || !seen.insert(format!("{}:{}", declaration.kind, declaration.name))
        {
            continue;
        }
        let docs = if declaration.kind == "decorator" {
            None
        } else {
            documentation_of_name(&declaration.name).map(|documentation| documentation.description)
        };
        let detail = if declaration.exported {
            format!("exported {}", declaration.kind)
        } else {
            declaration.kind.to_string()
        };
        let mut item = json!({
            "label": declaration.name,
            "kind": declaration_kind(declaration.kind),
            "detail": detail,
            "textEdit": text_edit(doc, replace, &declaration.name),
        });
        if let Some(docs) = docs {
            item["documentation"] = json!({ "kind": "markdown", "value": docs });
        }
        declarations.push(item);
    }
    for item in &declarations {
        if let Some(label) = item["label"].as_str() {
            shadowed.insert(label.to_string());
        }
    }
    items.extend(declarations);

    if kinds.is_some_and(|kinds| kinds.iter().any(|kind| kind == "func")) {
        for (name, _) in crate::globals::GLOBALS {
            if shadowed.contains(*name) {
                continue;
            }
            items.push(json!({
                "label": name,
                "kind": kind::FUNCTION,
                "detail": "global func",
                "documentation": { "kind": "markdown", "value": format_global_markdown(name) },
                "textEdit": text_edit(doc, replace, name),
            }));
        }
    }
    items
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::sessions::SessionManager;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("uffda-lsp-comp-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn labels(items: &[Value]) -> Vec<String> {
        items
            .iter()
            .filter_map(|item| item["label"].as_str().map(str::to_string))
            .collect()
    }

    /// Complete at `marker` (the `|` is removed from `source`).
    fn complete(session: &mut Session, path: &Path, source_with_marker: &str) -> Vec<Value> {
        let offset = source_with_marker
            .encode_utf16()
            .position(|unit| unit == u16::from(b'|'))
            .unwrap();
        let source = source_with_marker.replacen('|', "", 1);
        let url = Url::from_file_path(path).unwrap();
        let doc = DocumentAnalysis::parse(&mut session.languages, url.as_str(), &source).unwrap();
        completion_items(session, &doc, &url, Some(path), offset)
    }

    #[test]
    // req:cli-language-server-006
    fn module_path_completion_offers_relative_modules_and_directories() {
        let dir = temp_dir("paths");
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::create_dir_all(dir.join(".hidden")).unwrap();
        std::fs::write(dir.join("a.uff"), "export A;\nrule A = any;\n").unwrap();
        std::fs::write(dir.join("notes.txt"), "").unwrap();
        std::fs::write(dir.join("sub/inner.uff"), "").unwrap();
        let path = dir.join("main.uff");
        std::fs::write(&path, "").unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();

        let empty = complete(session, &path, "import \"|");
        assert_eq!(labels(&empty), ["./", "../"], "{empty:?}");

        let dot = complete(session, &path, "import \"./|");
        let found = labels(&dot);
        assert!(found.contains(&"a.uff".to_string()), "{found:?}");
        assert!(found.contains(&"sub/".to_string()), "{found:?}");
        assert!(!found.contains(&"notes.txt".to_string()), "{found:?}");
        assert!(
            !found.contains(&"main.uff".to_string()),
            "document itself excluded: {found:?}"
        );
        assert!(!found.contains(&".hidden/".to_string()), "{found:?}");

        let nested = complete(session, &path, "import \"./sub/|");
        assert_eq!(labels(&nested), ["inner.uff"], "{nested:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn imported_name_completion_reads_exports_without_loading_the_module() {
        let dir = temp_dir("names");
        std::fs::write(
            dir.join("a.uff"),
            "export Alpha;\nexport Beta;\nrule Alpha = any;\nrule Beta = any;\nrule Hidden = any;\n",
        )
        .unwrap();
        let path = dir.join("main.uff");
        std::fs::write(&path, "").unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();

        let items = complete(session, &path, "import \"./a.uff\" Alpha |");
        assert_eq!(labels(&items), ["Beta"], "{items:?}");
        assert!(
            !session.has_module(&Url::from_file_path(dir.join("a.uff")).unwrap()),
            "completion must not load the module"
        );
        let all = complete(session, &path, "import \"./a.uff\" |");
        assert_eq!(labels(&all), ["Alpha", "Beta"], "{all:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn name_reference_completion_orders_locals_declarations_and_globals() {
        let dir = temp_dir("refs");
        let path = dir.join("main.uff");
        let source =
            "export Main;\nrule Main<P> = Other;\nrule Other = any;\nfunc F<a:any> = (add a 1);\n";
        std::fs::write(&path, source).unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();
        assert_eq!(
            session.load(source, Some(&path.to_string_lossy()))["ok"],
            true
        );

        // A pattern reference names rules: the parameter, then declared rules;
        // no funcs and no globals.
        let items = complete(session, &path, "export Main;\nrule Main<P> = O|");
        let found = labels(&items);
        assert_eq!(found.first().map(String::as_str), Some("P"), "{found:?}");
        assert!(found.contains(&"Other".to_string()), "{found:?}");
        assert!(!found.contains(&"F".to_string()), "{found:?}");
        assert!(!found.contains(&"add".to_string()), "{found:?}");

        // An expression reference names funcs: locals first, then declared
        // funcs, then globals that nothing shadows.
        let items = complete(session, &path, "func G<a:any> = (|");
        let found = labels(&items);
        assert!(found.contains(&"F".to_string()), "{found:?}");
        assert!(found.contains(&"length".to_string()), "{found:?}");
        let a_index = found.iter().position(|label| label == "a");
        let f_index = found.iter().position(|label| label == "F");
        let length_index = found.iter().position(|label| label == "length");
        if let (Some(a), Some(f)) = (a_index, f_index) {
            assert!(a < f, "locals precede declarations: {found:?}");
        }
        assert!(f_index.unwrap() < length_index.unwrap(), "{found:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn positions_no_context_reaches_return_no_items() {
        let dir = temp_dir("none");
        let path = dir.join("main.uff");
        std::fs::write(&path, "").unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();
        assert!(complete(session, &path, "|").is_empty());
        assert!(complete(session, &path, "export Main;\nrule Main = any;\n|").is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
