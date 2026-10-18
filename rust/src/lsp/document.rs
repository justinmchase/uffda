//! Parsed `.uff` documents the editor features query: an open buffer's latest
//! parse, or a read-only parse of a file on disk. Queries never mutate a
//! session's module graph or any document's retained state.

use super::editor::Node;
use super::positions::utf16;
use crate::highlight::{HighlightSpan, identifier_at_offset};
use crate::json::JsonValue;
use crate::languages::{Language, Languages};
use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;
use std::time::SystemTime;
use url::Url;

/// A name token found in the parse tree's highlight spans.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identifier {
    pub name: String,
    pub start: usize,
    pub end: usize,
}

/// One parse of a document: source, highlight spans, and the editor tree.
pub struct DocumentAnalysis {
    /// The URI to report locations and edits against.
    pub uri: String,
    /// The module URL its imports resolve against.
    pub module_url: String,
    pub source: String,
    pub units: Vec<u16>,
    pub spans: Vec<HighlightSpan>,
    /// The projected parse match; absent when the parse produced none.
    pub tree: Option<Node>,
    /// Orders parses: failed (0), recovered (1), clean (2).
    pub quality: u8,
    /// AST from the same UffdaLang parse, when clean — reused for `session.load`
    /// so resolve does not re-parse the buffer.
    pub syntax: Option<JsonValue>,
}

impl DocumentAnalysis {
    /// Parse `source` with the built-in `.uff` grammar. `None` when the
    /// runtime could not run the grammar at all.
    pub fn parse(languages: &mut Languages, uri: &str, source: &str) -> Option<Self> {
        let analysis = languages.analyze(source, Language::Uffda).ok()?;
        let tree = analysis.tree.map(Rc::new);
        let quality = match &tree {
            None => 0,
            Some(root) if root.kind == "fail" => 0,
            Some(_) if !analysis.diagnostics.is_empty() => 1,
            Some(_) => 2,
        };
        Some(Self {
            uri: uri.to_string(),
            module_url: normalize_uri(uri),
            source: source.to_string(),
            units: utf16(source),
            spans: analysis.spans,
            tree,
            quality,
            syntax: analysis.syntax,
        })
    }

    /// The identifier covering `offset`: an identifier-role token span of the
    /// parse tree. With no parse tree nothing is known about the text, so
    /// there is no identifier (the text is never scanned).
    pub fn identifier_at(&self, offset: usize) -> Option<Identifier> {
        self.tree.as_ref()?;
        let (name, start, end) = identifier_at_offset(&self.spans, offset)?;
        Some(Identifier { name, start, end })
    }
}

/// A URI in the form module URLs use, so open documents and module graph
/// entries compare equal.
pub fn normalize_uri(uri: &str) -> String {
    Url::parse(uri)
        .map(|url| url.to_string())
        .unwrap_or_else(|_| uri.to_string())
}

/// Open documents (latest buffer parse) plus a cache of read-only parses of
/// files on disk, keyed by modification time.
#[derive(Default)]
pub struct DocumentStore {
    open: HashMap<String, Rc<DocumentAnalysis>>,
    disk: HashMap<String, (SystemTime, Rc<DocumentAnalysis>)>,
}

impl DocumentStore {
    pub fn set_open(&mut self, analysis: Rc<DocumentAnalysis>) {
        self.open.insert(normalize_uri(&analysis.uri), analysis);
    }

    pub fn remove_open(&mut self, uri: &str) {
        self.open.remove(&normalize_uri(uri));
    }

    pub fn open(&self, uri: &str) -> Option<Rc<DocumentAnalysis>> {
        self.open.get(&normalize_uri(uri)).cloned()
    }

    pub fn open_documents(&self) -> Vec<Rc<DocumentAnalysis>> {
        let mut documents: Vec<_> = self.open.values().cloned().collect();
        documents.sort_by(|a, b| a.uri.cmp(&b.uri));
        documents
    }

    /// The open buffer for `url`, else a read-only parse of its file.
    pub fn analysis_for(
        &mut self,
        languages: &mut Languages,
        url: &Url,
    ) -> Option<Rc<DocumentAnalysis>> {
        if let Some(open) = self.open.get(url.as_str()) {
            return Some(Rc::clone(open));
        }
        self.load_disk(languages, url)
    }

    /// A read-only parse of the `.uff` file `url` names.
    pub fn load_disk(
        &mut self,
        languages: &mut Languages,
        url: &Url,
    ) -> Option<Rc<DocumentAnalysis>> {
        let path: PathBuf = url.to_file_path().ok()?;
        if path.extension().and_then(|ext| ext.to_str()) != Some("uff") {
            return None;
        }
        let modified = std::fs::metadata(&path)
            .and_then(|meta| meta.modified())
            .ok()?;
        if let Some((cached, analysis)) = self.disk.get(url.as_str())
            && *cached == modified
        {
            return Some(Rc::clone(analysis));
        }
        let source = std::fs::read_to_string(&path).ok()?;
        let analysis = Rc::new(DocumentAnalysis::parse(languages, url.as_str(), &source)?);
        self.disk
            .insert(url.to_string(), (modified, Rc::clone(&analysis)));
        Some(analysis)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:cli-language-server-006
    fn identifier_requires_a_parse_tree_and_a_name_span() {
        let mut languages = Languages::new().unwrap();
        let source = "export Main;\nrule Main = any;\n";
        let doc = DocumentAnalysis::parse(&mut languages, "file:///tmp/doc.uff", source).unwrap();
        assert_eq!(doc.quality, 2);
        let main = source.find("Main").unwrap();
        let ident = doc.identifier_at(main + 1).unwrap();
        assert_eq!(ident.name, "Main");
        assert_eq!((ident.start, ident.end), (main, main + 4));
        // Keywords are not identifiers.
        let rule = source.find("rule").unwrap();
        assert_eq!(doc.identifier_at(rule + 1), None);
        // Whitespace is not an identifier.
        assert_eq!(doc.identifier_at(source.find('\n').unwrap()), None);
    }

    #[test]
    // req:cli-language-server-006

    fn store_prefers_open_buffers_over_disk() {
        let mut languages = Languages::new().unwrap();
        let mut store = DocumentStore::default();
        let doc = Rc::new(
            DocumentAnalysis::parse(&mut languages, "file:///tmp/nope.uff", "rule A = any;")
                .unwrap(),
        );
        store.set_open(Rc::clone(&doc));
        let url = Url::parse("file:///tmp/nope.uff").unwrap();
        let found = store.analysis_for(&mut languages, &url).unwrap();
        assert!(Rc::ptr_eq(&found, &doc));
        store.remove_open("file:///tmp/nope.uff");
        assert!(store.analysis_for(&mut languages, &url).is_none());
    }
}
