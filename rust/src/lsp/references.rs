//! Find-references and rename (requirement 006): the occurrences of the symbol
//! under the cursor across the workspace, found per document by
//! [`name_occurrences`]. A local binding's occurrences are all in its
//! document; a declaration's are in its module and the modules importing it
//! (exports name only a module's own declarations, so nothing re-exports it);
//! a runtime global's are wherever it is referenced.
//!
//! Nothing here writes files: rename returns a workspace edit for the client
//! to apply.

use super::document::{DocumentAnalysis, DocumentStore};
use super::positions::range_json;
use super::symbols::{NameOccurrence, NameSymbol, name_occurrences};
use crate::highlight::is_name_role;
use crate::languages::Languages;
use serde_json::{Map, Value, json};
use std::collections::HashSet;
use std::path::Path;
use std::rc::Rc;
use url::Url;

/// A document and the occurrences of one symbol in it.
pub struct DocumentOccurrences {
    pub document: Rc<DocumentAnalysis>,
    pub occurrences: Vec<NameOccurrence>,
}

/// The occurrence at `offset` in `doc`, if a name there denotes one.
pub fn occurrence_at(
    doc: &DocumentAnalysis,
    offset: usize,
    globals: &HashSet<String>,
) -> Option<NameOccurrence> {
    name_occurrences(doc, globals, None)
        .into_iter()
        .find(|occurrence| offset >= occurrence.start && offset <= occurrence.end)
}

/// Where a local binding occurring at `occurrence` in `doc` is bound: its
/// declaring occurrence (a rule parameter, or a variable's binding site).
pub fn local_definition(
    doc: &DocumentAnalysis,
    occurrence: &NameOccurrence,
    globals: &HashSet<String>,
) -> Option<Value> {
    if !matches!(occurrence.symbol, NameSymbol::Local { .. }) {
        return None;
    }
    let binding = name_occurrences(doc, globals, Some(&occurrence.name))
        .into_iter()
        .find(|candidate| candidate.declaration && candidate.symbol == occurrence.symbol)?;
    Some(json!({
        "uri": doc.uri,
        "range": range_json(&doc.units, binding.start, binding.end),
    }))
}

/// Whether a document's text could mention `symbol`: it contains the name
/// and, for a declaration, is its module or contains the module's file name
/// (every import path resolving to that module ends with it).
fn may_mention(symbol: &NameSymbol, name: &str, module_url: &str, source: &str) -> bool {
    if !source.contains(name) {
        return false;
    }
    let NameSymbol::Declaration {
        module_url: declaring,
        ..
    } = symbol
    else {
        return true;
    };
    if module_url == declaring {
        return true;
    }
    let file_name = declaring.rsplit('/').next().unwrap_or(declaring);
    if source.contains(file_name) {
        return true;
    }
    let decoded = percent_decode(file_name);
    source.contains(&decoded)
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && let Some(hex) = text.get(index + 1..index + 3)
            && let Ok(byte) = u8::from_str_radix(hex, 16)
        {
            out.push(byte);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `.uff` files under `root` (recursively), skipping hidden directories and
/// `node_modules`.
fn uff_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut found = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_string_lossy();
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_dir() {
                if !name.starts_with('.') && name != "node_modules" {
                    pending.push(path);
                }
            } else if kind.is_file() && name.ends_with(".uff") {
                found.push(path);
            }
        }
    }
    found.sort();
    found
}

/// Every occurrence of `symbol` (spelled `name`), grouped by document:
/// `origin` alone for a local binding, otherwise every workspace document that
/// may mention it (open buffers first, then `.uff` files under `root`, each
/// parsed read-only).
#[allow(clippy::too_many_arguments)]
pub fn symbol_occurrences(
    languages: &mut Languages,
    store: &mut DocumentStore,
    symbol: &NameSymbol,
    name: &str,
    origin: &Rc<DocumentAnalysis>,
    root: &Path,
    globals: &HashSet<String>,
) -> Vec<DocumentOccurrences> {
    let in_document = |document: &Rc<DocumentAnalysis>| -> Vec<NameOccurrence> {
        name_occurrences(document, globals, Some(name))
            .into_iter()
            .filter(|occurrence| &occurrence.symbol == symbol)
            .collect()
    };
    if matches!(symbol, NameSymbol::Local { .. }) {
        return vec![DocumentOccurrences {
            document: Rc::clone(origin),
            occurrences: in_document(origin),
        }];
    }
    let mut found = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut candidates: Vec<Rc<DocumentAnalysis>> = store.open_documents();
    if !candidates
        .iter()
        .any(|document| document.module_url == origin.module_url)
    {
        candidates.insert(0, Rc::clone(origin));
    }
    for document in candidates {
        seen.insert(document.module_url.clone());
        if !may_mention(symbol, name, &document.module_url, &document.source) {
            continue;
        }
        let occurrences = in_document(&document);
        if !occurrences.is_empty() {
            found.push(DocumentOccurrences {
                document,
                occurrences,
            });
        }
    }
    for path in uff_files(root) {
        let Ok(url) = Url::from_file_path(&path) else {
            continue;
        };
        if seen.contains(url.as_str()) {
            continue;
        }
        let Ok(source) = std::fs::read_to_string(&path) else {
            continue;
        };
        if !may_mention(symbol, name, url.as_str(), &source) {
            continue;
        }
        let Some(document) = store.from_disk(languages, &url) else {
            continue;
        };
        let occurrences = in_document(&document);
        if !occurrences.is_empty() {
            found.push(DocumentOccurrences {
                document,
                occurrences,
            });
        }
    }
    found
}

/// LSP locations for `found`, optionally without declaring occurrences.
pub fn reference_locations(found: &[DocumentOccurrences], include_declaration: bool) -> Vec<Value> {
    let mut locations = Vec::new();
    for DocumentOccurrences {
        document,
        occurrences,
    } in found
    {
        for occurrence in occurrences {
            if include_declaration || !occurrence.declaration {
                locations.push(json!({
                    "uri": document.uri,
                    "range": range_json(&document.units, occurrence.start, occurrence.end),
                }));
            }
        }
    }
    locations
}

pub enum RenamePlan {
    Edit(Value),
    Refused(String),
}

/// Why `symbol` cannot be renamed at all, if it cannot.
pub fn rename_refusal(symbol: &NameSymbol) -> Option<String> {
    match symbol {
        NameSymbol::Global { name } => Some(format!(
            "`{name}` is a runtime global and cannot be renamed"
        )),
        _ => None,
    }
}

/// The workspace edit renaming every occurrence in `found` of `symbol` to
/// `new_name`. Refused when the symbol is a runtime global, when its declaring
/// module is not in the workspace, when `new_name` already names something in a
/// document the rename edits (so no reference changes what it denotes), or when
/// the grammar does not read `new_name` back as that same name at every edited
/// occurrence (for example a reserved word, or not a name at all).
pub fn plan_rename(
    languages: &mut Languages,
    symbol: &NameSymbol,
    found: &[DocumentOccurrences],
    new_name: &str,
    globals: &HashSet<String>,
) -> RenamePlan {
    if let Some(refusal) = rename_refusal(symbol) {
        return RenamePlan::Refused(refusal);
    }
    if let NameSymbol::Declaration { module_url, name } = symbol
        && !found
            .iter()
            .any(|entry| entry.occurrences.iter().any(|o| o.declaration))
    {
        return RenamePlan::Refused(format!(
            "`{name}` is declared in {module_url}, outside the workspace"
        ));
    }
    let new_units: Vec<u16> = new_name.encode_utf16().collect();
    let mut changes = Map::new();
    for DocumentOccurrences {
        document,
        occurrences,
    } in found
    {
        if !name_occurrences(document, globals, Some(new_name)).is_empty() {
            return RenamePlan::Refused(format!(
                "`{new_name}` already names something in {}",
                document.uri
            ));
        }
        let mut sorted: Vec<&NameOccurrence> = occurrences.iter().collect();
        sorted.sort_by_key(|occurrence| occurrence.start);
        let mut renamed: Vec<u16> = Vec::new();
        let mut cursor = 0usize;
        let mut renamed_spans = Vec::new();
        for occurrence in &sorted {
            renamed.extend_from_slice(&document.units[cursor..occurrence.start]);
            renamed_spans.push(renamed.len());
            renamed.extend_from_slice(&new_units);
            cursor = occurrence.end;
        }
        renamed.extend_from_slice(&document.units[cursor..]);
        let renamed = String::from_utf16_lossy(&renamed);
        if !reads_back_as_name(languages, document, &renamed, &renamed_spans, new_name) {
            return RenamePlan::Refused(format!("`{new_name}` is not a valid name here"));
        }
        let edits: Vec<Value> = sorted
            .iter()
            .map(|occurrence| {
                json!({
                    "range": range_json(&document.units, occurrence.start, occurrence.end),
                    "newText": new_name,
                })
            })
            .collect();
        changes.insert(document.uri.clone(), Value::Array(edits));
    }
    RenamePlan::Edit(json!({ "changes": changes }))
}

/// Whether `renamed` parses (at least as well as `document` did) with a name
/// token spelled `new_name` starting at each of `starts`.
fn reads_back_as_name(
    languages: &mut Languages,
    document: &DocumentAnalysis,
    renamed: &str,
    starts: &[usize],
    new_name: &str,
) -> bool {
    let Some(parsed) = DocumentAnalysis::parse(languages, &document.uri, renamed) else {
        return false;
    };
    if parsed.quality < document.quality {
        return false;
    }
    let names: HashSet<usize> = parsed
        .spans
        .iter()
        .filter(|span| is_name_role(&span.role) && span.text == new_name)
        .map(|span| span.offset)
        .collect();
    starts.iter().all(|start| names.contains(start))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lsp::symbols::global_names;

    fn open(languages: &mut Languages, uri: &str, source: &str) -> Rc<DocumentAnalysis> {
        Rc::new(DocumentAnalysis::parse(languages, uri, source).unwrap())
    }

    #[test]
    // req:cli-language-server-006
    fn references_span_importing_workspace_modules_and_exclude_declarations() {
        let root = std::env::temp_dir().join(format!("uffda-lsp-refs-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let a_source = "export Thing;\nrule Thing = any;\n";
        let b_source = "import \"./a.uff\" Thing;\nexport Main;\nrule Main = Thing Thing;\n";
        std::fs::write(root.join("a.uff"), a_source).unwrap();
        std::fs::write(root.join("b.uff"), b_source).unwrap();
        let mut languages = Languages::new().unwrap();
        let mut store = DocumentStore::default();
        let a_uri = Url::from_file_path(root.join("a.uff")).unwrap().to_string();
        let a = open(&mut languages, &a_uri, a_source);
        store.set_open(Rc::clone(&a));

        let globals = global_names();
        let at = a_source.find("Thing;\nrule").unwrap();
        let occurrence = occurrence_at(&a, at + 1, &globals).expect("occurrence");
        let found = symbol_occurrences(
            &mut languages,
            &mut store,
            &occurrence.symbol,
            &occurrence.name,
            &a,
            &root,
            &globals,
        );
        let with_declaration = reference_locations(&found, true);
        let without = reference_locations(&found, false);
        // a.uff: export + declaration; b.uff: import list + two references.
        assert_eq!(with_declaration.len(), 5, "{with_declaration:?}");
        assert_eq!(without.len(), 4, "{without:?}");
        assert!(
            with_declaration
                .iter()
                .any(|loc| loc["uri"].as_str().unwrap().ends_with("/b.uff"))
        );

        // Rename produces edits in both modules and writes nothing.
        let RenamePlan::Edit(edit) =
            plan_rename(&mut languages, &occurrence.symbol, &found, "Item", &globals)
        else {
            panic!("rename refused");
        };
        assert_eq!(edit["changes"].as_object().unwrap().len(), 2);
        assert_eq!(
            std::fs::read_to_string(root.join("a.uff")).unwrap(),
            a_source
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    // req:cli-language-server-006
    fn rename_is_refused_for_globals_collisions_and_invalid_names() {
        let mut languages = Languages::new().unwrap();
        let source =
            "export Main;\nrule Main = Other;\nrule Other = any;\nfunc F<a:any> = (add a 1);\n";
        let doc = open(&mut languages, "file:///tmp/rename.uff", source);
        let mut store = DocumentStore::default();
        store.set_open(Rc::clone(&doc));
        let globals = global_names();
        let root = std::env::temp_dir().join("uffda-lsp-no-such-root");

        let add_at = source.find("add").unwrap();
        let add = occurrence_at(&doc, add_at, &globals).unwrap();
        assert!(matches!(add.symbol, NameSymbol::Global { .. }));
        let found = symbol_occurrences(
            &mut languages,
            &mut store,
            &add.symbol,
            "add",
            &doc,
            &root,
            &globals,
        );
        assert!(matches!(
            plan_rename(&mut languages, &add.symbol, &found, "plus", &globals),
            RenamePlan::Refused(message) if message.contains("runtime global")
        ));

        let other_at = source.find("Other").unwrap();
        let other = occurrence_at(&doc, other_at, &globals).unwrap();
        let found = symbol_occurrences(
            &mut languages,
            &mut store,
            &other.symbol,
            "Other",
            &doc,
            &root,
            &globals,
        );
        assert_eq!(found[0].occurrences.len(), 2);
        // Collides with an existing name in the edited document.
        assert!(matches!(
            plan_rename(&mut languages, &other.symbol, &found, "Main", &globals),
            RenamePlan::Refused(message) if message.contains("already names")
        ));
        // A reserved word does not read back as a name.
        assert!(matches!(
            plan_rename(&mut languages, &other.symbol, &found, "rule", &globals),
            RenamePlan::Refused(message) if message.contains("not a valid name")
        ));
        assert!(matches!(
            plan_rename(&mut languages, &other.symbol, &found, "Renamed", &globals),
            RenamePlan::Edit(_)
        ));
    }

    #[test]
    // req:cli-language-server-006
    fn local_definition_points_at_the_binding_site() {
        let mut languages = Languages::new().unwrap();
        let source = "func F<a:any> = (add a 1);\n";
        let doc = open(&mut languages, "file:///tmp/local.uff", source);
        let globals = global_names();
        let use_at = source.rfind('a').unwrap();
        let occurrence = occurrence_at(&doc, use_at, &globals).unwrap();
        assert_eq!(&source[occurrence.start..occurrence.end], "a");
        let location = local_definition(&doc, &occurrence, &globals).expect("definition");
        assert_eq!(location["range"]["start"]["character"], 7);
    }
}
