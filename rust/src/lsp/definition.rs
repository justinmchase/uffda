//! `textDocument/definition` (requirement 006): resolve the identifier under
//! the cursor against the session's module graph (or its local binding), then
//! locate its declaring production in a parse tree by `[Declaration]`
//! metadata. Never invents a location when the declaration span cannot be
//! proven.

use super::document::{DocumentAnalysis, DocumentStore};
use super::editor::{EditorDecorator, Node, declared_name, find_annotated};
use super::positions::range_json;
use super::references::{local_definition, occurrence_at};
use super::symbols::{NameSymbol, global_names};
use crate::mcp::sessions::Session;
use serde_json::{Value, json};
use std::rc::Rc;
use url::Url;

/// A declaration's source span in a parsed document.
pub struct LocatedDeclaration {
    pub document: Rc<DocumentAnalysis>,
    pub start: usize,
    pub end: usize,
}

/// Walks a parse tree for a `[Declaration]` production whose projected `name`
/// equals `name`, returning its character span. Walks `Ok` and `Fail` children
/// so a declaration matched before a later failure is still findable.
pub fn declaration_span_in(tree: &Node, name: &str) -> Option<(usize, usize)> {
    find_annotated(tree, EditorDecorator::Declaration, |node| {
        declared_name(node).as_deref() == Some(name) && node.end > node.start
    })
    .map(|node| (node.start, node.end))
}

pub fn is_uff_file_url(url: &Url) -> bool {
    url.scheme() == "file" && url.path().ends_with(".uff")
}

/// The source and `[Declaration]` span of `name` in the `.uff` module
/// `defining_module_url`: an open buffer when there is one, else a read-only
/// parse of the file on disk. Does not mutate the session's module graph.
pub fn locate_declaration_source(
    session: &mut Session,
    store: &mut DocumentStore,
    defining_module_url: &Url,
    name: &str,
) -> Option<LocatedDeclaration> {
    if !is_uff_file_url(defining_module_url) {
        return None;
    }
    let document = store.analysis_for(&mut session.languages, defining_module_url)?;
    let (start, end) = declaration_span_in(document.tree.as_ref()?, name)?;
    Some(LocatedDeclaration {
        document,
        start,
        end,
    })
}

fn location(doc: &DocumentAnalysis, located: &LocatedDeclaration) -> Value {
    let uri = if located.document.module_url == doc.module_url {
        &doc.uri
    } else {
        &located.document.uri
    };
    json!({
        "uri": uri,
        "range": range_json(&located.document.units, located.start, located.end),
    })
}

/// `Location[]` for the name at `offset` in `doc`. Empty when nothing
/// resolvable is under the cursor or the declaring span cannot be located.
pub fn definition_at(
    session: &mut Session,
    store: &mut DocumentStore,
    doc: &DocumentAnalysis,
    module_url: &Url,
    offset: usize,
) -> Vec<Value> {
    let Some(ident) = doc.identifier_at(offset) else {
        return Vec::new();
    };
    let globals = global_names();
    let occurrence = occurrence_at(doc, offset, &globals);

    // A local binding resolves to its declaring occurrence before any
    // same-named declaration.
    if let Some(occurrence) = &occurrence
        && let Some(local) = local_definition(doc, occurrence, &globals)
    {
        return vec![local];
    }

    if let Some(resolved) = session.resolve_declaration(&ident.name, module_url)
        && let Some(located) =
            locate_declaration_source(session, store, &resolved.defining_module_url, &ident.name)
    {
        return vec![location(doc, &located)];
    }

    // The session has no resolved state for this module (for example while the
    // document does not parse): fall back to what the parse tree itself proves.
    let Some(occurrence) = occurrence else {
        return Vec::new();
    };
    let NameSymbol::Declaration {
        module_url: declaring,
        name,
    } = &occurrence.symbol
    else {
        return Vec::new();
    };
    let Ok(declaring) = Url::parse(declaring) else {
        return Vec::new();
    };
    let document = if declaring.as_str() == doc.module_url {
        let Some(tree) = doc.tree.as_ref() else {
            return Vec::new();
        };
        let Some((start, end)) = declaration_span_in(tree, name) else {
            return Vec::new();
        };
        return vec![json!({
            "uri": doc.uri,
            "range": range_json(&doc.units, start, end),
        })];
    } else {
        match locate_declaration_source(session, store, &declaring, name) {
            Some(located) => located,
            None => return Vec::new(),
        }
    };
    vec![location(doc, &document)]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::sessions::SessionManager;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("uffda-lsp-def-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    // req:cli-language-server-006
    fn definition_resolves_declarations_locals_and_returns_nothing_otherwise() {
        let dir = temp_dir("local");
        let path = dir.join("main.uff");
        let source = "export Main;\nrule Main<P> = x:Other P -> (add x 1);\nrule Other = any;\n";
        std::fs::write(&path, source).unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();
        let url = Url::from_file_path(&path).unwrap();
        assert_eq!(
            session.load(source, Some(&path.to_string_lossy()))["ok"],
            true
        );
        let doc =
            Rc::new(DocumentAnalysis::parse(&mut session.languages, url.as_str(), source).unwrap());
        let mut store = DocumentStore::default();
        store.set_open(Rc::clone(&doc));

        // Reference to a declaration → the whole declaring production.
        let at = source.find("Other P").unwrap() + 1;
        let found = definition_at(session, &mut store, &doc, &url, at);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0]["uri"], url.as_str());
        assert_eq!(found[0]["range"]["start"]["line"], 2);
        assert_eq!(found[0]["range"]["start"]["character"], 0);

        // A rule parameter reference → its `<P>` occurrence.
        let at = source.find("P ->").unwrap();
        let found = definition_at(session, &mut store, &doc, &url, at);
        assert_eq!(found[0]["range"]["start"]["line"], 1);
        assert_eq!(found[0]["range"]["start"]["character"], 10);

        // A variable reference → its binding site.
        let at = source.rfind("x 1").unwrap();
        let found = definition_at(session, &mut store, &doc, &url, at);
        assert_eq!(found[0]["range"]["start"]["character"], 15);

        // A runtime global, a keyword, and whitespace resolve to nothing.
        assert!(
            definition_at(session, &mut store, &doc, &url, source.find("add").unwrap()).is_empty()
        );
        assert!(
            definition_at(
                session,
                &mut store,
                &doc,
                &url,
                source.find("rule").unwrap() + 1
            )
            .is_empty()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn definition_crosses_import_boundaries() {
        let dir = temp_dir("import");
        let a_path = dir.join("a.uff");
        let b_path = dir.join("b.uff");
        let a_source = "export Thing;\nrule Thing = any;\n";
        let b_source = "import \"./a.uff\" Thing;\nexport Main;\nrule Main = Thing;\n";
        std::fs::write(&a_path, a_source).unwrap();
        std::fs::write(&b_path, b_source).unwrap();
        let mut manager = SessionManager::new();
        let id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let session = manager.get_mut(&id).ok().unwrap();
        assert_eq!(
            session.load(a_source, Some(&a_path.to_string_lossy()))["ok"],
            true
        );
        assert_eq!(
            session.load(b_source, Some(&b_path.to_string_lossy()))["ok"],
            true
        );
        let b_url = Url::from_file_path(&b_path).unwrap();
        let a_url = Url::from_file_path(&a_path).unwrap();
        let doc = Rc::new(
            DocumentAnalysis::parse(&mut session.languages, b_url.as_str(), b_source).unwrap(),
        );
        let mut store = DocumentStore::default();
        store.set_open(Rc::clone(&doc));

        // `a.uff` is not open: it is parsed read-only from disk.
        let at = b_source.rfind("Thing").unwrap() + 1;
        let found = definition_at(session, &mut store, &doc, &b_url, at);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0]["uri"], a_url.as_str());
        assert_eq!(found[0]["range"]["start"]["line"], 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn definition_falls_back_to_the_parse_tree_when_the_module_is_not_loaded() {
        let source = "export Main;\nrule Main = Other;\nrule Other = any;\n";
        let mut manager = SessionManager::new();
        let id = manager
            .open(std::env::temp_dir(), None)
            .ok()
            .unwrap()
            .id
            .clone();
        let session = manager.get_mut(&id).ok().unwrap();
        let url = Url::parse("file:///tmp/uffda-lsp-def-unloaded/main.uff").unwrap();
        let doc =
            Rc::new(DocumentAnalysis::parse(&mut session.languages, url.as_str(), source).unwrap());
        let mut store = DocumentStore::default();
        store.set_open(Rc::clone(&doc));
        let at = source.find("Other;").unwrap();
        let found = definition_at(session, &mut store, &doc, &url, at);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0]["range"]["start"]["line"], 2);
    }
}
