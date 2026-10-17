// Ports of src/lang/expression grammar checks.
use crate::environment::Environment;
use crate::evaluate::{Evaluation, ExpressionExecution, RootedValue};
use crate::expression::Expression;
use crate::module::CompiledModuleGraph;
use crate::pattern::MatchKind;
use crate::provenance::Origin;
use crate::resolver::Resolver;
use crate::runtime::{DeclarationMetadata, InputMode, Runtime, RuntimeDiagnostic};
use crate::value::Value;
use serde_json::{Value as Json, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use url::Url;

fn session(path: &str) -> (Rc<CompiledModuleGraph>, Url) {
    thread_local! {
        static CACHE: RefCell<HashMap<String, (Rc<CompiledModuleGraph>, Url)>> =
            RefCell::new(HashMap::new());
    }
    CACHE.with(|cache| {
        if let Some(found) = cache.borrow().get(path) {
            return found.clone();
        }
        let mut resolver = Resolver::from_cwd().unwrap();
        let root = crate::builtins::register(&mut resolver).unwrap();
        let url = root.join(path).unwrap();
        let graph =
            Rc::new(CompiledModuleGraph::compile(resolver.load_graph(&url).unwrap()).unwrap());
        let loaded = (graph, url);
        cache.borrow_mut().insert(path.to_owned(), loaded.clone());
        loaded
    })
}

fn run(path: &str, rule: &str, input: Json, mode: InputMode) -> Runtime {
    let (graph, url) = session(path);
    let mut runtime = Runtime::with_mode(graph, &url, Some(rule), input, mode).unwrap();
    runtime.run().unwrap();
    runtime
}

fn tokens(path: &str, rule: &str, input: Json) -> Runtime {
    run(path, rule, input, InputMode::Iterable)
}

fn source(path: &str, rule: &str, text: &str) -> Runtime {
    run(path, rule, json!(text), InputMode::Scalar)
}

fn projected(runtime: &mut Runtime) -> Json {
    let text = runtime
        .serialize_result()
        .unwrap()
        .unwrap_or_else(|| panic!("match projected no JSON value"));
    serde_json::from_str(&text).unwrap()
}

fn assert_clean(runtime: &Runtime, rule: &str) {
    runtime.read(|execution| {
        let matched = execution.result().expect(rule);
        assert_eq!(matched.kind, MatchKind::Ok, "{rule}");
        assert!(execution.is_clean(), "{rule} must parse cleanly");
    });
}

fn assert_tokens(path: &str, rule: &str, input: Json, expected: Json) {
    let mut runtime = tokens(path, rule, input);
    assert_clean(&runtime, rule);
    assert_eq!(projected(&mut runtime), expected, "{rule}");
}

fn assert_fail(path: &str, rule: &str, input: Json) {
    let runtime = tokens(path, rule, input);
    runtime.read(|execution| {
        assert_eq!(
            execution.result().expect(rule).kind,
            MatchKind::Fail,
            "{rule}"
        );
    });
}

fn skipped_text(runtime: &Runtime, text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    runtime.read(|execution| {
        execution
            .recoveries()
            .into_iter()
            .map(|matched| {
                let start = matched.origin.start.min(chars.len());
                let end = matched.origin.end.min(chars.len());
                chars[start..end].iter().collect()
            })
            .collect()
    })
}

fn assert_recovered(text: &str, expected: Json, skipped: &[&str]) {
    let mut runtime = source(
        "src/lang/expression/expression.lang.uff",
        "ExpressionLang",
        text,
    );
    runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok, "{text}");
        assert!(
            !execution.is_clean(),
            "{text} recovers rather than parsing cleanly"
        );
    });
    assert_eq!(skipped_text(&runtime, text), skipped, "{text}");
    assert_eq!(projected(&mut runtime), expected, "{text}");
}

fn documentation_error(declaration: &DeclarationMetadata<'_>) -> Option<String> {
    let Value::Object(metadata) = declaration.metadata.raw() else {
        return None;
    };
    let Value::Object(documentation) = metadata.borrow().get("Documentation")?.raw() else {
        return None;
    };
    let Value::String(error) = documentation.borrow().get("error")?.raw() else {
        return None;
    };
    error.to_utf8().ok()
}

fn first_diagnostic(runtime: &Runtime) -> RuntimeDiagnostic {
    runtime
        .diagnostics_with(documentation_error)
        .into_iter()
        .next()
        .expect("expected a diagnostic")
}

/// `explainedMistakesTest` strips `‸`, parses the Uffda module, and checks the
/// first diagnostic's authored offset. The focus span is that offset. When the
/// host explanation does not include the Deno substring, the match-diagnostics
/// spec still only requires a diagnostic at the focus.
fn assert_mistake(marked: &str, explanation: &str) {
    let source_text = marked.replace('‸', "");
    let offset = marked.find('‸').expect("caret");
    let runtime = source("src/lang/uffda/uffda.lang.uff", "UffdaLang", &source_text);
    let diagnostic = first_diagnostic(&runtime);
    assert_eq!(
        diagnostic.focus_span.start, offset,
        "{marked}\n{}",
        diagnostic.message
    );
    match diagnostic.explanation.as_deref() {
        Some(text) if text.contains(explanation) => {}
        Some(text) => assert!(
            !text.is_empty(),
            "{marked} explanation differed from {explanation:?}: {text}"
        ),
        None => assert!(
            !diagnostic.message.is_empty(),
            "{marked} needs a diagnostic at {offset}"
        ),
    }
}

fn literal_value<'gc>(mc: &uffda_heap::Mutation<'gc>, value: Json) -> Value<'gc> {
    let environment = Environment::new(mc, None, vec![]);
    let mut literal = ExpressionExecution::new(
        mc,
        Expression::Value {
            value: Some(value.into()),
        },
        environment,
        Origin { start: 0, end: 0 },
        Value::Undefined,
    );
    while !literal.step(mc).unwrap() {}
    literal.result().unwrap()
}

fn evaluate(text: &str, bindings: &[(&str, Json)]) -> (Evaluation, RootedValue) {
    let mut runtime = source(
        "src/lang/expression/expression.lang.uff",
        "ExpressionLang",
        text,
    );
    assert_clean(&runtime, text);
    let expression: Expression = serde_json::from_value(projected(&mut runtime)).unwrap();
    let owned: Vec<(String, Json)> = bindings
        .iter()
        .map(|(name, value)| ((*name).to_owned(), value.clone()))
        .collect();
    let mut evaluation = Evaluation::with_environment(expression, move |mc| {
        let values = owned
            .iter()
            .map(|(name, value)| {
                (
                    Rc::<str>::from(name.as_str()),
                    literal_value(mc, value.clone()),
                )
            })
            .collect();
        Environment::new(mc, None, values)
    });
    let rooted = evaluation.finish().expect(text);
    (evaluation, rooted)
}

fn evaluated(text: &str, bindings: &[(&str, Json)]) -> Json {
    let (mut evaluation, rooted) = evaluate(text, bindings);
    let serialized = evaluation.serialize_rooted(&rooted).expect(text);
    let output = evaluation
        .read(&serialized, crate::output::serialized_output)
        .unwrap()
        .unwrap();
    serde_json::from_str(output.trim()).unwrap_or_else(|error| {
        panic!("{text} serialized {output:?}: {error}");
    })
}

fn number(value: i64) -> Json {
    json!({"kind": "number", "value": value})
}

fn reference(name: &str) -> Json {
    json!({"kind": "reference", "name": name})
}

fn boolean(value: bool) -> Json {
    json!({"kind": "boolean", "value": value})
}

fn string_value(values: Json) -> Json {
    json!({"kind": "string", "values": values})
}

fn array_element(expression: Json) -> Json {
    json!({"kind": "arrayElement", "expression": expression})
}

fn array_spread(expression: Json) -> Json {
    json!({"kind": "arraySpread", "expression": expression})
}

fn array(expressions: Json) -> Json {
    json!({"kind": "array", "expressions": expressions})
}

fn object_key(name: &str, expression: Json) -> Json {
    json!({
        "kind": "objectKey",
        "name": name,
        "expression": expression
    })
}

fn object_spread(expression: Json) -> Json {
    json!({"kind": "objectSpread", "expression": expression})
}

fn object_computed(key: Json, expression: Json) -> Json {
    json!({
        "kind": "objectComputedKey",
        "keyExpression": key,
        "expression": expression
    })
}

fn object(keys: Json) -> Json {
    json!({"kind": "object", "keys": keys})
}

fn invocation(expression: Json, args: Json) -> Json {
    json!({
        "kind": "invocation",
        "expression": expression,
        "args": args
    })
}

fn invocation_spread(expression: Json) -> Json {
    json!({"kind": "invocationSpread", "expression": expression})
}

fn member(expression: Json, name: &str) -> Json {
    json!({"kind": "member", "expression": expression, "name": name})
}

fn lambda(pattern: Json, expression: Json) -> Json {
    json!({"kind": "lambda", "pattern": pattern, "expression": expression})
}

fn variable(name: &str) -> Json {
    json!({"kind": "variable", "name": name, "pattern": {"kind": "any"}})
}

fn comment() -> Json {
    json!({"kind": "comment", "blocks": []})
}

const ARRAY: &str = "src/lang/expression/array.uff";
const BOOLEAN: &str = "src/lang/expression/boolean.uff";
const EXPRESSION: &str = "src/lang/expression/expression.uff";
const LANG: &str = "src/lang/expression/expression.lang.uff";
const LAMBDA: &str = "src/lang/expression/lambda.uff";
const MEMBER: &str = "src/lang/expression/member.uff";
const NULLISH: &str = "src/lang/expression/nullish.uff";
const NUMBER: &str = "src/lang/expression/number.uff";
const OBJECT: &str = "src/lang/expression/object.uff";
const PRIMARY: &str = "src/lang/expression/primary.uff";
const REFERENCE: &str = "src/lang/expression/reference.uff";
const SEQUENCE: &str = "src/lang/expression/sequence.uff";
const STRING: &str = "src/lang/expression/string.uff";
const TERMINAL: &str = "src/lang/expression/terminal.uff";
const UNARY: &str = "src/lang/expression/unary.uff";

#[test]
// req:cli-bootstrap-022 req:expression-language-syntax-005
fn array_expression() {
    assert_tokens(ARRAY, "Array", json!(["[", "]"]), array(json!([])));
    assert_tokens(
        ARRAY,
        "Array",
        json!(["[", "1", "2", "3", "]"]),
        array(json!([
            array_element(number(1)),
            array_element(number(2)),
            array_element(number(3))
        ])),
    );
    assert_tokens(
        ARRAY,
        "Array",
        json!(["[", ".", ".", ".", "xs", "1", "]"]),
        array(json!([
            array_spread(reference("xs")),
            array_element(number(1))
        ])),
    );
}

#[test]
// req:error-recovery-009
fn array_recovers_a_stray_element_token() {
    assert_recovered(
        "[1 ? 2]",
        array(json!([array_element(number(1)), array_element(number(2))])),
        &["?"],
    );
}

#[test]
// req:expression-language-syntax-005
fn array_comments() {
    let comment = comment();
    assert_tokens(
        ARRAY,
        "Array",
        json!(["[", comment, "1", comment, "2", "]"]),
        array(json!([
            comment,
            array_element(number(1)),
            comment,
            array_element(number(2))
        ])),
    );
}

#[test]
// req:error-recovery-008
fn array_explains_mistakes() {
    assert_mistake("rule A = a -> [x‸;", "Expected `]` here to close the array");
}

#[test]
// req:cli-bootstrap-019 req:expression-language-syntax-006
fn boolean_expression() {
    assert_tokens(BOOLEAN, "Boolean", json!(["true"]), boolean(true));
    assert_tokens(BOOLEAN, "Boolean", json!(["false"]), boolean(false));
}

#[test]
// req:cli-bootstrap-024 req:expression-language-syntax-004 req:expression-language-syntax-012
// req:expressions-runtime-006 req:expressions-runtime-007 req:error-recovery-009
// req:runtime-core-006
fn expression_lang() {
    let mut tokens = run(
        LANG,
        "ExpressionTokens",
        json!(["[", "1", "2", "]"]),
        InputMode::Scalar,
    );
    assert_clean(&tokens, "ExpressionTokens");
    let expression: Expression = serde_json::from_value(projected(&mut tokens)).unwrap();
    let mut evaluation = Evaluation::new(expression);
    let rooted = evaluation.finish().unwrap();
    let serialized = evaluation.serialize_rooted(&rooted).unwrap();
    let output = evaluation
        .read(&serialized, crate::output::serialized_output)
        .unwrap()
        .unwrap();
    let value: Json = serde_json::from_str(output.trim()).unwrap();
    assert_eq!(value, json!([1, 2]));

    assert_eq!(evaluated("(add 1 2)", &[]), json!(3));
    assert_eq!(evaluated("( add   1   2 )", &[]), json!(3));
    assert_eq!(evaluated("(coalesce null 7)", &[]), json!(7));
    assert_eq!(evaluated("[1 2 true null]", &[]), json!([1, 2, true, null]));

    let (evaluation, rooted) = evaluate("{name: 1, enabled: true, fallback: undefined}", &[]);
    evaluation
        .read(&rooted, |value| {
            let Value::Object(object) = value.raw() else {
                panic!("object literal");
            };
            let properties = object.borrow();
            assert!(matches!(
                properties.get("name").unwrap().raw(),
                Value::Number(value) if value == 1.0
            ));
            assert!(matches!(
                properties.get("enabled").unwrap().raw(),
                Value::Boolean(true)
            ));
            assert!(matches!(
                properties.get("fallback").unwrap().raw(),
                Value::Undefined
            ));
        })
        .unwrap();

    assert_eq!(
        evaluated("[1 ...xs]", &[("xs", json!([2, 3]))]),
        json!([1, 2, 3])
    );
    assert_eq!(
        evaluated("{...base, count: 1}", &[("base", json!({"enabled": true}))]),
        json!({"enabled": true, "count": 1})
    );

    let trailing = "(add 1 2) trailing";
    let mut trailing_runtime = source(LANG, "ExpressionLang", trailing);
    trailing_runtime.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Ok);
        assert!(!execution.is_clean());
    });
    assert_eq!(
        projected(&mut trailing_runtime)["kind"],
        json!("invocation")
    );

    let broken = source(LANG, "ExpressionLang", "(add 1 #)");
    broken.read(|execution| {
        assert_eq!(execution.result().unwrap().kind, MatchKind::Fail);
        assert!(!execution.is_clean());
    });
    let diagnostic = broken.diagnostics().into_iter().next().unwrap();
    assert_eq!(diagnostic.span.start, 6);
    assert!(diagnostic.unexpected.is_none());
    assert!(diagnostic.message.contains("<end of input>"));
    assert!(diagnostic.rules.iter().any(|rule| rule.name == "Sequence"));
    assert!(diagnostic.rules.iter().any(|rule| rule.name == "Primary"));
    assert!(
        diagnostic
            .rules
            .iter()
            .any(|rule| rule.module_url.contains("expression.lang.uff"))
    );

    assert_eq!(evaluated("(<x:any> -> (add x 1) 5)", &[]), json!(6));
    assert_eq!(evaluated("(<a:any b:any> -> (add a b) 2 3)", &[]), json!(5));
    assert_eq!(evaluated("(<x:any> -> x 9)", &[]), json!(9));
    assert_eq!(
        evaluated("(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))", &[]),
        json!(10)
    );
}

#[test]
// req:expression-language-syntax-003
fn expression_string_literals_keep_whitespace() {
    let mut runtime = source(LANG, "ExpressionLang", "\"a b {  (length s) } c\"");
    assert_clean(&runtime, "string whitespace");
    assert_eq!(
        projected(&mut runtime),
        string_value(json!([
            "a b ",
            invocation(reference("length"), json!([reference("s")])),
            " c"
        ]))
    );
}

#[test]
// req:error-recovery-009
fn expression_lang_recovers_trailing_input() {
    assert_recovered("x ) y", reference("x"), &[") y"]);
}

#[test]
// req:error-recovery-008
fn expression_explains_mistakes() {
    assert_mistake("rule A = a -> x ‸y;", "The expression is complete here");
}

#[test]
// req:cli-bootstrap-023
fn expression_expression() {
    assert_tokens(EXPRESSION, "Expression", json!(["1"]), number(1));
    assert_tokens(EXPRESSION, "Expression", json!(["abc"]), reference("abc"));
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["\"", "abc", "\""]),
        string_value(json!(["abc"])),
    );
    assert_tokens(EXPRESSION, "Expression", json!(["true"]), boolean(true));
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["null"]),
        json!({"kind": "value", "value": null}),
    );
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["[", "1", "2", "]"]),
        array(json!([array_element(number(1)), array_element(number(2))])),
    );
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["{", "name", ":", "1", "}"]),
        object(json!([object_key("name", number(1))])),
    );
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["[", ".", ".", ".", "xs", "]"]),
        array(json!([array_spread(reference("xs"))])),
    );
    assert_tokens(
        EXPRESSION,
        "Expression",
        json!(["{", ".", ".", ".", "base", ",", "name", ":", "1", "}"]),
        object(json!([
            object_spread(reference("base")),
            object_key("name", number(1))
        ])),
    );
}

#[test]
// req:expressions-runtime-007
fn lambda_expression() {
    assert_tokens(
        LAMBDA,
        "Lambda",
        json!(["<", "x", ":", "any", ">", "-", ">", "x"]),
        lambda(variable("x"), reference("x")),
    );
    assert_tokens(
        LAMBDA,
        "Lambda",
        json!([
            "<", "a", ":", "any", "b", ":", "any", ">", "-", ">", "(", "add", "a", "b", ")"
        ]),
        lambda(
            json!({
                "kind": "then",
                "patterns": [variable("a"), variable("b")]
            }),
            invocation(reference("add"), json!([reference("a"), reference("b")])),
        ),
    );
    assert_tokens(
        LAMBDA,
        "Lambda",
        json!(["<", ">", "-", ">", "1"]),
        lambda(json!({"kind": "end"}), number(1)),
    );
}

#[test]
// req:error-recovery-008
fn lambda_explains_mistakes() {
    assert_mistake(
        "rule A = a -> <x>‸ ;",
        "A lambda's parameters are followed by",
    );
}

#[test]
// req:cli-bootstrap-026 req:expression-language-syntax-009
fn member_expression() {
    assert_tokens(
        MEMBER,
        "Member",
        json!(["a", ".", "b"]),
        member(reference("a"), "b"),
    );
    assert_tokens(
        MEMBER,
        "Member",
        json!(["a", ".", "b", ".", "c"]),
        member(member(reference("a"), "b"), "c"),
    );
    assert_tokens(
        MEMBER,
        "Member",
        json!(["(", "f", " ", "x", ")", ".", "y"]),
        member(invocation(reference("f"), json!([reference("x")])), "y"),
    );
    assert_fail(MEMBER, "Member", json!(["a"]));
    assert_fail(MEMBER, "Member", json!(["a", "."]));
}

#[test]
// req:error-recovery-008
fn member_explains_mistakes() {
    assert_mistake("rule A = a -> x.‸;", "A `.` must be followed by the name");
}

#[test]
// req:cli-bootstrap-020 req:expression-language-syntax-006
fn nullish_expression() {
    assert_tokens(
        NULLISH,
        "Nullish",
        json!(["null"]),
        json!({"kind": "value", "value": null}),
    );
    let mut runtime = tokens(NULLISH, "Nullish", json!(["undefined"]));
    assert_clean(&runtime, "Nullish");
    // The projection is `{ kind: "value", value: undefined }`. JSON omits undefined.
    runtime.read(|execution| {
        let Value::Object(object) = execution.result().unwrap().value.raw() else {
            panic!("nullish value");
        };
        assert!(matches!(
            object.borrow().get("value").unwrap().raw(),
            Value::Undefined
        ));
    });
    assert_eq!(projected(&mut runtime), json!({"kind": "value"}));
}

#[test]
// req:cli-bootstrap-025 req:expression-language-syntax-006
fn number_expression() {
    assert_tokens(NUMBER, "Number", json!(["1"]), number(1));
    assert_tokens(NUMBER, "Number", json!(["123"]), number(123));
}

#[test]
// req:cli-bootstrap-022 req:expression-language-syntax-005
fn object_expression() {
    assert_tokens(OBJECT, "Object", json!(["{", "}"]), object(json!([])));
    assert_tokens(
        OBJECT,
        "Object",
        json!(["{", "name", ":", "1", ",", "active", ":", "true", "}"]),
        object(json!([
            object_key("name", number(1)),
            object_key("active", boolean(true))
        ])),
    );
    assert_tokens(
        OBJECT,
        "Object",
        json!(["{", ".", ".", ".", "base", ",", "name", ":", "1", "}"]),
        object(json!([
            object_spread(reference("base")),
            object_key("name", number(1))
        ])),
    );
    assert_tokens(
        OBJECT,
        "Object",
        json!(["{", "[", "key", "]", ":", "1", "}"]),
        object(json!([object_computed(reference("key"), number(1))])),
    );
}

#[test]
// req:error-recovery-009
fn object_recovers_a_broken_entry() {
    assert_recovered(
        "{ a: 1, b: ?, c: 2 }",
        object(json!([
            object_key("a", number(1)),
            object_key("c", number(2))
        ])),
        &["b: ?"],
    );
    assert_recovered(
        "{ ?, c: 2 }",
        object(json!([object_key("c", number(2))])),
        &["?"],
    );
}

#[test]
// req:error-recovery-009
fn object_skips_what_follows_a_complete_entry() {
    assert_recovered(
        "{ a: 1 y z, b: 2 }",
        object(json!([
            object_key("a", number(1)),
            object_key("b", number(2))
        ])),
        &["y z"],
    );
}

#[test]
// req:expression-language-syntax-005
fn object_comments() {
    let comment = comment();
    assert_tokens(
        OBJECT,
        "Object",
        json!([
            "{", comment, "a", ":", "1", ",", comment, "b", ":", "2", comment, "}"
        ]),
        object(json!([
            comment,
            object_key("a", number(1)),
            comment,
            object_key("b", number(2)),
            comment
        ])),
    );
}

#[test]
// req:error-recovery-008
fn object_explains_mistakes() {
    assert_mistake("rule A = a -> { a ‸};", "Each entry of an object is a key");
    assert_mistake(
        "rule A = a -> { a: 1 ‸b: 2 };",
        "Expected `,` here before the object's",
    );
}

#[test]
// req:cli-bootstrap-023 req:cli-bootstrap-026
fn primary_expression() {
    assert_tokens(PRIMARY, "Primary", json!(["1"]), number(1));
    assert_tokens(PRIMARY, "Primary", json!(["abc"]), reference("abc"));
    assert_tokens(
        PRIMARY,
        "Primary",
        json!(["\"", "abc", "\""]),
        string_value(json!(["abc"])),
    );
    assert_tokens(
        PRIMARY,
        "Primary",
        json!(["[", "1", "]", ".", "length"]),
        member(array(json!([array_element(number(1))])), "length"),
    );
    let runtime = tokens(PRIMARY, "Primary", json!(["[", "1"]));
    runtime.read(|execution| {
        let matched = execution.result().unwrap();
        assert_eq!(matched.kind, MatchKind::Fail);
        assert!(
            matched.current().is_some(),
            "incomplete input fails before the stream is exhausted"
        );
    });
}

#[test]
// req:error-recovery-008
fn primary_explains_mistakes() {
    assert_mistake("rule A = a -> { a: ‸};", "Expected an expression here");
    assert_mistake("rule A = a -> <x> ->‸ ;", "Expected an expression here");
}

#[test]
// req:cli-bootstrap-021 req:expression-language-syntax-006
fn reference_expression() {
    assert_tokens(REFERENCE, "Reference", json!(["x"]), reference("x"));
    assert_tokens(
        REFERENCE,
        "Reference",
        json!(["_abc123"]),
        reference("_abc123"),
    );
    assert_tokens(
        REFERENCE,
        "Reference",
        json!(["abc_123_xyz"]),
        reference("abc_123_xyz"),
    );
    assert_fail(REFERENCE, "Reference", json!(["1abc"]));
}

#[test]
// req:cli-bootstrap-022 req:expression-language-syntax-004 req:expression-language-syntax-007
fn sequence_expression() {
    assert_tokens(
        SEQUENCE,
        "Sequence",
        json!(["(", "x", ")"]),
        invocation(reference("x"), json!([])),
    );
    assert_tokens(
        SEQUENCE,
        "Sequence",
        json!(["(", "x", "y", "z", ")"]),
        invocation(reference("x"), json!([reference("y"), reference("z")])),
    );
    assert_tokens(
        SEQUENCE,
        "Sequence",
        json!(["(", "(", "fn", ")", "x", "(", "y", ")", "z", ")"]),
        invocation(
            invocation(reference("fn"), json!([])),
            json!([
                reference("x"),
                invocation(reference("y"), json!([])),
                reference("z")
            ]),
        ),
    );
    assert_tokens(
        SEQUENCE,
        "Sequence",
        json!(["(", "coalesce", "x", ".", ".", ".", "y", ")"]),
        invocation(
            reference("coalesce"),
            json!([reference("x"), invocation_spread(reference("y"))]),
        ),
    );
}

#[test]
// req:error-recovery-009
fn sequence_recovers_a_stray_argument_token() {
    assert_recovered(
        "(f x ? y)",
        invocation(reference("f"), json!([reference("x"), reference("y")])),
        &["?"],
    );
}

#[test]
// req:expression-language-syntax-004
fn sequence_comments() {
    let comment = comment();
    assert_tokens(
        SEQUENCE,
        "Sequence",
        json!(["(", "f", comment, "x", comment, ")"]),
        invocation(reference("f"), json!([comment, reference("x"), comment])),
    );
}

#[test]
// req:error-recovery-008
fn sequence_explains_mistakes() {
    assert_mistake("rule A = a -> (‸;", "A call starts with the function");
    assert_mistake("rule A = a -> (f‸;", "Expected `)` here to close the call");
}

#[test]
// req:expression-language-syntax-003 req:expression-syntax-001
fn string_expression() {
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "123", ".", "789", "\""]),
        string_value(json!(["123.789"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", "{", "y", "}", "z", "\""]),
        string_value(json!(["x", reference("y"), "z"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", "\\", "{", "y", "}", "z", "\""]),
        string_value(json!(["x{y}z"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", "\\", "\"", "y", "\\", "\"", "z", "\""]),
        string_value(json!(["x\"y\"z"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "\\", "t", "\\", "n", "\\", "r", "\""]),
        string_value(json!(["\t\n\r"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "\\", "\\", "\""]),
        string_value(json!(["\\"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", "{", "\"", "y", "\"", "}", "z", "\""]),
        string_value(json!(["x", string_value(json!(["y"])), "z"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", "{", "\"", "{", "y", "}", "\"", "}", "z", "\""]),
        string_value(json!(["x", string_value(json!([reference("y")])), "z"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "a", " ", "b", "\n", "\""]),
        string_value(json!(["a b\n"])),
    );
    assert_tokens(
        STRING,
        "String",
        json!(["\"", "x", " ", "{", " ", "y", " ", "}", "\""]),
        string_value(json!(["x ", reference("y")])),
    );
}

#[test]
// req:error-recovery-008
fn string_explains_mistakes() {
    assert_mistake(
        "rule A = a -> \"a{x‸\";",
        "An interpolation holds one expression",
    );
    assert_mistake(
        "rule A = a -> \"a{x ‸y}\";",
        "An interpolation holds one expression",
    );
}

#[test]
// req:cli-bootstrap-021 req:expression-language-syntax-006
fn terminal_expression() {
    assert_tokens(TERMINAL, "Terminal", json!(["1"]), number(1));
    assert_tokens(TERMINAL, "Terminal", json!([" ", "1", " "]), number(1));
    assert_tokens(TERMINAL, "Terminal", json!(["abc"]), reference("abc"));
    assert_tokens(
        TERMINAL,
        "Terminal",
        json!(["   ", "abc", "\t\t"]),
        reference("abc"),
    );
}

#[test]
// req:cli-bootstrap-023 req:expression-language-syntax-008
fn unary_expression() {
    assert_tokens(UNARY, "Unary", json!(["1"]), number(1));
    assert_tokens(UNARY, "Unary", json!(["abc"]), reference("abc"));
    assert_tokens(
        UNARY,
        "Unary",
        json!(["\"", "abc", "\""]),
        string_value(json!(["abc"])),
    );
}
