//! `textDocument/hover` (requirement 006): resolve the identifier at the
//! requested position against the document's own parse tree (local bindings),
//! the session's `describe` (the same structural introspection MCP exposes),
//! and the runtime globals, rather than a separately maintained documentation
//! source. Read-only over resolved state.

use super::definition::{is_uff_file_url, locate_declaration_source};
use super::document::{DocumentAnalysis, DocumentStore, Identifier};
use super::editor::{
    Documentation, EditorDecorator, documentation_of, has_editor_metadata, is_success, node_text,
    slice_text, walk_accepted,
};
use super::locals::{LocalBinding, identifier_position, local_binding_at};
use super::positions::range_json;
use crate::mcp::sessions::Session;
use serde_json::{Value, json};
use url::Url;

/// Longest declaration source shown in a hover before it is truncated.
const MAX_SOURCE_LINES: usize = 20;

fn truncate_lines(text: &str, max: usize) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    if lines.len() <= max {
        return text.to_string();
    }
    let mut kept: Vec<&str> = lines[..max].to_vec();
    kept.push("  …");
    kept.join("\n")
}

fn inspect_value(value: &Value) -> String {
    let text = value.to_string();
    if text.chars().count() > 160 {
        let cut: String = text.chars().take(157).collect();
        format!("{cut}...")
    } else {
        text
    }
}

/// The value a literal expression AST denotes, when it is one (a string,
/// number, boolean, array, or object of literals).
fn literal_value(expression: &Value) -> Option<Value> {
    match expression.get("kind")?.as_str()? {
        "string" => {
            let values = expression.get("values")?.as_array()?;
            let mut text = String::new();
            for value in values {
                text.push_str(value.as_str()?);
            }
            Some(Value::String(text))
        }
        "number" | "boolean" => expression.get("value").cloned(),
        "array" => {
            let mut items = Vec::new();
            for element in expression.get("expressions")?.as_array()? {
                items.push(literal_value(element.get("expression")?)?);
            }
            Some(Value::Array(items))
        }
        "object" => {
            let mut object = serde_json::Map::new();
            for key in expression.get("keys")?.as_array()? {
                object.insert(
                    key.get("name")?.as_str()?.to_string(),
                    literal_value(key.get("expression")?)?,
                );
            }
            Some(Value::Object(object))
        }
        _ => None,
    }
}

fn attribute_text(attribute: &Value) -> String {
    let decorator = attribute["decorator"].as_str().unwrap_or("");
    let args: Vec<String> = attribute["args"]
        .as_array()
        .map(|args| {
            args.iter()
                .map(|arg| inspect_value(&literal_value(arg).unwrap_or_else(|| arg.clone())))
                .collect()
        })
        .unwrap_or_default();
    if args.is_empty() {
        decorator.to_string()
    } else {
        format!("{decorator}({})", args.join(", "))
    }
}

/// Whether an attribute's metadata is something other than its sole argument
/// (a decorator computing a value, e.g. `[Keyword]` → `{ role: "keyword" }`).
fn has_computed_metadata(attribute: &Value, metadata: &Value) -> bool {
    let decorator = attribute["decorator"].as_str().unwrap_or("");
    let Some(value) = metadata.get(decorator) else {
        return false;
    };
    let args = attribute["args"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    args.len() != 1 || literal_value(&args[0]).as_ref() != Some(value)
}

fn parameter_docs(documentation: Option<&Documentation>) -> String {
    documentation
        .map(|documentation| {
            documentation
                .parameters
                .iter()
                .map(|(name, description)| format!("- `{name}` — {description}"))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn value_source_text(source: &Value) -> String {
    match source.get("kind").and_then(Value::as_str) {
        Some("variable") => format!("${}", source["name"].as_str().unwrap_or("")),
        _ => inspect_value(source.get("value").unwrap_or(&Value::Null)),
    }
}

fn short_pattern(pattern: &Value) -> String {
    let kind = pattern["kind"].as_str().unwrap_or("?");
    match kind {
        "resolve" => match pattern["name"].as_str() {
            Some(name) if !name.is_empty() => format!("resolve {name}"),
            _ => format!("resolve {}", pattern["targetKind"].as_str().unwrap_or("")),
        },
        "equal" => format!("equal {}", value_source_text(&pattern["value"])),
        "character" => format!(
            "character {}",
            pattern["characterClass"].as_str().unwrap_or("")
        ),
        "type" => format!("type {}", pattern["type"].as_str().unwrap_or("")),
        _ => kind.to_string(),
    }
}

/// Compact description of a pattern AST.
pub fn describe_pattern(pattern: &Value) -> String {
    match pattern["kind"].as_str() {
        Some("variable") => format!(
            "{}: {}",
            pattern["name"].as_str().unwrap_or(""),
            short_pattern(&pattern["pattern"])
        ),
        Some("into") => format!("into -> {}", short_pattern(&pattern["pattern"])),
        Some("regexp") => format!("regexp {}", pattern["pattern"].as_str().unwrap_or("")),
        _ => short_pattern(pattern),
    }
}

/// Formats a described declaration (`Session::describe`'s `declaration`) as
/// Markdown. Its `[Documentation]` description leads and its parameter
/// descriptions follow. With `source_text` (the declaration as authored,
/// attributes included) the source is shown verbatim and only decorator-computed
/// metadata not visible in it is listed; without it, the pattern, parameters,
/// and attributes are summarized instead.
pub fn format_described_declaration_markdown(
    declaration: &Value,
    source_text: Option<&str>,
) -> String {
    let export_tag = if declaration["exported"].as_bool() == Some(true) {
        "exported "
    } else {
        ""
    };
    let name = declaration["name"].as_str().unwrap_or("");
    let kind = declaration["kind"].as_str().unwrap_or("");
    let mut sections = vec![format!("({export_tag}{kind}) `{name}`")];
    let metadata = &declaration["metadata"];
    let documentation = documentation_of(metadata);
    if let Some(documentation) = &documentation {
        sections.push(documentation.description.clone());
    }
    let attributes: Vec<&Value> = declaration["attributes"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|attribute| attribute["decorator"] != "Documentation")
                .collect()
        })
        .unwrap_or_default();

    if let Some(source_text) = source_text {
        sections.push(format!(
            "```uffda\n{}\n```",
            truncate_lines(source_text, MAX_SOURCE_LINES)
        ));
        let computed: Vec<String> = attributes
            .iter()
            .filter(|attribute| has_computed_metadata(attribute, metadata))
            .map(|attribute| {
                let decorator = attribute["decorator"].as_str().unwrap_or("");
                format!(
                    "- `{}` → `{}`",
                    attribute_text(attribute),
                    inspect_value(&metadata[decorator])
                )
            })
            .collect();
        if !computed.is_empty() {
            sections.push(computed.join("\n"));
        }
        let parameters = parameter_docs(documentation.as_ref());
        if !parameters.is_empty() {
            sections.push(parameters);
        }
        return sections.join("\n\n");
    }

    sections.push(format!(
        "**pattern:** `{}`",
        describe_pattern(&declaration["pattern"])
    ));
    let parameters = parameter_docs(documentation.as_ref());
    if !parameters.is_empty() {
        sections.push("**parameters:**".to_string());
        sections.push(parameters);
    } else if let Some(listed) = declaration["parameters"].as_array()
        && !listed.is_empty()
    {
        let names: Vec<String> = listed
            .iter()
            .filter_map(|parameter| parameter["name"].as_str())
            .map(|name| format!("`{name}`"))
            .collect();
        sections.push(format!("**parameters:** {}", names.join(", ")));
    }
    if !attributes.is_empty() {
        sections.push("**attributes:**".to_string());
        sections.push(
            attributes
                .iter()
                .map(|attribute| {
                    let decorator = attribute["decorator"].as_str().unwrap_or("");
                    let computed = if has_computed_metadata(attribute, metadata) {
                        format!(" → `{}`", inspect_value(&metadata[decorator]))
                    } else {
                        String::new()
                    };
                    format!("- `{}`{computed}", attribute_text(attribute))
                })
                .collect::<Vec<_>>()
                .join("\n"),
        );
    }
    sections.join("\n\n")
}

/// Formats a local binding as hover Markdown, with the enclosing declaration's
/// `[Documentation]` of that parameter when given.
pub fn format_local_binding_markdown(
    binding: &LocalBinding,
    units: &[u16],
    parameter_description: Option<&str>,
) -> String {
    let mut sections: Vec<String> = Vec::new();
    match binding {
        LocalBinding::Parameter {
            name,
            declaration_name,
        } => sections.push(format!(
            "(parameter) `{name}`{}",
            declaration_name
                .as_ref()
                .map(|rule| format!(" of rule `{rule}`"))
                .unwrap_or_default()
        )),
        LocalBinding::Variable {
            name, start, end, ..
        } => {
            sections.push(format!("(variable) `{name}`"));
            sections.push(format!(
                "```uffda\n{}\n```",
                truncate_lines(&slice_text(units, *start, *end), MAX_SOURCE_LINES)
            ));
        }
    }
    if let Some(description) = parameter_description {
        sections.push(description.to_string());
    }
    sections.join("\n\n")
}

/// Formats a runtime global as hover Markdown: signature and description from
/// the metadata the global carries (same text Deno `defineMetadata` attaches).
pub fn format_global_markdown(name: &str) -> String {
    let Some(global) = crate::globals::lookup(name) else {
        return format!("(global func) `{name}`");
    };
    let metadata = global.metadata();
    [
        format!("(global func) `{name}`"),
        format!("```uffda\n{}\n```", global.format_signature()),
        metadata.description.to_string(),
    ]
    .join("\n\n")
}

/// The Markdown for the identifier `ident` in `doc`, resolved in the order
/// references resolve: a local binding, then a declared rule/func/decorator,
/// then (where a func may be named) a runtime global.
pub fn hover_markdown(
    session: &mut Session,
    store: &mut DocumentStore,
    doc: &DocumentAnalysis,
    module_url: &Url,
    ident: &Identifier,
) -> Option<String> {
    let tree = doc.tree.as_ref()?;
    let position = identifier_position(tree, ident.start, ident.end);
    if let Some(local) = local_binding_at(&position, &ident.name) {
        let description = local
            .declaration_name()
            .and_then(|declaration| {
                let described = session.describe(declaration, Some(module_url.as_str()));
                documentation_of(&described["declaration"]["metadata"])
            })
            .and_then(|documentation| documentation.parameter(&ident.name).map(str::to_string));
        return Some(format_local_binding_markdown(
            &local,
            &doc.units,
            description.as_deref(),
        ));
    }

    if let Some(resolved) = session.resolve_declaration(&ident.name, module_url) {
        let described = session.describe(&ident.name, Some(resolved.defining_module_url.as_str()));
        if described["ok"].as_bool() == Some(true) {
            let source_text = locate_declaration_source(
                session,
                store,
                &resolved.defining_module_url,
                &ident.name,
            )
            .map(|located| slice_text(&located.document.units, located.start, located.end));
            return Some(format_described_declaration_markdown(
                &described["declaration"],
                source_text.as_deref(),
            ));
        }
    }

    if position.accepts_kind("func")
        && crate::globals::GLOBALS
            .iter()
            .any(|(name, _)| *name == ident.name)
    {
        return Some(format_global_markdown(&ident.name));
    }
    None
}

/// A `[ModulePath]` covering `offset`: the authored specifier and its span.
/// Prefers the innermost (shortest) covering path when several nest.
fn module_path_at(doc: &DocumentAnalysis, offset: usize) -> Option<(String, usize, usize)> {
    let tree = doc.tree.as_ref()?;
    let mut best: Option<(String, usize, usize)> = None;
    walk_accepted(tree, |node, _| {
        if !is_success(node) || !has_editor_metadata(node, EditorDecorator::ModulePath) {
            return;
        }
        let covers = if node.start == node.end {
            offset == node.start
        } else {
            offset >= node.start && offset < node.end
        };
        if !covers {
            return;
        }
        let length = node.end.saturating_sub(node.start);
        let replace = best
            .as_ref()
            .is_none_or(|(_, start, end)| length <= end.saturating_sub(*start));
        if replace {
            best = Some((node_text(node, &doc.units), node.start, node.end));
        }
    });
    best
}

/// Markdown describing the module `path` resolves to from `module_url`.
pub fn format_module_path_markdown(
    session: &mut Session,
    module_url: &Url,
    path: &str,
) -> Option<String> {
    let resolved = module_url.join(path).ok()?;
    let mut sections = vec![format!("(module) `{resolved}`")];
    if resolved.scheme() == "file"
        && let Ok(file) = resolved.to_file_path()
    {
        sections.push(format!("**path:** `{}`", file.display()));
    }

    let exports: Vec<(String, String)> = if is_uff_file_url(&resolved) {
        if let Some(listed) = session.list_exports(&resolved) {
            listed
                .into_iter()
                .map(|export| (export.name, export.kind.to_string()))
                .collect()
        } else if let Ok(file) = resolved.to_file_path()
            && let Ok(source) = std::fs::read_to_string(file)
            && let Some(listed) = session.exports_from_source(&source)
        {
            listed
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    if exports.is_empty() {
        if is_uff_file_url(&resolved) {
            sections.push("*No exports known for this module.*".to_string());
        }
    } else {
        sections.push("**exports:**".to_string());
        sections.push(
            exports
                .into_iter()
                .map(|(name, kind)| format!("- `{name}` ({kind})"))
                .collect::<Vec<_>>()
                .join("\n"),
        );
    }
    Some(sections.join("\n\n"))
}

/// The LSP `Hover` for `offset` in `doc`, or `None` when there is no
/// identifier or module path, nothing describes it, or the document has not
/// resolved enough state yet. Never errors for those cases.
pub fn hover_at(
    session: &mut Session,
    store: &mut DocumentStore,
    doc: &DocumentAnalysis,
    module_url: &Url,
    offset: usize,
) -> Option<Value> {
    if let Some(ident) = doc.identifier_at(offset)
        && let Some(value) = hover_markdown(session, store, doc, module_url, &ident)
    {
        return Some(json!({
            "contents": { "kind": "markdown", "value": value },
            "range": range_json(&doc.units, ident.start, ident.end),
        }));
    }
    let (path, start, end) = module_path_at(doc, offset)?;
    let value = format_module_path_markdown(session, module_url, &path)?;
    Some(json!({
        "contents": { "kind": "markdown", "value": value },
        "range": range_json(&doc.units, start, end),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::sessions::SessionManager;

    struct Fixture {
        manager: SessionManager,
        session_id: String,
        store: DocumentStore,
        module_url: Url,
    }

    impl Fixture {
        fn new(source: &str) -> (Self, std::rc::Rc<DocumentAnalysis>) {
            let dir = std::env::temp_dir().join("uffda-lsp-hover");
            let _ = std::fs::create_dir_all(&dir);
            let path = dir.join(format!("hover-{}.uff", source.len()));
            let mut manager = SessionManager::new();
            let session_id = manager.open(dir, None).ok().unwrap().id.clone();
            let module_url = Url::from_file_path(&path).unwrap();
            let session = manager.get_mut(&session_id).ok().unwrap();
            let loaded = session.load(source, Some(&path.to_string_lossy()));
            assert_eq!(loaded["ok"], true, "{loaded}");
            let doc = std::rc::Rc::new(
                DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), source)
                    .unwrap(),
            );
            let mut store = DocumentStore::default();
            store.set_open(std::rc::Rc::clone(&doc));
            (
                Self {
                    manager,
                    session_id,
                    store,
                    module_url,
                },
                doc,
            )
        }

        fn hover(&mut self, doc: &DocumentAnalysis, offset: usize) -> Option<Value> {
            let session = self.manager.get_mut(&self.session_id).ok().unwrap();
            hover_at(session, &mut self.store, doc, &self.module_url, offset)
        }
    }

    fn markdown(hover: &Value) -> String {
        hover["contents"]["value"].as_str().unwrap().to_string()
    }

    #[test]
    // req:cli-language-server-006
    fn hover_describes_a_declaration_with_its_source() {
        let source = "export Main;\nrule Main = Other;\nrule Other = any;\n";
        let (mut fixture, doc) = Fixture::new(source);
        let at = source.find("Other").unwrap() + 1;
        let hover = fixture.hover(&doc, at).expect("hover");
        let text = markdown(&hover);
        assert!(text.contains("(rule) `Other`"), "{text}");
        assert!(text.contains("rule Other = any;"), "{text}");
        let start = &hover["range"]["start"];
        assert_eq!(
            (start["line"].as_u64(), start["character"].as_u64()),
            (Some(1), Some(12))
        );

        let main = fixture
            .hover(&doc, source.find("Main").unwrap() + 1)
            .unwrap();
        assert!(markdown(&main).starts_with("(exported rule) `Main`"));
    }

    #[test]
    // req:cli-language-server-006
    fn hover_shows_locals_before_declarations_and_globals_last() {
        let source = "export Main;\nrule Main<P> = x:Other P -> (add x 1);\nrule Other = any;\nfunc add<a:any b:any> = a;\n";
        let (mut fixture, doc) = Fixture::new(source);

        let variable = fixture
            .hover(&doc, source.rfind("x 1").unwrap())
            .expect("variable hover");
        let text = markdown(&variable);
        assert!(text.starts_with("(variable) `x`"), "{text}");
        assert!(text.contains("x:Other"), "{text}");

        let parameter = fixture
            .hover(&doc, source.find("P ->").unwrap())
            .expect("parameter hover");
        assert!(markdown(&parameter).starts_with("(parameter) `P` of rule `Main`"));

        // A declared func shadows the same-named runtime global.
        let add = fixture
            .hover(&doc, source.find("(add").unwrap() + 1)
            .unwrap();
        assert!(
            markdown(&add).starts_with("(func) `add`"),
            "{}",
            markdown(&add)
        );
    }

    #[test]
    // req:cli-language-server-006
    fn hover_reports_runtime_globals_and_nothing_for_keywords() {
        let source = "export F;\nfunc F<a:any> = (length (pack a));\n";
        let (mut fixture, doc) = Fixture::new(source);
        let global = fixture
            .hover(&doc, source.find("length").unwrap() + 1)
            .expect("global hover");
        let text = markdown(&global);
        assert!(text.starts_with("(global func) `length`"), "{text}");
        assert!(text.contains("(length value)"), "{text}");
        assert!(
            text.contains("The length of a string, array, Set, or Map."),
            "{text}"
        );
        let pack = fixture
            .hover(&doc, source.find("pack").unwrap() + 1)
            .expect("pack hover");
        let pack_text = markdown(&pack);
        assert!(pack_text.starts_with("(global func) `pack`"), "{pack_text}");
        assert!(pack_text.contains("(pack ...values)"), "{pack_text}");
        assert!(
            pack_text.contains("Collects its arguments into an array."),
            "{pack_text}"
        );
        // Keywords and whitespace describe nothing.
        assert!(
            fixture
                .hover(&doc, source.find("func").unwrap() + 1)
                .is_none()
        );
        assert!(
            fixture
                .hover(&doc, source.find("= (").unwrap() + 1)
                .is_none()
        );
    }

    #[test]
    // req:cli-language-server-006
    fn hover_without_a_parse_tree_returns_nothing() {
        let (mut fixture, doc) = Fixture::new("export Main;\nrule Main = any;\n");
        let mut bare = DocumentAnalysis::parse(
            &mut fixture
                .manager
                .get_mut(&fixture.session_id)
                .ok()
                .unwrap()
                .languages,
            doc.uri.as_str(),
            &doc.source,
        )
        .unwrap();
        bare.tree = None;
        assert!(fixture.hover(&bare, 17).is_none());
    }

    #[test]
    // req:cli-language-server-006
    fn hover_on_module_path_lists_resolved_url_and_exports() {
        let dir =
            std::env::temp_dir().join(format!("uffda-lsp-hover-import-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let dep = dir.join("dep.uff");
        let main = dir.join("main.uff");
        std::fs::write(
            &dep,
            "export Foo;\nexport Bar;\nrule Foo = any;\nfunc Bar<a:any> = a;\n",
        )
        .unwrap();
        let source = "import \"./dep.uff\" Foo;\nexport Main;\nrule Main = Foo;\n";
        std::fs::write(&main, source).unwrap();

        let mut manager = SessionManager::new();
        let session_id = manager.open(dir.clone(), None).ok().unwrap().id.clone();
        let module_url = Url::from_file_path(&main).unwrap();
        let session = manager.get_mut(&session_id).ok().unwrap();
        assert_eq!(
            session.load(
                &std::fs::read_to_string(&dep).unwrap(),
                Some(&dep.to_string_lossy())
            )["ok"],
            true
        );
        assert_eq!(
            session.load(source, Some(&main.to_string_lossy()))["ok"],
            true
        );
        let doc = std::rc::Rc::new(
            DocumentAnalysis::parse(&mut session.languages, module_url.as_str(), source).unwrap(),
        );
        let mut store = DocumentStore::default();
        store.set_open(std::rc::Rc::clone(&doc));
        let mut fixture = Fixture {
            manager,
            session_id,
            store,
            module_url,
        };

        let at = source.find("dep.uff").unwrap() + 1;
        let hover = fixture.hover(&doc, at).expect("module path hover");
        let text = markdown(&hover);
        assert!(text.starts_with("(module) `"), "{text}");
        assert!(text.contains("dep.uff"), "{text}");
        assert!(text.contains("**path:**"), "{text}");
        assert!(text.contains("`Foo` (rule)"), "{text}");
        assert!(text.contains("`Bar` (func)"), "{text}");
        let range = &hover["range"];
        assert!(
            range["start"]["character"].as_u64().unwrap()
                <= source.find("./dep.uff").unwrap() as u64
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    // req:cli-language-server-006
    fn declaration_markdown_prefers_documentation_and_lists_computed_metadata() {
        let declaration = json!({
            "kind": "rule",
            "name": "Kw",
            "exported": false,
            "attributes": [
                { "decorator": "Documentation", "args": [] },
                { "decorator": "Keyword", "args": [] },
                { "decorator": "Highlight", "args": [{
                    "kind": "object",
                    "keys": [{ "kind": "objectKey", "name": "role",
                        "expression": { "kind": "string", "values": ["x"] } }]
                }] }
            ],
            "metadata": {
                "Documentation": { "description": "A word.", "parameters": { "P": "the p" } },
                "Keyword": { "role": "keyword" },
                "Highlight": { "role": "x" }
            },
            "pattern": { "kind": "any" }
        });
        let with_source =
            format_described_declaration_markdown(&declaration, Some("rule Kw = any;"));
        assert!(with_source.contains("A word."), "{with_source}");
        assert!(with_source.contains("rule Kw = any;"), "{with_source}");
        assert!(
            with_source.contains("`Keyword` → `{\"role\":\"keyword\"}`"),
            "{with_source}"
        );
        // An attribute whose metadata is its own argument is not repeated.
        assert!(!with_source.contains("`Highlight("), "{with_source}");
        assert!(with_source.contains("- `P` — the p"), "{with_source}");
        let summary = format_described_declaration_markdown(&declaration, None);
        assert!(summary.contains("**pattern:** `any`"), "{summary}");
        assert!(summary.contains("**attributes:**"), "{summary}");
    }

    #[test]
    // req:cli-language-server-006 req:runtime-core-006
    fn describe_pattern_names_equals_resolves_and_variable_wrappers() {
        assert_eq!(
            describe_pattern(&json!({
                "kind": "equal",
                "value": {"kind": "literal", "value": ":"}
            })),
            "equal \":\""
        );
        assert_eq!(
            describe_pattern(&json!({
                "kind": "resolve",
                "targetKind": "reference",
                "name": "RuleParameterList",
                "args": []
            })),
            "resolve RuleParameterList"
        );
        assert_eq!(
            describe_pattern(&json!({
                "kind": "variable",
                "name": "t",
                "pattern": {
                    "kind": "resolve",
                    "targetKind": "reference",
                    "name": "ImportModuleSpecifier",
                    "args": []
                }
            })),
            "t: resolve ImportModuleSpecifier"
        );
        // Resolve names belong in describe_pattern / the rule stack, not as a
        // bare expected value: short_pattern still names the target.
        assert_eq!(
            short_pattern(&json!({
                "kind": "resolve",
                "targetKind": "reference",
                "name": "ImportModuleSpecifier",
                "args": []
            })),
            "resolve ImportModuleSpecifier"
        );
        assert_eq!(
            value_source_text(&json!({"kind": "literal", "value": ";"})),
            "\";\""
        );
    }
}
