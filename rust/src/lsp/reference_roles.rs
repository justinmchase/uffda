//! Refine `variable` highlight spans by what their names resolve to
//! (requirement 005 / 006): locals stay `variable`, rules/decorators become
//! `type`, funcs and runtime globals become `function`.

use super::document::DocumentAnalysis;
use super::locals::{LocalScopeMemo, identifier_positions, local_bindings_at};
use crate::highlight::HighlightSpan;
use crate::mcp::sessions::Session;
use url::Url;

fn declaration_role(kind: &str) -> Option<&'static str> {
    match kind {
        "rule" | "decorator" => Some("type"),
        "func" => Some("function"),
        _ => None,
    }
}

/// Refines each `variable`-role span by what its name resolves to at that
/// position. Read-only over the session and parse tree.
pub fn resolve_reference_roles(
    doc: &DocumentAnalysis,
    session: &Session,
    module_url: &Url,
) -> Vec<HighlightSpan> {
    let Some(tree) = doc.tree.as_ref() else {
        return doc.spans.clone();
    };
    let references: Vec<usize> = doc
        .spans
        .iter()
        .enumerate()
        .filter(|(_, span)| span.role == "variable")
        .map(|(index, _)| index)
        .collect();
    if references.is_empty() {
        return doc.spans.clone();
    }

    let declarations: std::collections::HashMap<String, &'static str> = session
        .list_declarations(module_url)
        .unwrap_or_default()
        .into_iter()
        .map(|declaration| (declaration.name, declaration.kind))
        .collect();
    let globals: std::collections::HashSet<&str> = crate::globals::GLOBALS
        .iter()
        .map(|(name, _)| *name)
        .collect();

    let positions = identifier_positions(
        tree,
        &references
            .iter()
            .map(|&index| {
                let span = &doc.spans[index];
                (span.offset, span.offset + span.length)
            })
            .collect::<Vec<_>>(),
    );
    let mut memo = LocalScopeMemo::default();
    let mut roles = std::collections::HashMap::<usize, &'static str>::new();
    for (i, &index) in references.iter().enumerate() {
        let span = &doc.spans[index];
        let position = &positions[i];
        if local_bindings_at(position, Some(&mut memo))
            .iter()
            .any(|binding| binding.name() == span.text)
        {
            continue;
        }
        if let Some(kind) = declarations.get(&span.text)
            && let Some(role) = declaration_role(kind)
        {
            roles.insert(index, role);
        } else if globals.contains(span.text.as_str()) && position.accepts_kind("func") {
            roles.insert(index, "function");
        }
    }

    doc.spans
        .iter()
        .enumerate()
        .map(|(index, span)| {
            if let Some(role) = roles.get(&index) {
                HighlightSpan {
                    role: (*role).to_string(),
                    ..span.clone()
                }
            } else {
                span.clone()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::sessions::SessionManager;

    #[test]
    // req:cli-language-server-005 req:cli-language-server-006
    fn attribute_names_color_as_type_when_the_decorator_is_in_scope() {
        let dir = std::env::temp_dir().join(format!(
            "uffda-lsp-ref-roles-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let source = "\
export Main;
decorator Keyword = { role: \"keyword\" };
[Keyword]
rule Main = any;
";
        let path = dir.join("main.uff");
        std::fs::write(&path, source).unwrap();
        let mut manager = SessionManager::new();
        let session_id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let module_url = url::Url::from_file_path(&path).unwrap();
        let session = manager.get_mut(&session_id).ok().unwrap();
        assert_eq!(
            session.load(source, Some(&path.to_string_lossy()))["ok"],
            true
        );
        let doc = DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), source)
            .unwrap();
        // The attribute use, not the decorator's declared name.
        let before = doc
            .spans
            .iter()
            .rev()
            .find(|span| span.text == "Keyword")
            .expect("Keyword span");
        assert_eq!(before.role, "variable", "{before:?}");

        let refined = resolve_reference_roles(&doc, session, &module_url);
        let after = refined
            .iter()
            .rev()
            .find(|span| span.text == "Keyword")
            .expect("Keyword span");
        assert_eq!(after.role, "type", "{after:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
