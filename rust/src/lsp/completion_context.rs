//! Grammar-derived completion contexts (requirement 006). The text before the
//! cursor is parsed with the document's own grammar; the editor metadata on
//! the nodes that reach the cursor says what may be completed there. Nothing
//! about any language's syntax is known here: a grammar that applies no editor
//! metadata simply has no completion contexts.

use super::editor::{
    EditorDecorator, Node, find_annotated, has_editor_metadata, is_success, module_path_extensions,
    name_reference_kinds, node_id, node_text, walk_annotatable,
};
use super::locals::{IdentifierPosition, LocalBinding, local_bindings_at};
use crate::highlight::{HighlightSpan, is_trivia_role};
use std::cell::RefCell;
use std::collections::HashMap;

/// A half-open UTF-16 range a completion item replaces.
pub type CompletionReplace = (usize, usize);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CompletionContext {
    ModulePath {
        /// Module path text typed so far.
        typed: String,
        /// Extensions the grammar's modules use (`None`: any file).
        extensions: Option<Vec<String>>,
        /// The path segment being typed (after the last `/`).
        replace: CompletionReplace,
    },
    ImportedName {
        /// The enclosing import's module path, if it has one.
        module_path: Option<String>,
        /// Names the enclosing import already binds.
        listed: Vec<String>,
        replace: CompletionReplace,
    },
    NameReference {
        /// Declaration kinds that may be named (`None`: every kind).
        kinds: Option<Vec<String>>,
        /// Local bindings visible at the cursor that the reference may name,
        /// innermost first.
        locals: Vec<LocalBinding>,
        replace: CompletionReplace,
    },
}

const CONTEXT_DECORATORS: [EditorDecorator; 3] = [
    EditorDecorator::ModulePath,
    EditorDecorator::ImportedName,
    EditorDecorator::NameReference,
];

/// Whether `predicate` holds for a node or any match beneath it, accepted or
/// rejected. Shared sub-matches are decided once.
fn within(
    node: &Node,
    known: &RefCell<HashMap<usize, bool>>,
    predicate: &dyn Fn(&Node) -> bool,
) -> bool {
    if let Some(cached) = known.borrow().get(&node_id(node)) {
        return *cached;
    }
    known.borrow_mut().insert(node_id(node), false);
    let result = predicate(node)
        || node
            .children
            .iter()
            .any(|child| within(child, known, predicate));
    known.borrow_mut().insert(node_id(node), result);
    result
}

/// End offset of the last non-trivia token span, or 0.
fn last_significant_end(spans: &[HighlightSpan]) -> usize {
    spans
        .iter()
        .filter(|span| !is_trivia_role(&span.role))
        .map(|span| span.offset + span.length)
        .next_back()
        .unwrap_or(0)
}

/// The completion contexts at the end of `prefix` (the document text before the
/// cursor, as UTF-16 `units`), given `tree` and `spans`, the document
/// grammar's parse of `prefix`.
///
/// A node reaches the cursor when it is being typed (an `Ok` node ending
/// exactly there, or a node that itself, or in a continuation beneath it,
/// consumed input and then failed expecting more at the cursor) or when it is
/// a `Fail` node attempted after the last significant token, i.e. separated
/// from the cursor by trivia only (a token the grammar expected next). A
/// non-empty construct being typed wins over tokens expected after it. Only the
/// outermost node carrying a given decorator on a path counts. Distinct
/// contexts are returned in tree order.
pub fn completion_contexts_at(
    tree: &Node,
    spans: &[HighlightSpan],
    units: &[u16],
) -> Vec<CompletionContext> {
    let cursor = units.len();
    let significant_end = last_significant_end(spans);
    let runs_out_known = RefCell::new(HashMap::new());
    let typed_known = RefCell::new(HashMap::new());
    let runs_out = |node: &Node| {
        within(node, &runs_out_known, &|candidate| {
            candidate.kind == "fail"
                && candidate.start >= significant_end
                && candidate.start <= cursor
        })
    };
    let typed_partway = |node: &Node| {
        within(node, &typed_known, &|candidate| {
            candidate.kind == "fail" && candidate.start < significant_end && runs_out(candidate)
        })
    };

    let mut typed: Vec<CompletionContext> = Vec::new();
    let mut expected: Vec<CompletionContext> = Vec::new();
    walk_annotatable(tree, |node, ancestors| {
        let typing = node.start < cursor
            && ((is_success(node) && node.end == cursor) || typed_partway(node));
        let reaches = typing
            || if is_success(node) {
                node.end == cursor
            } else {
                node.start >= significant_end && node.start <= cursor
            };
        if !reaches {
            return;
        }
        for decorator in CONTEXT_DECORATORS {
            if !has_editor_metadata(node, decorator) {
                continue;
            }
            if ancestors
                .iter()
                .any(|ancestor| has_editor_metadata(ancestor, decorator))
            {
                continue;
            }
            let context = context_for(decorator, node, ancestors, units, typing);
            if typing {
                typed.push(context);
            } else {
                expected.push(context);
            }
        }
    });
    distinct(if typed.is_empty() { expected } else { typed })
}

fn distinct(contexts: Vec<CompletionContext>) -> Vec<CompletionContext> {
    let mut seen: Vec<CompletionContext> = Vec::new();
    for context in contexts {
        if !seen.contains(&context) {
            seen.push(context);
        }
    }
    seen
}

fn context_for(
    decorator: EditorDecorator,
    node: &Node,
    ancestors: &[Node],
    units: &[u16],
    typing: bool,
) -> CompletionContext {
    let cursor = units.len();
    let replace = if typing {
        (node.start, cursor)
    } else {
        (cursor, cursor)
    };
    match decorator {
        EditorDecorator::ModulePath => {
            let typed_units = &units[replace.0.min(cursor)..cursor];
            let last_slash = typed_units
                .iter()
                .rposition(|unit| *unit == u16::from(b'/'))
                .map(|index| index as isize)
                .unwrap_or(-1);
            CompletionContext::ModulePath {
                typed: String::from_utf16_lossy(typed_units),
                extensions: module_path_extensions(node),
                replace: ((replace.0 as isize + last_slash + 1) as usize, cursor),
            }
        }
        EditorDecorator::ImportedName => {
            let import = ancestors
                .iter()
                .rev()
                .find(|ancestor| has_editor_metadata(ancestor, EditorDecorator::Import));
            let module_path = import
                .and_then(|import| find_annotated(import, EditorDecorator::ModulePath, |_| true))
                .map(|path| node_text(&path, units));
            CompletionContext::ImportedName {
                module_path,
                listed: import
                    .map(|import| listed_names(import, node, units))
                    .unwrap_or_default(),
                replace,
            }
        }
        EditorDecorator::NameReference => {
            let kinds = name_reference_kinds(node);
            let mut chain = ancestors.to_vec();
            chain.push(std::rc::Rc::clone(node));
            let position = IdentifierPosition {
                chain,
                reference: Some(kinds.clone()),
            };
            CompletionContext::NameReference {
                kinds,
                locals: local_bindings_at(&position, None),
                replace,
            }
        }
        _ => unreachable!("not a completion context decorator: {decorator:?}"),
    }
}

/// Names bound by `import`'s `[ImportedName]` nodes, except `typing`.
fn listed_names(import: &Node, typing: &Node, units: &[u16]) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    walk_annotatable(import, |node, _| {
        if is_success(node)
            && node.start != typing.start
            && has_editor_metadata(node, EditorDecorator::ImportedName)
        {
            let name = node_text(node, units);
            if !names.contains(&name) {
                names.push(name);
            }
        }
    });
    names
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::{Language, Languages};
    use crate::lsp::positions::utf16;
    use std::rc::Rc;

    fn contexts(prefix: &str) -> Vec<CompletionContext> {
        let mut languages = Languages::new().unwrap();
        let analysis = languages.analyze_open(prefix, Language::Uffda).unwrap();
        let tree = Rc::new(analysis.tree.unwrap());
        completion_contexts_at(&tree, &analysis.spans, &utf16(prefix))
    }

    #[test]
    // req:cli-language-server-006
    fn module_path_context_reports_typed_text_and_segment_range() {
        let found = contexts("import \"./sub/a");
        assert_eq!(found.len(), 1, "{found:?}");
        let CompletionContext::ModulePath {
            typed,
            extensions,
            replace,
        } = &found[0]
        else {
            panic!("expected module path context: {found:?}");
        };
        assert_eq!(typed, "./sub/a");
        assert_eq!(extensions.as_deref(), Some(&[".uff".to_string()][..]));
        // The segment after the last `/`.
        assert_eq!(*replace, (14, 15));
    }

    #[test]
    // req:cli-language-server-006
    fn name_reference_context_names_kinds_and_visible_locals() {
        let found = contexts("rule Main<P> = x:Other Ot");
        let CompletionContext::NameReference {
            kinds,
            locals,
            replace,
        } = found.last().expect("context")
        else {
            panic!("expected name reference: {found:?}");
        };
        assert_eq!(kinds.as_deref(), Some(&["rule".to_string()][..]));
        assert_eq!(*replace, (23, 25));
        assert!(
            locals.iter().any(|local| local.name() == "P"),
            "rule parameters are visible to pattern references: {locals:?}"
        );
    }

    #[test]
    // req:cli-language-server-006
    fn imported_name_context_names_the_import_module_and_listed_names() {
        let found = contexts("import \"./a.uff\" A B");
        let imported: Vec<_> = found
            .iter()
            .filter_map(|context| match context {
                CompletionContext::ImportedName {
                    module_path,
                    listed,
                    replace,
                } => Some((module_path.clone(), listed.clone(), *replace)),
                _ => None,
            })
            .collect();
        assert_eq!(imported.len(), 1, "{found:?}");
        assert_eq!(imported[0].0.as_deref(), Some("./a.uff"));
        assert_eq!(imported[0].1, ["A"]);
        assert_eq!(imported[0].2, (19, 20));
    }

    #[test]
    // req:cli-language-server-006
    fn positions_no_context_reaches_yield_no_contexts() {
        assert!(contexts("").is_empty());
        assert!(contexts("export Main;\nrule Main = any;\n").is_empty());
    }

    #[test]
    // req:cli-language-server-006
    fn open_prefix_expects_another_imported_name_after_a_listed_one() {
        // The prefix ends after trivia that follows a repetition's last element,
        // through the grammar's pipeline stages and its recovery restart.
        let found = contexts("import \"./a.uff\" Alpha ");
        assert_eq!(
            found,
            vec![CompletionContext::ImportedName {
                module_path: Some("./a.uff".to_string()),
                listed: vec!["Alpha".to_string()],
                replace: (23, 23),
            }]
        );
    }
}
