use super::{ModuleDeclaration, ModuleResolutionError, decode_declaration, error};
use deno_semver::{RangeBound, Version, VersionBoundKind, VersionReq};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use url::Url;

pub trait Transport {
    fn read(&self, url: &Url) -> Result<Vec<u8>, String>;
}

pub struct HttpTransport;

impl Transport for HttpTransport {
    fn read(&self, url: &Url) -> Result<Vec<u8>, String> {
        if url.scheme() != "https" && url.scheme() != "http" {
            return Err(format!("unsupported transport protocol {}", url.scheme()));
        }
        let mut response = ureq::get(url.as_str()).call().map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        response
            .body_mut()
            .as_reader()
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        Ok(bytes)
    }
}

#[derive(Default, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LockfileData {
    #[serde(default)]
    pub specifiers: BTreeMap<String, String>,
    #[serde(default)]
    pub jsr: BTreeMap<String, Integrity>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Integrity {
    pub integrity: String,
}

pub struct Lockfile {
    pub data: LockfileData,
    path: Option<PathBuf>,
}

impl Lockfile {
    pub fn memory() -> Self {
        Self {
            data: LockfileData::default(),
            path: None,
        }
    }

    pub fn load(path: PathBuf) -> Result<Self, String> {
        let data = match std::fs::read_to_string(&path) {
            Ok(text) => {
                let value: Value =
                    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
                if !value.is_object() {
                    return Err(format!("{}: lockfile must be an object", path.display()));
                }
                if let Some(specifiers) = value.get("specifiers")
                    && !specifiers.is_object()
                {
                    return Err(format!("{}: specifiers must be an object", path.display()));
                }
                if let Some(jsr) = value.get("jsr") {
                    let entries = jsr
                        .as_object()
                        .ok_or_else(|| format!("{}: jsr must be an object", path.display()))?;
                    if entries.values().any(|entry| !entry.is_object()) {
                        return Err(format!(
                            "{}: jsr integrity entries must be objects",
                            path.display()
                        ));
                    }
                }
                serde_json::from_value(value).map_err(|e| format!("{}: {e}", path.display()))?
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => LockfileData::default(),
            Err(e) => return Err(format!("{}: {e}", path.display())),
        };
        Ok(Self {
            data,
            path: Some(path),
        })
    }

    fn save(&self) -> Result<(), String> {
        if let Some(path) = &self.path {
            let mut text = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
            text.push('\n');
            std::fs::write(path, text).map_err(|e| format!("{}: {e}", path.display()))?;
        }
        Ok(())
    }

    fn version(&mut self, key: String, version: String) -> Result<(), String> {
        if self.data.specifiers.get(&key) != Some(&version) {
            let previous = self.data.specifiers.insert(key.clone(), version);
            if let Err(cause) = self.save() {
                match previous {
                    Some(previous) => {
                        self.data.specifiers.insert(key, previous);
                    }
                    None => {
                        self.data.specifiers.remove(&key);
                    }
                }
                return Err(cause);
            }
        }
        Ok(())
    }

    fn integrity(&mut self, key: String, integrity: String) -> Result<(), String> {
        if self.data.jsr.get(&key).map(|v| &v.integrity) != Some(&integrity) {
            let previous = self.data.jsr.insert(key.clone(), Integrity { integrity });
            if let Err(cause) = self.save() {
                match previous {
                    Some(previous) => {
                        self.data.jsr.insert(key, previous);
                    }
                    None => {
                        self.data.jsr.remove(&key);
                    }
                }
                return Err(cause);
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct JsrSpecifier {
    pub package: String,
    pub range: Option<String>,
    pub export: String,
}

fn segment(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
}

pub(crate) fn valid_segment(value: &str) -> bool {
    segment(value)
}

pub fn parse_specifier(text: &str) -> Result<JsrSpecifier, String> {
    let value = text
        .strip_prefix("jsr:@")
        .ok_or_else(|| format!("{text} is not a jsr: specifier"))?;
    let mut parts = value.split('/');
    let scope = parts.next().unwrap_or("");
    let name_and_range = parts.next().unwrap_or("");
    let (name, range) = name_and_range
        .split_once('@')
        .map_or((name_and_range, None), |(name, range)| (name, Some(range)));
    let export: Vec<_> = parts.collect();
    if !segment(scope)
        || !segment(name)
        || range == Some("")
        || !export.iter().all(|part| segment(part))
    {
        return Err(format!("{text} is not a jsr: specifier"));
    }
    Ok(JsrSpecifier {
        package: format!("@{scope}/{name}"),
        range: range.map(str::to_string),
        export: if export.is_empty() {
            ".".into()
        } else {
            format!("./{}", export.join("/"))
        },
    })
}

pub fn highest_satisfying<'a>(
    versions: impl Iterator<Item = &'a str>,
    range: &str,
) -> Result<Option<String>, String> {
    validate_range_versions(range)?;
    let range = VersionReq::parse_from_npm(range).map_err(|e| e.to_string())?;
    let ranges = range
        .range()
        .ok_or("package version must be a semver range, not a distribution tag")?;
    Ok(versions
        .filter_map(strict_version)
        .filter(|version| {
            ranges.0.iter().any(|range| {
                let satisfies_bound = |bound: &RangeBound, direction: Ordering| match bound {
                    RangeBound::Unbounded => true,
                    RangeBound::Version(bound) => {
                        let order = compare_versions(version, &bound.version);
                        order == direction
                            || (order == Ordering::Equal
                                && bound.kind == VersionBoundKind::Inclusive)
                    }
                };
                let eligible_prerelease = version.pre.is_empty()
                    || [&range.start, &range.end]
                        .into_iter()
                        .any(|bound| match bound {
                            RangeBound::Version(bound) => {
                                !bound.version.pre.is_empty()
                                    && (version.major, version.minor, version.patch)
                                        == (
                                            bound.version.major,
                                            bound.version.minor,
                                            bound.version.patch,
                                        )
                            }
                            RangeBound::Unbounded => false,
                        });
                eligible_prerelease
                    && satisfies_bound(&range.start, Ordering::Greater)
                    && satisfies_bound(&range.end, Ordering::Less)
            })
        })
        .max_by(compare_versions)
        .map(|version| version.to_string()))
}

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

fn validate_range_versions(range: &str) -> Result<(), String> {
    for branch in range.split('|') {
        for token in branch.split_whitespace() {
            if token == "-" {
                continue;
            }
            let token = token.trim_start_matches(['<', '>', '=', '~', '^', 'v']);
            if token.is_empty() {
                continue;
            }
            let core = token.split(['-', '+']).next().unwrap_or("");
            let parts: Vec<_> = core.split('.').collect();
            let numeric = |part: &str| {
                !part.is_empty()
                    && (part.len() == 1 || !part.starts_with('0'))
                    && part.bytes().all(|byte| byte.is_ascii_digit())
                    && part.parse::<u64>().is_ok_and(|n| n <= MAX_SAFE_INTEGER)
            };
            if parts.len() > 3
                || !parts
                    .iter()
                    .all(|part| matches!(*part, "*" | "x" | "X") || numeric(part))
                || (parts.len() == 3
                    && parts.iter().all(|part| numeric(part))
                    && strict_version(token).is_none())
            {
                return Err(format!("invalid semver range version {token}"));
            }
        }
    }
    Ok(())
}

fn compare_versions(left: &Version, right: &Version) -> Ordering {
    let core = (left.major, left.minor, left.patch).cmp(&(right.major, right.minor, right.patch));
    if core != Ordering::Equal {
        return core;
    }
    match (left.pre.is_empty(), right.pre.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Greater,
        (false, true) => return Ordering::Less,
        (false, false) => {}
    }
    for (left, right) in left.pre.iter().zip(right.pre.iter()) {
        // @std/semver treats numeric identifiers beyond JS's safe integer limit as strings.
        let number = |text: &str| text.parse::<u64>().ok().filter(|n| *n <= MAX_SAFE_INTEGER);
        let ordering = match (number(left), number(right)) {
            (Some(left), Some(right)) => left.cmp(&right),
            (Some(_), None) => Ordering::Less,
            (None, Some(_)) => Ordering::Greater,
            (None, None) => left.cmp(right),
        };
        if ordering != Ordering::Equal {
            return ordering;
        }
    }
    left.pre.len().cmp(&right.pre.len())
}

fn strict_version(text: &str) -> Option<Version> {
    if text.len() > 256 {
        return None;
    }
    let text = text.trim();
    let text = text.strip_prefix('v').unwrap_or(text);
    let (version, build) = text
        .split_once('+')
        .map_or((text, None), |(version, build)| (version, Some(build)));
    let (core, prerelease) = version
        .split_once('-')
        .map_or((version, None), |(core, pre)| (core, Some(pre)));
    let parts: Vec<_> = core.split('.').collect();
    if parts.len() != 3
        || !parts.iter().all(|part| {
            !part.is_empty()
                && (part.len() == 1 || !part.starts_with('0'))
                && part.bytes().all(|byte| byte.is_ascii_digit())
                && part.parse::<u64>().is_ok_and(|n| n <= MAX_SAFE_INTEGER)
        })
    {
        return None;
    }
    for (identifiers, numeric_leading_zeros) in [(prerelease, false), (build, true)] {
        if let Some(identifiers) = identifiers
            && !identifiers.split('.').all(|identifier| {
                !identifier.is_empty()
                    && identifier
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                    && (numeric_leading_zeros
                        || identifier.len() == 1
                        || !identifier.starts_with('0')
                        || !identifier.bytes().all(|byte| byte.is_ascii_digit()))
            })
        {
            return None;
        }
    }
    Version::parse_standard(text).ok()
}

struct PackageVersion {
    package: String,
    version: String,
    manifest: BTreeMap<String, String>,
    exports: BTreeMap<String, String>,
    out_dir: String,
}

pub struct JsrPackages {
    registry: Url,
    cache_dir: PathBuf,
    transport: Rc<dyn Transport>,
    pub lockfile: Lockfile,
    chosen: HashMap<String, Vec<String>>,
    versions: HashMap<String, Rc<PackageVersion>>,
}

impl JsrPackages {
    pub fn standard(lockfile: Lockfile) -> Result<Self, String> {
        let cache_dir = default_cache_dir()?;
        Self::new(
            Url::parse("https://jsr.io/").map_err(|e| e.to_string())?,
            cache_dir,
            Rc::new(HttpTransport),
            lockfile,
        )
    }

    pub fn new(
        registry: Url,
        cache_dir: PathBuf,
        transport: Rc<dyn Transport>,
        lockfile: Lockfile,
    ) -> Result<Self, String> {
        if !registry.as_str().ends_with('/') {
            return Err("registry URL must end with /".into());
        }
        if !cache_dir.is_absolute() {
            return Err("cache directory must be absolute".into());
        }
        Ok(Self {
            registry,
            cache_dir,
            transport,
            lockfile,
            chosen: HashMap::new(),
            versions: HashMap::new(),
        })
    }

    pub fn registry(&self) -> &Url {
        &self.registry
    }

    pub fn belongs_to_registry(&self, url: &Url) -> bool {
        url.origin() == self.registry.origin() && url.path().starts_with(self.registry.path())
    }

    pub fn resolve(&mut self, text: &str) -> Result<Url, ModuleResolutionError> {
        self.resolve_inner(text)
            .map_err(|message| ModuleResolutionError {
                module_url: text.into(),
                message,
                cause: None,
                import_chain: Vec::new(),
            })
    }

    fn resolve_inner(&mut self, text: &str) -> Result<Url, String> {
        let specifier = parse_specifier(text)?;
        let key = format!(
            "jsr:{}{}",
            specifier.package,
            specifier
                .range
                .as_ref()
                .map(|r| format!("@{r}"))
                .unwrap_or_default()
        );
        let range = specifier.range.as_deref().unwrap_or("*");
        let version = if let Some(version) = self.lockfile.data.specifiers.get(&key) {
            version.clone()
        } else {
            let chosen = self.chosen.get(&specifier.package);
            let reused =
                highest_satisfying(chosen.into_iter().flatten().map(String::as_str), range)?;
            let version = match reused {
                Some(version) => version,
                None => {
                    let path = format!("{}/meta.json", specifier.package);
                    let bytes = match self.download(&path) {
                        Ok(bytes) => {
                            self.write_cache(&path, &bytes)?;
                            bytes
                        }
                        Err(download_error) => self.read_cache(&path)?.ok_or(download_error)?,
                    };
                    let value: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                    let versions = value
                        .get("versions")
                        .and_then(Value::as_object)
                        .ok_or("meta.json lists no versions")?;
                    highest_satisfying(
                        versions
                            .iter()
                            .filter(|(_, value)| value.get("yanked") != Some(&Value::Bool(true)))
                            .map(|(version, _)| version.as_str()),
                        range,
                    )?
                    .ok_or_else(|| {
                        format!("{} has no version matching {range}", specifier.package)
                    })?
                }
            };
            self.lockfile.version(key, version.clone())?;
            self.chosen
                .entry(specifier.package.clone())
                .or_default()
                .push(version.clone());
            version
        };
        let info = self.package_version(&specifier.package, &version)?;
        let path = info.exports.get(&specifier.export).ok_or_else(|| {
            format!(
                "{}@{} does not export {}",
                specifier.package, version, specifier.export
            )
        })?;
        supported(path)?;
        self.registry
            .join(&format!("{}/{version}/{path}", specifier.package))
            .map_err(|e| e.to_string())
    }

    pub fn package_of(&self, url: &Url) -> Option<String> {
        self.file_of(url)
            .map(|(package, version, _)| format!("{package}@{version}"))
    }

    fn file_of(&self, url: &Url) -> Option<(String, String, String)> {
        let relative = url.as_str().strip_prefix(self.registry.as_str())?;
        let parts: Vec<_> = relative.split('/').collect();
        if parts.len() < 4
            || !parts[0].starts_with('@')
            || !segment(&parts[0][1..])
            || !segment(parts[1])
            || strict_version(parts[2]).is_none()
            || !parts[3..].iter().all(|part| segment(part))
        {
            return None;
        }
        Some((
            format!("{}/{}", parts[0], parts[1]),
            parts[2].into(),
            parts[3..].join("/"),
        ))
    }

    pub fn load(&mut self, url: &Url) -> Result<ModuleDeclaration, ModuleResolutionError> {
        let (package, version, path) = self
            .file_of(url)
            .ok_or_else(|| error(url, "not a file of a package version".into(), None))?;
        supported(&path).map_err(|message| error(url, message, None))?;
        let info = self
            .package_version(&package, &version)
            .map_err(|message| error(url, message, None))?;
        let target = if path.ends_with(".uff") {
            format!(
                "{}/ast/{}.uffda.ast.json",
                info.out_dir,
                &path[..path.len() - 4]
            )
        } else {
            path
        };
        let bytes = self
            .package_file(&info, &target)
            .map_err(|message| error(url, message, None))?;
        let text = String::from_utf8(bytes).map_err(|cause| {
            error(
                url,
                "declaration is not UTF-8".into(),
                Some(cause.to_string()),
            )
        })?;
        decode_declaration(url, &text)
    }

    fn package_version(
        &mut self,
        package: &str,
        version: &str,
    ) -> Result<Rc<PackageVersion>, String> {
        if strict_version(version).is_none() {
            return Err("invalid package version".into());
        }
        let key = format!("{package}@{version}");
        if let Some(info) = self.versions.get(&key) {
            return Ok(Rc::clone(info));
        }
        let meta_path = format!("{package}/{version}_meta.json");
        let locked = self
            .lockfile
            .data
            .jsr
            .get(&key)
            .map(|v| v.integrity.clone());
        let cached = self.read_cache(&meta_path)?;
        let bytes = match cached.filter(|bytes| {
            locked
                .as_ref()
                .is_none_or(|locked| sha256(bytes) == *locked)
        }) {
            Some(bytes) => bytes,
            None => self.download(&meta_path)?,
        };
        let integrity = sha256(&bytes);
        if locked.as_ref().is_some_and(|locked| *locked != integrity) {
            return Err(format!(
                "{key}'s version meta does not match the lockfile integrity"
            ));
        }
        self.write_cache(&meta_path, &bytes)?;
        self.lockfile.integrity(key.clone(), integrity)?;
        let parsed: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        let files = parsed
            .get("manifest")
            .and_then(Value::as_object)
            .ok_or("version meta lists no manifest")?;
        let mut manifest = BTreeMap::new();
        for (path, info) in files {
            let path = path
                .strip_prefix('/')
                .ok_or("manifest paths must start with /")?;
            safe_path(path)?;
            let hash = info
                .get("checksum")
                .and_then(Value::as_str)
                .and_then(|v| v.strip_prefix("sha256-"))
                .ok_or("manifest entry lacks sha256 checksum")?;
            if hash.len() != 64 || !hash.bytes().all(|c| c.is_ascii_hexdigit()) {
                return Err("invalid sha256 checksum".into());
            }
            manifest.insert(path.into(), hash.into());
        }
        let mut info = PackageVersion {
            package: package.into(),
            version: version.into(),
            manifest,
            exports: BTreeMap::new(),
            out_dir: "bin".into(),
        };
        let project_bytes = self.package_file(&info, "uffda.jsonc")?;
        let text = String::from_utf8(project_bytes).map_err(|e| e.to_string())?;
        let project: Value = jsonc_parser::parse_to_serde_value(&text, &Default::default())
            .map_err(|e| e.to_string())?
            .ok_or("uffda.jsonc must contain an object")?;
        let fields = project.as_object().ok_or("uffda.jsonc must be an object")?;
        if fields
            .keys()
            .any(|key| !["imports", "exports", "languages", "outDir"].contains(&key.as_str()))
        {
            return Err("uffda.jsonc contains unknown fields".into());
        }
        validate_project_fields(fields)?;
        if let Some(exports) = fields.get("exports") {
            for (name, path) in exports.as_object().ok_or("exports must be an object")? {
                if name != "." {
                    relative_project_path(name)?;
                }
                let path = path.as_str().ok_or("export target must be a string")?;
                info.exports
                    .insert(name.clone(), relative_project_path(path)?);
            }
        }
        if let Some(out_dir) = fields.get("outDir") {
            info.out_dir =
                relative_project_path(out_dir.as_str().ok_or("outDir must be a string")?)?;
        }
        let info = Rc::new(info);
        self.versions.insert(key, Rc::clone(&info));
        Ok(info)
    }

    fn package_file(&self, info: &PackageVersion, path: &str) -> Result<Vec<u8>, String> {
        safe_path(path)?;
        let checksum = info
            .manifest
            .get(path)
            .ok_or_else(|| format!("{}@{} has no file {path}", info.package, info.version))?;
        let registry_path = format!("{}/{}/{path}", info.package, info.version);
        if let Some(bytes) = self
            .read_cache(&registry_path)?
            .filter(|bytes| sha256(bytes) == *checksum)
        {
            return Ok(bytes);
        }
        let bytes = self.download(&registry_path)?;
        if sha256(&bytes) != *checksum {
            return Err(format!("{path} does not match its manifest checksum"));
        }
        self.write_cache(&registry_path, &bytes)?;
        Ok(bytes)
    }

    fn download(&self, path: &str) -> Result<Vec<u8>, String> {
        let url = self.registry.join(path).map_err(|e| e.to_string())?;
        self.transport
            .read(&url)
            .map_err(|e| format!("unable to fetch {url}: {e}"))
    }

    fn cache_path(&self, path: &str) -> Result<PathBuf, String> {
        if path
            .split('/')
            .any(|v| v.is_empty() || v == "." || v == ".." || v.contains('\\'))
        {
            return Err("invalid cache path".into());
        }
        Ok(self.cache_dir.join("jsr").join(path))
    }

    fn read_cache(&self, path: &str) -> Result<Option<Vec<u8>>, String> {
        match std::fs::read(self.cache_path(path)?) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn write_cache(&self, path: &str, bytes: &[u8]) -> Result<(), String> {
        let path = self.cache_path(path)?;
        std::fs::create_dir_all(path.parent().ok_or("cache path has no parent")?)
            .map_err(|e| e.to_string())?;
        atomic_write(&path, bytes)
    }
}

fn supported(path: &str) -> Result<(), String> {
    if path.ends_with(".uff") || path.ends_with(".json") {
        Ok(())
    } else {
        Err("a package supplies .uff or .json modules only".into())
    }
}

fn safe_path(path: &str) -> Result<(), String> {
    if path.is_empty() || path.split('/').any(|v| !segment(v)) {
        Err(format!("invalid package path {path}"))
    } else {
        Ok(())
    }
}

fn relative_project_path(path: &str) -> Result<String, String> {
    let path = path
        .strip_prefix("./")
        .ok_or("project path must start with ./")?;
    safe_path(path)?;
    Ok(path.into())
}

pub(crate) fn normalize_project_path(path: &str) -> Result<String, String> {
    relative_project_path(path)
}

fn validate_project_fields(fields: &serde_json::Map<String, Value>) -> Result<(), String> {
    let mut aliases = BTreeMap::new();
    if let Some(imports) = fields.get("imports") {
        for (alias, target) in imports.as_object().ok_or("imports must be an object")? {
            if !alias.starts_with('@') || !alias[1..].split('/').all(segment) {
                return Err(format!("invalid module alias {alias}"));
            }
            let target = target
                .as_str()
                .ok_or("import target must be a jsr: string")?;
            parse_specifier(target)?;
            aliases.insert(alias, target);
        }
        if aliases.keys().any(|alias| {
            aliases
                .keys()
                .any(|other| other != alias && other.starts_with(&format!("{alias}/")))
        }) {
            return Err("project import aliases overlap".into());
        }
    }
    if let Some(languages) = fields.get("languages") {
        let mut seen = std::collections::HashSet::new();
        for language in languages.as_array().ok_or("languages must be an array")? {
            let language = language
                .as_str()
                .ok_or("language must be a module specifier string")?;
            if !seen.insert(language) {
                return Err(format!("duplicate language {language}"));
            }
            if language.starts_with("jsr:") {
                parse_specifier(language)?;
            } else if let Some(name) = language.strip_prefix('@') {
                if !name.split('/').all(segment)
                    || !aliases.keys().any(|alias| {
                        language == alias.as_str() || language.starts_with(&format!("{alias}/"))
                    })
                {
                    return Err(format!(
                        "language {language} does not name a declared import alias"
                    ));
                }
            } else if language.starts_with("./") || language.starts_with("../") {
                let mut path = language;
                if let Some(relative) = path.strip_prefix("./") {
                    path = relative;
                } else {
                    while let Some(relative) = path.strip_prefix("../") {
                        path = relative;
                    }
                }
                if safe_path(path).is_err() {
                    return Err(format!("invalid language module specifier {language}"));
                }
            } else {
                return Err(format!("invalid language module specifier {language}"));
            }
        }
    }
    Ok(())
}

pub fn default_cache_dir() -> Result<PathBuf, String> {
    for key in ["XDG_CACHE_HOME", "LOCALAPPDATA", "HOME"] {
        match std::env::var_os(key) {
            Some(value) if !value.is_empty() => {
                let path = PathBuf::from(value);
                if !path.is_absolute() {
                    return Err(format!("{key} must name an absolute cache directory"));
                }
                return Ok(if key == "HOME" {
                    path.join(".cache/uffda")
                } else {
                    path.join("uffda")
                });
            }
            _ => {}
        }
    }
    Err("no cache home is configured (XDG_CACHE_HOME, LOCALAPPDATA, HOME)".into())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let temporary = path.with_extension(format!(
        "tmp-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        std::io::Write::write_all(&mut file, bytes)?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)?;
        Ok::<_, std::io::Error>(())
    })();
    if let Err(cause) = result {
        match std::fs::remove_file(&temporary) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(cleanup) => {
                return Err(format!("{cause}; removing temporary cache file: {cleanup}"));
            }
        }
        return Err(cause.to_string());
    }
    Ok(())
}

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod ported;
#[cfg(test)]
mod tests;
