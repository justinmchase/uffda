use crate::environment::Environment;
use crate::evaluate::{CompiledExpression, ExpressionExecution};
use crate::expression::Expression;
use crate::pattern::{Pattern, PatternProgram};
use crate::program::Program;
use crate::provenance::Origin;
use crate::resolver::graph::{MemberKind, ModuleGraph, ModuleMember};
use crate::value::{Declaration, RuntimeUrl, Value};
use gc_arena::{Collect, Gc, Mutation, RefLock};
use serde::Deserialize;
use std::collections::HashMap;
use std::fmt;
use std::rc::Rc;
use url::Url;

#[derive(Debug)]
pub struct ModuleCompileError {
    pub module_url: Box<Url>,
    pub kind: MemberKind,
    pub declaration_index: usize,
    pub message: String,
}

impl fmt::Display for ModuleCompileError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Unable to compile {:?} declaration {} in {}: {}",
            self.kind, self.declaration_index, self.module_url, self.message
        )
    }
}

impl std::error::Error for ModuleCompileError {}

#[derive(Deserialize)]
struct Parameter {
    name: String,
}

#[derive(Deserialize)]
struct AttributeSyntax {
    name: String,
    args: Vec<Expression>,
}

#[derive(Deserialize)]
struct RuleSyntax {
    name: String,
    parameters: Vec<Parameter>,
    pattern: Pattern,
    expression: Option<Expression>,
    #[serde(default)]
    attributes: Vec<AttributeSyntax>,
}

#[derive(Deserialize)]
struct FuncSyntax {
    name: String,
    pattern: Pattern,
    expression: Expression,
    #[serde(default)]
    attributes: Vec<AttributeSyntax>,
}

pub struct Attribute {
    pub name: String,
    pub(crate) args: Vec<Rc<Program>>,
}

impl Attribute {
    pub fn arguments(&self) -> impl Iterator<Item = CompiledExpression> + '_ {
        self.args
            .iter()
            .cloned()
            .map(CompiledExpression::from_program)
    }
}

pub struct CompiledDeclaration {
    pub name: String,
    pub parameters: Vec<String>,
    pub attributes: Vec<Attribute>,
    pub(crate) pattern: Rc<PatternProgram>,
    pub(crate) expression: Option<Rc<Program>>,
}

struct CompiledModule {
    rules: Vec<Rc<CompiledDeclaration>>,
    funcs: Vec<Rc<CompiledDeclaration>>,
    decorators: Vec<Rc<CompiledDeclaration>>,
}

pub struct CompiledModuleGraph {
    pub graph: Rc<ModuleGraph>,
    modules: HashMap<Url, CompiledModule>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct BoundCallable<'gc> {
    #[collect(require_static)]
    member: ModuleMember,
    value: Value<'gc>,
}

#[derive(Collect)]
#[collect(no_drop)]
struct BoundDeclaration<'gc> {
    #[collect(require_static)]
    member: ModuleMember,
    value: Value<'gc>,
    info: Option<Value<'gc>>,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct ModuleBindings<'gc> {
    environments: Vec<(String, Environment<'gc>)>,
    callables: Vec<BoundCallable<'gc>>,
    declarations: Vec<BoundDeclaration<'gc>>,
}

impl<'gc> ModuleBindings<'gc> {
    pub fn new(mc: &Mutation<'gc>, graph: &CompiledModuleGraph) -> Result<Self, String> {
        Self::with_environment(mc, graph, None)
    }

    pub fn with_environment(
        mc: &Mutation<'gc>,
        graph: &CompiledModuleGraph,
        parent: Option<Environment<'gc>>,
    ) -> Result<Self, String> {
        let mut runtime_modules = HashMap::new();
        for url in graph.modules.keys() {
            runtime_modules.insert(
                url.clone(),
                Value::object(
                    mc,
                    vec![
                        (
                            "moduleUrl".into(),
                            Value::Url(Gc::new(mc, RuntimeUrl(url.clone()))),
                        ),
                        ("default".into(), Value::Undefined),
                    ],
                ),
            );
        }
        let mut subjects = Vec::new();
        for (url, module) in &graph.modules {
            for (kind, declarations, sources) in [
                (
                    MemberKind::Rule,
                    &module.rules,
                    &graph.graph.modules[url].declaration.rules,
                ),
                (
                    MemberKind::Func,
                    &module.funcs,
                    &graph.graph.modules[url].declaration.funcs,
                ),
                (
                    MemberKind::Decorator,
                    &module.decorators,
                    &graph.graph.modules[url].declaration.decorators,
                ),
            ] {
                for (index, compiled) in declarations.iter().enumerate() {
                    let member = ModuleMember {
                        module_url: url.clone(),
                        kind,
                        declaration_index: index,
                    };
                    let source = &sources[index];
                    let mut properties = crate::value::ObjectProperties::default();
                    properties.set("name".into(), Value::string(mc, &compiled.name));
                    properties.set("module".into(), runtime_modules[url]);
                    for name in ["pattern", "parameters", "expression"] {
                        if let Some(value) = source.get(name) {
                            let mut execution = ExpressionExecution::new(
                                mc,
                                Expression::Value {
                                    value: Some(value.clone()),
                                },
                                Environment::new(mc, None, vec![]),
                                Origin { start: 0, end: 0 },
                                Value::Undefined,
                            );
                            while !execution.step(mc).map_err(|e| e.to_string())? {}
                            properties.set(
                                name.into(),
                                execution.result().ok_or("invalid structural value")?,
                            );
                        }
                    }
                    subjects.push(BoundDeclaration {
                        member: member.clone(),
                        info: (kind == MemberKind::Rule).then(|| {
                            Value::object(
                                mc,
                                vec![
                                    ("kind".into(), Value::string(mc, "rule")),
                                    ("name".into(), Value::string(mc, &compiled.name)),
                                    ("moduleUrl".into(), Value::string(mc, url.as_str())),
                                    (
                                        "parameters".into(),
                                        Value::array(
                                            mc,
                                            compiled
                                                .parameters
                                                .iter()
                                                .map(|name| Value::string(mc, name))
                                                .collect(),
                                        ),
                                    ),
                                ],
                            )
                        }),
                        value: Value::Declaration(Gc::new(
                            mc,
                            Declaration {
                                member,
                                compiled: compiled.clone(),
                                properties: Gc::new(mc, RefLock::new(properties)),
                            },
                        )),
                    });
                }
            }
        }
        for (url, module) in &graph.graph.modules {
            let Value::Object(object) = runtime_modules[url] else {
                unreachable!()
            };
            let mut object = object.borrow_mut(mc);
            for (name, entries) in [
                ("imports", &module.imports),
                ("exports", &module.exports),
                ("rules", &module.locals),
                ("funcs", &module.locals),
                ("decorators", &module.locals),
                ("decoratorImports", &module.imports),
            ] {
                let values = entries
                    .iter()
                    .filter(|(_, member)| match name {
                        "rules" => member.kind == MemberKind::Rule,
                        "funcs" => member.kind == MemberKind::Func,
                        "decorators" | "decoratorImports" => member.kind == MemberKind::Decorator,
                        "imports" => member.kind != MemberKind::Decorator,
                        _ => true,
                    })
                    .map(|(name, member)| {
                        let value = subjects
                            .iter()
                            .find(|subject| &subject.member == member)
                            .ok_or("missing canonical module member")?
                            .value;
                        Ok((Value::string(mc, name), value))
                    })
                    .collect::<Result<Vec<_>, String>>()?;
                object.set(name.into(), Value::map(mc, values));
            }
            if let Some(member) = &module.default {
                let value = subjects
                    .iter()
                    .find(|subject| &subject.member == member)
                    .ok_or("missing canonical default member")?
                    .value;
                object.set("default".into(), value);
            }
        }
        let mut builders: HashMap<_, _> = graph
            .graph
            .modules
            .keys()
            .map(|url| (url.clone(), Environment::builder(mc, parent)))
            .collect();
        let mut callables = Vec::new();
        for (url, module) in &graph.modules {
            let environment = builders
                .get(url)
                .ok_or("missing module environment")?
                .environment();
            for (kind, declarations) in [
                (MemberKind::Func, &module.funcs),
                (MemberKind::Decorator, &module.decorators),
            ] {
                for (index, declaration) in declarations.iter().enumerate() {
                    let expression = declaration
                        .expression
                        .as_ref()
                        .ok_or("callable has no expression program")?;
                    let member = ModuleMember {
                        module_url: url.clone(),
                        kind,
                        declaration_index: index,
                    };
                    let value = CompiledExpression::from_program(expression.clone()).bind_compiled(
                        mc,
                        Environment::new(mc, Some(environment), vec![]),
                        Origin { start: 0, end: 0 },
                        declaration.pattern.clone(),
                    );
                    if kind == MemberKind::Func {
                        builders
                            .get_mut(url)
                            .ok_or("missing module environment")?
                            .define(mc, declaration.name.clone(), value)?;
                    }
                    callables.push(BoundCallable { member, value });
                }
            }
        }
        for (url, module) in &graph.graph.modules {
            for (name, member) in &module.imports {
                if member.kind == MemberKind::Func {
                    let value = callables
                        .iter()
                        .find(|value| &value.member == member)
                        .ok_or("missing imported callable")?
                        .value;
                    builders
                        .get_mut(url)
                        .ok_or("missing module environment")?
                        .define(mc, name.clone(), value)?;
                }
            }
        }
        for (url, module) in &graph.graph.modules {
            let builder = builders.get_mut(url).ok_or("missing module environment")?;
            for (name, member) in module.locals.iter().chain(module.imports.iter()) {
                if member.kind == MemberKind::Rule && builder.environment().get(name).is_none() {
                    let info = subjects
                        .iter()
                        .find(|subject| &subject.member == member)
                        .and_then(|subject| subject.info)
                        .ok_or("missing rule info")?;
                    builder.define(mc, name.clone(), info)?;
                }
            }
        }
        Ok(Self {
            environments: builders
                .into_iter()
                .map(|(url, builder)| (url.to_string(), builder.finish()))
                .collect(),
            callables,
            declarations: subjects,
        })
    }

    pub fn declaration(&self, member: &ModuleMember) -> Option<Value<'gc>> {
        self.declarations
            .iter()
            .find(|subject| &subject.member == member)
            .map(|subject| subject.value)
    }

    pub fn environment(&self, module: &Url) -> Option<Environment<'gc>> {
        self.environments
            .iter()
            .find(|(url, _)| url == module.as_str())
            .map(|(_, env)| *env)
    }

    pub fn callable(&self, member: &ModuleMember) -> Option<Value<'gc>> {
        self.callables
            .iter()
            .find(|value| &value.member == member)
            .map(|value| value.value)
    }
}

fn attributes(syntax: Vec<AttributeSyntax>) -> Vec<Attribute> {
    syntax
        .into_iter()
        .map(|attribute| Attribute {
            name: attribute.name,
            args: attribute.args.into_iter().map(Program::compile).collect(),
        })
        .collect()
}

impl CompiledModuleGraph {
    pub fn compile(graph: Rc<ModuleGraph>) -> Result<Self, ModuleCompileError> {
        let mut modules = HashMap::new();
        let mut source_modules: Vec<_> = graph.modules.iter().collect();
        source_modules.sort_by(|(left, _), (right, _)| left.as_str().cmp(right.as_str()));
        for (url, module) in source_modules {
            let mut compiled = CompiledModule {
                rules: Vec::new(),
                funcs: Vec::new(),
                decorators: Vec::new(),
            };
            for (index, value) in module.declaration.rules.iter().enumerate() {
                let syntax: RuleSyntax =
                    serde_json::from_value(value.clone()).map_err(|error| ModuleCompileError {
                        module_url: Box::new(url.clone()),
                        kind: MemberKind::Rule,
                        declaration_index: index,
                        message: error.to_string(),
                    })?;
                let mut parameters = Vec::new();
                for parameter in syntax.parameters {
                    if parameters.contains(&parameter.name) {
                        return Err(ModuleCompileError {
                            module_url: Box::new(url.clone()),
                            kind: MemberKind::Rule,
                            declaration_index: index,
                            message: format!("duplicate rule parameter {}", parameter.name),
                        });
                    }
                    parameters.push(parameter.name);
                }
                compiled.rules.push(Rc::new(CompiledDeclaration {
                    name: syntax.name,
                    parameters,
                    attributes: attributes(syntax.attributes),
                    pattern: PatternProgram::compile(syntax.pattern),
                    expression: syntax.expression.map(Program::compile),
                }));
            }
            for (kind, values, target) in [
                (
                    MemberKind::Func,
                    &module.declaration.funcs,
                    &mut compiled.funcs,
                ),
                (
                    MemberKind::Decorator,
                    &module.declaration.decorators,
                    &mut compiled.decorators,
                ),
            ] {
                for (index, value) in values.iter().enumerate() {
                    let syntax: FuncSyntax =
                        serde_json::from_value(value.clone()).map_err(|error| {
                            ModuleCompileError {
                                module_url: Box::new(url.clone()),
                                kind,
                                declaration_index: index,
                                message: error.to_string(),
                            }
                        })?;
                    target.push(Rc::new(CompiledDeclaration {
                        name: syntax.name,
                        parameters: Vec::new(),
                        attributes: attributes(syntax.attributes),
                        pattern: PatternProgram::compile(syntax.pattern),
                        expression: Some(Program::compile(syntax.expression)),
                    }));
                }
            }
            modules.insert(url.clone(), compiled);
        }
        Ok(Self { graph, modules })
    }

    pub fn declaration(&self, member: &ModuleMember) -> Option<Rc<CompiledDeclaration>> {
        let module = self.modules.get(&member.module_url)?;
        let declarations = match member.kind {
            MemberKind::Rule => &module.rules,
            MemberKind::Func => &module.funcs,
            MemberKind::Decorator => &module.decorators,
        };
        declarations.get(member.declaration_index).cloned()
    }

    pub fn resolve(&self, module: &Url, name: &str) -> Option<ModuleMember> {
        let module = self.graph.modules.get(module)?;
        module
            .locals
            .get(name)
            .or_else(|| module.imports.get(name))
            .filter(|member| member.kind != MemberKind::Decorator)
            .cloned()
    }

    pub fn resolve_decorator(&self, module: &Url, name: &str) -> Option<ModuleMember> {
        let module = self.graph.modules.get(module)?;
        module
            .locals
            .get(name)
            .or_else(|| module.imports.get(name))
            .filter(|member| member.kind == MemberKind::Decorator)
            .cloned()
    }

    pub fn export(&self, module: &Url, name: Option<&str>) -> Option<ModuleMember> {
        let module = self.graph.modules.get(module)?;
        match name {
            Some(name) => module.exports.get(name).cloned(),
            None => module.default.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::resolver::{Resolver, decode_declaration};
    use serde_json::json;

    fn graph(declaration: serde_json::Value) -> Rc<ModuleGraph> {
        let url = Url::parse("file:///injected-module.json").unwrap();
        let mut resolver = Resolver::from_cwd().unwrap();
        resolver.insert_declaration(
            url.clone(),
            decode_declaration(&url, &declaration.to_string()).unwrap(),
        );
        resolver.load_graph(&url).unwrap()
    }

    #[test]
    // req:runtime-core-013
    fn module_authored_functions_capture_explicit_host_parent_bindings() {
        let graph = graph(json!({
            "imports": [], "exports": [{"kind":"func","name":"Call","default":true}],
            "rules": [], "decorators": [],
            "funcs": [{"name":"Call","pattern":{"kind":"end"},
                "expression":{"kind":"invocation","expression":{"kind":"reference","name":"host"},"args":[]}}]
        }));
        let entry = graph.entry.clone();
        let graph = CompiledModuleGraph::compile(graph).unwrap();
        gc_arena::arena::rootless_mutate(|mc| {
            let host = Value::host(
                mc,
                crate::value::HostCallable {
                    id: 9,
                    name: "host".into(),
                    arity: 0,
                },
            );
            let parent = Environment::new(mc, None, vec![("host".into(), host)]);
            let bindings = ModuleBindings::with_environment(mc, &graph, Some(parent)).unwrap();
            let environment = bindings.environment(&entry).unwrap();
            assert!(environment.get("host").unwrap().strict_eq(host));
            let mut execution = ExpressionExecution::call(
                mc,
                environment.get("Call").unwrap(),
                vec![],
                environment,
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            for _ in 0..100 {
                if execution.step_status(mc).unwrap() == crate::evaluate::StepStatus::Suspended {
                    break;
                }
            }
            assert_eq!(execution.take_host_request(mc).unwrap().callable.id, 9);
        });
    }

    #[test]
    // req:modules-runtime-004 req:runtime-memory-005
    fn compiles_callable_and_rule_programs_and_preserves_canonical_identity() {
        let graph = graph(json!({
            "imports": [],
            "exports": [{"kind":"func","name":"Answer","default":true}],
            "rules": [{"name":"Main","parameters":[],"pattern":{"kind":"any"}}],
            "funcs": [{"name":"Answer","pattern":{"kind":"end"},"expression":{"kind":"number","value":42}}],
            "decorators": []
        }));
        let entry = graph.entry.clone();
        let compiled = CompiledModuleGraph::compile(graph).unwrap();
        let member = compiled.export(&entry, None).unwrap();
        assert_eq!(member.kind, MemberKind::Func);
        let first = compiled.declaration(&member).unwrap();
        let second = compiled
            .declaration(&compiled.resolve(&entry, "Answer").unwrap())
            .unwrap();
        assert!(Rc::ptr_eq(&first, &second));
        assert!(first.expression.is_some());
        assert_eq!(first.name, "Answer");
        assert!(
            compiled
                .declaration(&compiled.resolve(&entry, "Main").unwrap())
                .unwrap()
                .expression
                .is_none()
        );
    }

    #[test]
    // req:rule-decorators-003 req:expressions-runtime-011 req:runtime-memory-005
    fn canonical_declaration_subjects_are_compiled_identities_distinct_from_rule_info() {
        let graph = graph(json!({
            "imports": [], "exports": [{"kind":"rule","name":"Main","default":true}],
            "rules": [{"name":"Main","parameters":[{"name":"Item"}],"pattern":{"kind":"any"},
                "attributes":[{"name":"Label","args":[]}]}],
            "funcs": [{"name":"Self","pattern":{"kind":"end"},"expression":{"kind":"reference","name":"this"}}],
            "decorators": [{"name":"Label","pattern":{"kind":"end"},"expression":{"kind":"reference","name":"this"}}]
        }));
        let entry = graph.entry.clone();
        let compiled = CompiledModuleGraph::compile(graph).unwrap();
        let mut arena = gc_arena::Arena::<gc_arena::Rootable![ModuleBindings<'_>]>::new(|mc| {
            ModuleBindings::new(mc, &compiled).unwrap()
        });
        arena.finish_cycle();
        arena.mutate(|mc, bindings| {
            let member = compiled.resolve(&entry, "Main").unwrap();
            let value = bindings.declaration(&member).unwrap();
            assert!(value.strict_eq(bindings.declaration(&member).unwrap()));
            let Value::Declaration(declaration) = value else {
                unreachable!()
            };
            assert!(Rc::ptr_eq(
                &declaration.compiled,
                &compiled.declaration(&member).unwrap()
            ));
            assert_eq!(declaration.member, member);
            let properties = declaration.properties.borrow();
            assert!(properties.get("metadata").is_none());
            assert!(properties.get("attributes").is_none());
            let Value::Object(module) = properties.get("module").unwrap() else {
                unreachable!()
            };
            let Value::Url(url) = module.borrow().get("moduleUrl").unwrap() else {
                unreachable!()
            };
            assert_eq!(url.0, entry);
            let Value::Map(rules) = module.borrow().get("rules").unwrap() else {
                unreachable!()
            };
            let Value::Array(pair) = rules.borrow()[0] else {
                unreachable!()
            };
            assert!(pair.borrow()[1].strict_eq(value));
            assert!(module.borrow().get("default").unwrap().strict_eq(value));
            let info = bindings.environment(&entry).unwrap().get("Main").unwrap();
            assert!(!info.strict_eq(value));
            assert_eq!(
                crate::globals::json_text(info).unwrap().unwrap(),
                format!(
                    r#"{{"kind":"rule","name":"Main","moduleUrl":"{}","parameters":["Item"]}}"#,
                    entry
                )
            );
            let callable_member = compiled.resolve(&entry, "Self").unwrap();
            let mut execution = ExpressionExecution::call(
                mc,
                bindings.callable(&callable_member).unwrap(),
                vec![],
                bindings.environment(&entry).unwrap(),
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            while !execution.step(mc).unwrap() {}
            assert!(matches!(execution.result().unwrap().raw(), Value::Match(_)));
            let mut decorated = ExpressionExecution::call_with_subject(
                mc,
                bindings.callable(&callable_member).unwrap(),
                vec![],
                bindings.environment(&entry).unwrap(),
                Origin { start: 0, end: 0 },
                value,
            );
            while !decorated.step(mc).unwrap() {}
            assert!(decorated.result().unwrap().strict_eq(value));
        });
    }

    #[test]
    // req:modules-runtime-004
    fn malformed_callable_patterns_fail_without_partial_compiled_graph() {
        let graph = graph(json!({
            "imports": [], "exports": [], "rules": [],
            "funcs": [{"name":"Bad","pattern":{"kind":"unknown"},"expression":{"kind":"number","value":42}}]
        }));
        let entry = graph.entry.clone();
        let error = match CompiledModuleGraph::compile(graph) {
            Err(error) => error,
            Ok(_) => panic!("unsupported AST cannot compile"),
        };
        assert_eq!(error.kind, MemberKind::Func);
        assert_eq!(error.declaration_index, 0);
        assert_eq!(*error.module_url, entry);
        assert!(error.message.contains("unknown"));
    }

    #[test]
    // req:modules-runtime-004 req:rule-decorators-002
    fn callable_attributes_retain_order_and_compiled_arguments() {
        let graph = graph(json!({
            "imports": [], "exports": [], "rules": [],
            "funcs": [{"name":"Answer","pattern":{"kind":"end"},"expression":{"kind":"number","value":42},
                "attributes":[{"name":"First","args":[{"kind":"number","value":1}]},{"name":"Second","args":[]}]}],
            "decorators":[{"name":"First","pattern":{"kind":"any"},"expression":{"kind":"number","value":1}},
                {"name":"Second","pattern":{"kind":"end"},"expression":{"kind":"number","value":2}}]
        }));
        let entry = graph.entry.clone();
        let compiled = CompiledModuleGraph::compile(graph).unwrap();
        let answer = compiled
            .declaration(&compiled.resolve(&entry, "Answer").unwrap())
            .unwrap();
        assert_eq!(answer.attributes[0].name, "First");
        assert_eq!(answer.attributes[0].args.len(), 1);
        assert_eq!(answer.attributes[1].name, "Second");
        assert!(answer.attributes[1].args.is_empty());
        let _pattern = &answer.pattern;
        assert!(compiled.resolve(&entry, "First").is_none());
        assert_eq!(
            compiled.resolve_decorator(&entry, "First").unwrap().kind,
            MemberKind::Decorator
        );
        assert!(compiled.resolve_decorator(&entry, "Answer").is_none());
    }

    #[test]
    // req:modules-runtime-004 req:runtime-memory-004
    fn recursive_module_binding_construction_preserves_callable_identity() {
        let graph = graph(json!({
            "imports": [], "exports": [{"kind":"func","name":"Caller"}], "rules": [],
            "funcs": [
                {"name":"Caller","pattern":{"kind":"end"},"expression":{"kind":"invocation","expression":{"kind":"reference","name":"Callee"},"args":[]}},
                {"name":"Callee","pattern":{"kind":"end"},"expression":{"kind":"number","value":42}}
            ]
        }));
        let entry = graph.entry.clone();
        let compiled = CompiledModuleGraph::compile(graph).unwrap();
        gc_arena::arena::rootless_mutate(|mc| {
            let bindings = ModuleBindings::new(mc, &compiled).unwrap();
            let member = compiled.resolve(&entry, "Caller").unwrap();
            let callable = bindings.callable(&member).unwrap();
            let env = bindings.environment(&entry).unwrap();
            assert!(callable.strict_eq(env.get("Caller").unwrap()));
            let Value::Lambda(caller) = callable else {
                unreachable!()
            };
            let Value::Lambda(callee) = env.get("Callee").unwrap() else {
                unreachable!()
            };
            assert_ne!(caller.environment.identity(), callee.environment.identity());
            assert_ne!(caller.environment.identity(), env.identity());
            assert!(caller.environment.is_descendant_of(env));
            assert!(callee.environment.is_descendant_of(env));
            let mut execution = crate::evaluate::ExpressionExecution::call(
                mc,
                callable,
                vec![],
                env,
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            while !execution.step(mc).unwrap() {}
            assert!(execution.result().unwrap().strict_eq(Value::Number(42.0)));
        });
    }

    #[test]
    // req:modules-runtime-004 req:runtime-memory-002 req:runtime-memory-005
    fn module_callable_cycles_survive_execution_steps_and_are_reclaimed() {
        #[derive(Collect)]
        #[collect(no_drop)]
        struct Root<'gc> {
            bindings: Option<ModuleBindings<'gc>>,
            execution: Option<crate::evaluate::ExpressionExecution<'gc>>,
            weak: gc_arena::GcWeak<'gc, crate::value::Closure<'gc>>,
        }
        let graph = graph(json!({
            "imports": [], "exports": [{"kind":"func","name":"Caller"}], "rules": [],
            "funcs": [
                {"name":"Caller","pattern":{"kind":"end"},"expression":{"kind":"invocation","expression":{"kind":"reference","name":"Callee"},"args":[]}},
                {"name":"Callee","pattern":{"kind":"end"},"expression":{"kind":"number","value":42}}
            ]
        }));
        let entry = graph.entry.clone();
        let compiled = CompiledModuleGraph::compile(graph).unwrap();
        let mut arena = gc_arena::Arena::<gc_arena::Rootable![Root<'_>]>::new(|mc| {
            let bindings = ModuleBindings::new(mc, &compiled).unwrap();
            let callable = bindings
                .callable(&compiled.resolve(&entry, "Caller").unwrap())
                .unwrap();
            let Value::Lambda(closure) = callable.raw() else {
                panic!("expected declared callable");
            };
            let execution = crate::evaluate::ExpressionExecution::call(
                mc,
                callable,
                vec![],
                bindings.environment(&entry).unwrap(),
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            Root {
                bindings: Some(bindings),
                execution: Some(execution),
                weak: gc_arena::Gc::downgrade(closure),
            }
        });
        loop {
            let finished =
                arena.mutate_root(|mc, root| root.execution.as_mut().unwrap().step(mc).unwrap());
            arena.finish_cycle();
            arena.mutate(|mc, root| assert!(root.weak.upgrade(mc).is_some()));
            if finished {
                break;
            }
        }
        arena.mutate(|_, root| {
            assert!(
                root.execution
                    .as_ref()
                    .unwrap()
                    .result()
                    .unwrap()
                    .strict_eq(Value::Number(42.0))
            )
        });
        arena.mutate_root(|_, root| {
            root.execution = None;
            root.bindings = None;
        });
        arena.finish_cycle();
        arena.mutate(|mc, root| assert!(root.weak.upgrade(mc).is_none()));
    }

    #[test]
    // req:modules-runtime-004
    fn imported_funcs_shadow_globals_and_reject_unmatched_arguments() {
        let app = Url::parse("file:///callable-app.json").unwrap();
        let library = Url::parse("file:///callable-lib.json").unwrap();
        let mut resolver = Resolver::from_cwd().unwrap();
        for (url, value) in [
            (
                &app,
                json!({
                    "imports":[{"kind":"module","moduleUrl":library.as_str(),"names":["add"]}],
                    "exports":[{"kind":"func","name":"Caller"}], "rules":[],
                    "funcs":[{"name":"Caller","pattern":{"kind":"end"},"expression":{
                        "kind":"invocation","expression":{"kind":"reference","name":"add"},
                        "args":[{"kind":"number","value":2},{"kind":"number","value":3}]
                    }}]
                }),
            ),
            (
                &library,
                json!({
                    "imports":[], "exports":[{"kind":"func","name":"add"}], "rules":[],
                    "funcs":[{"name":"add","pattern":{"kind":"then","patterns":[{"kind":"any"},{"kind":"any"}]},
                        "expression":{"kind":"number","value":99}}]
                }),
            ),
        ] {
            resolver.insert_declaration(
                url.clone(),
                decode_declaration(url, &value.to_string()).unwrap(),
            );
        }
        let compiled = CompiledModuleGraph::compile(resolver.load_graph(&app).unwrap()).unwrap();
        gc_arena::arena::rootless_mutate(|mc| {
            let bindings = ModuleBindings::new(mc, &compiled).unwrap();
            let imported = compiled.resolve(&app, "add").unwrap();
            assert_eq!(imported.module_url, library);
            let imported_value = bindings.callable(&imported).unwrap();
            let env = bindings.environment(&app).unwrap();
            assert!(env.get("add").unwrap().strict_eq(imported_value));
            let mut execution = crate::evaluate::ExpressionExecution::call(
                mc,
                bindings
                    .callable(&compiled.resolve(&app, "Caller").unwrap())
                    .unwrap(),
                vec![],
                env,
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            while !execution.step(mc).unwrap() {}
            assert!(execution.result().unwrap().strict_eq(Value::Number(99.0)));
            let mut failure = crate::evaluate::ExpressionExecution::call(
                mc,
                imported_value,
                vec![],
                env,
                Origin { start: 0, end: 0 },
                Value::Undefined,
            );
            loop {
                match failure.step(mc) {
                    Ok(false) => {}
                    Ok(true) => panic!("missing arguments cannot match"),
                    Err(error) => {
                        assert_eq!(failure.step(mc).unwrap_err(), error);
                        assert!(failure.result().is_none());
                        break;
                    }
                }
            }
        });
    }
}
