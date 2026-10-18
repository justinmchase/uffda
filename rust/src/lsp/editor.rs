//! Readers for the editor metadata vocabulary declared in
//! `src/lang/editor/editor.uff`. Editor tooling locates syntax exclusively
//! through these decorator names on a parse tree's rule metadata, never
//! through a grammar's rule names or text patterns, so any grammar that
//! applies them gets the same tooling.
//!
//! The tree is a [`RetainedMatch`] projection of the parse's `PatternMatch`
//! DAG: memoized sub-matches are shared by pointer (see
//! `mcp::ops::project_match_tree`), including attempts the parse rejected, so
//! walks here visit each node once.

use crate::mcp::ops::RetainedMatch;
use serde_json::Value;
use std::collections::HashSet;
use std::rc::Rc;

/// A shared parse-tree node.
pub type Node = Rc<RetainedMatch>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EditorDecorator {
    /// Read by highlighting (`crate::highlight`), listed for the full vocabulary.
    #[allow(dead_code)]
    Highlight,
    Declaration,
    Parameter,
    NameReference,
    Import,
    ModulePath,
    ImportedName,
    Documentation,
}

impl EditorDecorator {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Highlight => "Highlight",
            Self::Declaration => "Declaration",
            Self::Parameter => "Parameter",
            Self::NameReference => "NameReference",
            Self::Import => "Import",
            Self::ModulePath => "ModulePath",
            Self::ImportedName => "ImportedName",
            Self::Documentation => "Documentation",
        }
    }
}

/// Stable identity of a shared node.
pub fn node_id(node: &Node) -> usize {
    Rc::as_ptr(node) as usize
}

/// `Ok` or `Skip` (a match that consumed per its pattern).
pub fn is_success(node: &RetainedMatch) -> bool {
    node.kind != "fail"
}

/// The raw metadata value `decorator` carries on `node`'s rule, if applied.
pub fn editor_metadata(node: &RetainedMatch, decorator: EditorDecorator) -> Option<&Value> {
    node.metadata.as_object()?.get(decorator.as_str())
}

pub fn has_editor_metadata(node: &RetainedMatch, decorator: EditorDecorator) -> bool {
    editor_metadata(node, decorator).is_some()
}

fn string_array(value: Option<&Value>) -> Option<Vec<String>> {
    let items = value?.as_array()?;
    Some(
        items
            .iter()
            .filter_map(|item| item.as_str().map(str::to_string))
            .collect(),
    )
}

/// The declaration kinds a `[NameReference]` node refers to, or `None` when
/// it names no kinds (every kind applies).
pub fn name_reference_kinds(node: &RetainedMatch) -> Option<Vec<String>> {
    string_array(
        editor_metadata(node, EditorDecorator::NameReference).and_then(|value| value.get("kinds")),
    )
}

/// The file extensions (with leading dot) a `[ModulePath]` node's modules use,
/// or `None` when unrestricted.
pub fn module_path_extensions(node: &RetainedMatch) -> Option<Vec<String>> {
    string_array(
        editor_metadata(node, EditorDecorator::ModulePath)
            .and_then(|value| value.get("extensions")),
    )
}

/// A declaration's `[Documentation]`, as normalized by the decorator.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Documentation {
    pub description: String,
    /// Parameter name → description, in authored order.
    pub parameters: Vec<(String, String)>,
    pub error: Option<String>,
}

impl Documentation {
    pub fn parameter(&self, name: &str) -> Option<&str> {
        self.parameters
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, description)| description.as_str())
    }
}

/// The `[Documentation]` a declaration's metadata object carries, validated;
/// a missing or malformed entry yields `None`.
pub fn documentation_of(metadata: &Value) -> Option<Documentation> {
    let value = metadata.get(EditorDecorator::Documentation.as_str())?;
    let description = value.get("description")?.as_str()?.to_string();
    let parameters = value
        .get("parameters")
        .and_then(Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(key, value)| Some((key.clone(), value.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default();
    let error = value
        .get("error")
        .and_then(Value::as_str)
        .map(str::to_string);
    Some(Documentation {
        description,
        parameters,
        error,
    })
}

/// The `name` field of a node's projected value (a `[Declaration]`).
pub fn declared_name(node: &RetainedMatch) -> Option<String> {
    if !is_success(node) {
        return None;
    }
    node.value
        .as_ref()?
        .get("name")?
        .as_str()
        .map(str::to_string)
}

/// The text an annotated node denotes: its projected value when that is a
/// string (e.g. an unescaped module path), otherwise its source text.
pub fn node_text(node: &RetainedMatch, units: &[u16]) -> String {
    if is_success(node)
        && let Some(Value::String(text)) = node.value.as_ref()
    {
        return text.clone();
    }
    slice_text(units, node.start, node.end)
}

/// Source range of the import declaration `frame` names inside a module parse
/// tree, using editor metadata (`[Import]` / `[ModulePath]` / `[ImportedName]`).
/// Port of Deno `cli/import_location.ts` (req:cli-language-server-006).
pub fn import_frame_location(
    root: &Node,
    source: &str,
    import_index: usize,
    module_url: &str,
    name: Option<&str>,
) -> Option<crate::diagnostics::SourceLocation> {
    let units = super::positions::utf16(source);
    let imports = collect_import_nodes(root);
    let indexed = imports.get(import_index);
    let chosen = indexed
        .filter(|entry| entry.module_url.as_deref() == Some(module_url))
        .or_else(|| {
            imports
                .iter()
                .find(|entry| entry.module_url.as_deref() == Some(module_url))
        })?;
    let target = name
        .and_then(|wanted| {
            find_annotated(&chosen.node, EditorDecorator::ImportedName, |node| {
                node_text(node, &units) == wanted
            })
        })
        .or_else(|| find_annotated(&chosen.node, EditorDecorator::ModulePath, |_| true))
        .unwrap_or_else(|| Rc::clone(&chosen.node));
    if target.end <= target.start {
        return None;
    }
    Some(crate::diagnostics::location(
        source,
        target.start,
        target.end,
    ))
}

struct ImportNode {
    node: Node,
    module_url: Option<String>,
}

fn collect_import_nodes(root: &Node) -> Vec<ImportNode> {
    let mut found = Vec::new();
    let mut seen_starts = HashSet::new();
    walk_annotatable(root, |node, _| {
        if !is_success(node) || !has_editor_metadata(node, EditorDecorator::Import) {
            return;
        }
        let start = node.start;
        if !seen_starts.insert(start) {
            return;
        }
        let module_url = node
            .value
            .as_ref()
            .and_then(|value| value.get("moduleUrl"))
            .and_then(Value::as_str)
            .map(str::to_string);
        found.push(ImportNode {
            node: Rc::clone(node),
            module_url,
        });
    });
    found
}

pub fn slice_text(units: &[u16], start: usize, end: usize) -> String {
    let end = end.min(units.len());
    let start = start.min(end);
    String::from_utf16_lossy(&units[start..end])
}

/// Visits every node of `root` exactly once in pre-order, passing the chain of
/// its ancestors (outermost first).
///
/// A parse match is a DAG, not a tree: memoized sub-matches are shared by
/// every attempt that reached them, including attempts the parse rejected (a
/// `Fail` beneath an `Ok`). The accepted parse (`Ok` beneath `Ok`, and
/// everything beneath a `Fail` root) is walked first, so a node belonging to it
/// is visited with its accepted ancestors; the rest of the DAG follows, each
/// node visited on the first path reaching it.
pub fn walk_annotatable(root: &Node, mut visit: impl FnMut(&Node, &[Node])) {
    let mut visited = HashSet::new();
    walk_pass(root, true, &mut visited, &mut visit);
    walk_pass(root, false, &mut visited, &mut visit);
}

/// The first phase of [`walk_annotatable`] alone: visits each node of the
/// accepted parse once in pre-order, skipping attempts the parse rejected.
pub fn walk_accepted(root: &Node, mut visit: impl FnMut(&Node, &[Node])) {
    let mut visited = HashSet::new();
    walk_pass(root, true, &mut visited, &mut visit);
}

fn walk_pass(
    root: &Node,
    accepted_only: bool,
    visited: &mut HashSet<usize>,
    visit: &mut impl FnMut(&Node, &[Node]),
) {
    let mut expanded: HashSet<usize> = HashSet::new();
    let mut ancestors: Vec<Node> = Vec::new();
    let mut next: Vec<usize> = Vec::new();

    expanded.insert(node_id(root));
    if visited.insert(node_id(root)) {
        visit(root, &ancestors);
    }
    ancestors.push(Rc::clone(root));
    next.push(0);

    while let Some(top) = ancestors.last() {
        let index = *next.last().expect("parallel stacks");
        let Some(child) = top.children.get(index).cloned() else {
            ancestors.pop();
            next.pop();
            continue;
        };
        *next.last_mut().expect("parallel stacks") += 1;
        if accepted_only && is_success(top) && !is_success(&child) {
            continue;
        }
        if !expanded.insert(node_id(&child)) {
            continue;
        }
        if visited.insert(node_id(&child)) {
            visit(&child, &ancestors);
        }
        ancestors.push(child);
        next.push(0);
    }
}

/// The first `Ok` node in `root`'s subtree (including `root`) carrying
/// `decorator` metadata and satisfying `predicate`.
pub fn find_annotated(
    root: &Node,
    decorator: EditorDecorator,
    predicate: impl Fn(&Node) -> bool,
) -> Option<Node> {
    let mut found: Option<Node> = None;
    walk_annotatable(root, |node, _| {
        if found.is_none()
            && is_success(node)
            && has_editor_metadata(node, decorator)
            && predicate(node)
        {
            found = Some(Rc::clone(node));
        }
    });
    found
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use crate::highlight::HighlightSpan;
    use crate::languages::{Language, Languages};

    /// Parse `source` with the built-in `.uff` grammar into an editor tree.
    pub fn parse(source: &str) -> (Node, Vec<HighlightSpan>) {
        let mut languages = Languages::new().expect("languages");
        let analysis = languages
            .analyze(source, Language::Uffda)
            .expect("analysis");
        (Rc::new(analysis.tree.expect("tree")), analysis.spans)
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::parse;
    use super::*;
    use crate::lsp::positions::utf16;

    #[test]
    // req:cli-language-server-006
    fn declaration_nodes_carry_origin_character_spans_and_names() {
        let source = "export Main;\nrule Main = any;\nrule Other = any;\n";
        let (tree, _) = parse(source);
        let mut declared = Vec::new();
        walk_accepted(&tree, |node, _| {
            if is_success(node)
                && has_editor_metadata(node, EditorDecorator::Declaration)
                && let Some(name) = declared_name(node)
            {
                declared.push((name, node.start, node.end));
            }
        });
        let units = utf16(source);
        assert!(
            declared.iter().any(|(name, start, end)| name == "Main"
                && slice_text(&units, *start, *end).starts_with("rule Main")),
            "{declared:?}"
        );
        assert!(declared.iter().any(|(name, ..)| name == "Other"));
    }

    #[test]
    // req:cli-language-server-006
    fn import_nodes_expose_module_path_and_imported_names() {
        let source = "import \"./a.uff\" A B;\nexport Main;\nrule Main = any;\n";
        let units = utf16(source);
        let (tree, _) = parse(source);
        let import = find_annotated(&tree, EditorDecorator::Import, |_| true).expect("import");
        let path = find_annotated(&import, EditorDecorator::ModulePath, |_| true).expect("path");
        assert_eq!(node_text(&path, &units), "./a.uff");
        assert_eq!(
            module_path_extensions(&path),
            Some(vec![".uff".to_string()])
        );
        let mut names = Vec::new();
        walk_accepted(&import, |node, _| {
            if is_success(node) && has_editor_metadata(node, EditorDecorator::ImportedName) {
                names.push(node_text(node, &units));
            }
        });
        assert_eq!(names, ["A", "B"]);
    }

    #[test]
    // req:cli-language-server-006
    fn import_frame_location_indexes_paths_names_and_fallbacks() {
        let source = [
            "import \"./a.uff\" A;",
            "import   \"./b.uff\" B;",
            "",
            "export X;",
            "rule X = A B;",
        ]
        .join("\n");
        let (tree, _) = parse(&source);

        let b_path = import_frame_location(&tree, &source, 1, "./b.uff", None).expect("b path");
        assert_eq!(b_path.line, 1);
        assert_eq!(
            &source[b_path.offset..b_path.end_offset.unwrap()],
            "./b.uff"
        );

        let a_fallback =
            import_frame_location(&tree, &source, 7, "./a.uff", None).expect("a fallback");
        assert_eq!(a_fallback.line, 0);
        assert_eq!(
            &source[a_fallback.offset..a_fallback.end_offset.unwrap()],
            "./a.uff"
        );

        let named = import_frame_location(&tree, &source, 1, "./b.uff", Some("B")).expect("name");
        assert_eq!(named.line, 1);
        assert_eq!(&source[named.offset..named.end_offset.unwrap()], "B");

        let missing_name =
            import_frame_location(&tree, &source, 0, "./a.uff", Some("Missing")).expect("path");
        assert_eq!(
            &source[missing_name.offset..missing_name.end_offset.unwrap()],
            "./a.uff"
        );

        assert!(import_frame_location(&tree, &source, 0, "./c.uff", None).is_none());
    }

    #[test]
    // req:cli-language-server-006
    fn name_reference_kinds_and_documentation_are_read_from_metadata() {
        let (tree, _) = parse("[Documentation \"hi\"]\nrule Main = Other;\nrule Other = any;\n");
        let mut kinds = Vec::new();
        walk_accepted(&tree, |node, _| {
            if is_success(node) && has_editor_metadata(node, EditorDecorator::NameReference) {
                kinds.push(name_reference_kinds(node));
            }
        });
        assert!(
            kinds
                .iter()
                .any(|kinds| kinds.as_deref() == Some(&["rule".to_string()][..])),
            "{kinds:?}"
        );
        let doc = documentation_of(&serde_json::json!({
            "Documentation": { "description": "d", "parameters": { "p": "x", "q": 1 } }
        }))
        .unwrap();
        assert_eq!(doc.description, "d");
        assert_eq!(doc.parameters, [("p".to_string(), "x".to_string())]);
        assert!(documentation_of(&serde_json::json!({})).is_none());
    }

    #[test]
    // req:cli-language-server-006
    fn walks_visit_each_shared_node_once() {
        let (tree, _) = parse("export Main;\nrule Main = any;\n");
        let mut seen = HashSet::new();
        walk_annotatable(&tree, |node, _| {
            assert!(seen.insert(node_id(node)), "node visited twice");
        });
        assert!(seen.len() > 1);
    }
}
