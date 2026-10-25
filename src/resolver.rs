use crate::json::JsonValue as Value;
use serde::Deserialize;
use std::collections::{BTreeMap, HashMap};
use std::fmt;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use url::Url;

pub mod graph;
pub mod packages;

/// Declaration data only. Linking and runtime rule compilation are separate stages.
#[derive(Debug, Deserialize)]
pub struct ModuleDeclaration {
    pub imports: Vec<Value>,
    pub exports: Vec<Value>,
    pub rules: Vec<Value>,
    #[serde(default)]
    pub funcs: Vec<Value>,
    #[serde(default)]
    pub decorators: Vec<Value>,
}

#[derive(Debug)]
pub struct ModuleResolutionError {
    pub module_url: String,
    pub message: String,
    pub cause: Option<String>,
    pub import_chain: Vec<graph::ImportFrame>,
}

impl fmt::Display for ModuleResolutionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Unable to load {}: {}", self.module_url, self.message)
    }
}

impl std::error::Error for ModuleResolutionError {}

pub struct Resolver {
    root: PathBuf,
    out_dir: PathBuf,
    declarations: HashMap<Url, Rc<ModuleDeclaration>>,
    declaration_sources: HashMap<Url, DeclarationSource>,
    packages: Option<packages::JsrPackages>,
    import_map: BTreeMap<String, String>,
    graphs: HashMap<Url, Rc<graph::ModuleGraph>>,
    transport: Rc<dyn packages::Transport>,
    artifact_packages: Vec<(Url, String)>,
}

enum DeclarationSource {
    Json(&'static str),
    Codec(&'static str),
}

impl Resolver {
    pub fn from_cwd() -> Result<Self, ModuleResolutionError> {
        let root = std::env::current_dir().map_err(|cause| ModuleResolutionError {
            module_url: "current working directory".into(),
            message: "could not determine default artifact root".into(),
            cause: Some(cause.to_string()),
            import_chain: Vec::new(),
        })?;
        Self::new(root.clone(), root.join("bin"))
    }

    pub fn new(root: PathBuf, out_dir: PathBuf) -> Result<Self, ModuleResolutionError> {
        for path in [&root, &out_dir] {
            if !path.is_absolute() {
                return Err(ModuleResolutionError {
                    module_url: path.display().to_string(),
                    message: "artifact root and output directory must be absolute".into(),
                    cause: None,
                    import_chain: Vec::new(),
                });
            }
        }
        Ok(Self {
            root: normalize_path(&root)?,
            out_dir: normalize_path(&out_dir)?,
            declarations: HashMap::new(),
            declaration_sources: HashMap::new(),
            packages: None,
            import_map: BTreeMap::new(),
            graphs: HashMap::new(),
            transport: Rc::new(packages::HttpTransport),
            artifact_packages: Vec::new(),
        })
    }

    pub fn declaration_count(&self) -> usize {
        self.declarations.len()
    }

    pub fn set_packages(&mut self, packages: packages::JsrPackages) {
        self.packages = Some(packages);
    }

    pub fn set_transport(&mut self, transport: Rc<dyn packages::Transport>) {
        self.transport = transport;
    }

    pub fn add_artifact_package(
        &mut self,
        root: Url,
        out_dir: &str,
    ) -> Result<(), ModuleResolutionError> {
        if !root.as_str().ends_with('/') {
            return Err(error(&root, "package root must end with /".into(), None));
        }
        let normalized = packages::normalize_project_path(out_dir)
            .map_err(|message| error(&root, message, None))?;
        self.artifact_packages.push((root, normalized));
        Ok(())
    }

    pub fn canonical_url(&mut self, url: &Url) -> Result<Url, ModuleResolutionError> {
        if url.scheme() != "jsr"
            || self.declarations.contains_key(url)
            || self.declaration_sources.contains_key(url)
        {
            return Ok(url.clone());
        }
        self.packages
            .as_mut()
            .ok_or_else(|| error(url, "no package resolver is configured".into(), None))?
            .resolve(url.as_str())
    }

    /// Explicit host injection uses a URL as identity; it never loads a file.
    pub fn insert_declaration(&mut self, url: Url, declaration: ModuleDeclaration) {
        if self.declaration_sources.remove(&url).is_some() {
            self.graphs.clear();
        }
        self.declarations.insert(url, Rc::new(declaration));
    }

    /// Register immutable declaration data; validation occurs on first access.
    pub fn insert_declaration_source(&mut self, url: Url, source: &'static str) {
        self.declarations.remove(&url);
        self.graphs.clear();
        self.declaration_sources
            .insert(url, DeclarationSource::Json(source));
    }

    /// Register an immutable codec artifact without loading a grammar to decode it.
    pub fn insert_declaration_codec_source(&mut self, url: Url, source: &'static str) {
        self.declarations.remove(&url);
        self.graphs.clear();
        self.declaration_sources
            .insert(url, DeclarationSource::Codec(source));
    }

    pub fn load_declaration(
        &mut self,
        url: &Url,
    ) -> Result<Rc<ModuleDeclaration>, ModuleResolutionError> {
        let canonical = self.canonical_url(url)?;
        let url = &canonical;
        if let Some(declaration) = self.declarations.get(url) {
            return Ok(Rc::clone(declaration));
        }
        if let Some(source) = self.declaration_sources.get(url) {
            let declaration = Rc::new(match source {
                DeclarationSource::Json(source) => decode_declaration(url, source)?,
                DeclarationSource::Codec(source) => decode_artifact(url, ".uff.ast", source)?,
            });
            self.declarations
                .insert(url.clone(), Rc::clone(&declaration));
            return Ok(declaration);
        }
        if let Some(packages) = self.packages.as_mut()
            && packages.belongs_to_registry(url)
        {
            let declaration = Rc::new(packages.load(url)?);
            self.declarations
                .insert(url.clone(), Rc::clone(&declaration));
            return Ok(declaration);
        }
        if url.path().ends_with(".uff")
            && let Some((root, out_dir)) = self
                .artifact_packages
                .iter()
                .filter(|(root, _)| url.as_str().starts_with(root.as_str()))
                .max_by_key(|(root, _)| root.as_str().len())
        {
            let source = &url.path()[root.path().len()..];
            let stem = &source[..source.len() - 4];
            let mut candidates = Vec::new();
            for suffix in [".uff.ast", ".uff.ast.json", ".uffda.ast", ".uffda.ast.json"] {
                candidates.push(
                    root.join(&format!("{out_dir}/ast/{stem}{suffix}"))
                        .map_err(|cause| {
                            error(
                                url,
                                "invalid package artifact URL".into(),
                                Some(cause.to_string()),
                            )
                        })?,
                );
            }
            let declaration = Rc::new(load_artifact_candidates(url, &candidates, &self.transport)?);
            self.declarations
                .insert(url.clone(), Rc::clone(&declaration));
            return Ok(declaration);
        }
        if url.scheme() == "https" || url.scheme() == "http" {
            require_extension(url)?;
            if !url.path().ends_with(".json") {
                return Err(error(
                    url,
                    "remote .uff module needs a package artifact layout".into(),
                    None,
                ));
            }
            let bytes = self.transport.read(url).map_err(|cause| {
                error(url, "could not read JSON declaration".into(), Some(cause))
            })?;
            let text = String::from_utf8(bytes).map_err(|cause| {
                error(
                    url,
                    "declaration is not UTF-8".into(),
                    Some(cause.to_string()),
                )
            })?;
            let declaration = Rc::new(decode_declaration(url, &text)?);
            self.declarations
                .insert(url.clone(), Rc::clone(&declaration));
            return Ok(declaration);
        }
        let extension = require_extension(url)?;
        let declaration = if extension == "json" {
            let path = url.to_file_path().map_err(|()| {
                error(
                    url,
                    format!(
                        "filesystem declaration loader does not support {}",
                        url.scheme()
                    ),
                    None,
                )
            })?;
            let text = std::fs::read_to_string(&path).map_err(|cause| {
                error(
                    url,
                    format!("could not read declaration {}", path.display()),
                    Some(cause.to_string()),
                )
            })?;
            Rc::new(decode_declaration(url, &text)?)
        } else {
            Rc::new(self.load_uff_declaration_file(url)?)
        };
        self.declarations
            .insert(url.clone(), Rc::clone(&declaration));
        Ok(declaration)
    }

    /// Preferred on-disk artifact path for a logical module URL.
    ///
    /// For `.uff` modules this selects codec before JSON compatibility artifacts,
    /// or the preferred `.uff.ast` path when no candidate exists.
    pub fn load_path(&self, url: &Url) -> Result<PathBuf, ModuleResolutionError> {
        let extension = require_extension(url)?;
        let path = url.to_file_path().map_err(|()| {
            error(
                url,
                format!(
                    "filesystem declaration loader does not support {}",
                    url.scheme()
                ),
                None,
            )
        })?;
        if extension == "json" {
            return Ok(path);
        }
        let candidates = self.uff_artifact_paths(url, &path)?;
        Ok(select_existing_artifact(candidates))
    }

    fn load_uff_declaration_file(
        &self,
        url: &Url,
    ) -> Result<ModuleDeclaration, ModuleResolutionError> {
        let path = url.to_file_path().map_err(|()| {
            error(
                url,
                format!(
                    "filesystem declaration loader does not support {}",
                    url.scheme()
                ),
                None,
            )
        })?;
        let candidates = self.uff_artifact_paths(url, &path)?;
        for candidate in &candidates {
            let text = match std::fs::read_to_string(candidate) {
                Ok(text) => text,
                Err(cause) if cause.kind() == std::io::ErrorKind::NotFound => continue,
                Err(cause) => {
                    return Err(error(
                        url,
                        format!("could not read artifact {}", candidate.display()),
                        Some(cause.to_string()),
                    ));
                }
            };
            return decode_artifact(url, &candidate.to_string_lossy(), &text);
        }
        // None of the candidates existed: surface the preferred path's IO error
        // so missing-artifact diagnostics name a concrete file.
        let preferred = &candidates[0];
        let cause = std::fs::read_to_string(preferred)
            .err()
            .map(|e| e.to_string());
        let tried = candidates
            .iter()
            .map(|candidate| candidate.display().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        Err(error(
            url,
            format!("could not read artifact {tried}"),
            cause,
        ))
    }

    fn uff_artifact_paths(
        &self,
        url: &Url,
        path: &Path,
    ) -> Result<Vec<PathBuf>, ModuleResolutionError> {
        let relative = path.strip_prefix(&self.root).map_err(|cause| {
            error(
                url,
                format!("module is outside artifact root {}", self.root.display()),
                Some(cause.to_string()),
            )
        })?;
        if relative.as_os_str().is_empty() {
            return Err(error(
                url,
                "module cannot be the artifact root".into(),
                None,
            ));
        }
        Ok(uff_artifact_paths(&self.out_dir, relative))
    }
}

/// Artifact path candidates for a `.uff` source, preferred first.
///
/// Order: `.uff.ast` (data codec), `.uff.ast.json` (JSON compatibility), then
/// the corresponding legacy `.uffda.ast` / `.uffda.ast.json` names.
pub fn uff_artifact_paths(out_dir: &Path, relative_uff: &Path) -> Vec<PathBuf> {
    let base = out_dir.join("ast").join(relative_uff);
    vec![
        base.with_extension("uff.ast"),
        base.with_extension("uff.ast.json"),
        base.with_extension("uffda.ast"),
        base.with_extension("uffda.ast.json"),
    ]
}

fn select_existing_artifact(candidates: Vec<PathBuf>) -> PathBuf {
    for candidate in &candidates {
        if candidate.is_file() {
            return candidate.clone();
        }
    }
    candidates
        .into_iter()
        .next()
        .expect("uff_artifact_paths is non-empty")
}

fn load_artifact_candidates(
    url: &Url,
    candidates: &[Url],
    transport: &Rc<dyn packages::Transport>,
) -> Result<ModuleDeclaration, ModuleResolutionError> {
    let mut first_error = None;
    for candidate in candidates {
        let bytes = match read_artifact_url(url, candidate, transport) {
            Ok(bytes) => bytes,
            Err(error) => {
                if first_error.is_none() {
                    first_error = Some(error);
                }
                continue;
            }
        };
        let text = String::from_utf8(bytes)
            .map_err(|cause| error(url, "artifact is not UTF-8".into(), Some(cause.to_string())))?;
        return decode_artifact(url, candidate.as_str(), &text);
    }
    Err(first_error.expect("candidates is non-empty"))
}

fn read_artifact_url(
    module: &Url,
    artifact: &Url,
    transport: &Rc<dyn packages::Transport>,
) -> Result<Vec<u8>, ModuleResolutionError> {
    if artifact.scheme() == "file" {
        let path = artifact
            .to_file_path()
            .map_err(|()| error(module, "invalid artifact file URL".into(), None))?;
        std::fs::read(&path).map_err(|cause| {
            error(
                module,
                format!("could not read artifact {}", path.display()),
                Some(cause.to_string()),
            )
        })
    } else {
        transport.read(artifact).map_err(|cause| {
            error(
                module,
                format!("could not read artifact {artifact}"),
                Some(cause),
            )
        })
    }
}

fn is_codec_artifact_path(path: &str) -> bool {
    (path.ends_with(".uff.ast") && !path.ends_with(".uff.ast.json"))
        || (path.ends_with(".uffda.ast") && !path.ends_with(".uffda.ast.json"))
}

pub fn decode_artifact(
    url: &Url,
    path: &str,
    text: &str,
) -> Result<ModuleDeclaration, ModuleResolutionError> {
    if is_codec_artifact_path(path) {
        let value = crate::codec::declaration::decode_declaration_codec(text)
            .map_err(|cause| error(url, "invalid declaration codec".into(), Some(cause)))?;
        if !value.is_object() {
            return Err(error(
                url,
                "declaration must be a ModuleDeclaration".into(),
                Some("expected a declaration object".into()),
            ));
        }
        crate::json::from_value(value).map_err(|cause| {
            error(
                url,
                "declaration must be a ModuleDeclaration".into(),
                Some(cause.to_string()),
            )
        })
    } else {
        decode_declaration(url, text)
    }
}

fn require_extension(url: &Url) -> Result<&str, ModuleResolutionError> {
    let extension = Path::new(url.path())
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    if extension != "uff" && extension != "json" {
        return Err(error(
            url,
            format!(
                "Unable to resolve file of unknown extension {}",
                if extension.is_empty() {
                    String::new()
                } else {
                    format!(".{extension}")
                }
            ),
            None,
        ));
    }
    Ok(extension)
}

pub fn decode_declaration(
    url: &Url,
    text: &str,
) -> Result<ModuleDeclaration, ModuleResolutionError> {
    let value: Value = crate::json::from_str(text).map_err(|cause| {
        error(
            url,
            "invalid declaration JSON".into(),
            Some(cause.to_string()),
        )
    })?;
    if !value.is_object() {
        return Err(error(
            url,
            "declaration must be a ModuleDeclaration".into(),
            Some("expected a declaration object".into()),
        ));
    }
    crate::json::from_value(value).map_err(|cause| {
        error(
            url,
            "declaration must be a ModuleDeclaration".into(),
            Some(cause.to_string()),
        )
    })
}

pub(crate) fn normalize_path(path: &Path) -> Result<PathBuf, ModuleResolutionError> {
    let invalid = || ModuleResolutionError {
        module_url: path.display().to_string(),
        message: "invalid filesystem artifact path".into(),
        cause: None,
        import_chain: Vec::new(),
    };
    if !path.is_absolute() {
        return Err(invalid());
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            component => normalized.push(component.as_os_str()),
        }
    }
    Url::from_file_path(normalized)
        .and_then(|url| url.to_file_path())
        .map_err(|()| invalid())
}

fn error(url: &Url, message: String, cause: Option<String>) -> ModuleResolutionError {
    ModuleResolutionError {
        module_url: url.to_string(),
        message,
        cause,
        import_chain: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:runtime-strings-002
    fn raw_declarations_preserve_literal_strings_but_scalar_names_error() {
        let url = Url::parse("file:///lossless.json").unwrap();
        let declaration = decode_declaration(&url, r#"{"imports":[],"exports":[],"rules":[],"funcs":[{"name":"Text","pattern":{"kind":"end"},"expression":{"kind":"value","value":{"\ud800":"\udfff"}}}]}"#).unwrap();
        let literal = &declaration.funcs[0]["expression"]["value"];
        let Value::Object(properties) = literal else {
            panic!()
        };
        assert_eq!(properties.iter().next().unwrap().0.as_utf16(), &[0xd800]);
        assert!(
            crate::json::from_value::<crate::expression::Expression>(
                crate::json::from_str(r#"{"kind":"reference","name":"\ud800"}"#).unwrap()
            )
            .is_err()
        );
    }
    use std::sync::atomic::{AtomicU64, Ordering};

    #[test]
    // req:project-file-003
    fn shared_path_normalization_removes_dot_segments_and_rejects_relative_paths() {
        let cwd = std::env::current_dir().unwrap();
        assert_eq!(
            normalize_path(&cwd.join("src/../main.uff")).unwrap(),
            cwd.join("main.uff")
        );
        assert!(normalize_path(Path::new("relative.uff")).is_err());
    }

    struct Directory(PathBuf);

    impl Directory {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "uffda-rust-resolver-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn url(&self, name: &str) -> Url {
            Url::from_file_path(self.0.join(name)).unwrap()
        }

        fn resolver(&self) -> Resolver {
            Resolver::new(self.0.clone(), self.0.join("bin")).unwrap()
        }
    }

    impl Drop for Directory {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }

    const DECLARATION: &str = r#"{"imports":[],"exports":[],"rules":[]}"#;

    #[test]
    // req:cli-bootstrap-015 req:modules-runtime-001
    fn registered_sources_decode_on_demand_and_cache_without_io() {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        let url = dir.url("embedded.uff");
        let invalid = dir.url("unused.uff");
        resolver.insert_declaration_source(url.clone(), DECLARATION);
        resolver.insert_declaration_source(invalid.clone(), "{");
        assert_eq!(resolver.declaration_count(), 0);
        let first = resolver.load_declaration(&url).unwrap();
        let second = resolver.load_declaration(&url).unwrap();
        assert!(Rc::ptr_eq(&first, &second));
        let graph = resolver.load_graph(&url).unwrap();
        assert_eq!(resolver.declaration_count(), 1);
        assert!(resolver.load_declaration(&invalid).is_err());
        assert_eq!(resolver.declaration_count(), 1);
        resolver.insert_declaration_source(
            url.clone(),
            r#"{"imports":[],"exports":[],"rules":[{"name":"New","parameters":[],"pattern":{"kind":"any"}}]}"#,
        );
        let replaced = resolver.load_declaration(&url).unwrap();
        assert!(!Rc::ptr_eq(&first, &replaced));
        assert_eq!(replaced.rules[0]["name"], "New");
        let replaced_graph = resolver.load_graph(&url).unwrap();
        assert!(!Rc::ptr_eq(&graph, &replaced_graph));
        resolver.insert_declaration(url.clone(), decode_declaration(&url, DECLARATION).unwrap());
        assert!(resolver.load_declaration(&url).unwrap().rules.is_empty());
        let direct_graph = resolver.load_graph(&url).unwrap();
        assert!(!Rc::ptr_eq(&replaced_graph, &direct_graph));
    }

    #[test]
    // req:cli-bootstrap-004
    fn default_layout_uses_cwd_and_bin() {
        let resolver = Resolver::from_cwd().unwrap();
        let root = std::env::current_dir().unwrap();
        let url = Url::from_file_path(root.join("src/test.uff")).unwrap();
        assert_eq!(
            resolver.load_path(&url).unwrap(),
            root.join("bin/ast/src/test.uff.ast")
        );
    }

    #[test]
    // req:modules-runtime-001 req:modules-runtime-003
    fn supplied_declarations_are_host_injection_not_executable_file_loading() {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        let url = dir.url("not-loaded.ts");
        resolver.insert_declaration(url.clone(), decode_declaration(&url, DECLARATION).unwrap());
        assert!(resolver.load_declaration(&url).unwrap().imports.is_empty());
        assert!(resolver.load_path(&url).is_err());
        assert_eq!(resolver.declaration_count(), 1);
    }

    #[test]
    // req:modules-runtime-001 req:modules-runtime-002
    fn loads_direct_json_as_data_and_reuses_logical_identity() {
        let dir = Directory::new();
        std::fs::write(dir.0.join("module.json"), DECLARATION).unwrap();
        let mut resolver = dir.resolver();
        let first = resolver.load_declaration(&dir.url("module.json")).unwrap();
        assert!(first.funcs.is_empty());
        assert!(first.decorators.is_empty());
        std::fs::remove_file(dir.0.join("module.json")).unwrap();
        let second = resolver.load_declaration(&dir.url("module.json")).unwrap();
        assert!(Rc::ptr_eq(&first, &second));
        assert_eq!(resolver.declaration_count(), 1);
    }

    #[test]
    // req:cli-bootstrap-004 req:modules-runtime-001
    fn uff_remaps_without_reading_source_or_relowering() {
        let dir = Directory::new();
        std::fs::create_dir_all(dir.0.join("bin/ast/src")).unwrap();
        std::fs::write(dir.0.join("bin/ast/src/module.uff.ast.json"), DECLARATION).unwrap();
        let mut resolver = dir.resolver();
        let logical = dir.url("src/module.uff");
        let artifact = dir.url("bin/ast/src/module.uff.ast.json");
        let loaded = resolver.load_declaration(&logical).unwrap();
        let direct = resolver.load_declaration(&artifact).unwrap();
        assert!(!Rc::ptr_eq(&loaded, &direct));
        assert_eq!(resolver.declaration_count(), 2);
        let outside = Url::from_file_path(dir.0.parent().unwrap().join("outside.uff")).unwrap();
        assert!(
            resolver
                .load_declaration(&outside)
                .unwrap_err()
                .message
                .contains("outside artifact root")
        );
    }

    #[test]
    // req:project-file-003 req:cli-bootstrap-004 req:data-codec-005
    fn uff_prefers_codec_artifact_over_json_when_both_exist() {
        let dir = Directory::new();
        std::fs::create_dir_all(dir.0.join("bin/ast/src")).unwrap();
        std::fs::write(
            dir.0.join("bin/ast/src/module.uff.ast.json"),
            r#"{"imports":[],"exports":[],"rules":[{"name":"Json","parameters":[],"pattern":{"kind":"any"}}]}"#,
        )
        .unwrap();
        let codec = crate::codec::declaration::encode_declaration_codec(
            &crate::json::from_str(
                r#"{"imports":[],"exports":[],"rules":[{"name":"Codec","parameters":[],"pattern":{"kind":"any"}}]}"#,
            )
            .unwrap(),
        )
        .unwrap();
        std::fs::write(dir.0.join("bin/ast/src/module.uff.ast"), codec).unwrap();
        let mut resolver = dir.resolver();
        let loaded = resolver
            .load_declaration(&dir.url("src/module.uff"))
            .unwrap();
        assert_eq!(loaded.rules[0]["name"], "Codec");
        assert_eq!(
            resolver.load_path(&dir.url("src/module.uff")).unwrap(),
            dir.0.join("bin/ast/src/module.uff.ast")
        );
    }

    #[test]
    // req:project-file-003 req:cli-bootstrap-004
    fn uff_loads_codec_only_and_json_only_artifacts() {
        let dir = Directory::new();
        std::fs::create_dir_all(dir.0.join("bin/ast")).unwrap();
        let codec = crate::codec::declaration::encode_declaration_codec(
            &crate::json::from_str(DECLARATION).unwrap(),
        )
        .unwrap();
        std::fs::write(dir.0.join("bin/ast/codec.uff.ast"), codec).unwrap();
        std::fs::write(dir.0.join("bin/ast/json.uff.ast.json"), DECLARATION).unwrap();
        let mut resolver = dir.resolver();
        assert!(
            resolver
                .load_declaration(&dir.url("codec.uff"))
                .unwrap()
                .rules
                .is_empty()
        );
        assert!(
            resolver
                .load_declaration(&dir.url("json.uff"))
                .unwrap()
                .rules
                .is_empty()
        );
    }

    #[test]
    // req:data-codec-005 req:cli-bootstrap-015
    fn embedded_codec_registration_is_lazy_cached_and_replaceable() {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        let url = dir.url("absent.uff");
        resolver.insert_declaration_codec_source(url.clone(), "{imports:[] exports:[] rules:[]}\n");
        assert_eq!(resolver.declaration_count(), 0);
        let first = resolver.load_declaration(&url).unwrap();
        assert!(Rc::ptr_eq(
            &first,
            &resolver.load_declaration(&url).unwrap()
        ));
        resolver.insert_declaration_codec_source(url.clone(), "{}\n{}\n");
        assert_eq!(resolver.declaration_count(), 0);
        assert!(resolver.load_declaration(&url).is_err());
        resolver.insert_declaration_source(url.clone(), DECLARATION);
        assert!(resolver.load_declaration(&url).unwrap().rules.is_empty());
        resolver.insert_declaration_codec_source(url.clone(), "{imports:[] exports:[] rules:[]}\n");
        assert!(resolver.load_declaration(&url).unwrap().rules.is_empty());
    }

    #[test]
    // req:data-codec-005
    fn malformed_codec_is_not_hidden_by_a_valid_json_sibling() {
        for bytes in [b"not-codec\n".as_slice(), b"{}\n{}\n", &[0xff]] {
            let dir = Directory::new();
            std::fs::create_dir_all(dir.0.join("bin/ast")).unwrap();
            std::fs::write(dir.0.join("bin/ast/main.uff.ast"), bytes).unwrap();
            std::fs::write(dir.0.join("bin/ast/main.uff.ast.json"), DECLARATION).unwrap();
            assert!(
                dir.resolver()
                    .load_declaration(&dir.url("main.uff"))
                    .is_err()
            );
        }
    }

    #[test]
    // req:modules-runtime-001
    fn rejects_executable_extensions_before_reading_and_filesystem_rejects_network_urls() {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        for name in ["module.ts", "module.js", "module.mjs", "module.txt"] {
            let result = resolver.load_declaration(&dir.url(name)).unwrap_err();
            assert!(result.message.contains("unknown extension"));
            assert!(result.cause.is_none());
        }
        let remote = Url::parse("https://example.com/module.json").unwrap();
        assert!(
            resolver
                .load_path(&remote)
                .unwrap_err()
                .message
                .contains("does not support https")
        );
        assert_eq!(resolver.declaration_count(), 0);
    }

    #[test]
    // req:modules-runtime-002
    fn validates_structure_and_does_not_cache_failures() {
        let dir = Directory::new();
        let mut resolver = dir.resolver();
        let url = dir.url("module.json");
        for text in [
            "{",
            "null",
            "42",
            "[]",
            "{}",
            r#"{"imports":[],"exports":[],"rules":null}"#,
            r#"{"imports":[],"exports":[],"rules":[],"funcs":null}"#,
            r#"{"imports":[],"exports":[],"rules":[],"decorators":{}}"#,
        ] {
            std::fs::write(dir.0.join("module.json"), text).unwrap();
            let failure = resolver.load_declaration(&url).unwrap_err();
            assert_eq!(failure.module_url, url.as_str());
            assert!(failure.cause.is_some());
            assert_eq!(resolver.declaration_count(), 0);
        }
        std::fs::write(dir.0.join("module.json"), DECLARATION).unwrap();
        resolver.load_declaration(&url).unwrap();
        assert_eq!(resolver.declaration_count(), 1);
    }

    #[test]
    // req:modules-runtime-002
    fn shared_json_declaration_validation_fixtures() {
        #[derive(Deserialize)]
        struct Fixture {
            name: String,
            text: String,
            valid: bool,
        }
        let fixtures: Vec<Fixture> =
            serde_json::from_str(include_str!("../tests/rust/module-fixtures.json")).unwrap();
        let url = Url::parse("file:///shared-module.json").unwrap();
        for fixture in fixtures {
            assert_eq!(
                decode_declaration(&url, &fixture.text).is_ok(),
                fixture.valid,
                "{}",
                fixture.name
            );
        }
    }

    #[test]
    // req:cli-bootstrap-004 req:modules-runtime-002
    fn missing_artifact_names_target_and_rejects_relative_layouts() {
        let dir = Directory::new();
        let failure = dir
            .resolver()
            .load_declaration(&dir.url("missing.uff"))
            .unwrap_err();
        assert!(failure.message.contains("bin/ast/missing.uff.ast.json"));
        assert!(failure.cause.is_some());
        assert!(Resolver::new("relative".into(), dir.0.join("bin")).is_err());
        assert!(Resolver::new(dir.0.clone(), "relative".into()).is_err());
    }
}

#[cfg(test)]
mod ported_tests;
