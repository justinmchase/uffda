//! Name occurrences for find-references and rename (requirement 006): every
//! name in a document paired with the symbol it denotes, found through the
//! parse tree's editor metadata (`[Declaration]`, `[Parameter]`,
//! `[NameReference]`, `[Import]`, `[ModulePath]`, `[ImportedName]`) the same
//! way hover resolves names, never through grammar rule names.

use super::document::DocumentAnalysis;
use super::editor::{
    EditorDecorator, Node, declared_name, find_annotated, has_editor_metadata, is_success,
    node_text, walk_accepted,
};
use super::locals::{
    IdentifierPosition, LocalBinding, LocalScopeMemo, identifier_positions, local_bindings_at,
};
use std::collections::{HashMap, HashSet};
use url::Url;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NameSymbol {
    /// Identifies a binding within its document.
    Local {
        key: String,
    },
    /// A rule/func/decorator in the module declaring it (imports resolve to
    /// their target module).
    Declaration {
        module_url: String,
        name: String,
    },
    Global {
        name: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NameOccurrence {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub symbol: NameSymbol,
    /// Whether this occurrence declares or binds the symbol.
    pub declaration: bool,
}

struct ModuleScope {
    /// Names the document declares, each with its `[Declaration]` node.
    declared: HashMap<String, Node>,
    /// Imported names mapped to the module URL their import resolves to.
    imported: HashMap<String, String>,
}

/// The document's declarations and imports. An import's module path resolves
/// against `module_url` the way the runtime resolver resolves it.
fn module_scope(doc: &DocumentAnalysis, tree: &Node, module_url: &str) -> ModuleScope {
    let mut scope = ModuleScope {
        declared: HashMap::new(),
        imported: HashMap::new(),
    };
    let base = Url::parse(module_url).ok();
    let mut imports: Vec<Node> = Vec::new();
    walk_accepted(tree, |node, _| {
        if !is_success(node) {
            return;
        }
        if has_editor_metadata(node, EditorDecorator::Declaration)
            && let Some(name) = declared_name(node)
        {
            scope
                .declared
                .entry(name)
                .or_insert_with(|| std::rc::Rc::clone(node));
        }
        if has_editor_metadata(node, EditorDecorator::Import) {
            imports.push(std::rc::Rc::clone(node));
        }
    });
    for import in imports {
        let Some(path) = find_annotated(&import, EditorDecorator::ModulePath, |_| true) else {
            continue;
        };
        let Some(target) = base
            .as_ref()
            .and_then(|base| base.join(&node_text(&path, &doc.units)).ok())
        else {
            continue;
        };
        let target = target.to_string();
        walk_accepted(&import, |inner, _| {
            if is_success(inner) && has_editor_metadata(inner, EditorDecorator::ImportedName) {
                scope
                    .imported
                    .insert(node_text(inner, &doc.units), target.clone());
            }
        });
    }
    scope
}

fn covers(node: &Node, start: usize, end: usize) -> bool {
    node.start <= start && node.end >= end
}

/// Every name occurrence in `doc` (optionally only those spelled `name`) with
/// the symbol it denotes: declaring names, imported names, rule parameters,
/// variable binding sites, and references, resolved as references resolve (a
/// local binding, then a declared or imported name, then, where a func may be
/// named, a runtime global in `globals`). Names that denote nothing (object
/// keys, member names, unresolved references) are omitted.
pub fn name_occurrences(
    doc: &DocumentAnalysis,
    globals: &HashSet<String>,
    name: Option<&str>,
) -> Vec<NameOccurrence> {
    let Some(tree) = doc.tree.as_ref() else {
        return Vec::new();
    };
    let spans: Vec<_> = doc
        .spans
        .iter()
        .filter(|span| {
            crate::highlight::is_name_role(&span.role)
                && span.role != "property"
                && name.is_none_or(|name| span.text == name)
        })
        .collect();
    if spans.is_empty() {
        return Vec::new();
    }
    let scope = module_scope(doc, tree, &doc.module_url);
    let bounds: Vec<(usize, usize)> = spans
        .iter()
        .map(|span| (span.offset, span.offset + span.length))
        .collect();
    let positions = identifier_positions(tree, &bounds);
    let mut memo = LocalScopeMemo::default();
    let mut claimed: HashSet<usize> = HashSet::new();
    let mut occurrences = Vec::new();
    for (span, position) in spans.iter().zip(positions.iter()) {
        let (start, end) = (span.offset, span.offset + span.length);
        if let Some((symbol, declaration)) = resolve_occurrence(
            &doc.module_url,
            &span.text,
            start,
            end,
            position,
            &scope,
            globals,
            &mut memo,
            &mut claimed,
        ) {
            occurrences.push(NameOccurrence {
                start,
                end,
                name: span.text.clone(),
                symbol,
                declaration,
            });
        }
    }
    occurrences
}

#[allow(clippy::too_many_arguments)]
fn resolve_occurrence(
    module_url: &str,
    text: &str,
    start: usize,
    end: usize,
    position: &IdentifierPosition,
    scope: &ModuleScope,
    globals: &HashSet<String>,
    memo: &mut LocalScopeMemo,
    claimed: &mut HashSet<usize>,
) -> Option<(NameSymbol, bool)> {
    if position.annotated(EditorDecorator::ImportedName).is_some() {
        let target = scope.imported.get(text)?;
        return Some((
            NameSymbol::Declaration {
                module_url: target.clone(),
                name: text.to_string(),
            },
            false,
        ));
    }

    if position.reference.is_none() {
        if let Some(declaring) = scope.declared.get(text) {
            let id = super::editor::node_id(declaring);
            if !claimed.contains(&id) && covers(declaring, start, end) {
                claimed.insert(id);
                return Some((
                    NameSymbol::Declaration {
                        module_url: module_url.to_string(),
                        name: text.to_string(),
                    },
                    true,
                ));
            }
        }
        let parameter = position.annotated(EditorDecorator::Parameter).is_some();
        let binding = local_bindings_at(position, Some(memo))
            .into_iter()
            .find(|binding| {
                binding.name() == text
                    && match binding {
                        LocalBinding::Parameter { .. } => parameter,
                        LocalBinding::Variable { start: bound, .. } => *bound == start,
                    }
            })?;
        return Some((
            NameSymbol::Local {
                key: local_key(module_url, &binding),
            },
            true,
        ));
    }

    if let Some(local) = local_bindings_at(position, Some(memo))
        .into_iter()
        .find(|binding| binding.name() == text)
    {
        return Some((
            NameSymbol::Local {
                key: local_key(module_url, &local),
            },
            false,
        ));
    }
    if scope.declared.contains_key(text) {
        return Some((
            NameSymbol::Declaration {
                module_url: module_url.to_string(),
                name: text.to_string(),
            },
            false,
        ));
    }
    if let Some(target) = scope.imported.get(text) {
        return Some((
            NameSymbol::Declaration {
                module_url: target.clone(),
                name: text.to_string(),
            },
            false,
        ));
    }
    if globals.contains(text) && position.accepts_kind("func") {
        return Some((
            NameSymbol::Global {
                name: text.to_string(),
            },
            false,
        ));
    }
    None
}

fn local_key(module_url: &str, binding: &LocalBinding) -> String {
    match binding {
        LocalBinding::Parameter {
            name,
            declaration_name,
        } => format!(
            "{module_url}#parameter:{}:{name}",
            declaration_name.as_deref().unwrap_or("")
        ),
        LocalBinding::Variable { start, .. } => format!("{module_url}#variable:{start}"),
    }
}

/// The names of the runtime globals every module sees.
pub fn global_names() -> HashSet<String> {
    crate::globals::GLOBALS
        .iter()
        .map(|(name, _)| (*name).to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::Languages;

    fn doc(source: &str) -> DocumentAnalysis {
        let mut languages = Languages::new().unwrap();
        DocumentAnalysis::parse(&mut languages, "file:///tmp/symbols.uff", source).unwrap()
    }

    fn texts<'a>(source: &'a str, occurrences: &[NameOccurrence]) -> Vec<(&'a str, bool)> {
        occurrences
            .iter()
            .map(|o| (&source[o.start..o.end], o.declaration))
            .collect()
    }

    #[test]
    // req:cli-language-server-006
    fn declarations_references_and_exports_share_one_symbol() {
        let source = "export Main;\nrule Main = Other Other;\nrule Other = any;\n";
        let doc = doc(source);
        let found = name_occurrences(&doc, &global_names(), Some("Other"));
        let symbol = NameSymbol::Declaration {
            module_url: "file:///tmp/symbols.uff".into(),
            name: "Other".into(),
        };
        assert_eq!(found.len(), 3, "{found:?}");
        assert!(found.iter().all(|o| o.symbol == symbol));
        assert_eq!(found.iter().filter(|o| o.declaration).count(), 1);
        let main = name_occurrences(&doc, &global_names(), Some("Main"));
        // Export-list reference and declaration.
        assert_eq!(texts(source, &main).len(), 2, "{main:?}");
        assert_eq!(main.iter().filter(|o| o.declaration).count(), 1);
    }

    #[test]
    // req:cli-language-server-006
    fn locals_are_distinct_symbols_and_globals_are_recognized() {
        let source = "func F<a:any> = (add a 1);\nfunc G<a:any> = (add a 2);\n";
        let doc = doc(source);
        let found = name_occurrences(&doc, &global_names(), Some("a"));
        let keys: HashSet<_> = found
            .iter()
            .filter_map(|o| match &o.symbol {
                NameSymbol::Local { key } => Some(key.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(keys.len(), 2, "{found:?}");
        let add = name_occurrences(&doc, &global_names(), Some("add"));
        assert_eq!(add.len(), 2);
        assert!(
            add.iter()
                .all(|o| o.symbol == NameSymbol::Global { name: "add".into() } && !o.declaration)
        );
    }

    #[test]
    // req:cli-language-server-006
    fn imported_names_resolve_to_their_target_module() {
        let source = "import \"./other.uff\" Thing;\nexport Main;\nrule Main = Thing;\n";
        let doc = doc(source);
        let found = name_occurrences(&doc, &global_names(), Some("Thing"));
        assert_eq!(found.len(), 2, "{found:?}");
        for occurrence in &found {
            assert_eq!(
                occurrence.symbol,
                NameSymbol::Declaration {
                    module_url: "file:///tmp/other.uff".into(),
                    name: "Thing".into()
                }
            );
            assert!(!occurrence.declaration);
        }
    }
}
