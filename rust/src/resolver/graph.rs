use super::{ModuleDeclaration, ModuleResolutionError, Resolver, error};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::rc::Rc;
use url::Url;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ImportFrame {
    pub importer_url: String,
    pub import_index: usize,
    pub module_url: String,
    pub resolved_url: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemberKind {
    Rule,
    Func,
    Decorator,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModuleMember {
    pub module_url: Url,
    pub kind: MemberKind,
    pub declaration_index: usize,
}

pub struct ResolvedModule {
    pub declaration: Rc<ModuleDeclaration>,
    pub locals: BTreeMap<String, ModuleMember>,
    pub imports: BTreeMap<String, ModuleMember>,
    pub exports: BTreeMap<String, ModuleMember>,
    pub default: Option<ModuleMember>,
}

pub struct ModuleGraph {
    pub entry: Url,
    pub modules: HashMap<Url, ResolvedModule>,
}

#[derive(Deserialize)]
struct Export {
    kind: ExportKind,
    name: String,
    #[serde(default)]
    default: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum ExportKind {
    Rule,
    Func,
    Decorator,
    Import,
}

#[derive(Deserialize)]
struct Import {
    kind: ImportKind,
    #[serde(rename = "moduleUrl")]
    module_url: String,
    names: Vec<String>,
    module: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum ImportKind {
    Module,
    Native,
}

struct Edge {
    frame: ImportFrame,
    target: Url,
    names: Vec<String>,
}

impl Resolver {
    pub fn set_import_map(
        &mut self,
        imports: BTreeMap<String, String>,
    ) -> Result<(), ModuleResolutionError> {
        for (alias, target) in &imports {
            if !alias.starts_with('@')
                || alias[1..]
                    .split('/')
                    .any(|part| !super::packages::valid_segment(part))
            {
                return Err(error(
                    &Url::parse("uffda:import-map").expect("static URL"),
                    format!("invalid module alias {alias}"),
                    None,
                ));
            }
            super::packages::parse_specifier(target).map_err(|message| {
                error(
                    &Url::parse("uffda:import-map").expect("static URL"),
                    message,
                    None,
                )
            })?;
            if imports
                .keys()
                .any(|other| other != alias && other.starts_with(&format!("{alias}/")))
            {
                return Err(error(
                    &Url::parse("uffda:import-map").expect("static URL"),
                    format!("overlapping module alias {alias}"),
                    None,
                ));
            }
        }
        self.import_map = imports;
        Ok(())
    }

    pub fn load_graph(&mut self, url: &Url) -> Result<Rc<ModuleGraph>, ModuleResolutionError> {
        let entry = self.canonical_url(url)?;
        if let Some(graph) = self.graphs.get(&entry) {
            return Ok(Rc::clone(graph));
        }
        let mut graph = ModuleGraph {
            entry: entry.clone(),
            modules: HashMap::new(),
        };
        let mut edges: HashMap<Url, Vec<Edge>> = HashMap::new();
        let mut parents: HashMap<Url, (Url, ImportFrame)> = HashMap::new();
        let mut pending = vec![entry.clone()];
        let mut discovery = Vec::new();
        while let Some(url) = pending.pop() {
            if graph.modules.contains_key(&url) {
                continue;
            }
            let declaration = self
                .load_declaration(&url)
                .map_err(|error| annotate(error, &url, &entry, &parents))?;
            let resolved = materialize(&url, Rc::clone(&declaration))
                .map_err(|error| annotate(error, &url, &entry, &parents))?;
            graph.modules.insert(url.clone(), resolved);
            discovery.push(url.clone());
            let mut imports = Vec::new();
            for (index, value) in declaration.imports.iter().enumerate() {
                if !value.is_object() {
                    return Err(annotate(
                        error(&url, "import declaration must be an object".into(), None),
                        &url,
                        &entry,
                        &parents,
                    ));
                }
                let import: Import = serde_json::from_value(value.clone()).map_err(|cause| {
                    annotate(
                        error(
                            &url,
                            "invalid import declaration".into(),
                            Some(cause.to_string()),
                        ),
                        &url,
                        &entry,
                        &parents,
                    )
                })?;
                let mut frame = ImportFrame {
                    importer_url: url.to_string(),
                    import_index: index,
                    module_url: import.module_url.clone(),
                    resolved_url: None,
                    name: None,
                };
                let target =
                    self.resolve_import(&url, &import.module_url)
                        .map_err(|mut error| {
                            error.import_chain.push(frame.clone());
                            annotate(error, &url, &entry, &parents)
                        })?;
                frame.resolved_url = Some(target.to_string());
                if matches!(import.kind, ImportKind::Native)
                    && !self.declarations.contains_key(&target)
                {
                    let payload = import.module.ok_or_else(|| {
                        let mut failure = error(
                            &url,
                            "native import lacks explicitly supplied declaration".into(),
                            None,
                        );
                        failure.import_chain.push(frame.clone());
                        annotate(failure, &url, &entry, &parents)
                    })?;
                    let text = serde_json::to_string(&payload).map_err(|cause| {
                        error(
                            &url,
                            "invalid native import declaration".into(),
                            Some(cause.to_string()),
                        )
                    })?;
                    let declaration =
                        super::decode_declaration(&target, &text).map_err(|mut error| {
                            error.import_chain.push(frame.clone());
                            annotate(error, &url, &entry, &parents)
                        })?;
                    self.insert_declaration(target.clone(), declaration);
                }
                if target != entry {
                    parents
                        .entry(target.clone())
                        .or_insert_with(|| (url.clone(), frame.clone()));
                }
                imports.push(Edge {
                    frame,
                    target,
                    names: import.names,
                });
            }
            pending.extend(imports.iter().rev().map(|edge| edge.target.clone()));
            edges.insert(url, imports);
        }
        // Locally exported declarations are visible before linking, including
        // across cycles. Re-exports advance monotonically until no edge changes.
        let mut dependents: HashMap<Url, Vec<Url>> = HashMap::new();
        for url in &discovery {
            for edge in &edges[url] {
                dependents
                    .entry(edge.target.clone())
                    .or_default()
                    .push(url.clone());
            }
        }
        let mut linking: VecDeque<_> = discovery.iter().cloned().collect();
        let mut queued: HashSet<_> = discovery.iter().cloned().collect();
        while let Some(url) = linking.pop_front() {
            queued.remove(&url);
            let mut exports_changed = false;
            {
                let url = &url;
                for edge in &edges[url] {
                    for name in &edge.names {
                        let member = graph.modules[&edge.target].exports.get(name).cloned();
                        if let Some(member) = member {
                            let module = graph.modules.get_mut(url).expect("known module");
                            if module.locals.contains_key(name) {
                                let mut failure = error(
                                    url,
                                    format!("Import {name} conflicts with local declaration"),
                                    None,
                                );
                                let mut frame = edge.frame.clone();
                                frame.name = Some(name.clone());
                                failure.import_chain.push(frame);
                                return Err(annotate(failure, url, &entry, &parents));
                            }
                            if edges[url]
                                .iter()
                                .rev()
                                .find(|other| other.names.contains(name))
                                .is_some_and(|other| {
                                    other.frame.import_index != edge.frame.import_index
                                })
                            {
                                continue;
                            }
                            if module.imports.get(name) != Some(&member) {
                                module.imports.insert(name.clone(), member);
                            }
                        }
                    }
                }
                let module = graph.modules.get_mut(url).expect("known module");
                for value in &module.declaration.exports {
                    if !value.is_object() {
                        return Err(error(
                            url,
                            "export declaration must be an object".into(),
                            None,
                        ));
                    }
                    let export: Export =
                        serde_json::from_value(value.clone()).map_err(|cause| {
                            error(
                                url,
                                "invalid export declaration".into(),
                                Some(cause.to_string()),
                            )
                        })?;
                    if matches!(export.kind, ExportKind::Import)
                        && let Some(member) = module.imports.get(&export.name).cloned()
                    {
                        if module.exports.get(&export.name) != Some(&member) {
                            module.exports.insert(export.name, member.clone());
                            exports_changed = true;
                        }
                        if export.default {
                            module.default = Some(member);
                        }
                    }
                }
            }
            if exports_changed && let Some(importers) = dependents.get(&url) {
                for importer in importers {
                    if queued.insert(importer.clone()) {
                        linking.push_back(importer.clone());
                    }
                }
            }
        }
        for url in &discovery {
            let imports = &edges[url];
            for edge in imports {
                for name in &edge.names {
                    if !graph.modules[&edge.target].exports.contains_key(name) {
                        let mut failure = error(
                            url,
                            format!("Unknown export {name} from module {}", edge.target),
                            None,
                        );
                        let mut frame = edge.frame.clone();
                        frame.name = Some(name.clone());
                        failure.import_chain.push(frame);
                        return Err(annotate(failure, url, &entry, &parents));
                    }
                }
            }
            let module = &graph.modules[url];
            for value in &module.declaration.exports {
                let export: Export =
                    serde_json::from_value(value.clone()).expect("previously validated export");
                if !module.exports.contains_key(&export.name) {
                    return Err(annotate(
                        error(url, format!("Unknown import {}", export.name), None),
                        url,
                        &entry,
                        &parents,
                    ));
                }
            }
        }
        let graph = Rc::new(graph);
        self.graphs.insert(entry, Rc::clone(&graph));
        Ok(graph)
    }

    fn resolve_import(
        &mut self,
        importer: &Url,
        specifier: &str,
    ) -> Result<Url, ModuleResolutionError> {
        let package = self.packages.as_ref().and_then(|p| p.package_of(importer));
        let full = if specifier.starts_with('@') {
            if let Some(package) = &package {
                return Err(error(
                    importer,
                    format!(
                        "{specifier} is a module name, which a module of package {package} may not import"
                    ),
                    None,
                ));
            }
            unfurl_specifier(&self.import_map, specifier)
                .map_err(|message| error(importer, message, None))?
        } else {
            specifier.to_string()
        };
        let specified = importer.join(&full).map_err(|cause| {
            error(
                importer,
                format!("invalid module specifier {specifier}"),
                Some(cause.to_string()),
            )
        })?;
        let canonical = self.canonical_url(&specified)?;
        if let Some(package) = package
            && !full.starts_with("jsr:")
            && self
                .packages
                .as_ref()
                .and_then(|p| p.package_of(&canonical))
                .as_deref()
                != Some(&package)
        {
            return Err(error(
                importer,
                format!("{specifier} is outside package {package}"),
                None,
            ));
        }
        Ok(canonical)
    }
}

pub(crate) fn unfurl_specifier(
    imports: &BTreeMap<String, String>,
    specifier: &str,
) -> Result<String, String> {
    if !specifier.starts_with('@') {
        return Ok(specifier.to_owned());
    }
    let (alias, target) = imports
        .iter()
        .find(|(alias, _)| {
            specifier == alias.as_str()
                || specifier
                    .strip_prefix(alias.as_str())
                    .is_some_and(|rest| rest.starts_with('/'))
        })
        .ok_or_else(|| {
            format!("{specifier} is not a module name the project file's imports declares")
        })?;
    Ok(format!("{target}{}", &specifier[alias.len()..]))
}

fn materialize(
    url: &Url,
    declaration: Rc<ModuleDeclaration>,
) -> Result<ResolvedModule, ModuleResolutionError> {
    let mut locals = BTreeMap::new();
    for (kind, declarations) in [
        (MemberKind::Rule, &declaration.rules),
        (MemberKind::Func, &declaration.funcs),
        (MemberKind::Decorator, &declaration.decorators),
    ] {
        for (index, value) in declarations.iter().enumerate() {
            let record = value
                .as_object()
                .ok_or_else(|| error(url, "member declaration must be an object".into(), None))?;
            let name = record
                .get("name")
                .and_then(Value::as_str)
                .ok_or_else(|| error(url, "member declaration lacks name".into(), None))?;
            if !record.get("pattern").is_some_and(Value::is_object) {
                return Err(error(
                    url,
                    format!("declaration {name} lacks pattern"),
                    None,
                ));
            }
            if kind == MemberKind::Rule && !record.get("parameters").is_some_and(Value::is_array) {
                return Err(error(url, format!("rule {name} lacks parameters"), None));
            }
            if kind != MemberKind::Rule && !record.get("expression").is_some_and(Value::is_object) {
                return Err(error(
                    url,
                    format!("callable {name} lacks expression"),
                    None,
                ));
            }
            if locals
                .insert(
                    name.into(),
                    ModuleMember {
                        module_url: url.clone(),
                        kind,
                        declaration_index: index,
                    },
                )
                .is_some()
            {
                return Err(error(
                    url,
                    format!("duplicate local declaration {name}"),
                    None,
                ));
            }
        }
    }
    let mut module = ResolvedModule {
        declaration,
        locals,
        imports: BTreeMap::new(),
        exports: BTreeMap::new(),
        default: None,
    };
    let mut default_count = 0;
    for value in &module.declaration.exports {
        let export: Export = serde_json::from_value(value.clone()).map_err(|cause| {
            error(
                url,
                "invalid export declaration".into(),
                Some(cause.to_string()),
            )
        })?;
        if export.default {
            default_count += 1;
        }
        if default_count > 1 {
            return Err(error(
                url,
                "module cannot have multiple default exports".into(),
                None,
            ));
        }
        let expected = match export.kind {
            ExportKind::Rule => MemberKind::Rule,
            ExportKind::Func => MemberKind::Func,
            ExportKind::Decorator => MemberKind::Decorator,
            ExportKind::Import => continue,
        };
        let member = module
            .locals
            .get(&export.name)
            .filter(|m| m.kind == expected)
            .ok_or_else(|| error(url, format!("Unknown {expected:?} {}", export.name), None))?
            .clone();
        if export.default {
            module.default = Some(member.clone());
        }
        module.exports.insert(export.name, member);
    }
    Ok(module)
}

fn annotate(
    mut error: ModuleResolutionError,
    url: &Url,
    entry: &Url,
    parents: &HashMap<Url, (Url, ImportFrame)>,
) -> ModuleResolutionError {
    let mut url = url;
    let mut seen = HashSet::new();
    let mut chain = Vec::new();
    while url != entry && seen.insert(url.clone()) {
        let Some((parent, frame)) = parents.get(url) else {
            break;
        };
        chain.push(frame.clone());
        url = parent;
    }
    chain.reverse();
    chain.append(&mut error.import_chain);
    error.import_chain = chain;
    error
}

#[cfg(test)]
mod tests;
