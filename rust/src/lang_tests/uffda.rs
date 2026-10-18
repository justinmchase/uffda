// Ports of the src/lang/uffda grammar checks.

use crate::json::JsonValue;
use crate::languages::{Language, Languages};
use crate::module::CompiledModuleGraph;
use crate::pattern::MatchKind;
use crate::resolver::{self, Resolver};
use crate::runtime::{DeclarationMetadata, InputMode, Runtime, RuntimeError};
use crate::value::Value as RuntimeValue;
use serde_json::{Value as Json, json};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use uffda_heap::Gc;
use url::Url;

const UFFDA_LANG: &str = "src/lang/uffda/uffda.lang.uff";
const RUNTIME_COMPILER: &str = "src/lang/uffda/runtime.compiler.uff";
const COMPILE_SOURCE: &str = "src/lang/uffda/compile.uff";
const SPECIFIER_RULES: &str = "src/lang/uffda/specifier.rules.uff";
const SHARED_RULES: &str = "src/lang/uffda/shared.rules.uff";

thread_local! {
    static GRAPHS: RefCell<HashMap<String, (Rc<CompiledModuleGraph>, Url)>> =
        RefCell::new(HashMap::new());
    static LANGUAGES: RefCell<Option<Languages>> = const { RefCell::new(None) };
}

fn graph(path: &str) -> (Rc<CompiledModuleGraph>, Url) {
    GRAPHS.with(|graphs| {
        if let Some(found) = graphs.borrow().get(path) {
            return found.clone();
        }
        let mut resolver = Resolver::from_cwd().unwrap();
        let root = crate::builtins::register(&mut resolver).unwrap();
        let url = root.join(path).unwrap();
        let compiled =
            Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
        let loaded = (compiled, url);
        graphs.borrow_mut().insert(path.to_string(), loaded.clone());
        loaded
    })
}

fn try_run(path: &str, entry: &str, input: Json, mode: InputMode) -> Result<Runtime, RuntimeError> {
    let (compiled, url) = graph(path);
    let mut runtime =
        Runtime::with_mode(compiled, &url, Some(entry), JsonValue::from(input), mode)?;
    runtime.run()?;
    Ok(runtime)
}

fn run(path: &str, entry: &str, input: Json, mode: InputMode) -> Runtime {
    try_run(path, entry, input, mode).unwrap()
}

fn parse_uffda(source: &str) -> Runtime {
    run(UFFDA_LANG, "UffdaLang", json!(source), InputMode::Scalar)
}

fn json_value(runtime: &mut Runtime) -> Json {
    let text = runtime
        .serialize_result()
        .unwrap()
        .unwrap_or_else(|| panic!("match produced no value"));
    serde_json::from_str(&text).unwrap()
}

fn kind_and_clean(runtime: &Runtime) -> (MatchKind, bool) {
    runtime.read(|execution| {
        let result = execution.result().expect("match result");
        (result.kind, execution.is_clean())
    })
}

fn parse_value(source: &str) -> Json {
    let mut runtime = parse_uffda(source);
    let (kind, clean) = kind_and_clean(&runtime);
    assert_eq!(kind, MatchKind::Ok, "{source}");
    assert!(clean, "{source}");
    json_value(&mut runtime)
}

fn assert_unclean(source: &str) {
    let runtime = parse_uffda(source);
    let (kind, clean) = kind_and_clean(&runtime);
    assert!(
        kind == MatchKind::Fail || !clean,
        "{source} parsed cleanly as {kind:?}"
    );
}

fn documentation_error(declaration: &DeclarationMetadata<'_>) -> Option<String> {
    let RuntimeValue::Object(metadata) = declaration.metadata.raw() else {
        return None;
    };
    let RuntimeValue::Object(documentation) = metadata.borrow().get("Documentation")?.raw() else {
        return None;
    };
    let RuntimeValue::String(error) = documentation.borrow().get("error")?.raw() else {
        return None;
    };
    error.to_utf8().ok()
}

fn assert_mistake(marked: &str, explanation: &str) {
    let offset = marked.find('‸').expect("caret");
    let source = marked.replacen('‸', "", 1);
    let runtime = parse_uffda(&source);
    let diagnostics = runtime.diagnostics_with(documentation_error);
    let first = diagnostics
        .first()
        .unwrap_or_else(|| panic!("no diagnostic for {marked}"));
    assert_eq!(
        first.focus_span.start, offset,
        "{marked} focus {:?} span {:?}",
        first.focus_span, first.span
    );
    let found = first
        .explanation
        .as_deref()
        .unwrap_or_else(|| panic!("{marked} has no explanation: {}", first.message));
    assert!(
        found.contains(explanation),
        "{marked}: expected {explanation:?} in {found:?}"
    );
    assert!(
        first.message.starts_with(found),
        "{marked}: message {:?} does not lead with {found:?}",
        first.message
    );
}

fn assert_mistakes(mistakes: &[(&str, &str)]) {
    for (marked, explanation) in mistakes {
        assert_mistake(marked, explanation);
    }
}

fn equal_literal(value: &str) -> Json {
    json!({"kind":"equal","value":{"kind":"value.literal","value":value}})
}

fn rule_declaration(name: &str, pattern: Json) -> Json {
    json!({
        "kind": "rule",
        "name": name,
        "parameters": [],
        "pattern": pattern,
        "attributes": []
    })
}

fn module(declarations: Json) -> Json {
    json!({"kind":"module","declarations":declarations})
}

fn declarations(value: &Json) -> &[Json] {
    value["declarations"].as_array().expect("declarations")
}

fn comment_text(comment: &Json) -> String {
    comment["blocks"]
        .as_array()
        .expect("comment blocks")
        .iter()
        .map(|block| {
            if block["kind"] == "paragraph" {
                block["inlines"]
                    .as_array()
                    .expect("inlines")
                    .iter()
                    .map(|inline| inline["text"].as_str().unwrap_or(""))
                    .collect::<String>()
            } else {
                block["kind"].as_str().unwrap_or("").to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" | ")
}

fn declaration_label(declaration: &Json) -> String {
    match declaration["kind"].as_str().unwrap() {
        "import" => format!("import {}", declaration["moduleUrl"].as_str().unwrap_or("")),
        "comment" => format!("comment {}", comment_text(declaration)),
        kind => format!("{kind} {}", declaration["name"].as_str().unwrap_or("")),
    }
}

fn declaration_labels(value: &Json) -> Vec<String> {
    declarations(value).iter().map(declaration_label).collect()
}

fn skipped_texts(runtime: &Runtime, source: &str) -> Vec<String> {
    runtime.read(|execution| {
        execution
            .recoveries()
            .iter()
            .map(|matched| {
                source
                    .chars()
                    .skip(matched.origin.start)
                    .take(matched.origin.end.saturating_sub(matched.origin.start))
                    .collect()
            })
            .collect()
    })
}

fn recovery_spans(runtime: &Runtime) -> Vec<(usize, usize)> {
    runtime.read(|execution| {
        execution
            .recoveries()
            .iter()
            .map(|matched| (matched.origin.start, matched.origin.end))
            .collect()
    })
}

fn compile_syntax(syntax: Json) -> Result<Runtime, RuntimeError> {
    try_run(
        RUNTIME_COMPILER,
        "UffdaRuntimeCompiler",
        syntax,
        InputMode::Scalar,
    )
}

fn compiled_json(syntax: Json) -> Json {
    let mut runtime = compile_syntax(syntax).expect("compiler run");
    let (kind, clean) = kind_and_clean(&runtime);
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
    json_value(&mut runtime)
}

fn compile_parsed(source: &str) -> Json {
    compiled_json(parse_value(source))
}

fn declaration_name(metadata: &DeclarationMetadata<'_>) -> Option<String> {
    match metadata.subject.raw() {
        RuntimeValue::Declaration(declaration) => Some(declaration.compiled.name.clone()),
        _ => None,
    }
}

fn compile_declaration_path(runtime: &Runtime) -> Option<String> {
    runtime.read(|execution| {
        let root = execution.result()?;
        let mut pending = vec![root];
        let mut seen = HashSet::new();
        while let Some(node) = pending.pop() {
            if !seen.insert(Gc::as_ptr(node) as usize) {
                continue;
            }
            if node.kind == MatchKind::Fail
                && node
                    .rule
                    .as_ref()
                    .and_then(|rule| declaration_name(rule))
                    .as_deref()
                    == Some("CompileDeclaration")
            {
                return Some(node.identity.position(node.start).to_string());
            }
            pending.extend(node.children.iter().copied());
        }
        None
    })
}

fn execute_module(module_json: &str, entry: &str, input: Json, mode: InputMode) -> Runtime {
    let mut resolver = Resolver::from_cwd().unwrap();
    let _root = crate::builtins::register(&mut resolver).unwrap();
    let url = Url::parse("file:///lang-tests/compiled.json").unwrap();
    resolver.insert_declaration(
        url.clone(),
        resolver::decode_declaration(&url, module_json).unwrap(),
    );
    let compiled =
        Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
    let mut runtime =
        Runtime::with_mode(compiled, &url, Some(entry), JsonValue::from(input), mode).unwrap();
    runtime.run().unwrap();
    runtime
}

fn execute_source(source: &str, entry: &str, input: Json, mode: InputMode) -> Runtime {
    let mut compiled = compile_syntax(parse_value(source)).unwrap();
    let module = compiled.serialize_result().unwrap().unwrap();
    execute_module(&module, entry, input, mode)
}

fn format_uffda(source: &str) -> Result<String, crate::languages::LanguageError> {
    LANGUAGES.with(|slot| {
        if slot.borrow().is_none() {
            *slot.borrow_mut() = Some(Languages::new().unwrap());
        }
        slot.borrow_mut()
            .as_mut()
            .unwrap()
            .format(source, Language::Uffda)
    })
}

fn assert_formats(source: &str, expected: &str) {
    let formatted = format_uffda(source).unwrap_or_else(|error| panic!("{source}: {error}"));
    assert_eq!(formatted, expected, "formatting {source:?}");
    let again = format_uffda(&formatted).unwrap();
    assert_eq!(
        again, formatted,
        "formatting is not idempotent for {source:?}"
    );
}

fn specifier_kind(text: &str) -> &'static str {
    if text.starts_with("jsr:") {
        "jsr"
    } else if text.starts_with('@') {
        "name"
    } else {
        "relative"
    }
}

#[test]
// req:rule-decorators-002
fn attribute_rules() {
    let plain = parse_value("rule Main = any;");
    assert_eq!(declarations(&plain)[0]["attributes"], json!([]));

    assert_eq!(
        declarations(&parse_value("[Foo] rule Main = any;"))[0]["attributes"],
        json!([{"kind":"attribute","name":"Foo","args":[]}])
    );

    let with_args_module = parse_value(r#"[Foo 1 "bar"] rule Main = any;"#);
    let with_args = &declarations(&with_args_module)[0];
    assert_eq!(with_args["attributes"][0]["name"], "Foo");
    assert_eq!(
        with_args["attributes"][0]["args"].as_array().unwrap().len(),
        2
    );

    assert_eq!(
        declarations(&parse_value("[Foo][Bar] rule Main = any;"))[0]["attributes"],
        json!([
            {"kind":"attribute","name":"Foo","args":[]},
            {"kind":"attribute","name":"Bar","args":[]}
        ])
    );

    let func_module = parse_value("[Foo] func Main<a:any> = a;");
    let func = &declarations(&func_module)[0];
    assert_eq!(func["kind"], "func");
    assert_eq!(
        func["attributes"],
        json!([{"kind":"attribute","name":"Foo","args":[]}])
    );

    let exported_module = parse_value("export [Foo] rule Main = any;");
    let exported = declarations(&exported_module)
        .iter()
        .find(|declaration| declaration["kind"] == "rule")
        .unwrap();
    assert_eq!(
        exported["attributes"],
        json!([{"kind":"attribute","name":"Foo","args":[]}])
    );

    assert_eq!(
        declarations(&parse_value(r#"[Foo] rule Main = "." end;"#))[0]["pattern"],
        json!({
            "kind": "then",
            "patterns": [equal_literal("."), {"kind":"end"}]
        })
    );

    let (kind, clean) = kind_and_clean(&parse_uffda("[Foo] decorator Bar = end;"));
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
}

#[test]
// req:uffda-language-syntax-016 req:rule-decorators-002
fn attribute_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        (
            "[Foo rule A ‸= a;",
            "Expected `]` here to close the attribute",
        ),
        ("[‸] rule A = a;", "An attribute starts with the name"),
    ]);
}

#[test]
// req:rule-decorators-001
fn decorator_rules() {
    let bare = parse_value(r#"decorator Example = "example";"#);
    let declaration = &declarations(&bare)[0];
    assert_eq!(declaration["kind"], "decorator");
    assert_eq!(declaration["name"], "Example");
    assert_eq!(declaration["pattern"], json!({"kind":"end"}));

    let parameterized_module = parse_value("decorator Deprecated<message:string> = message;");
    let parameterized = &declarations(&parameterized_module)[0];
    assert_eq!(parameterized["kind"], "decorator");
    assert_eq!(parameterized["name"], "Deprecated");

    let inline = parse_value(r#"export decorator Example = "example";"#);
    let decorator = declarations(&inline)
        .iter()
        .find(|declaration| declaration["kind"] == "decorator")
        .unwrap();
    let export = declarations(&inline)
        .iter()
        .find(|declaration| declaration["kind"] == "export")
        .unwrap();
    assert_eq!(decorator["kind"], "decorator");
    assert_eq!(export, &json!({"kind":"export","name":"Example"}));

    let decorated_module = parse_value("[Foo] [Bar] decorator Bar = end;");
    let decorated = &declarations(&decorated_module)[0];
    assert_eq!(decorated["kind"], "decorator");
    let names: Vec<_> = decorated["attributes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|attribute| attribute["name"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(names, ["Foo", "Bar"]);
}

#[test]
// req:uffda-language-syntax-016 req:rule-decorators-001
fn decorator_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        ("decorator ‸= 1;", "A declaration needs a name"),
        (
            "decorator D = ‸;",
            "A func or decorator needs an expression",
        ),
    ]);
}

#[test]
// req:uffda-language-syntax-008 req:cli-bootstrap-028
fn export_rules_parses_direct_export_names() {
    assert_eq!(
        parse_value("export Main Other; rule Main = any;"),
        module(json!([
            {"kind":"export","name":"Main"},
            {"kind":"export","name":"Other"},
            rule_declaration("Main", json!({"kind":"any"}))
        ]))
    );
}

#[test]
// req:uffda-language-syntax-008
fn export_rules_requires_at_least_one_name() {
    assert_unclean("export;");
}

#[test]
// req:uffda-language-syntax-005
fn export_rules_rejects_exports_after_rules() {
    assert_unclean("rule Main = any; export Main;");
}

#[test]
// req:uffda-language-syntax-008
fn export_rules_normalizes_inline_exported_rules() {
    assert_eq!(
        parse_value("export rule Main = any -> 1;"),
        parse_value("export Main; rule Main = any -> 1;")
    );
}

#[test]
// req:rule-decorators-001 req:uffda-language-syntax-008
fn export_rules_normalizes_inline_exported_decorators() {
    assert_eq!(
        parse_value(r#"export decorator Example = "example";"#),
        parse_value(r#"export Example; decorator Example = "example";"#)
    );
}

#[test]
// req:uffda-language-syntax-016
fn export_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        ("export ‸;", "`export` is followed by a declaration"),
        ("export ‸1;", "`export` is followed by a declaration"),
    ]);
}

#[test]
// req:uffda-language-syntax-016 req:uffda-language-syntax-012
fn func_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        ("func F = ‸;", "A func or decorator needs an expression"),
        ("func F ‸x = x;", "Expected `=` here"),
    ]);
}

#[test]
// req:uffda-language-syntax-016 req:uffda-language-syntax-017
fn import_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        (
            "import ‸A;",
            "An import names its module with a quoted path",
        ),
        ("import \"./a.uff\"‸;", "An import lists the names"),
        (
            "import \"./a.uff‸ A;",
            "Expected `\"` here to end the module path",
        ),
        (
            "import \"./a‸ b.uff\" A;",
            "Expected `\"` here to end the module path",
        ),
    ]);
}

#[test]
// req:uffda-language-syntax-016 req:uffda-language-syntax-007 req:uffda-language-syntax-009
fn rule_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        ("rule A = ‸;", "A rule needs a pattern after `=`"),
        ("rule A<P ‸= P;", "A rule's parameter list ends with `>`"),
        (
            "rule A = a -> ‸;",
            "`->` must be followed by the expression",
        ),
    ]);
}

#[test]
// req:uffda-language-syntax-016
fn shared_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        ("rule ‸= a;", "A declaration needs a name"),
        ("rule A ‸a;", "Expected `=` here"),
        ("rule A = a‸", "A declaration ends with `;`"),
        ("[Foo] ‸;", "Expected a declaration here"),
    ]);
}

#[test]
// req:uffda-language-syntax-017 req:uffda-language-syntax-004
fn specifier_rules_accepts_module_specifiers() {
    for specifier in [
        "./a.uff",
        "./tokens.uff",
        "./.hidden.uff",
        "./..x/...y.uff",
        "../common/identifier.uff",
        "../../x/my-lang.v2.uff",
        "./a_b/c-d/E9.uff",
        "@acme",
        "@acme/kv",
        "@acme/kv/tokens",
        "jsr:@acme/kv",
        "jsr:@acme/kv/tokens",
        "jsr:@acme/kv@1",
        "jsr:@acme/kv@^1.2.0",
        "jsr:@acme/kv@~1.2.0-pre.1/tokens",
        "jsr:@acme/kv@>=1.0.0<2.0.0",
    ] {
        assert_eq!(
            parse_value(&format!(r#"import "{specifier}" A;"#)),
            module(json!([{"kind":"import","moduleUrl":specifier,"names":["A"]}])),
            "{specifier}"
        );
    }
}

#[test]
// req:uffda-language-syntax-017
fn specifier_rules_rejects_other_text() {
    for specifier in [
        "",
        "tokens.uff",
        "a",
        "/abs.uff",
        "https://jsr.io/@acme/kv/tokens.uff",
        "npm:kv",
        "file:///a.uff",
        "./a b.uff",
        "./a\\b.uff",
        "./é.uff",
        "./",
        "../",
        "./../a.uff",
        "./a//b.uff",
        "./a/./b.uff",
        "./a/../b.uff",
        "./a/..",
        "@",
        "@acme/",
        "jsr:acme/kv",
        "jsr:@acme",
        "jsr:@acme/kv@",
    ] {
        assert_unclean(&format!(r#"import "{specifier}" A;"#));
    }
}

#[test]
// req:uffda-language-syntax-016 req:uffda-language-syntax-017
fn specifier_rules_explains_mistakes_where_they_occur() {
    assert_mistakes(&[
        (
            "import \"‸tokens.uff\" A;",
            "A module is named by a relative path",
        ),
        (
            "import \"‸/abs.uff\" A;",
            "A module is named by a relative path",
        ),
        (
            "import \"‸https://x/a.uff\" A;",
            "A module is named by a relative path",
        ),
        ("import \"‸\" A;", "A module is named by a relative path"),
        ("import \"./‸\" A;", "Expected a path segment here"),
        ("import \"./‸é.uff\" A;", "Expected a path segment here"),
        ("import \"./‸../a.uff\" A;", "Expected a path segment here"),
        ("import \"./a/‸/b.uff\" A;", "Expected a path segment here"),
        ("import \"./a/‸./b.uff\" A;", "Expected a path segment here"),
        ("import \"./a/‸..\" A;", "Expected a path segment here"),
        ("import \"@‸\" A;", "Expected a path segment here"),
        (
            "import \"jsr:‸acme/kv\" A;",
            "A `jsr:` specifier names a package",
        ),
        (
            "import \"jsr:@acme‸\" A;",
            "Expected `/` and the package name",
        ),
        (
            "import \"jsr:@acme/kv@‸\" A;",
            "Expected a version range after `@`",
        ),
    ]);
}

#[test]
// req:uffda-language-syntax-017 req:project-file-001
fn specifier_parse_module_specifier() {
    for (text, kind_name) in [
        ("./a.uff", "relative"),
        ("../x/my-lang.v2.uff", "relative"),
        ("@acme/kv", "name"),
        ("@acme/kv/tokens", "name"),
        ("jsr:@acme/kv", "jsr"),
        ("jsr:@acme/kv@^1.2.0/tokens", "jsr"),
    ] {
        let mut runtime = run(
            SPECIFIER_RULES,
            "ModuleSpecifierText",
            json!(text),
            InputMode::Scalar,
        );
        let (kind, clean) = kind_and_clean(&runtime);
        assert_eq!(kind, MatchKind::Ok, "{text}");
        assert!(clean, "{text}");
        assert_eq!(json_value(&mut runtime), json!(text));
        assert_eq!(specifier_kind(text), kind_name);
    }

    for text in [
        "",
        "a",
        "/abs.uff",
        "./a b.uff",
        " ./a.uff",
        "./a.uff ",
        "./a\"b.uff",
        "./a\\b.uff",
        "./é.uff",
        "./",
        "https://jsr.io/@acme/kv",
    ] {
        let runtime = run(
            SPECIFIER_RULES,
            "ModuleSpecifierText",
            json!(text),
            InputMode::Scalar,
        );
        let (_, clean) = kind_and_clean(&runtime);
        assert!(!clean, "{text:?} parsed as a module specifier");
    }
}

#[test]
// req:cli-bootstrap-033 req:cli-bootstrap-027 req:cli-bootstrap-028 req:cli-bootstrap-032 req:cli-bootstrap-025 req:uffda-language-syntax-002 req:uffda-language-syntax-003
fn rule_modules_compose_into_uffda_lang() {
    let uffda_lang = include_str!("../../../src/lang/uffda/uffda.lang.uff");
    assert!(uffda_lang.contains("import \"./import.rules.uff\" ImportDeclarationSyntax"));
    assert!(uffda_lang.contains("import \"./export.rules.uff\" ExportDeclarationSyntax"));
    assert!(uffda_lang.contains("import \"./rule.rules.uff\" RuleDeclarationSyntax"));
    assert!(uffda_lang.contains("rule ModuleBody"));

    let shared = include_str!("../../../src/lang/uffda/shared.rules.uff");
    assert!(shared.contains("export IdentifierToken"));
    assert!(shared.contains("IdToken"));
    assert!(!shared.contains("string & [Identifier]"));
    assert!(shared.contains("export ReservedKeywordToken"));

    let import_rules = include_str!("../../../src/lang/uffda/import.rules.uff");
    assert!(import_rules.contains("export ImportDeclarationSyntax"));
    assert!(import_rules.contains("export ImportNameList"));
    assert!(import_rules.contains("export ImportModuleSpecifier"));

    let export_rules = include_str!("../../../src/lang/uffda/export.rules.uff");
    assert!(export_rules.contains("export ExportDeclarationSyntax"));
    assert!(export_rules.contains("export ExportNameList"));

    let rule_rules = include_str!("../../../src/lang/uffda/rule.rules.uff");
    assert!(rule_rules.contains("import \"../pattern/pattern.lang.uff\" PatternTokens"));
    assert!(rule_rules.contains("import \"../expression/expression.lang.uff\" ExpressionTokens"));
    assert!(rule_rules.contains("|> PatternTokens"));
    assert!(rule_rules.contains("|> ExpressionTokens"));

    let compiler = include_str!("../../../src/lang/uffda/runtime.compiler.uff");
    assert!(compiler.contains("export UffdaRuntimeCompiler"));
}

#[test]
// req:uffda-language-syntax-015 req:cli-bootstrap-025
fn rule_modules_body_token() {
    let comment = json!({"kind":"comment","blocks":[]});
    let line_end = json!({"kind":"lineEndComment","comment":comment});
    for token in [json!("a"), comment, line_end] {
        let mut runtime = run(
            SHARED_RULES,
            "BodyToken",
            json!([token]),
            InputMode::Iterable,
        );
        let (kind, clean) = kind_and_clean(&runtime);
        assert_eq!(kind, MatchKind::Ok, "{token}");
        assert!(clean, "{token}");
        assert_eq!(json_value(&mut runtime), token);
    }

    let runtime = run(
        SHARED_RULES,
        "BodyToken",
        json!([{"kind":"comment","text":"# x"}]),
        InputMode::Iterable,
    );
    assert_eq!(kind_and_clean(&runtime).0, MatchKind::Fail);
}

#[test]
// req:uffda-language-syntax-014 req:cli-fmt-001
fn format_canonical() {
    assert_formats(
        "export Main;\nrule   Main =\n  a\n  b\n  -> x;",
        "export rule Main = a b -> x;\n",
    );
    assert_formats(
        "import \"./a.uff\" A; import \"./b.uff\" B; export X; export Y; rule Z = A; rule X = B;",
        "import \"./a.uff\" A;\nimport \"./b.uff\" B;\n\nexport X;\nexport Y;\n\nrule Z = A;\n\nrule X = B;\n",
    );
    assert_formats(
        "# Hello   world\n# again\nrule A = ok;\n# trailing",
        "# Hello world again\nrule A = ok;\n\n# trailing\n",
    );
    assert_formats(
        "rule Alternatives = \"aaaaaaaaaaaaaaaaaaaa\" | \"bbbbbbbbbbbbbbbbbbbbbbbbb\" | \"cccccccccccccccccccccccc\" | \"dddd\";",
        "rule Alternatives =\n  | \"aaaaaaaaaaaaaaaaaaaa\"\n  | \"bbbbbbbbbbbbbbbbbbbbbbbbb\"\n  | \"cccccccccccccccccccccccc\"\n  | \"dddd\"\n;\n",
    );
    assert_formats(
        "rule O = x:X -> { kind: \"something\", first: x, second: (add x 1), third: [x x x], fourth: \"text\" };",
        "rule O =\n  x:X\n  -> {\n    kind: \"something\",\n    first: x,\n    second: (add x 1),\n    third: [x x x],\n    fourth: \"text\"\n  }\n;\n",
    );
    assert_formats(
        "rule T = alpha:Alpha beta:Beta gamma:Gamma delta:Delta epsilon:Epsilon zeta:Zeta eta:Eta;",
        "rule T =\n  alpha:Alpha\n  beta:Beta\n  gamma:Gamma\n  delta:Delta\n  epsilon:Epsilon\n  zeta:Zeta\n  eta:Eta\n;\n",
    );
    assert_formats(
        "rule A = (object & { kind: \"aaaaaaaaaaaaaaaaaaaa\" }) & (object & { name: \"bbbbbbbbbbbbbbbbbbbbbbbbbbbb\" });",
        "rule A =\n  (object & { kind: \"aaaaaaaaaaaaaaaaaaaa\" })\n  & (object & { name: \"bbbbbbbbbbbbbbbbbbbbbbbbbbbb\" })\n;\n",
    );
    assert_formats(
        "rule P = ((a | b) c) & (d (x -> 1) [e*] (f g)+ (not (h?)) x:(i | j));",
        "rule P = (a | b) c & d (x -> 1) [e*] (f g)+ not h? x:(i | j);\n",
    );
    assert_formats("rule Q = (a (b -> 2)) -> 3;", "rule Q = a (b -> 2) -> 3;\n");
    assert_formats(
        "func F<a:string b:number> = (join [a b] \"\");\nfunc G<> = 1;\nfunc Long<firstParameter:{ index: number, value: string } secondParameter:array> = (add 1 2);",
        "func F<a:string b:number> = (join [a b] \"\");\n\nfunc G = 1;\n\nfunc Long<\n  firstParameter:{ index: number, value: string }\n  secondParameter:array\n> =\n  (add 1 2)\n;\n",
    );
    assert_formats(
        "func H<xs:array> = (map xs <x:number> -> (add x 1));",
        "func H<xs:array> = (map xs <x:number> -> (add x 1));\n",
    );
    assert_formats(
        "func H<items:array> = (reduce items 0 <accumulator:number item:{ value: number, weight: number }> -> (add accumulator item.value));",
        "func H<items:array> =\n  (reduce\n    items\n    0\n    <accumulator:number item:{ value: number, weight: number }> -> (add\n      accumulator\n      item.value\n    )\n  )\n;\n",
    );
    assert_formats(
        "rule S = \"a\\\"b\\\\c\\n\" -> \"x\\{y} {(add 1 2)}\";",
        "rule S = \"a\\\"b\\\\c\\n\" -> \"x\\{y} {(add 1 2)}\";\n",
    );
    assert_formats(
        "rule R = a*0.. b*1.. c*2 d*0..3 e*1..4 f? (skip g) h*;",
        "rule R = a*0 b+ c*2 d*..3 e*1..4 f? skip g h*;\n",
    );
    assert_formats(
        "rule U = ope X sneak by until \";\";",
        "rule U = ope X sneak by until \";\";\n",
    );
    assert_formats(
        "rule I = in[\"aaaaaaaaaaaa\" \"bbbbbbbbbbbbbbbb\" \"cccccccccccccccc\" \"dddddddddddddddd\" \"eeeeeeeeeeeee\"];",
        "rule I =\n  in[\n    \"aaaaaaaaaaaa\"\n    \"bbbbbbbbbbbbbbbb\"\n    \"cccccccccccccccc\"\n    \"dddddddddddddddd\"\n    \"eeeeeeeeeeeee\"\n  ]\n;\n",
    );
    assert_formats(
        "[Doc { description: \"A long description that will not fit on the same line as the attribute name.\" }]\nrule D = ok;",
        "[Doc {\n  description: \"A long description that will not fit on the same line as the attribute name.\"\n}]\nrule D = ok;\n",
    );

    let error = format_uffda("rule = ;").unwrap_err();
    assert!(!error.diagnostics.is_empty(), "{error}");
    LANGUAGES.with(|slot| {
        let mut borrowed = slot.borrow_mut();
        let languages = borrowed.as_mut().unwrap();
        let project = languages.project_languages(None).unwrap();
        let language = project
            .iter()
            .find(|language| language.id == "uffda")
            .unwrap();
        let refused = crate::format::stdin(languages, language, "rule = ;", false);
        assert!(!refused.ok);
        assert!(refused.text.is_none());
        assert!(!refused.files[0].diagnostics.is_empty());
    });

    assert_formats(
        "rule CommentBlockFormat<W, F> = ParagraphFormat<W> | ListFormat<W> | FenceFormat<F>;",
        "rule CommentBlockFormat<W, F> =\n  | ParagraphFormat<W>\n  | ListFormat<W>\n  | FenceFormat<F>\n;\n",
    );
    assert_formats(
        "rule A = a | b; rule B = (a | b) c;",
        "rule A =\n  | a\n  | b\n;\n\nrule B = (a | b) c;\n",
    );
    assert_formats(
        "rule A =\n  |> a\n  |> [b]\n;",
        "rule A =\n  |> a\n  |> [b]\n;\n",
    );
    let long = format!(
        "rule B = (a |> b) c; rule Q = x:({} |> {} |> {}) d;",
        "a".repeat(30),
        "b".repeat(30),
        "c".repeat(30)
    );
    let long_expected = format!(
        "rule B = (a |> b) c;\n\nrule Q =\n  x:(\n    |> {}\n    |> {}\n    |> {}\n  )\n  d\n;\n",
        "a".repeat(30),
        "b".repeat(30),
        "c".repeat(30)
    );
    assert_formats(&long, &long_expected);
    assert_eq!(format_uffda("").unwrap(), "");
}

#[test]
// req:uffda-language-syntax-014
fn format_broken_import_ends_with_semicolon_on_its_own_line() {
    let names = [
        "Aaaaaaaaaaaaaaaaaaaa",
        "Bbbbbbbbbbbbbbbbbbbb",
        "Cccccccccccccccccccc",
        "Dddddddddddddddddddd",
    ];
    let mut lines = vec!["import \"./example.uff\"".to_string()];
    lines.extend(names.iter().map(|name| format!("  {name}")));
    lines.push(";".into());
    lines.push(String::new());
    let expected = lines.join("\n");
    let source = format!("import \"./example.uff\" {};", names.join(" "));
    assert_formats(&source, &expected);
    assert_formats(&expected, &expected);
}

#[test]
// req:uffda-language-syntax-014 req:uffda-language-syntax-015
fn format_inner_comments() {
    let cases = [
        (
            "a comment forces the or onto separate lines",
            "rule A = a\n# b\n| c;",
            "rule A =\n  | a\n  # b\n  | c\n;\n",
        ),
        (
            "a single alternative after comments keeps its bar",
            "rule A =\n  # only\n  | a\n;",
            "rule A =\n  # only\n  | a\n;\n",
        ),
        (
            "comments between and, then and pipeline members",
            "rule A = x\n# c\n& y;\nrule B = a\n# c\nb;\nrule C = |> p\n# c\n|> q;",
            &[
                "rule A =\n  x\n  # c\n  & y\n;\n",
                "rule B =\n  a\n  # c\n  b\n;\n",
                "rule C =\n  |> p\n  # c\n  |> q\n;\n",
            ]
            .join("\n"),
        ),
        (
            "comments in objects, arrays and call arguments",
            "rule A = x:any -> {\n# k\na: [\n# e\nx\n],\nb: (f\n# arg\nx)\n# t\n};",
            &[
                "rule A =",
                "  x:any",
                "  -> {",
                "    # k",
                "    a: [",
                "      # e",
                "      x",
                "    ],",
                "    b: (f",
                "      # arg",
                "      x",
                "    )",
                "    # t",
                "  }",
                ";",
                "",
            ]
            .join("\n"),
        ),
        (
            "a labeled pattern starting with a comment ends its label line",
            "rule A = {\n  a:\n    # c\n    | x\n    | y\n};",
            "rule A =\n  {\n    a:\n      # c\n      | x\n      | y\n  }\n;\n",
        ),
    ];
    for (name, source, expected) in cases {
        let formatted = format_uffda(source).unwrap_or_else(|error| panic!("{name}: {error}"));
        assert_eq!(formatted, expected, "{name}");
        assert_eq!(format_uffda(&formatted).unwrap(), formatted, "{name}");
    }
}

#[test]
// req:cli-bootstrap-034 req:uffda-language-syntax-006
fn execute_compiles_through_runtime_compiler() {
    let compiled = compiled_json(json!({
        "kind": "module",
        "declarations": [
            {"kind":"export","name":"Main"},
            rule_declaration("Main", json!({"kind":"any"}))
        ]
    }));
    assert_eq!(compiled["exports"], json!([{"kind":"rule","name":"Main"}]));
    assert_eq!(compiled["rules"][0]["name"], "Main");
    assert_eq!(compiled["rules"][0]["parameters"], json!([]));
    assert_eq!(compiled["rules"][0]["pattern"], json!({"kind":"any"}));
    assert!(compiled["rules"][0]["expression"].is_null());
    assert_eq!(compiled["rules"][0]["attributes"], json!([]));
}

#[test]
// req:cli-bootstrap-034
fn execute_preserves_compiler_diagnostics_when_unwrapping_failures() {
    let runtime = compile_syntax(json!({
        "kind": "module",
        "declarations": [{"kind":"unsupported"}]
    }))
    .unwrap();
    assert_eq!(kind_and_clean(&runtime).0, MatchKind::Fail);
    assert_eq!(
        compile_declaration_path(&runtime).as_deref(),
        Some("[0].\"declarations\".[0].[0]")
    );
}

#[test]
// req:uffda-language-syntax-006
fn execute_parses_compiles_and_runs_canonical_any_rule() {
    let mut runtime = execute_source(
        "export Main; rule Main = any;",
        "Main",
        json!("z"),
        InputMode::Scalar,
    );
    let (kind, clean) = kind_and_clean(&runtime);
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
    assert_eq!(json_value(&mut runtime), json!("z"));
}

#[test]
// req:uffda-language-syntax-009 req:uffda-language-syntax-006
fn execute_parses_compiles_and_runs_parametric_surround_rule() {
    let source = "export rule Surround<L, P, R> = L? p:P R? -> p; export Main; rule Open = \"(\"; rule Close = \")\"; rule X = \"x\"; rule Main = Surround<Open, X, Close>;";
    for input in ["(x)", "(x", "x)", "x"] {
        let mut runtime = execute_source(source, "Main", json!(input), InputMode::Iterable);
        assert_eq!(kind_and_clean(&runtime).0, MatchKind::Ok, "{input}");
        assert_eq!(json_value(&mut runtime), json!("x"), "{input}");
    }
    let failed = execute_source(source, "Main", json!("()"), InputMode::Iterable);
    assert_eq!(kind_and_clean(&failed).0, MatchKind::Fail);
}

#[test]
// req:cli-bootstrap-034
fn execute_compile_source_matches_grammar_plus_compiler() {
    let source = "export Main; rule Main = any;";
    let mut single = run(
        COMPILE_SOURCE,
        "CompileUffdaSource",
        json!(source),
        InputMode::Scalar,
    );
    let (kind, clean) = kind_and_clean(&single);
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
    let mut compiled = compile_syntax(parse_value(source)).unwrap();
    assert_eq!(json_value(&mut single), json_value(&mut compiled));
}

#[test]
// req:cli-bootstrap-034 req:error-recovery-009
fn execute_compile_source_surfaces_parse_failures() {
    let runtime = run(
        COMPILE_SOURCE,
        "CompileUffdaSource",
        json!("rule Main = ;"),
        InputMode::Scalar,
    );
    assert!(!kind_and_clean(&runtime).1);
}

#[test]
// req:error-recovery-009 req:uffda-language-syntax-006
fn execute_never_runs_a_recovered_source() {
    let source = "export Main; rule Main = ; rule Other = any;";
    let parsed = parse_uffda(source);
    assert!(!kind_and_clean(&parsed).1);
    let again = parse_uffda(source);
    assert_eq!(recovery_spans(&parsed), recovery_spans(&again));
    let mut parsed = parse_uffda(source);
    assert_eq!(json_value(&mut parsed)["kind"], "module");
}

#[test]
// req:cli-bootstrap-034
fn runtime_compiler_compiles_an_empty_syntax_module() {
    assert_eq!(
        compiled_json(json!({"kind":"module","declarations":[]})),
        json!({
            "imports": [],
            "exports": [],
            "rules": [],
            "funcs": [],
            "decorators": []
        })
    );
}

#[test]
// req:cli-bootstrap-034
fn runtime_compiler_compiles_declaration_families() {
    let compiled = compiled_json(json!({
        "kind": "module",
        "declarations": [
            {"kind":"import","moduleUrl":"./symbols.ts","names":["Letter","Space"]},
            {"kind":"export","name":"Main"},
            {
                "kind": "rule",
                "name": "Main",
                "parameters": [],
                "pattern": {"kind":"any"},
                "projection": {"kind":"value","value":"compiled"},
                "attributes": []
            },
            {
                "kind": "rule",
                "name": "Stop",
                "parameters": [],
                "pattern": equal_literal("."),
                "attributes": []
            }
        ]
    }));
    assert_eq!(
        compiled["imports"],
        json!([{"kind":"module","moduleUrl":"./symbols.ts","names":["Letter","Space"]}])
    );
    assert_eq!(compiled["exports"], json!([{"kind":"rule","name":"Main"}]));
    assert_eq!(compiled["rules"][0]["name"], "Main");
    assert_eq!(compiled["rules"][0]["pattern"], json!({"kind":"any"}));
    assert_eq!(
        compiled["rules"][0]["expression"],
        json!({"kind":"value","value":"compiled"})
    );
    assert_eq!(compiled["rules"][1]["name"], "Stop");
    assert_eq!(compiled["rules"][1]["pattern"], equal_literal("."));
    assert!(compiled["rules"][1]["expression"].is_null());
    assert_eq!(compiled["funcs"], json!([]));
    assert_eq!(compiled["decorators"], json!([]));
}

#[test]
// req:cli-bootstrap-034 req:uffda-language-syntax-013
fn runtime_compiler_drops_comment_nodes() {
    let rule = rule_declaration("Main", json!({"kind":"any"}));
    let comment = |text: &str| {
        json!({
            "kind": "comment",
            "blocks": [{"kind":"paragraph","inlines":[{"kind":"text","text":text}]}]
        })
    };
    let with_comments = compiled_json(json!({
        "kind": "module",
        "declarations": [
            comment("head"),
            {"kind":"export","name":"Main"},
            comment("between"),
            rule,
            comment("tail")
        ]
    }));
    let without = compiled_json(json!({
        "kind": "module",
        "declarations": [{"kind":"export","name":"Main"}, rule]
    }));
    assert_eq!(with_comments, without);
}

#[test]
// req:cli-bootstrap-034
fn runtime_compiler_reexports_imports() {
    assert_eq!(
        compiled_json(json!({
            "kind": "module",
            "declarations": [
                {"kind":"import","moduleUrl":"./digit.uff","names":["Digit"]},
                {"kind":"export","name":"Digit"}
            ]
        })),
        json!({
            "imports": [{"kind":"module","moduleUrl":"./digit.uff","names":["Digit"]}],
            "exports": [{"kind":"import","name":"Digit"}],
            "rules": [],
            "funcs": [],
            "decorators": []
        })
    );
}

#[test]
// req:cli-bootstrap-034 req:rule-decorators-001
fn runtime_compiler_compiles_decorator_declarations() {
    let compiled = compiled_json(json!({
        "kind": "module",
        "declarations": [
            {"kind":"export","name":"Deprecated"},
            {
                "kind": "decorator",
                "name": "Deprecated",
                "pattern": {"kind":"end"},
                "expression": {"kind":"value","value":"deprecated"},
                "attributes": [{"kind":"attribute","name":"Deprecated","args":[]}]
            }
        ]
    }));
    assert_eq!(
        compiled["exports"],
        json!([{"kind":"decorator","name":"Deprecated"}])
    );
    assert_eq!(compiled["decorators"][0]["name"], "Deprecated");
    assert_eq!(compiled["decorators"][0]["pattern"], json!({"kind":"end"}));
    assert_eq!(
        compiled["decorators"][0]["expression"],
        json!({"kind":"value","value":"deprecated"})
    );
    assert_eq!(
        compiled["decorators"][0]["attributes"],
        json!([{"name":"Deprecated","args":[]}])
    );
    assert_eq!(compiled["rules"], json!([]));
}

#[test]
// req:cli-bootstrap-034
fn runtime_compiler_rejects_unsupported_declarations() {
    let runtime = compile_syntax(json!({
        "kind": "module",
        "declarations": [{"kind":"unsupported"}]
    }))
    .unwrap();
    assert_eq!(kind_and_clean(&runtime).0, MatchKind::Fail);
    assert_eq!(
        compile_declaration_path(&runtime).as_deref(),
        Some("[0].\"declarations\".[0].[0]")
    );
}

#[test]
// req:cli-bootstrap-034
fn runtime_compiler_rejects_malformed_module_input() {
    let runtime = compile_syntax(json!({"kind":"rule","declarations":[]})).unwrap();
    assert_eq!(kind_and_clean(&runtime).0, MatchKind::Fail);

    let Err(error) = compile_syntax(json!("not-a-module")) else {
        panic!("a non-object module compiled");
    };
    let message = error.to_string();
    assert!(
        message.contains("object"),
        "a non-object module must fail to compile, got {message}"
    );
}

#[test]
// req:cli-bootstrap-034 req:uffda-language-syntax-015
fn runtime_compiler_drops_inner_comments() {
    let cases = [
        ("rule A =\n  # a\n  | a\n  # | b\n;", "rule A = a;"),
        ("rule A =\n  | a\n  # b\n  | c\n  # d\n;", "rule A = a | c;"),
        (
            "rule A =\n  a\n  # c\n  b\n;\nrule B =\n  x\n  # c\n  & y\n;\nrule C =\n  |> p\n  # c\n  |> q\n;",
            "rule A = a b;\nrule B = x & y;\nrule C = |> p |> q;",
        ),
        (
            "rule A = x:any -> {\n  # k\n  a: [\n    # e\n    x\n  ],\n  b: (f\n    # arg\n    x)\n};\nfunc F<x> = [\n  # e\n  x\n];",
            "rule A = x:any -> { a: [x], b: (f x) };\nfunc F<x> = [x];",
        ),
    ];
    for (commented, plain) in cases {
        assert_eq!(compile_parsed(commented), compile_parsed(plain), "{plain}");
    }
}

#[test]
// req:uffda-language-syntax-001 req:uffda-language-syntax-004 req:uffda-language-syntax-005 req:uffda-language-syntax-007 req:uffda-language-syntax-009 req:uffda-language-syntax-011 req:incremental-parsing-004
fn uffda_lang_parses_modules() {
    assert_eq!(parse_value(""), json!({"kind":"module","declarations":[]}));
    assert_eq!(
        parse_value("import \"./a.ts\" A;"),
        module(json!([{"kind":"import","moduleUrl":"./a.ts","names":["A"]}]))
    );
    assert_unclean("import \"./a.ts\" A; trailing");
    assert_eq!(
        parse_value("import \"./a.ts\" A; import \"./b.ts\" B;"),
        module(json!([
            {"kind":"import","moduleUrl":"./a.ts","names":["A"]},
            {"kind":"import","moduleUrl":"./b.ts","names":["B"]}
        ]))
    );
    assert_eq!(
        parse_value("import \"./a.ts\" A; import \"./a.ts\" B;"),
        module(json!([
            {"kind":"import","moduleUrl":"./a.ts","names":["A"]},
            {"kind":"import","moduleUrl":"./a.ts","names":["B"]}
        ]))
    );
    assert_eq!(
        declarations(&parse_value("import \"./a.ts\" A;"))[0],
        json!({"kind":"import","moduleUrl":"./a.ts","names":["A"]})
    );
    assert_eq!(
        declarations(&parse_value("import \"./a.ts\" A B C;"))[0],
        json!({"kind":"import","moduleUrl":"./a.ts","names":["A","B","C"]})
    );
    assert_unclean("import \"./a.ts\" A, B, C;");

    let one = parse_value("rule P = any;");
    assert_eq!(declarations(&one).len(), 1);
    assert_eq!(declarations(&one)[0]["kind"], "rule");
    assert_eq!(declarations(&one)[0]["name"], "P");
    assert_eq!(declarations(&one)[0]["parameters"], json!([]));
    assert!(declarations(&one)[0].get("projection").is_none());
    assert_eq!(
        declarations(&parse_value("rule P = \".\" \".\" end;"))[0],
        rule_declaration(
            "P",
            json!({
                "kind": "then",
                "patterns": [equal_literal("."), equal_literal("."), {"kind":"end"}]
            })
        )
    );

    assert_eq!(
        declarations(&parse_value("rule Wrap<> = any;"))[0],
        rule_declaration("Wrap", json!({"kind":"any"}))
    );
    let params_module = parse_value("rule Surround<L, P, R> = L? p:P R? -> p;");
    let params = &declarations(&params_module)[0];
    assert_eq!(params["kind"], "rule");
    assert_eq!(params["name"], "Surround");
    assert_eq!(
        params["parameters"],
        json!([{"name":"L"},{"name":"P"},{"name":"R"}])
    );
    assert_eq!(params["projection"], json!({"kind":"reference","name":"p"}));

    for source in [
        "rule P = any;",
        "rule P = any -> 1;",
        "rule P = any -> [1 2];",
        "rule P = \";\" \"->\" -> \";\";",
        "rule Slash = \"\\\\\"; rule Other = \"x\" -> { kind: \"ok\" };",
        "rule A = any -> \"\\\\\"; rule B = \"x\";",
    ] {
        let (kind, clean) = kind_and_clean(&parse_uffda(source));
        assert_eq!(kind, MatchKind::Ok, "{source}");
        assert!(clean, "{source}");
    }

    let (kind, clean) = kind_and_clean(&parse_uffda("import \"./a.ts\" A; rule P = any;"));
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
    assert_unclean("rule P = any; import \"./a.ts\" A;");
    assert_unclean("import \"./a.ts\" A rule P = any;");

    let before = "rule First = \"a\"; rule Second = \"b\";";
    let edit_at = before.find("\"b\"").unwrap();
    let after = format!(
        "{}{}{}",
        &before[..edit_at],
        "\"c\"",
        &before[edit_at + 3..]
    );
    let mut edited = parse_uffda(before);
    edited
        .reparse_edit(json!(after), InputMode::Scalar, 0, 1, 1)
        .unwrap();
    edited.run().unwrap();
    let incremental = json_value(&mut edited);
    assert_eq!(incremental, parse_value(&after));
    assert_eq!(
        incremental,
        module(json!([
            rule_declaration("First", equal_literal("a")),
            rule_declaration("Second", equal_literal("c"))
        ]))
    );
}

#[test]
// req:error-recovery-009 req:error-recovery-007 req:uffda-language-syntax-013 req:uffda-language-syntax-015
fn uffda_lang_recovery_points() {
    let cases: &[(&str, &str, &[&str], &[&str])] = &[
        (
            "a broken import between imports",
            "import \"./a.uff\" A;\nimport \"./b.uff\";\nimport \"./c.uff\" C;\nrule R = any;",
            &["import \"./b.uff\";"],
            &["import ./a.uff", "import ./c.uff", "rule R"],
        ),
        (
            "a broken export before exports",
            "export ;\nexport B;\nrule B = any;",
            &["export ;"],
            &["export B", "rule B"],
        ),
        (
            "a missing semicolon before the next declaration",
            "rule A = a\nrule B = b;",
            &["rule A = a"],
            &["rule B"],
        ),
        (
            "a missing semicolon after a projection",
            "rule A = a -> 1\nfunc F = 2;",
            &["rule A = a -> 1"],
            &["func F"],
        ),
        (
            "a missing semicolon after a func body",
            "func F = 1\ndecorator D = 2;",
            &["func F = 1"],
            &["decorator D"],
        ),
        (
            "a stray semicolon",
            "rule A = a;;\nrule B = b;",
            &[";"],
            &["rule A", "rule B"],
        ),
        (
            "a broken declaration quoting a keyword",
            "rule A = ) \"rule\";\nrule B = b;",
            &["rule A = ) \"rule\";"],
            &["rule B"],
        ),
        (
            "a stray token inside a rule body",
            "rule A = a ! b;\nrule B = b;",
            &["!"],
            &["rule A", "rule B"],
        ),
        (
            "a comment after code inside a rule body",
            "# head\nrule A = a # c\n b;\nrule B = b;",
            &["# c"],
            &["comment head", "rule A", "rule B"],
        ),
        (
            "a comment on its own line inside a rule body",
            "rule A =\n  | a\n  # c\n  | b\n;\nrule B = b;",
            &[],
            &["rule A", "rule B"],
        ),
        (
            "comments around a broken declaration",
            "rule A = a;\n# between\nrule B = ) ;\n# after\nrule C = c;",
            &["rule B = ) ;"],
            &["rule A", "comment between", "comment after", "rule C"],
        ),
    ];
    for (name, source, skipped, labels) in cases {
        let mut runtime = parse_uffda(source);
        let (_, clean) = kind_and_clean(&runtime);
        assert_eq!(clean, skipped.is_empty(), "{name}");
        assert_eq!(skipped_texts(&runtime, source), *skipped, "{name}");
        assert_eq!(
            declaration_labels(&json_value(&mut runtime)),
            *labels,
            "{name}"
        );
    }

    let source = "import \"./a.uff\" A;\nexport B;\nrule B = x:any -> { rule: x };";
    let mut runtime = parse_uffda(source);
    assert!(kind_and_clean(&runtime).1);
    assert!(recovery_spans(&runtime).is_empty());
    assert_eq!(
        declaration_labels(&json_value(&mut runtime)),
        ["import ./a.uff", "export B", "rule B"]
    );

    let source = [
        "# head",
        "import \"./a.uff\" A;",
        "# among imports",
        "import \"./b.uff\" B;",
        "# between groups",
        "export C; # after a declaration",
        "# before rule",
        "rule C = \"#\";",
        "# tail",
    ]
    .join("\n");
    let mut runtime = parse_uffda(&source);
    assert!(kind_and_clean(&runtime).1);
    assert!(recovery_spans(&runtime).is_empty());
    assert_eq!(
        declaration_labels(&json_value(&mut runtime)),
        [
            "comment head",
            "import ./a.uff",
            "comment among imports",
            "import ./b.uff",
            "comment between groups",
            "export C",
            "comment after a declaration before rule",
            "rule C",
            "comment tail",
        ]
    );
}

#[test]
// req:uffda-language-syntax-001 req:cli-bootstrap-033
fn uffda_lang_entry_is_uffda_lang() {
    let (compiled, url) = graph(UFFDA_LANG);
    assert!(url.path().ends_with("/src/lang/uffda/uffda.lang.uff"));
    assert!(compiled.export(&url, Some("UffdaLang")).is_some());
    assert_eq!(parse_value(""), json!({"kind":"module","declarations":[]}));
}

#[test]
// req:projection-002
fn projection_dlr_whole_body_rule_projection_applies_each_growth_step() {
    let source = r#"export Member Primary Direct;
rule Member = e:Primary "." n:any -> { kind: "member", expression: e, name: n };
rule Primary = Member | "a";
rule Direct = e:(Direct | "a") "." n:any -> { kind: "member", expression: e, name: n };"#;
    let nested = json!({
        "kind": "member",
        "expression": {"kind": "member", "expression": "a", "name": "b"},
        "name": "c"
    });
    for entry in ["Member", "Primary", "Direct"] {
        let mut runtime = execute_source(source, entry, json!("a.b.c"), InputMode::Iterable);
        assert_eq!(kind_and_clean(&runtime).0, MatchKind::Ok, "{entry}");
        assert_eq!(json_value(&mut runtime), nested, "{entry}");
    }
}

#[test]
// req:uffda-language-syntax-010
fn uffda_rule_level_projection_coexists_with_nested_projection() {
    let group_less = parse_value("rule P = any -> 1;");
    let decl = &declarations(&group_less)[0];
    assert_eq!(decl["kind"], "rule");
    assert_eq!(decl["pattern"], json!({"kind": "any"}));
    assert_eq!(decl["projection"], json!({"kind": "number", "value": 1}));

    let nested = parse_value("rule M = (any -> 1) | fail;");
    let decl = &declarations(&nested)[0];
    assert_eq!(decl["kind"], "rule");
    assert!(decl.get("projection").is_none());
    assert_eq!(
        decl["pattern"],
        json!({
            "kind": "or",
            "patterns": [
                {
                    "kind": "projection",
                    "pattern": {"kind": "any"},
                    "expression": {"kind": "number", "value": 1}
                },
                {"kind": "fail"}
            ]
        })
    );
}

#[test]
// req:uffda-runtime-compilation-001
fn runtime_compiler_is_an_executable_language_export() {
    let source = include_str!("../../../src/lang/uffda/runtime.compiler.uff");
    assert!(source.contains("export UffdaRuntimeCompiler"));
    assert!(source.contains("rule UffdaRuntimeCompiler"));
    assert_eq!(
        compiled_json(json!({"kind": "module", "declarations": []})),
        json!({
            "imports": [],
            "exports": [],
            "rules": [],
            "funcs": [],
            "decorators": []
        })
    );
}

#[test]
// req:uffda-runtime-compilation-002
fn runtime_compiler_consumes_structured_syntax_trees_not_source_text() {
    let source = include_str!("../../../src/lang/uffda/runtime.compiler.uff");
    assert!(source.contains("kind: \"module\"") || source.contains("kind:\"module\""));
    assert!(source.contains("[CompileDeclarations]") || source.contains("CompileDeclarations"));
    let ok = compile_syntax(json!({"kind": "module", "declarations": []})).unwrap();
    assert_eq!(kind_and_clean(&ok).0, MatchKind::Ok);
    let rejected = try_run(
        RUNTIME_COMPILER,
        "UffdaRuntimeCompiler",
        json!("{\"kind\":\"module\",\"declarations\":[]}"),
        InputMode::Scalar,
    );
    match rejected {
        Ok(runtime) => assert_ne!(kind_and_clean(&runtime).0, MatchKind::Ok),
        Err(error) => assert!(
            error.to_string().contains("object") || error.to_string().contains("String"),
            "{error}"
        ),
    }
}

#[test]
// req:uffda-runtime-compilation-003 req:uffda-runtime-compilation-004
fn runtime_compiler_transforms_then_host_executes_independently() {
    let compiled = compiled_json(json!({
        "kind": "module",
        "declarations": [
            {"kind":"export","name":"Main"},
            {
                "kind": "rule",
                "name": "Main",
                "parameters": [],
                "pattern": {"kind":"any"},
                "attributes": []
            }
        ]
    }));
    assert_eq!(compiled["exports"], json!([{"kind":"rule","name":"Main"}]));
    assert_eq!(compiled["rules"][0]["pattern"], json!({"kind":"any"}));
    let mut runtime = execute_module(
        &serde_json::to_string(&compiled).unwrap(),
        "Main",
        json!("value"),
        InputMode::Scalar,
    );
    assert_eq!(kind_and_clean(&runtime).0, MatchKind::Ok);
    assert_eq!(json_value(&mut runtime), json!("value"));
}

#[test]
// req:uffda-runtime-compilation-005
fn runtime_compiler_diagnostics_are_deterministic_for_unsupported_declarations() {
    let syntax = json!({
        "kind": "module",
        "declarations": [{"kind":"unsupported"}]
    });
    let first = compile_syntax(syntax.clone()).unwrap();
    let second = compile_syntax(syntax).unwrap();
    assert_eq!(kind_and_clean(&first).0, MatchKind::Fail);
    assert_eq!(kind_and_clean(&second).0, MatchKind::Fail);
    let path = compile_declaration_path(&first);
    assert_eq!(path.as_deref(), Some("[0].\"declarations\".[0].[0]"));
    assert_eq!(path, compile_declaration_path(&second));
}

#[test]
// req:uffda-runtime-compilation-007
fn runtime_compiler_normalizes_reexport_import_kind() {
    let source = include_str!("../../../src/lang/uffda/runtime.compiler.uff");
    assert!(source.contains("NormalizeModule") || source.contains("FinalizeExports"));
    assert_eq!(
        compiled_json(json!({
            "kind": "module",
            "declarations": [
                {"kind":"import","moduleUrl":"./digit.uff","names":["Digit"]},
                {"kind":"export","name":"Digit"}
            ]
        })),
        json!({
            "imports": [{"kind":"module","moduleUrl":"./digit.uff","names":["Digit"]}],
            "exports": [{"kind":"import","name":"Digit"}],
            "rules": [],
            "funcs": [],
            "decorators": []
        })
    );
}

#[test]
// req:uffda-runtime-compilation-006
fn remport_source_authored_morse_decodes_the_full_repertoire() {
    const MORSE: &str = include_str!("../../../examples/morse/morse.uff");
    let repertoire = [
        (".-", "A"),
        ("-...", "B"),
        ("-.-.", "C"),
        ("-..", "D"),
        (".", "E"),
        ("..-.", "F"),
        ("--.", "G"),
        ("....", "H"),
        ("..", "I"),
        (".---", "J"),
        ("-.-", "K"),
        (".-..", "L"),
        ("--", "M"),
        ("-.", "N"),
        ("---", "O"),
        (".--.", "P"),
        ("--.-", "Q"),
        (".-.", "R"),
        ("...", "S"),
        ("-", "T"),
        ("..-", "U"),
        ("...-", "V"),
        (".--", "W"),
        ("-..-", "X"),
        ("-.--", "Y"),
        ("--..", "Z"),
        ("-----", "0"),
        (".----", "1"),
        ("..---", "2"),
        ("...--", "3"),
        ("....-", "4"),
        (".....", "5"),
        ("-....", "6"),
        ("--...", "7"),
        ("---..", "8"),
        ("----.", "9"),
        (".-.-.-", "."),
        ("--..--", ","),
        ("..--..", "?"),
        (".----.", "'"),
        ("-.-.--", "!"),
        ("-..-.", "/"),
        ("-.--.", "("),
        ("-.--.-", ")"),
        (".-...", "&"),
        ("---...", ":"),
        ("-.-.-.", ";"),
        ("-...-", "="),
        (".-.-.", "+"),
        ("-....-", "-"),
        ("..--.-", "_"),
        (".-..-.", "\""),
        ("...-..-", "$"),
        (".--.-.", "@"),
    ];
    let encoded = repertoire
        .iter()
        .map(|(code, _)| format!("{code}/"))
        .collect::<String>();
    let expected = repertoire
        .iter()
        .map(|(_, symbol)| *symbol)
        .collect::<String>();
    let mut runtime = execute_source(MORSE, "Morse", json!(encoded), InputMode::Iterable);
    let (kind, clean) = kind_and_clean(&runtime);
    assert_eq!(kind, MatchKind::Ok);
    assert!(clean);
    assert_eq!(json_value(&mut runtime), json!(expected));
}

#[test]
// req:uffda-runtime-compilation-006
fn remport_morse_compiles_and_roundtrips_moby_dick_excerpt() {
    use crate::compile::{CompileRequest, compile};
    use std::collections::BTreeMap;

    const MORSE: &str = include_str!("../../../examples/morse/morse.uff");
    const MOBY_DICK: &str = "I quickly followed suit, and descending into the\n\
bar-room accosted the grinning landlord very pleasantly. I cherished no malice\n\
towards him, though he had been skylarking with me not a little in the matter of\n\
my bedfellow.\n\
\n\
However, a good laugh is a mighty good thing, and rather too scarce a good\n\
thing; the more's the pity. So, if any one man, in his own proper person, afford\n\
stuff for a good joke to anybody, let him not be backward, but let him\n\
cheerfully allow himself to spend and be spent in that way. And the man that has\n\
anything bountifully laughable about him, be sure there is more in that man than\n\
you perhaps think for.";

    let root = std::env::temp_dir().join(format!(
        "uffda-morse-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(root.join("examples/morse")).unwrap();
    std::fs::write(root.join("examples/morse/morse.uff"), MORSE).unwrap();
    let out_dir = root.join("bin");
    let paths = vec!["examples/morse/morse.uff".to_string()];
    let imports = BTreeMap::new();
    let mut languages = Languages::new().unwrap();
    let result = compile(
        CompileRequest {
            cwd: &root,
            root: &root,
            out_dir: &out_dir,
            paths: &paths,
            imports: &imports,
            overwrite: false,
        },
        &mut languages,
    );
    assert!(result.ok, "{}", serde_json::to_string(&result).unwrap());
    assert!(result.failures.is_empty());
    assert_eq!(result.successes.len(), 1);
    let artifact = std::fs::read_to_string(&result.successes[0].output_path).unwrap();
    let declaration: Json = serde_json::from_str(&artifact).unwrap();
    assert!(declaration["rules"].as_array().is_some());

    let source_text = MOBY_DICK
        .split("\n\n")
        .map(|paragraph| paragraph.replace('\n', " "))
        .collect::<Vec<_>>()
        .join("\n\n")
        .to_uppercase();
    let mut encoded = execute_module(&artifact, "Text", json!(source_text), InputMode::Iterable);
    assert_eq!(kind_and_clean(&encoded).0, MatchKind::Ok);
    let encoded_text = json_value(&mut encoded);
    assert!(encoded_text.as_str().is_some());
    let mut decoded = execute_module(&artifact, "Morse", encoded_text, InputMode::Iterable);
    assert_eq!(kind_and_clean(&decoded).0, MatchKind::Ok);
    assert_eq!(json_value(&mut decoded), json!(source_text));
    let _ = std::fs::remove_dir_all(root);
}
