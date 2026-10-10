use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use url::Url;

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
}

impl Resolver {
    pub fn new(root: PathBuf, out_dir: PathBuf) -> Result<Self, ModuleResolutionError> {
        for path in [&root, &out_dir] {
            if !path.is_absolute() {
                return Err(ModuleResolutionError {
                    module_url: path.display().to_string(),
                    message: "artifact root and output directory must be absolute".into(),
                    cause: None,
                });
            }
        }
        Ok(Self {
            root: normalize_path(&root)?,
            out_dir: normalize_path(&out_dir)?,
            declarations: HashMap::new(),
        })
    }

    pub fn declaration_count(&self) -> usize {
        self.declarations.len()
    }

    pub fn load_declaration(
        &mut self,
        url: &Url,
    ) -> Result<Rc<ModuleDeclaration>, ModuleResolutionError> {
        if let Some(declaration) = self.declarations.get(url) {
            return Ok(Rc::clone(declaration));
        }
        let path = self.load_path(url)?;
        let text = std::fs::read_to_string(&path).map_err(|cause| {
            error(
                url,
                format!("could not read declaration {}", path.display()),
                Some(cause.to_string()),
            )
        })?;
        let declaration = decode_declaration(url, &text)?;
        let declaration = Rc::new(declaration);
        self.declarations
            .insert(url.clone(), Rc::clone(&declaration));
        Ok(declaration)
    }

    pub fn load_path(&self, url: &Url) -> Result<PathBuf, ModuleResolutionError> {
        let extension = Path::new(url.path())
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        if extension != "uff" && extension != "json" {
            return Err(error(
                url,
                format!("Unable to resolve file of unknown extension .{extension}"),
                None,
            ));
        }
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
        let mut artifact = self.out_dir.join("ast").join(relative);
        artifact.set_extension("uffda.ast.json");
        Ok(artifact)
    }
}

pub fn decode_declaration(
    url: &Url,
    text: &str,
) -> Result<ModuleDeclaration, ModuleResolutionError> {
    let value: Value = serde_json::from_str(text).map_err(|cause| {
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
    serde_json::from_value(value).map_err(|cause| {
        error(
            url,
            "declaration must be a ModuleDeclaration".into(),
            Some(cause.to_string()),
        )
    })
}

fn normalize_path(path: &Path) -> Result<PathBuf, ModuleResolutionError> {
    Url::from_file_path(path)
        .and_then(|url| url.to_file_path())
        .map_err(|()| ModuleResolutionError {
            module_url: path.display().to_string(),
            message: "invalid filesystem artifact path".into(),
            cause: None,
        })
}

fn error(url: &Url, message: String, cause: Option<String>) -> ModuleResolutionError {
    ModuleResolutionError {
        module_url: url.to_string(),
        message,
        cause,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

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
        std::fs::write(dir.0.join("bin/ast/src/module.uffda.ast.json"), DECLARATION).unwrap();
        let mut resolver = dir.resolver();
        let logical = dir.url("src/module.uff");
        let artifact = dir.url("bin/ast/src/module.uffda.ast.json");
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
    // req:modules-runtime-001
    fn rejects_executable_extensions_before_reading_and_network_is_explicitly_unsupported() {
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
                .load_declaration(&remote)
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
            serde_json::from_str(include_str!("../../test/rust/module-fixtures.json")).unwrap();
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
        assert!(failure.message.contains("bin/ast/missing.uffda.ast.json"));
        assert!(failure.cause.is_some());
        assert!(Resolver::new("relative".into(), dir.0.join("bin")).is_err());
        assert!(Resolver::new(dir.0.clone(), "relative".into()).is_err());
    }
}
