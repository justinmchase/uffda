// Ports of src/lang/pattern grammar checks.

use crate::json::JsonValue;
use crate::module::CompiledModuleGraph;
use crate::pattern::MatchKind;
use crate::resolver::{Resolver, decode_declaration};
use crate::runtime::{DeclarationMetadata, InputMode, Runtime};
use crate::value::Value as RuntimeValue;
use serde_json::{Value as Json, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use url::Url;

const AND: &str = "src/lang/pattern/and.uff";
const ATOMIC: &str = "src/lang/pattern/atomic.uff";
const ATOMS: &str = "src/lang/pattern/atoms.uff";
const LITERALS: &str = "src/lang/pattern/literals.uff";
const OR: &str = "src/lang/pattern/or.uff";
const PATTERN: &str = "src/lang/pattern/pattern.uff";
const PATTERN_LANG: &str = "src/lang/pattern/pattern.lang.uff";
const PIPE: &str = "src/lang/pattern/pipe.uff";
const PREFIX: &str = "src/lang/pattern/prefix.uff";
const PROJECTION: &str = "src/lang/pattern/projection.uff";
const RESOLVE: &str = "src/lang/pattern/resolve.uff";
const STRUCTURE: &str = "src/lang/pattern/structure.uff";
const THEN: &str = "src/lang/pattern/then.uff";
const UFFDA_LANG: &str = "src/lang/uffda/uffda.lang.uff";

thread_local! {
    static GRAPHS: RefCell<HashMap<String, (Rc<CompiledModuleGraph>, Url)>> =
        RefCell::new(HashMap::new());
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

fn run(path: &str, entry: &str, input: Json, mode: InputMode) -> Runtime {
    let (compiled, url) = graph(path);
    let mut runtime =
        Runtime::with_mode(compiled, &url, Some(entry), JsonValue::from(input), mode).unwrap();
    runtime.run().unwrap();
    runtime
}

fn json_value(runtime: &mut Runtime) -> Json {
    let text = runtime.serialize_result().unwrap().unwrap();
    serde_json::from_str(&text).unwrap()
}

fn consumed(input: &Json, mode: InputMode) -> usize {
    match mode {
        InputMode::Scalar => 1,
        InputMode::Empty => 0,
        InputMode::Iterable => input.as_array().expect("iterable input").len(),
    }
}

fn clean(path: &str, entry: &str, input: Json, mode: InputMode, expected: Json) {
    let end = consumed(&input, mode);
    let mut runtime = run(path, entry, input, mode);
    runtime.read(|execution| {
        let result = execution.result().expect("match");
        assert_eq!(result.kind, MatchKind::Ok, "{path} {entry}");
        assert!(!result.recovered, "{path} {entry} recovered");
        assert_eq!(result.start, 0, "{path} {entry}");
        assert_eq!(result.end, end, "{path} {entry} left input unconsumed");
    });
    let actual = json_value(&mut runtime);
    assert_eq!(actual, expected, "{path} {entry}");
}

fn fail(path: &str, entry: &str, input: Json, mode: InputMode) {
    let runtime = run(path, entry, input, mode);
    runtime.read(|execution| {
        let result = execution.result().expect("match");
        assert_eq!(result.kind, MatchKind::Fail, "{path} {entry}");
        assert_eq!(
            result.end, result.start,
            "{path} {entry} failure consumed input"
        );
    });
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

fn expect_mistake(marked: &str, phrase: &str) {
    let offset = marked.find('‸').expect("caret");
    let source = marked.replacen('‸', "", 1);
    let runtime = run(UFFDA_LANG, "UffdaLang", json!(source), InputMode::Scalar);
    let diagnostics = runtime.diagnostics_with(documentation_error);
    let Some(diagnostic) = diagnostics.first() else {
        panic!("expected a diagnostic for {marked}");
    };
    assert_eq!(
        diagnostic.focus_span.start, offset,
        "{marked}\nspan {:?} focus {:?}\n{}",
        diagnostic.span, diagnostic.focus_span, diagnostic.message
    );
    match diagnostic.explanation.as_deref() {
        Some(explanation) if explanation.contains(phrase) => {}
        Some(explanation) if !explanation.is_empty() => {
            panic!("{marked}\nexpected an explanation including {phrase:?}, got {explanation:?}")
        }
        _ => panic!("{marked}\nexpected a non-empty explanation at {offset}"),
    }
}

fn skipped_text(runtime: &Runtime, source: &str) -> Vec<String> {
    let chars: Vec<char> = source.chars().collect();
    runtime.read(|execution| {
        execution
            .recoveries()
            .iter()
            .map(|matched| {
                let start = matched.origin.start.min(chars.len());
                let end = matched.origin.end.min(chars.len());
                chars[start..end].iter().collect()
            })
            .collect()
    })
}

fn execute_source(source: &str, entry: &str, input: Json, mode: InputMode) -> Runtime {
    let mut languages = crate::languages::Languages::new().unwrap();
    let syntax = languages
        .parse(source, crate::languages::Language::Uffda)
        .unwrap_or_else(|error| panic!("parse {}: {}", error.message, source));
    let declaration = languages
        .compile(syntax)
        .unwrap_or_else(|error| panic!("compile {}: {}", error.message, source));
    let url = Url::parse("file:///uffda/module.uff").unwrap();
    let mut resolver = Resolver::from_cwd().unwrap();
    let _ = crate::builtins::register(&mut resolver).unwrap();
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(&url, &declaration.to_string())
            .unwrap_or_else(|error| panic!("decode {}: {}", error.message, source)),
    );
    let compiled =
        Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
    let mut runtime = Runtime::with_mode(compiled, &url, Some(entry), JsonValue::from(input), mode)
        .unwrap_or_else(|error| panic!("runtime {entry}: {error}"));
    runtime
        .run()
        .unwrap_or_else(|error| panic!("run {entry}: {error}"));
    runtime
}

fn comment() -> Json {
    json!({"kind": "comment", "blocks": []})
}

fn any() -> Json {
    json!({"kind": "any"})
}

fn fail_pat() -> Json {
    json!({"kind": "fail"})
}

fn end_pat() -> Json {
    json!({"kind": "end"})
}

fn ok_pat() -> Json {
    json!({"kind": "ok"})
}

fn literal(value: Json) -> Json {
    json!({"kind": "value.literal", "value": value})
}

fn variable(name: &str) -> Json {
    json!({"kind": "value.variable", "name": name})
}

fn equal(value: Json) -> Json {
    json!({"kind": "equal", "value": literal(value)})
}

fn reference(name: &str) -> Json {
    json!({
        "kind": "resolve",
        "targetKind": "reference",
        "name": name,
        "args": []
    })
}

fn ty(name: &str) -> Json {
    json!({"kind": "type", "type": name})
}

#[test]
// req:cli-bootstrap-029
fn and_joins_any_and_fail() {
    clean(
        AND,
        "And",
        json!(["any", "&", "fail"]),
        InputMode::Iterable,
        json!({"kind": "and", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn and_keeps_a_comment_before_the_operator() {
    let note = comment();
    clean(
        AND,
        "And",
        json!(["any", note, "&", "fail"]),
        InputMode::Iterable,
        json!({"kind": "and", "patterns": [any(), comment(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-024
fn atomic_resolves_a_rule_reference() {
    clean(
        ATOMIC,
        "Atomic",
        json!(["foo"]),
        InputMode::Iterable,
        reference("foo"),
    );
}

#[test]
// req:cli-bootstrap-023
fn atoms_projects_any() {
    clean(ATOMS, "Atoms", json!(["any"]), InputMode::Iterable, any());
}

#[test]
// req:cli-bootstrap-038 req:pattern-syntax-001
fn literals_equal_hello() {
    clean(
        LITERALS,
        "Literals",
        json!(["\"", "hello", "\""]),
        InputMode::Iterable,
        equal(json!("hello")),
    );
}

#[test]
// req:pattern-syntax-001 req:cli-bootstrap-038
fn literals_interpret_string_escapes() {
    let cases = [
        (json!(["\"", "\\", "t", "\""]), json!("\t")),
        (json!(["\"", "\\", "n", "\""]), json!("\n")),
        (json!(["\"", "\\", "r", "\""]), json!("\r")),
        (json!(["\"", "\\", "\\", "\""]), json!("\\")),
        (json!(["\"", "\\", "\"", "\""]), json!("\"")),
        (json!(["\"", "\\", "t", "ab", "\""]), json!("\tab")),
    ];
    for (input, value) in cases {
        clean(
            LITERALS,
            "Literals",
            input,
            InputMode::Iterable,
            equal(value),
        );
    }
}

#[test]
// req:cli-bootstrap-038
fn literals_includes() {
    clean(
        LITERALS,
        "Literals",
        json!(["in", "[", "x", "y", "]"]),
        InputMode::Iterable,
        json!({
            "kind": "includes",
            "values": [literal(json!("x")), literal(json!("y"))]
        }),
    );
}

#[test]
// req:cli-bootstrap-038
fn literals_between() {
    clean(
        LITERALS,
        "Literals",
        json!(["1", ".", ".", "5"]),
        InputMode::Iterable,
        json!({
            "kind": "between",
            "left": literal(json!(1)),
            "right": literal(json!(5))
        }),
    );
}

#[test]
// req:pattern-language-syntax-007
fn literals_equal_variable() {
    clean(
        LITERALS,
        "Literals",
        json!(["$", "x"]),
        InputMode::Iterable,
        json!({"kind": "equal", "value": variable("x")}),
    );
}

#[test]
// req:pattern-language-syntax-007
fn literals_between_variables() {
    clean(
        LITERALS,
        "Literals",
        json!(["$", "a", ".", ".", "$", "b"]),
        InputMode::Iterable,
        json!({
            "kind": "between",
            "left": variable("a"),
            "right": variable("b")
        }),
    );
}

#[test]
// req:pattern-language-syntax-007
fn literals_between_open_upper() {
    clean(
        LITERALS,
        "Literals",
        json!(["$", "a", ".", "."]),
        InputMode::Iterable,
        json!({"kind": "between", "left": variable("a")}),
    );
}

#[test]
// req:pattern-language-syntax-007
fn literals_between_open_lower() {
    clean(
        LITERALS,
        "Literals",
        json!([".", ".", "$", "b"]),
        InputMode::Iterable,
        json!({"kind": "between", "right": variable("b")}),
    );
}

#[test]
// req:uffda-language-syntax-016
fn literals_explain_mistakes_where_they_occur() {
    expect_mistake("rule A = in[‸;", "lists one or more literal values");
    expect_mistake("rule A = $‸;", "`$` must be followed by the name");
    expect_mistake("rule A = \"abc‸;", "This string is missing its closing");
}

#[test]
// req:cli-bootstrap-029
fn or_joins_any_and_fail() {
    clean(
        OR,
        "Or",
        json!(["any", "|", "fail"]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_accepts_a_leading_pipe() {
    clean(
        OR,
        "Or",
        json!(["|", "any", "|", "fail"]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_treats_a_leading_pipe_gt_as_a_pipeline() {
    clean(
        OR,
        "Or",
        json!(["|", ">", "any", "|", ">", "end"]),
        InputMode::Iterable,
        json!({"kind": "pipeline", "steps": [any(), end_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_branches_a_leading_pipeline() {
    clean(
        OR,
        "Or",
        json!(["|", "|", ">", "any", "|", ">", "end", "|", "fail"]),
        InputMode::Iterable,
        json!({
            "kind": "or",
            "patterns": [
                {"kind": "pipeline", "steps": [any(), end_pat()]},
                fail_pat()
            ]
        }),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_keeps_a_comment_before_the_operator() {
    let note = comment();
    clean(
        OR,
        "Or",
        json!(["any", note, "|", "fail"]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [any(), comment(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_keeps_leading_comments() {
    let note = comment();
    clean(
        OR,
        "Or",
        json!([note, "|", "any"]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [comment(), any()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn or_keeps_trailing_comments() {
    let note = comment();
    clean(
        OR,
        "Or",
        json!(["any", "|", "fail", note]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [any(), fail_pat(), comment()]}),
    );
}

#[test]
// req:uffda-language-syntax-016
fn parameter_list_explains_a_missing_closer() {
    expect_mistake(
        "func F<x = x;‸",
        "Expected `>` here to close the parameter list",
    );
}

#[test]
// req:pattern-language-syntax-001 req:cli-bootstrap-031
fn pattern_lang_parses_any() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any"),
        InputMode::Scalar,
        any(),
    );
}

#[test]
// req:cli-bootstrap-031 req:pattern-language-syntax-002
fn pattern_tokens_parse_an_existing_token_array() {
    clean(
        PATTERN_LANG,
        "PatternTokens",
        json!(["any", "|", "fail"]),
        InputMode::Scalar,
        json!({"kind": "or", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_not() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("not any"),
        InputMode::Scalar,
        json!({"kind": "not", "pattern": any()}),
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_or() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any | fail"),
        InputMode::Scalar,
        json!({"kind": "or", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_and_binds_tighter_than_or() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any & fail | ok"),
        InputMode::Scalar,
        json!({
            "kind": "or",
            "patterns": [
                {"kind": "and", "patterns": [any(), fail_pat()]},
                ok_pat()
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_leading_pipe() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("| any | fail | ok"),
        InputMode::Scalar,
        json!({"kind": "or", "patterns": [any(), fail_pat(), ok_pat()]}),
    );
}

#[test]
// req:pattern-language-syntax-002 req:error-recovery-009
fn pattern_lang_does_not_treat_and_as_an_operator() {
    // A stray `and` inside a sequence is recovered, so it is not a composition
    // operator. The sequence stays Then(any, fail).
    let source = "any and fail";
    let mut runtime = run(
        PATTERN_LANG,
        "PatternLang",
        json!(source),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
    });
    assert_eq!(skipped_text(&runtime, source), vec!["and".to_string()]);
    assert_eq!(
        json_value(&mut runtime),
        json!({"kind": "then", "patterns": [any(), fail_pat()]})
    );
}

#[test]
// req:pattern-language-syntax-002 req:error-recovery-009
fn pattern_lang_does_not_treat_or_as_an_operator() {
    let source = "any or fail";
    let mut runtime = run(
        PATTERN_LANG,
        "PatternLang",
        json!(source),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
    });
    assert_eq!(skipped_text(&runtime, source), vec!["or".to_string()]);
    assert_eq!(
        json_value(&mut runtime),
        json!({"kind": "then", "patterns": [any(), fail_pat()]})
    );
}

#[test]
// req:pattern-language-syntax-001
fn pattern_lang_type() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("string"),
        InputMode::Scalar,
        ty("string"),
    );
}

#[test]
// req:pattern-language-syntax-001
fn pattern_lang_character_class() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("\\cL"),
        InputMode::Scalar,
        json!({"kind": "character", "characterClass": "L"}),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_reference() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("foo"),
        InputMode::Scalar,
        reference("foo"),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_escaped_reference() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("@any"),
        InputMode::Scalar,
        reference("any"),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_reference_argument() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"foo<"bar">"#),
        InputMode::Scalar,
        json!({
            "kind": "resolve",
            "targetKind": "reference",
            "name": "foo",
            "args": [equal(json!("bar"))]
        }),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_nested_reference_argument() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"foo<bar<"baz">>"#),
        InputMode::Scalar,
        json!({
            "kind": "resolve",
            "targetKind": "reference",
            "name": "foo",
            "args": [{
                "kind": "resolve",
                "targetKind": "reference",
                "name": "bar",
                "args": [equal(json!("baz"))]
            }]
        }),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_includes() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("in[x y]"),
        InputMode::Scalar,
        json!({
            "kind": "includes",
            "values": [literal(json!("x")), literal(json!("y"))]
        }),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_between() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("1..5"),
        InputMode::Scalar,
        json!({
            "kind": "between",
            "left": literal(json!(1)),
            "right": literal(json!(5))
        }),
    );
}

#[test]
// req:pattern-syntax-001 req:pattern-language-syntax-001
fn pattern_lang_string_literal() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#""hello""#),
        InputMode::Scalar,
        equal(json!("hello")),
    );
}

#[test]
// req:pattern-syntax-001
fn pattern_lang_string_escapes() {
    let cases = [
        (r#""\t""#, json!("\t")),
        (r#""\n""#, json!("\n")),
        (r#""\r""#, json!("\r")),
        (r#""\\""#, json!("\\")),
        (r#""\"""#, json!("\"")),
        (r#""\tab""#, json!("\tab")),
    ];
    for (source, value) in cases {
        clean(
            PATTERN_LANG,
            "PatternLang",
            json!(source),
            InputMode::Scalar,
            equal(value),
        );
    }
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_pipeline() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any |> end"),
        InputMode::Scalar,
        json!({"kind": "pipeline", "steps": [any(), end_pat()]}),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_object() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("{name: any, enabled: end, }"),
        InputMode::Scalar,
        json!({
            "kind": "over",
            "keys": {"name": any(), "enabled": end_pat()}
        }),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_rejects_includes_keyword() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"includes [1 "x"]"#),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-syntax-001
fn pattern_lang_string_keeps_braces() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#""{foo}""#),
        InputMode::Scalar,
        equal(json!("{foo}")),
    );
}

#[test]
// req:pattern-language-syntax-004
fn pattern_lang_newline_between_not_and_operand() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("not\nany"),
        InputMode::Scalar,
        json!({"kind": "not", "pattern": any()}),
    );
}

#[test]
// req:pattern-language-syntax-004
fn pattern_lang_newlines_around_reference_arguments() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("foo\n<\n\"bar\"\n>"),
        InputMode::Scalar,
        json!({
            "kind": "resolve",
            "targetKind": "reference",
            "name": "foo",
            "args": [equal(json!("bar"))]
        }),
    );
}

#[test]
// req:pattern-language-syntax-004
fn pattern_lang_newlines_between_alternatives() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("|\nany\n|\nfail\n|\nok"),
        InputMode::Scalar,
        json!({"kind": "or", "patterns": [any(), fail_pat(), ok_pat()]}),
    );
}

#[test]
// req:pattern-language-syntax-004
fn pattern_lang_newlines_inside_an_object() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("{\nname: any,\nenabled: end,\n}"),
        InputMode::Scalar,
        json!({
            "kind": "over",
            "keys": {"name": any(), "enabled": end_pat()}
        }),
    );
}

#[test]
// req:pattern-language-syntax-011
fn pattern_lang_parses_rest_entry_object_syntax() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("{ id: number ...[string]: string }"),
        InputMode::Scalar,
        json!({
            "kind": "over",
            "keys": {"id": ty("number")},
            "rest": [{
                "kind": "pattern",
                "key": ty("string"),
                "value": ty("string")
            }]
        }),
    );
}

#[test]
// req:pattern-language-syntax-002 req:pattern-language-syntax-003
fn pattern_lang_pipeline_into() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any |> [end] |> ok"),
        InputMode::Scalar,
        json!({
            "kind": "pipeline",
            "steps": [
                any(),
                {"kind": "into", "pattern": end_pat()},
                ok_pat()
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_rejects_over_keyword() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!("over {name: any}"),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-language-syntax-003
fn pattern_lang_rejects_pipeline_keyword() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!("pipeline { any; end; }"),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_rejects_into_keyword() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!("into end"),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_pipeline_groups_an_or() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("any |> (end | fail)"),
        InputMode::Scalar,
        json!({
            "kind": "pipeline",
            "steps": [
                any(),
                {"kind": "or", "patterns": [end_pat(), fail_pat()]}
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-002
fn pattern_lang_groups_a_pipeline() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("(any |> [end])"),
        InputMode::Scalar,
        json!({
            "kind": "pipeline",
            "steps": [any(), {"kind": "into", "pattern": end_pat()}]
        }),
    );
}

#[test]
// req:pattern-language-syntax-003 req:pattern-language-syntax-004
fn pattern_lang_canonical_multiline() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(
            "|\n  \"literal\"\n|\n  any\n  |>\n  [end]\n  |>\n  ok\n|\n  {\n    name: string,\n    aliases: [any+],\n  }"
        ),
        InputMode::Scalar,
        json!({
            "kind": "or",
            "patterns": [
                equal(json!("literal")),
                {
                    "kind": "pipeline",
                    "steps": [
                        any(),
                        {"kind": "into", "pattern": end_pat()},
                        ok_pat()
                    ]
                },
                {
                    "kind": "over",
                    "keys": {
                        "name": ty("string"),
                        "aliases": {
                            "kind": "into",
                            "pattern": {
                                "kind": "quantifier",
                                "pattern": any(),
                                "min": literal(json!(1))
                            }
                        }
                    }
                }
            ]
        }),
    );
}

#[test]
// req:pattern-syntax-001
fn pattern_string_literals_keep_whitespace() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"" a b ""#),
        InputMode::Scalar,
        equal(json!(" a b ")),
    );
}

#[test]
// req:error-recovery-009
fn pattern_lang_recovers_trailing_input() {
    let source = "a ) b";
    let mut runtime = run(
        PATTERN_LANG,
        "PatternLang",
        json!(source),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
    });
    assert_eq!(skipped_text(&runtime, source), vec![") b".to_string()]);
    assert_eq!(json_value(&mut runtime), reference("a"));

    let clean_source = "a b";
    let mut clean = run(
        PATTERN_LANG,
        "PatternLang",
        json!(clean_source),
        InputMode::Scalar,
    );
    clean.read(|execution| {
        assert!(execution.is_clean(), "{clean_source}");
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
    });
    assert!(skipped_text(&clean, clean_source).is_empty());
    assert_eq!(json_value(&mut clean)["kind"], "then");
}

#[test]
// req:uffda-language-syntax-016
fn pattern_lang_explains_a_stray_closer() {
    expect_mistake("rule A = a‸);", "The pattern is complete here");
}

#[test]
// req:cli-bootstrap-030
fn pattern_is_identity_over_or() {
    clean(
        PATTERN,
        "Pattern",
        json!(["any", "|", "fail"]),
        InputMode::Iterable,
        json!({"kind": "or", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn pipe_projects_steps() {
    clean(
        PIPE,
        "Pipe",
        json!(["any", "|", ">", "end"]),
        InputMode::Iterable,
        json!({"kind": "pipeline", "steps": [any(), end_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn pipe_projects_an_into_step() {
    clean(
        PIPE,
        "Pipe",
        json!(["any", "|", ">", "[", "end", "]", "|", ">", "ok"]),
        InputMode::Iterable,
        json!({
            "kind": "pipeline",
            "steps": [
                any(),
                {"kind": "into", "pattern": end_pat()},
                ok_pat()
            ]
        }),
    );
}

#[test]
// req:cli-bootstrap-029
fn pipe_allows_a_leading_operator() {
    clean(
        PIPE,
        "Pipe",
        json!(["|", ">", "any", "|", ">", "end"]),
        InputMode::Iterable,
        json!({"kind": "pipeline", "steps": [any(), end_pat()]}),
    );
}

#[test]
// req:cli-bootstrap-029
fn pipe_collapses_a_single_leading_step() {
    clean(
        PIPE,
        "Pipe",
        json!(["|", ">", "any"]),
        InputMode::Iterable,
        any(),
    );
}

#[test]
// req:cli-bootstrap-029
fn pipe_keeps_a_comment_before_the_operator() {
    let note = comment();
    clean(
        PIPE,
        "Pipe",
        json!(["any", note, "|", ">", "fail"]),
        InputMode::Iterable,
        json!({"kind": "pipeline", "steps": [any(), comment(), fail_pat()]}),
    );
}

fn quantifier(pattern: Json, min: Option<Json>, max: Option<Json>) -> Json {
    let mut value = json!({"kind": "quantifier", "pattern": pattern});
    if let Some(min) = min {
        value["min"] = min;
    }
    if let Some(max) = max {
        value["max"] = max;
    }
    value
}

#[test]
// req:pattern-language-syntax-005 req:cli-bootstrap-036
fn prefix_star_min_max() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*", "1", ".", ".", "3"]),
        InputMode::Iterable,
        quantifier(any(), Some(literal(json!(1))), Some(literal(json!(3)))),
    );
}

#[test]
// req:pattern-language-syntax-005 req:cli-bootstrap-036
fn prefix_star_bare() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*"]),
        InputMode::Iterable,
        quantifier(any(), None, None),
    );
}

#[test]
// req:pattern-language-syntax-005 req:cli-bootstrap-036
fn prefix_star_min_open() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*", "1", ".", "."]),
        InputMode::Iterable,
        quantifier(any(), Some(literal(json!(1))), None),
    );
}

#[test]
// req:pattern-language-syntax-005 req:cli-bootstrap-036
fn prefix_star_max_only() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*", ".", ".", "2"]),
        InputMode::Iterable,
        quantifier(any(), Some(literal(json!(0))), Some(literal(json!(2)))),
    );
}

#[test]
// req:pattern-language-syntax-007 req:cli-bootstrap-036
fn prefix_star_min_variable() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*", "$", "n"]),
        InputMode::Iterable,
        quantifier(any(), Some(variable("n")), None),
    );
}

#[test]
// req:pattern-language-syntax-007 req:cli-bootstrap-036
fn prefix_star_minmax_variables() {
    clean(
        PREFIX,
        "Prefix",
        json!(["any", "*", "$", "min", ".", ".", "$", "max"]),
        InputMode::Iterable,
        quantifier(any(), Some(variable("min")), Some(variable("max"))),
    );
}

#[test]
// req:pattern-language-syntax-005 req:cli-bootstrap-036
fn prefix_star_rejects_descending_digits() {
    fail(
        PREFIX,
        "Star",
        json!(["any", "*", "2", ".", ".", "1"]),
        InputMode::Iterable,
    );
}

#[test]
// req:pattern-language-syntax-009
fn prefix_skip_operand() {
    clean(
        PREFIX,
        "Prefix",
        json!(["skip", "any", "*"]),
        InputMode::Iterable,
        json!({
            "kind": "skip",
            "pattern": quantifier(any(), None, None)
        }),
    );
}

#[test]
// req:pattern-language-syntax-009
fn prefix_skip_bare() {
    clean(
        PREFIX,
        "Prefix",
        json!(["skip"]),
        InputMode::Iterable,
        json!({"kind": "skip", "pattern": any()}),
    );
}

#[test]
// req:pattern-language-syntax-009
fn prefix_skip_nested() {
    clean(
        PREFIX,
        "Prefix",
        json!(["skip", "skip"]),
        InputMode::Iterable,
        json!({
            "kind": "skip",
            "pattern": {"kind": "skip", "pattern": any()}
        }),
    );
}

#[test]
// req:pattern-language-syntax-010
fn prefix_ope() {
    clean(
        PREFIX,
        "Prefix",
        json!(["ope", "any", "sneak", "by", "skip"]),
        InputMode::Iterable,
        json!({
            "kind": "recover",
            "pattern": any(),
            "skip": {"kind": "skip", "pattern": any()}
        }),
    );
}

#[test]
// req:pattern-language-syntax-010
fn prefix_ope_until() {
    clean(
        PREFIX,
        "Prefix",
        json!(["ope", "any", "sneak", "by", "until", "any"]),
        InputMode::Iterable,
        json!({
            "kind": "recover",
            "pattern": any(),
            "skip": quantifier(
                json!({
                    "kind": "then",
                    "patterns": [
                        {"kind": "not", "pattern": any()},
                        any()
                    ]
                }),
                Some(literal(json!(1))),
                None,
            )
        }),
    );
}

#[test]
// req:pattern-language-syntax-010
fn prefix_ope_requires_sneak_by() {
    fail(
        PREFIX,
        "Prefix",
        json!(["ope", "any", "any"]),
        InputMode::Iterable,
    );
}

#[test]
// req:uffda-language-syntax-016
fn prefix_explains_mistakes_where_they_occur() {
    expect_mistake("rule A = ope a‸;", "`ope` and its pattern must be followed");
    expect_mistake("rule A = ope a sneak by‸;", "`sneak by` must be followed");
    expect_mistake("rule A = a*..‸;", "A repetition bound is");
    expect_mistake("rule A = a |‸;", "Expected a pattern here");
}

#[test]
// req:cli-bootstrap-035
fn projection_is_the_pipe() {
    clean(
        PROJECTION,
        "Projection",
        json!(["any"]),
        InputMode::Iterable,
        any(),
    );
}

#[test]
// req:cli-bootstrap-035 req:pattern-language-syntax-006
fn projection_wraps_an_expression() {
    clean(
        PROJECTION,
        "Projection",
        json!(["any", "-", ">", "1"]),
        InputMode::Iterable,
        json!({
            "kind": "projection",
            "pattern": any(),
            "expression": {"kind": "number", "value": 1}
        }),
    );
}

#[test]
// req:cli-bootstrap-037
fn resolve_names_a_reference() {
    clean(
        RESOLVE,
        "Resolve",
        json!(["foo"]),
        InputMode::Iterable,
        reference("foo"),
    );
}

#[test]
// req:cli-bootstrap-037 req:pattern-language-syntax-003
fn resolve_escaped_identifier() {
    clean(
        RESOLVE,
        "Resolve",
        json!(["@", "any"]),
        InputMode::Iterable,
        reference("any"),
    );
}

#[test]
// req:cli-bootstrap-037 req:pattern-language-syntax-003
fn resolve_arguments() {
    clean(
        RESOLVE,
        "Resolve",
        json!(["foo", "<", "bar", ",", "@", "or", ",", ">"]),
        InputMode::Iterable,
        json!({
            "kind": "resolve",
            "targetKind": "reference",
            "name": "foo",
            "args": [reference("bar"), reference("or")]
        }),
    );
}

#[test]
// req:cli-bootstrap-037
fn resolve_literal_argument() {
    clean(
        RESOLVE,
        "Resolve",
        json!(["foo", "<", "\"", "bar", "\"", ">"]),
        InputMode::Iterable,
        json!({
            "kind": "resolve",
            "targetKind": "reference",
            "name": "foo",
            "args": [equal(json!("bar"))]
        }),
    );
}

#[test]
// req:uffda-language-syntax-016
fn resolve_explains_a_missing_closer() {
    expect_mistake("rule A = B<C‸;", "Expected `>` here to close the rule's");
}

fn object_keys(name: Json, enabled: Json) -> Json {
    json!({
        "kind": "over",
        "keys": {"name": name, "enabled": enabled}
    })
}

#[test]
// req:cli-bootstrap-037
fn structure_object_keys() {
    clean(
        STRUCTURE,
        "Structure",
        json!(["{", "name", ":", "any", ",", "enabled", ":", "end", "}"]),
        InputMode::Iterable,
        object_keys(any(), end_pat()),
    );
}

#[test]
// req:cli-bootstrap-037
fn structure_trailing_comma() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", "name", ":", "any", ",", "enabled", ":", "end", ",", "}"
        ]),
        InputMode::Iterable,
        object_keys(any(), end_pat()),
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_parses_rest_only_object_patterns() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "[", "number", "]", ":", "string", ".", ".", ".", "ope", ",", "}"
        ]),
        InputMode::Iterable,
        json!({
            "kind": "over",
            "keys": {},
            "rest": [
                {"kind": "pattern", "key": ty("number"), "value": ty("string")},
                {"kind": "any"}
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_parses_named_keys_followed_by_rest() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", "id", ":", "number", ".", ".", ".", "[", "string", "]", ":", "string", "}"
        ]),
        InputMode::Iterable,
        json!({
            "kind": "over",
            "keys": {"id": ty("number")},
            "rest": [{
                "kind": "pattern",
                "key": ty("string"),
                "value": ty("string")
            }]
        }),
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_parses_grouped_key_captures() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "[", "name", ":", "string", "]", ":", "[", "any", "]", "}"
        ]),
        InputMode::Iterable,
        json!({
            "kind": "over",
            "keys": {},
            "rest": [{
                "kind": "pattern",
                "key": {
                    "kind": "variable",
                    "name": "name",
                    "pattern": ty("string")
                },
                "value": {"kind": "into", "pattern": any()}
            }]
        }),
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_rejects_named_entries_after_rest() {
    fail(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "[", "string", "]", ":", "string", ",", "name", ":", "any", "}"
        ]),
        InputMode::Iterable,
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_rejects_clauses_after_catch_all() {
    fail(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "ope", ".", ".", ".", "[", "string", "]", ":", "any", "}"
        ]),
        InputMode::Iterable,
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_parses_ordered_rest_clauses() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "[", "string", "]", ":", "number", ".", ".", ".", "[", "number",
            "]", ":", "string", ".", ".", ".", "ope", "}"
        ]),
        InputMode::Iterable,
        json!({
            "kind": "over",
            "keys": {},
            "rest": [
                {"kind": "pattern", "key": ty("string"), "value": ty("number")},
                {"kind": "pattern", "key": ty("number"), "value": ty("string")},
                {"kind": "any"}
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-011
fn structure_parses_entry_key_and_value_captures() {
    clean(
        STRUCTURE,
        "Structure",
        json!([
            "{", ".", ".", ".", "e", ":", "[", "k", ":", "string", "]", ":", "v", ":", "string",
            "}"
        ]),
        InputMode::Iterable,
        json!({
            "kind": "over",
            "keys": {},
            "rest": [{
                "kind": "pattern",
                "entry": "e",
                "key": {
                    "kind": "variable",
                    "name": "k",
                    "pattern": ty("string")
                },
                "value": {
                    "kind": "variable",
                    "name": "v",
                    "pattern": ty("string")
                }
            }]
        }),
    );
}

#[test]
// req:uffda-language-syntax-016
fn structure_explains_mistakes_where_they_occur() {
    expect_mistake("rule A = (a‸;", "Expected `)` here to close the group");
    expect_mistake(
        "rule A = {a: x‸;",
        "Expected `}` here to close the object pattern",
    );
    expect_mistake(
        "rule A = { a ‸};",
        "Each entry of an object pattern is a key",
    );
    expect_mistake(
        "rule A = { a: ‸};",
        "Expected a pattern here, such as a rule",
    );
    expect_mistake(
        "rule A = { ...[string] ‸string };",
        "Expected `:` here between the rest key pattern and value pattern.",
    );
}

#[test]
// req:over-002
fn rest_captures_aggregate_for_projections() {
    let input = json!({"a": "x", "b": "y"});
    let cases = [
        (
            "export rule P = { ...[string]: v:string } -> (id v);",
            json!(["x", "y"]),
        ),
        (
            "export rule P = { ...[k:string]: string } -> (id k);",
            json!(["a", "b"]),
        ),
        (
            "export rule P = { ...[k:string]: v:string } -> (id [k v]);",
            json!([["a", "b"], ["x", "y"]]),
        ),
        (
            "export rule P = { ...e:[string]: string } -> (id e);",
            json!([["a", "x"], ["b", "y"]]),
        ),
        (
            "export rule P = { ...e:[k:string]: v:string } -> (id [e k v]);",
            json!([[["a", "x"], ["b", "y"]], ["a", "b"], ["x", "y"]]),
        ),
    ];
    for (source, expected) in cases {
        let mut runtime = execute_source(source, "P", input.clone(), InputMode::Scalar);
        runtime.read(|execution| {
            assert_eq!(execution.result().unwrap().kind, MatchKind::Ok, "{source}");
        });
        assert_eq!(json_value(&mut runtime), expected, "{source}");
    }
}

fn switch_case(key: Json, pattern: Json) -> Json {
    json!({"key": key, "pattern": pattern})
}

fn values_key(values: Vec<Json>) -> Json {
    json!({"kind": "values", "values": values})
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_a_literal_key_and_default() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r##"switch { "#": any, default: fail }"##),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [switch_case(values_key(vec![literal(json!("#"))]), any())],
            "default": fail_pat()
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_a_character_class_key() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"switch { \cL: any, default: fail }"#),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [switch_case(
                json!({"kind": "characterClass", "characterClass": "L"}),
                any()
            )],
            "default": fail_pat()
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_multiple_literal_keys() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r#"switch { "a", "b": any }"#),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [switch_case(
                values_key(vec![literal(json!("a")), literal(json!("b"))]),
                any()
            )]
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_multiple_cases_without_default() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r##"switch { "#": any, "%": end }"##),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [
                switch_case(values_key(vec![literal(json!("#"))]), any()),
                switch_case(values_key(vec![literal(json!("%"))]), end_pat())
            ]
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_a_default_only_body() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("switch { default: fail }"),
        InputMode::Scalar,
        json!({"kind": "switch", "cases": [], "default": fail_pat()}),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_parses_an_empty_body() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!("switch { }"),
        InputMode::Scalar,
        json!({"kind": "switch", "cases": []}),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_allows_a_trailing_comma() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r##"switch { "#": any, }"##),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [switch_case(values_key(vec![literal(json!("#"))]), any())]
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_allows_a_trailing_comma_after_default() {
    clean(
        PATTERN_LANG,
        "PatternLang",
        json!(r##"switch { "#": any, default: fail, }"##),
        InputMode::Scalar,
        json!({
            "kind": "switch",
            "cases": [switch_case(values_key(vec![literal(json!("#"))]), any())],
            "default": fail_pat()
        }),
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_rejects_default_as_a_rule_reference() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!("default"),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-language-syntax-008
fn switch_rejects_switch_as_a_rule_reference() {
    fail(
        PATTERN_LANG,
        "PatternLang",
        json!("switch"),
        InputMode::Scalar,
    );
}

#[test]
// req:pattern-language-syntax-008 req:switch-002
fn switch_dispatches_and_commits_without_fallthrough() {
    let source = r#"
          export Main;
          rule Main = switch {
            "a": ok,
            "b": fail,
            default: ok
          };
        "#;
    for (sample, kind) in [("a", MatchKind::Ok), ("c", MatchKind::Ok)] {
        let runtime = execute_source(source, "Main", json!(sample), InputMode::Scalar);
        runtime.read(|execution| {
            assert_eq!(execution.result().unwrap().kind, kind, "{sample}");
        });
    }
    let runtime = execute_source(source, "Main", json!("b"), InputMode::Scalar);
    runtime.read(|execution| {
        let result = execution.result().unwrap();
        assert_eq!(result.kind, MatchKind::Fail);
        assert_eq!(result.end, result.start);
    });
}

#[test]
// req:uffda-language-syntax-016
fn switch_explains_mistakes_where_they_occur() {
    expect_mistake(
        "rule A = switch { \"a\" ‸b };",
        "Each switch case is its values",
    );
    expect_mistake(
        "rule A = switch { \"a\": b‸ ;",
        "Expected `}` here to close the switch",
    );
}

#[test]
// req:cli-bootstrap-029
fn then_sequences_patterns() {
    clean(
        THEN,
        "Then",
        json!(["any", "fail"]),
        InputMode::Iterable,
        json!({"kind": "then", "patterns": [any(), fail_pat()]}),
    );
}

#[test]
// req:error-recovery-009
fn then_recovers_a_stray_token() {
    let source = "a ! b";
    let mut runtime = run(
        PATTERN_LANG,
        "PatternLang",
        json!(source),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(execution.result().unwrap().recovered);
    });
    assert_eq!(skipped_text(&runtime, source), vec!["!".to_string()]);
    assert_eq!(json_value(&mut runtime)["kind"], "then");

    let delimited = "(a !) | b";
    let mut runtime = run(
        PATTERN_LANG,
        "PatternLang",
        json!(delimited),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
    });
    assert_eq!(skipped_text(&runtime, delimited), vec!["!".to_string()]);
    assert_eq!(json_value(&mut runtime)["kind"], "or");
}

#[test]
// req:cli-bootstrap-029
fn then_keeps_a_comment_between_items() {
    let note = comment();
    clean(
        THEN,
        "Then",
        json!(["any", note, "fail"]),
        InputMode::Iterable,
        json!({"kind": "then", "patterns": [any(), comment(), fail_pat()]}),
    );
}
