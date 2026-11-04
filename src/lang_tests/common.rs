// Ports of src/lang grammar checks that are not pattern, expression, or uffda rule suites.

use crate::environment::Environment;
use crate::evaluate::Evaluation;
use crate::expression::Expression;
use crate::languages::{Language, Languages, ProjectLanguage};
use crate::module::CompiledModuleGraph;
use crate::pattern::MatchKind;
use crate::provenance::Origin;
use crate::resolver::{Resolver, decode_declaration};
use crate::runtime::{DiagnosticKind, InputMode, Runtime};
use crate::text::RuntimeString;
use crate::value::Value;
use serde_json::{Value as Json, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use url::Url;

struct BuiltinCache {
    root: Url,
    resolver: Resolver,
    graphs: HashMap<String, Rc<CompiledModuleGraph>>,
}

thread_local! {
    static BUILTINS: RefCell<Option<BuiltinCache>> = const { RefCell::new(None) };
}

fn builtin(path: &str) -> (Rc<CompiledModuleGraph>, Url) {
    BUILTINS.with(|slot| {
        let mut slot = slot.borrow_mut();
        let cache = slot.get_or_insert_with(|| {
            let mut resolver = Resolver::from_cwd().expect("artifact root");
            let root = crate::builtins::register(&mut resolver).expect("embedded languages");
            BuiltinCache {
                root,
                resolver,
                graphs: HashMap::new(),
            }
        });
        if cache.graphs.contains_key(path) {
            let url = cache.root.join(path).expect("language path");
            return (Rc::clone(&cache.graphs[path]), url);
        }
        let url = cache.root.join(path).expect("language path");
        let graph = Rc::new(
            CompiledModuleGraph::compile(cache.resolver.load_graph(&url).expect("load graph"))
                .expect("compile graph"),
        );
        cache.graphs.insert(path.to_string(), Rc::clone(&graph));
        (graph, url)
    })
}

fn run(path: &str, rule: &str, input: Json, mode: InputMode) -> Runtime {
    let (graph, url) = builtin(path);
    let mut runtime = Runtime::with_mode(graph, &url, Some(rule), input, mode).expect("runtime");
    runtime.run().expect("run");
    runtime
}

fn code_points(text: &str) -> usize {
    RuntimeString::from(text).code_points().count()
}

fn json_of(runtime: &mut Runtime) -> Json {
    fn project(value: Value<'_>) -> Json {
        match value.raw() {
            Value::Null | Value::Undefined | Value::Symbol(_) => Json::Null,
            Value::Boolean(value) => Json::Bool(value),
            Value::Number(value) => {
                serde_json::from_str(&crate::coercion::number_text(value)).unwrap_or(Json::Null)
            }
            Value::String(value) => value.to_utf8().map(Json::String).unwrap_or(Json::Null),
            Value::Array(values) => {
                Json::Array(values.borrow().iter().copied().map(project).collect())
            }
            Value::Object(object) => {
                let mut projected = serde_json::Map::new();
                for (key, value) in object.borrow().entries() {
                    if key.is_symbol() {
                        continue;
                    }
                    if matches!(value.raw(), Value::Undefined) {
                        continue;
                    }
                    let key = key
                        .as_string()
                        .expect("test JSON projection only omits symbol protocol keys")
                        .to_utf8()
                        .expect("test fixture object keys are scalar strings");
                    projected.insert(key, project(*value));
                }
                Json::Object(projected)
            }
            Value::Date(date) => Json::String(
                date.0
                    .format(&time::format_description::well_known::Rfc3339)
                    .expect("test date formats as RFC 3339"),
            ),
            Value::Error(_) => Json::Object(serde_json::Map::new()),
            _ => panic!(
                "test JSON projection does not support {:?}",
                value.runtime_type()
            ),
        }
    }

    runtime.read(|execution| project(execution.result().expect("result").value))
}

fn assert_clean(path: &str, rule: &str, input: Json, mode: InputMode, value: Json, end: usize) {
    let mut runtime = run(path, rule, input, mode);
    runtime.read(|execution| {
        let result = execution.result().expect("result");
        assert_eq!(result.kind, MatchKind::Ok, "{path} {rule}");
        assert!(!result.recovered, "{path} {rule} recovered");
        assert!(execution.is_clean(), "{path} {rule}");
        assert_eq!(result.end, end, "{path} {rule} end");
    });
    assert_eq!(json_of(&mut runtime), value, "{path} {rule}");
}

fn assert_text(path: &str, rule: &str, source: &str, mode: InputMode, value: Json) {
    let end = match mode {
        InputMode::Iterable => code_points(source),
        InputMode::Scalar | InputMode::Empty => 1,
    };
    assert_clean(path, rule, json!(source), mode, value, end);
}

fn assert_fail(path: &str, rule: &str, input: Json, mode: InputMode) {
    let runtime = run(path, rule, input, mode);
    runtime.read(|execution| {
        assert_eq!(
            execution.result().expect("result").kind,
            MatchKind::Fail,
            "{path} {rule}"
        );
        assert!(!execution.is_clean(), "{path} {rule}");
    });
}

fn origins_of(value: Value<'_>) -> Vec<(usize, usize)> {
    let mut origins = Vec::new();
    let mut index = 0;
    while let Some(Origin { start, end }) = value.char_origin(index) {
        origins.push((start, end));
        index += 1;
    }
    origins
}

fn field<'gc>(value: Value<'gc>, name: &str) -> Value<'gc> {
    match value.raw() {
        Value::Object(object) => object.borrow().get(name).unwrap_or(Value::Undefined),
        _ => Value::Undefined,
    }
}

fn marked(source: &str) -> (String, usize) {
    let offset = source.find('‸').expect("caret");
    (source.replace('‸', ""), offset)
}

fn assert_explained(path: &str, rule: &str, marked_source: &str, explanation: &str) {
    let (source, offset) = marked(marked_source);
    let runtime = run(path, rule, json!(source), InputMode::Scalar);
    let diagnostics = crate::diagnostics::collect(
        &runtime,
        source.as_str(),
        "CLI_STREAM_PARSE_RECOVERED",
        "CLI_STREAM_PARSE_FAILURE",
        "parse",
    )
    .expect("diagnostics");
    let diagnostic = diagnostics
        .iter()
        .find(|diagnostic| diagnostic.message.starts_with(explanation))
        .unwrap_or_else(|| panic!("missing {explanation} in {diagnostics:?}"));
    assert_eq!(diagnostic.location.offset, offset, "{marked_source}");
}

/// `map` and `filter` yield a lazy sequence. Array spread materializes it into
/// the array the semantic-token contract describes.
fn spread_array(name: &str) -> Json {
    json!({
        "kind": "array",
        "expressions": [{
            "kind": "arraySpread",
            "expression": {"kind": "reference", "name": name}
        }]
    })
}

fn metadatas(path: &str, names: &[(&str, bool)]) -> Vec<Json> {
    let (graph, url) = builtin(path);
    let members: Vec<_> = names
        .iter()
        .map(|(name, decorator)| {
            let member = if *decorator {
                graph.resolve_decorator(&url, name)
            } else {
                graph.resolve(&url, name)
            };
            member.unwrap_or_else(|| panic!("{path} missing {name}"))
        })
        .collect();
    let mut runtime = Runtime::metadata(Rc::clone(&graph)).expect("metadata runtime");
    runtime.run().expect("metadata");
    members
        .iter()
        .map(|member| {
            let text = runtime
                .serialize_metadata(member)
                .expect("serialize metadata")
                .expect("metadata");
            serde_json::from_str(&text).expect("metadata json")
        })
        .collect()
}

fn rule_info(root: &Url, path: &str, name: &str) -> Json {
    json!({
        "kind": "rule",
        "name": name,
        "moduleUrl": root.join(path).expect("path").as_str(),
        "parameters": []
    })
}

fn harness(path: &str, declaration: &Json) -> (Rc<CompiledModuleGraph>, Url) {
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    let root = crate::builtins::register(&mut resolver).expect("embedded languages");
    let url = root.join(path).expect("harness path");
    let text = serde_json::to_string(declaration).expect("declaration json");
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(&url, &text).expect("declaration"),
    );
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("load harness"))
            .expect("compile harness"),
    );
    (graph, url)
}

fn run_graph(
    graph: Rc<CompiledModuleGraph>,
    url: &Url,
    rule: &str,
    input: Json,
    mode: InputMode,
) -> Runtime {
    let mut runtime = Runtime::with_mode(graph, url, Some(rule), input, mode).expect("runtime");
    runtime.run().expect("run");
    runtime
}

fn reference(name: &str, args: Json) -> Json {
    json!({"kind":"resolve","targetKind":"reference","name":name,"args":args})
}

fn equal(value: &str) -> Json {
    json!({"kind":"equal","value":{"kind":"value.literal","value":value}})
}

fn compile_module(languages: &mut Languages, source: &str) -> String {
    let syntax = languages
        .parse(source, Language::Uffda)
        .expect("compile source");
    let declaration = languages.compile(syntax).expect("lower module");
    serde_json::to_string(&declaration).expect("declaration json")
}

fn insert_source(resolver: &mut Resolver, url: &Url, source: &str, languages: &mut Languages) {
    let text = compile_module(languages, source);
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(url, &text).expect("compiled declaration"),
    );
}

struct TempTree(std::path::PathBuf);

impl Drop for TempTree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
// req:uffda-language-syntax-014
fn comment_blocks_format_to_hash_lines() {
    let mut languages = Languages::new().expect("languages");
    let words = (0..20)
        .map(|index| format!("word{index}"))
        .collect::<Vec<_>>()
        .join(" ");
    let cases = [
        ("#".to_string(), vec!["#"]),
        (
            format!("# {words}"),
            vec![
                "# word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11",
                "# word12 word13 word14 word15 word16 word17 word18 word19",
            ],
        ),
        (
            "# one\n#\n#\n# two".to_string(),
            vec!["# one", "#", "# two"],
        ),
        (
            format!("# - {words}\n# - short"),
            vec![
                "# - word0 word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11",
                "#   word12 word13 word14 word15 word16 word17 word18 word19",
                "# - short",
            ],
        ),
        (
            "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa `b c d`"
                .to_string(),
            vec![
                "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "# `b c d`",
            ],
        ),
        (
            "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa - b"
                .to_string(),
            vec![
                "# aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -",
                "# b",
            ],
        ),
        (
            "# ```text\n#   kept   as is\n# ```\n#\n# ```uffda\n# rule   A =\n#   ok;\n# ```"
                .to_string(),
            vec![
                "# ```text",
                "#   kept   as is",
                "# ```",
                "#",
                "# ```uffda",
                "# rule A = ok;",
                "# ```",
            ],
        ),
    ];
    for (source, lines) in &cases {
        let formatted = languages
            .format(source, Language::Uffda)
            .unwrap_or_else(|error| panic!("{source}: {error}"));
        let mut expected = lines.join("\n");
        expected.push('\n');
        assert_eq!(formatted, expected, "{source}");
    }
}

fn comment_blocks(source: &str) -> Json {
    let mut runtime = run(
        "src/lang/uffda/uffda.lang.uff",
        "UffdaLang",
        json!(source),
        InputMode::Scalar,
    );
    runtime.read(|execution| {
        assert!(
            execution.is_clean(),
            "{source}: {:?}",
            execution.failure_diagnostic()
        );
    });
    let value = json_of(&mut runtime);
    assert_eq!(
        value["declarations"].as_array().map(Vec::len),
        Some(1),
        "{value}"
    );
    assert_eq!(value["declarations"][0]["kind"], "comment");
    value["declarations"][0]["blocks"].clone()
}

#[test]
// req:comment-syntax-001
fn comment_blocks_parse_paragraphs_lists_and_fences() {
    let text = |text: &str| json!({"kind":"text","text":text});
    let code = |text: &str| json!({"kind":"code","text":text});
    let paragraph = |inlines: Json| json!({"kind":"paragraph","inlines":inlines});

    assert_eq!(
        comment_blocks("#hello\n#  world"),
        json!([paragraph(json!([text("hello world")]))])
    );
    assert_eq!(comment_blocks("#\n#"), json!([]));
    assert_eq!(
        comment_blocks("#   a   b\tc  "),
        json!([paragraph(json!([text("a b c")]))])
    );
    assert_eq!(
        comment_blocks("# one\n#\n#\n# two"),
        json!([
            paragraph(json!([text("one")])),
            paragraph(json!([text("two")]))
        ])
    );
    assert_eq!(
        comment_blocks("# use `a  b` here"),
        json!([paragraph(json!([
            text("use "),
            code("a  b"),
            text(" here")
        ]))])
    );
    assert_eq!(
        comment_blocks("# a `long\n# code` b"),
        json!([paragraph(json!([
            text("a "),
            code("long code"),
            text(" b")
        ]))])
    );
    assert_eq!(
        comment_blocks("# intro\n# - one\n#   more\n#   - two `x`"),
        json!([
            paragraph(json!([text("intro")])),
            {
                "kind": "list",
                "items": [
                    {"inlines": [text("one more")]},
                    {"inlines": [text("two "), code("x")]}
                ]
            }
        ])
    );
    assert_eq!(
        comment_blocks("# -one"),
        json!([paragraph(json!([text("-one")]))])
    );
    assert_eq!(
        comment_blocks("# ```\n#   a  `\n# b\n# ```"),
        json!([{"kind":"fence","language":"","code":"  a  `\nb"}])
    );
    assert_eq!(
        comment_blocks("# text\n#  ```text  \n# a\n#   ```  "),
        json!([
            paragraph(json!([text("text")])),
            {"kind":"fence","language":"text","code":"a"}
        ])
    );

    let blocks = comment_blocks("# ```uffda\n# rule B = b;\n# ```");
    assert_eq!(blocks[0]["kind"], "fence");
    assert_eq!(blocks[0]["language"], "uffda");
    assert_eq!(blocks[0]["code"], "rule B = b;");
    let names: Vec<_> = blocks[0]["tree"]["declarations"]
        .as_array()
        .expect("fence tree")
        .iter()
        .filter_map(|declaration| declaration["name"].as_str())
        .collect();
    assert_eq!(names, ["B"]);
}

#[test]
// req:comment-syntax-001
fn comment_blocks_reject_unclosed_and_unknown_fences() {
    for source in [
        "# open `code",
        "# a `` b",
        "# ```\n# unclosed",
        "# ```foo\n# x\n# ```",
        "# ```uffda\n# rule B = ;\n# ```",
    ] {
        let runtime = run(
            "src/lang/uffda/uffda.lang.uff",
            "UffdaLang",
            json!(source),
            InputMode::Scalar,
        );
        runtime.read(|execution| assert!(!execution.is_clean(), "{source}"));
    }
}

#[test]
// req:cli-language-server-009
fn hash_comment_toggle_comments_and_uncomments_whole_lines() {
    let cases = [
        ("rule A = a;", "# rule A = a;"),
        ("# a\nrule A;", "# # a\n# rule A;"),
        ("  a\n\n    b", "  # a\n\n  #   b"),
        ("\ta\n\t\tb", "\t# a\n\t# \tb"),
        ("  # a\n\n  #b\n#", "  a\n\n  b\n"),
        ("#  a", " a"),
        ("a\r\n  \r\nb", "# a\r\n  \r\n# b"),
        ("# a\r\n# b", "a\r\nb"),
        ("", ""),
        ("  \n", "  \n"),
    ];
    for (source, expected) in cases {
        assert_text(
            "src/lang/comment/toggle.uff",
            "ToggleHashComment",
            source,
            InputMode::Scalar,
            json!(expected),
        );
    }
}

#[test]
// req:cli-bootstrap-010
fn combining_accepts_nonspacing_enclosing_and_spacing_marks() {
    for mark in ["\u{0302}", "\u{20DD}", "\u{0903}"] {
        assert_text(
            "src/lang/common/characters/combining.uff",
            "Combining",
            mark,
            InputMode::Iterable,
            json!(mark),
        );
    }
    assert_fail(
        "src/lang/common/characters/combining.uff",
        "Combining",
        json!("a"),
        InputMode::Iterable,
    );
}

#[test]
// req:cli-bootstrap-006
fn connecting_accepts_connector_punctuation() {
    assert_text(
        "src/lang/common/characters/connecting.uff",
        "Connecting",
        "\u{203F}",
        InputMode::Iterable,
        json!("\u{203F}"),
    );
    assert_fail(
        "src/lang/common/characters/connecting.uff",
        "Connecting",
        json!("a"),
        InputMode::Iterable,
    );
}

#[test]
// req:cli-bootstrap-003
fn digit_accepts_unicode_decimal_digits() {
    for digit in ["1", "\u{0661}"] {
        assert_text(
            "src/lang/common/characters/digit.uff",
            "Digit",
            digit,
            InputMode::Iterable,
            json!(digit),
        );
    }
    assert_fail(
        "src/lang/common/characters/digit.uff",
        "Digit",
        json!("a"),
        InputMode::Iterable,
    );
}

#[test]
// req:cli-bootstrap-008
fn formatting_accepts_format_characters() {
    assert_text(
        "src/lang/common/characters/formatting.uff",
        "Formatting",
        "\u{200B}",
        InputMode::Iterable,
        json!("\u{200B}"),
    );
    assert_fail(
        "src/lang/common/characters/formatting.uff",
        "Formatting",
        json!("a"),
        InputMode::Iterable,
    );
}

#[test]
// req:cli-bootstrap-009
fn letter_accepts_letters_and_letter_numbers() {
    for letter in ["a", "\u{2160}"] {
        assert_text(
            "src/lang/common/characters/letter.uff",
            "Letter",
            letter,
            InputMode::Iterable,
            json!(letter),
        );
    }
    assert_fail(
        "src/lang/common/characters/letter.uff",
        "Letter",
        json!("1"),
        InputMode::Iterable,
    );
}

#[test]
// req:cli-bootstrap-012
fn newline_canonicalizes_cr_lf_and_crlf_without_consuming_the_next_line() {
    for source in ["\n", "\r", "\r\n"] {
        assert_clean(
            "src/lang/common/characters/newLine.uff",
            "NewLine",
            json!(source),
            InputMode::Iterable,
            json!("\n"),
            code_points(source),
        );
    }
    assert_clean(
        "src/lang/common/characters/newLine.uff",
        "NewLine",
        json!("\n\n"),
        InputMode::Iterable,
        json!("\n"),
        1,
    );
}

#[test]
// req:cli-bootstrap-011
fn whitespace_accepts_one_separator_or_tab_and_rejects_line_breaks() {
    for source in [" ", "\t", "\u{2028}", "\u{2029}"] {
        assert_text(
            "src/lang/common/characters/whitespace.uff",
            "Whitespace",
            source,
            InputMode::Iterable,
            json!(source),
        );
    }
    for (source, value) in [("   ", " "), (" \t", " ")] {
        assert_clean(
            "src/lang/common/characters/whitespace.uff",
            "Whitespace",
            json!(source),
            InputMode::Iterable,
            json!(value),
            1,
        );
    }
    for source in ["", "\r", "\n"] {
        assert_fail(
            "src/lang/common/characters/whitespace.uff",
            "Whitespace",
            json!(source),
            InputMode::Iterable,
        );
    }
}

#[test]
// req:uffda-language-syntax-016
fn own_line_comments_match_comment_nodes_and_same_line_comments_are_explained() {
    let comment = json!({"kind":"comment","blocks":[]});
    let path = "src/lang/common/comment.uff";
    assert_clean(
        path,
        "CommentNode",
        json!([comment]),
        InputMode::Iterable,
        comment.clone(),
        1,
    );
    assert_fail(
        path,
        "CommentNode",
        json!([{"kind":"comment","text":"# x"}]),
        InputMode::Iterable,
    );
    assert_fail(path, "CommentNode", json!(["#"]), InputMode::Iterable);
    assert_fail(
        path,
        "CommentNode",
        json!([{"kind":"lineEndComment","comment":comment}]),
        InputMode::Iterable,
    );
    assert_clean(
        path,
        "OwnLineComment",
        json!([{"kind":"comment","blocks":[]}]),
        InputMode::Iterable,
        json!({"kind":"comment","blocks":[]}),
        1,
    );
    assert_fail(
        path,
        "OwnLineComment",
        json!([{"kind":"lineEndComment","comment":{"kind":"comment","blocks":[]}}]),
        InputMode::Iterable,
    );
    // The recovery span is the unexpected comment token. Its start is the `#`
    // (`originalSpan`); its end is the caret, past the comment.
    let marked_source = "rule A =\n  a # note‸\n;";
    let (source, end) = marked(marked_source);
    let start = source.find("# note").expect("comment");
    let runtime = run(
        "src/lang/uffda/uffda.lang.uff",
        "UffdaLang",
        json!(source),
        InputMode::Scalar,
    );
    let diagnostics = crate::diagnostics::collect(
        &runtime,
        source.as_str(),
        "CLI_STREAM_PARSE_RECOVERED",
        "CLI_STREAM_PARSE_FAILURE",
        "parse",
    )
    .expect("diagnostics");
    let diagnostic = &diagnostics[0];
    assert_eq!(diagnostic.kind, DiagnosticKind::Recovery);
    assert_eq!(diagnostic.location.offset, start, "{marked_source}");
    assert_eq!(diagnostic.location.end_offset, Some(end), "{marked_source}");
    assert!(
        diagnostic
            .message
            .starts_with("Comments are part of the syntax"),
        "{}",
        diagnostic.message
    );
}

#[test]
// req:cli-bootstrap-014
fn identifier_joins_letters_marks_connectors_and_format_characters() {
    let path = "src/lang/common/identifier.uff";
    for source in [
        "abc",
        "_Abc",
        "A_b_c_",
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
        "ab\u{0303}c",
        "ab\u{0903}c",
        "ab\u{2040}c",
        "abc\u{2060}xyz",
    ] {
        assert_text(
            path,
            "Identifier",
            source,
            InputMode::Iterable,
            json!(source),
        );
    }
    assert_fail(path, "Identifier", json!("1abc"), InputMode::Iterable);
    assert_clean(
        path,
        "IdToken",
        json!(["abc"]),
        InputMode::Iterable,
        json!("abc"),
        1,
    );
    assert_fail(path, "IdToken", json!([1]), InputMode::Iterable);
}

#[test]
// req:cli-bootstrap-018
fn spread_marker_is_three_dot_tokens() {
    let path = "src/lang/common/spread.uff";
    assert_clean(
        path,
        "SpreadMarker",
        json!([".", ".", "."]),
        InputMode::Iterable,
        json!([".", ".", "."]),
        3,
    );
    assert_fail(path, "SpreadMarker", json!([".", "."]), InputMode::Iterable);
}

#[test]
// req:cli-bootstrap-016
fn surround_keeps_the_payload_when_either_delimiter_is_absent() {
    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./surround.uff","names":["Surround"]}],
        "exports": [{"kind":"rule","name":"SurroundTest","default":true}],
        "rules": [
            {"name":"A","parameters":[],"pattern": equal("(")},
            {"name":"B","parameters":[],"pattern": equal("x")},
            {"name":"C","parameters":[],"pattern": equal(")")},
            {"name":"SurroundTest","parameters":[],"pattern": reference("Surround", json!([
                reference("A", json!([])),
                reference("B", json!([])),
                reference("C", json!([]))
            ]))}
        ],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness("src/lang/common/surround.harness.uff", &declaration);
    for source in ["(x)", "(x", "x)", "x"] {
        let mut runtime = run_graph(
            Rc::clone(&graph),
            &url,
            "SurroundTest",
            json!(source),
            InputMode::Iterable,
        );
        runtime.read(|execution| {
            let result = execution.result().expect("result");
            assert_eq!(result.kind, MatchKind::Ok, "{source}");
            assert!(execution.is_clean(), "{source}");
        });
        assert_eq!(json_of(&mut runtime), json!("x"), "{source}");
    }
    let runtime = run_graph(
        graph,
        &url,
        "SurroundTest",
        json!("()"),
        InputMode::Iterable,
    );
    runtime.read(|execution| {
        assert_eq!(execution.result().expect("result").kind, MatchKind::Fail);
    });
}

#[test]
// req:data-codec-002 req:data-codec-008
fn data_grammar_keeps_safe_tokens_and_rejects_non_data_syntax() {
    let path = "src/lang/data/data.lang.uff";
    let accepted = [
        ("null", json!({"kind":"null"})),
        ("undefined", json!({"kind":"undefined"})),
        ("true", json!({"kind":"boolean","value":true})),
        ("false", json!({"kind":"boolean","value":false})),
        ("-0", json!({"kind":"number","token":"-0"})),
        ("1.25e-3", json!({"kind":"number","token":"1.25e-3"})),
        (
            "12345678901234567890n",
            json!({"kind":"bigint","token":"12345678901234567890n"}),
        ),
        (
            "\"\\ud800\"",
            json!({"kind":"string","token":"\"\\ud800\""}),
        ),
        (
            "\"{not an interpolation}\"",
            json!({"kind":"string","token":"\"{not an interpolation}\""}),
        ),
        ("NaN", json!({"kind":"number","token":"NaN"})),
        ("-Infinity", json!({"kind":"number","token":"-Infinity"})),
        (
            "@date \"2026-10-10T00:00:00Z\"",
            json!({
                "kind":"tag",
                "tag":"date",
                "value":{"kind":"string","token":"\"2026-10-10T00:00:00Z\""}
            }),
        ),
    ];
    for (source, expected) in accepted {
        assert_text(path, "DataLang", source, InputMode::Scalar, expected);
    }
    for source in [
        "[]",
        "{}",
        "[null true 3]",
        "{name:\"Ada\" \"display name\":\"Lovelace\"}",
        "[# comment\n1\n2 # trailing\n]",
        "@bytes\"SGVsbG8\"",
        "@symbol\"registry\"",
        "@set[1 2]",
        "@error{name:\"Error\" message:\"failed\"}",
    ] {
        let runtime = run(path, "DataLang", json!(source), InputMode::Scalar);
        runtime.read(|execution| assert!(execution.is_clean(), "{source}"));
    }
    for source in [
        "",
        "01",
        "1.",
        "1e",
        "1e+",
        "1 2",
        "[1,2]",
        "[1true]",
        "{a:1,b:2}",
        "{a:1b:2}",
        "{\"bad\":}",
        "(add 1 2)",
        "import \"x\";",
        "@meta{version:1}",
        "@map[[\"key\" 42]]",
        "@unknown\"value\"",
        "\"\\q\"",
        "\"\\u12\"",
        "\"line\nbreak\"",
        "[1",
        "{a:1",
    ] {
        assert_fail(path, "DataLang", json!(source), InputMode::Scalar);
    }
}

#[test]
// req:data-codec-002
fn data_required_elements_report_their_position_and_explanation() {
    let cases = [
        ("[1‸", "Expected `]`"),
        ("{a ‸1}", "Expected `:`"),
        ("{a:‸}", "Expected a data value"),
        ("{a:1‸", "Expected `}`"),
        ("\"abc‸", "Expected `\"`"),
        ("\"\\‸q\"", "Expected a JSON string escape"),
        ("\"\\u‸zzzz\"", "Expected four hexadecimal"),
        ("1.‸", "Expected a decimal digit"),
        ("1 ‸2", "Expected the end"),
    ];
    for (marked_source, explanation) in cases {
        assert_explained(
            "src/lang/data/data.lang.uff",
            "DataLang",
            marked_source,
            explanation,
        );
    }
}

#[test]
// req:cli-bootstrap-001 req:cli-bootstrap-003 req:cli-bootstrap-006 req:cli-bootstrap-008 req:cli-bootstrap-009 req:cli-bootstrap-010 req:cli-bootstrap-011 req:cli-bootstrap-012 req:cli-bootstrap-014 req:cli-bootstrap-016 req:cli-bootstrap-017 req:cli-bootstrap-018 req:cli-bootstrap-039 req:cli-bootstrap-040 req:cli-bootstrap-041
fn embedded_language_modules_load_from_declarations_not_a_host_registry() {
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    let root = crate::builtins::register(&mut resolver).expect("embedded languages");
    assert_eq!(resolver.declaration_count(), 0);
    let mut paths = vec![
        "src/lang/common/characters/digit.uff",
        "src/lang/common/characters/mod.uff",
        "src/lang/common/identifier.uff",
        "src/lang/common/surround.uff",
        "src/lang/tokenizer/token.uff",
        "src/lang/common/spread.uff",
        "src/lang/expression/boolean.uff",
        "src/lang/expression/nullish.uff",
        "src/lang/expression/reference.uff",
        "src/lang/expression/terminal.uff",
        "src/lang/expression/not.uff",
        "src/lang/expression/member.uff",
        "src/lang/expression/string.uff",
        "src/lang/uffda/import.rules.uff",
        "src/lang/uffda/export.rules.uff",
        "src/lang/uffda/rule.rules.uff",
        "src/lang/uffda/uffda.lang.uff",
        "src/lang/uffda/runtime.compiler.uff",
        "src/lang/source/mod.uff",
        "src/lang/tokenizer/mod.uff",
        "src/lang/tokenizer/tokenizer.lang.uff",
    ]
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<_>>();
    for name in [
        "then",
        "pipe",
        "and",
        "or",
        "pattern",
        "pattern.lang",
        "projection",
        "prefix",
        "resolve",
        "structure",
        "atomic",
        "literals",
        "character_class",
    ] {
        paths.push(format!("src/lang/pattern/{name}.uff"));
    }
    for path in &paths {
        let declaration = resolver
            .load_declaration(&root.join(path).expect(path))
            .unwrap_or_else(|error| panic!("{path}: {error}"));
        assert!(
            !declaration.rules.is_empty()
                || !declaration.exports.is_empty()
                || !declaration.funcs.is_empty()
                || !declaration.decorators.is_empty(),
            "{path}"
        );
    }
}

#[test]
// req:cli-language-server-002 req:cli-language-server-005 req:rule-decorators-004
fn editor_metadata_is_declared_on_the_grammar_rules() {
    let root = Url::parse("file:///uffda/builtin/").expect("builtin root");
    let cases: &[(&str, &str, &str, Json)] = &[
        (
            "src/lang/uffda/uffda.lang.uff",
            "UffdaLang",
            "Formatter",
            rule_info(&root, "src/lang/uffda/format/mod.uff", "UffdaFormat"),
        ),
        (
            "src/lang/uffda/uffda.lang.uff",
            "UffdaLang",
            "ToggleComment",
            rule_info(&root, "src/lang/comment/toggle.uff", "ToggleHashComment"),
        ),
        (
            "src/lang/uffda/uffda.lang.uff",
            "UffdaLang",
            "Language",
            json!({"id":"uffda","name":"Uffda","extensions":[".uff"]}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "WordToken",
            "Highlight",
            json!({"role":"identifier"}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "CommentToken",
            "Highlight",
            json!({"role":"comment"}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "WhitespaceToken",
            "Highlight",
            json!({"role":"whitespace"}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "NewLineToken",
            "Highlight",
            json!({"role":"newline"}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "PunctuationToken",
            "Highlight",
            json!({"role":"punctuation"}),
        ),
        (
            "src/lang/tokenizer/mod.uff",
            "QuotedStringTokens",
            "Highlight",
            json!({"role":"string"}),
        ),
        (
            "src/lang/uffda/import.rules.uff",
            "ImportDeclarationSyntax",
            "Import",
            json!(true),
        ),
        (
            "src/lang/uffda/import.rules.uff",
            "ImportModulePath",
            "ModulePath",
            json!({"extensions":[".uff"]}),
        ),
        (
            "src/lang/uffda/import.rules.uff",
            "ImportNameEntry",
            "ImportedName",
            json!(true),
        ),
        (
            "src/lang/uffda/rule.rules.uff",
            "RuleDeclarationSyntax",
            "Declaration",
            json!(true),
        ),
        (
            "src/lang/uffda/rule.rules.uff",
            "RuleParameterName",
            "Parameter",
            json!(true),
        ),
        (
            "src/lang/uffda/func.rules.uff",
            "FuncDeclarationSyntax",
            "Declaration",
            json!(true),
        ),
        (
            "src/lang/uffda/decorator.rules.uff",
            "DecoratorDeclarationSyntax",
            "Declaration",
            json!(true),
        ),
        (
            "src/lang/uffda/attribute.rules.uff",
            "AttributeName",
            "NameReference",
            json!({"kinds":["decorator"]}),
        ),
        (
            "src/lang/uffda/export.rules.uff",
            "ExportName",
            "NameReference",
            json!({}),
        ),
        (
            "src/lang/pattern/resolve.uff",
            "ResolveName",
            "NameReference",
            json!({"kinds":["rule"]}),
        ),
        (
            "src/lang/expression/reference.uff",
            "Reference",
            "NameReference",
            json!({"kinds":["func"]}),
        ),
        (
            "src/lang/pattern/character_class.uff",
            "CharacterClass",
            "Highlight",
            json!({"role":"string"}),
        ),
    ];
    let mut grouped: HashMap<&str, Vec<&str>> = HashMap::new();
    for (path, rule, _, _) in cases {
        grouped.entry(*path).or_default().push(*rule);
    }
    let mut loaded: HashMap<(&str, &str), Json> = HashMap::new();
    for (path, mut rules) in grouped {
        rules.sort();
        rules.dedup();
        let names: Vec<(&str, bool)> = rules.iter().map(|rule| (*rule, false)).collect();
        for (rule, metadata) in rules.into_iter().zip(metadatas(path, &names)) {
            loaded.insert((path, rule), metadata);
        }
    }
    for (path, rule, decorator, expected) in cases {
        let metadata = &loaded[&(*path, *rule)];
        assert_eq!(&metadata[*decorator], expected, "{path} {rule} {decorator}");
    }
    let keywords = [
        ("src/lang/uffda/shared.rules.uff", "RuleKeyword"),
        ("src/lang/pattern/switch.uff", "SwitchKeyword"),
        ("src/lang/pattern/switch.uff", "DefaultKeyword"),
        ("src/lang/pattern/prefix.uff", "NotKeyword"),
        ("src/lang/pattern/prefix.uff", "MaybeKeyword"),
        ("src/lang/pattern/prefix.uff", "LookaheadKeyword"),
        ("src/lang/pattern/prefix.uff", "ExceptKeyword"),
        ("src/lang/pattern/literals.uff", "InKeyword"),
        ("src/lang/pattern/literals.uff", "TypeString"),
        ("src/lang/pattern/atoms.uff", "Any"),
        ("src/lang/pattern/atoms.uff", "Fail"),
        ("src/lang/expression/not.uff", "NotKeyword"),
        ("src/lang/expression/boolean.uff", "TrueKeyword"),
        ("src/lang/expression/nullish.uff", "NullKeyword"),
    ];
    let mut keyword_groups: HashMap<&str, Vec<&str>> = HashMap::new();
    for (path, rule) in keywords {
        keyword_groups.entry(path).or_default().push(rule);
    }
    for (path, rules) in keyword_groups {
        let names: Vec<(&str, bool)> = rules.iter().copied().map(|rule| (rule, false)).collect();
        for (rule, metadata) in rules.into_iter().zip(metadatas(path, &names)) {
            assert_eq!(
                metadata["Keyword"],
                json!({"role":"keyword"}),
                "{path} {rule}"
            );
        }
    }
}

#[test]
// req:rule-decorators-004
fn editor_decorators_document_themselves() {
    let parameters = [
        ("Highlight", vec!["c"]),
        ("Keyword", vec![]),
        ("Declaration", vec![]),
        ("Parameter", vec![]),
        ("NameReference", vec!["c"]),
        ("Import", vec![]),
        ("ModulePath", vec!["c"]),
        ("ImportedName", vec![]),
        ("Formatter", vec!["f"]),
        ("ToggleComment", vec!["t"]),
        ("Documentation", vec!["d"]),
    ];
    let names: Vec<(&str, bool)> = parameters.iter().map(|(name, _)| (*name, true)).collect();
    let loaded = metadatas("src/lang/editor/editor.uff", &names);
    for ((name, expected), metadata) in parameters.into_iter().zip(loaded) {
        let documentation = &metadata["Documentation"];
        let description = documentation["description"]
            .as_str()
            .unwrap_or_else(|| panic!("{name} description"));
        assert!(!description.is_empty(), "{name}");
        let mut actual: Vec<_> = documentation["parameters"]
            .as_object()
            .map(|entries| entries.keys().cloned().collect())
            .unwrap_or_default();
        actual.sort();
        let mut expected: Vec<_> = expected.iter().map(|name| (*name).to_string()).collect();
        expected.sort();
        assert_eq!(actual, expected, "{name}");
    }
}

#[test]
// req:cli-fmt-001 req:uffda-language-syntax-014
fn formatter_metadata_formats_a_clean_parse_and_refuses_the_other_cases() {
    let print_source = r#"
export Print;
export Count;
rule Print = [w:string*] -> (join w " ");
rule Count = ok -> 1;
"#;
    let lang_source = |formatter: &str| {
        format!(
            r#"
import "./print.uff" Print Count;
export Words;
decorator Formatter<f:object> = f;
decorator Other<f:any> = f;
{formatter}
rule Words = [w:Item* end] -> w;
rule Item = w:Word Space* -> w;
rule Word = w:("a".."z"+) -> (join w "");
rule Space = " ";
"#
        )
    };
    let lang_url = Url::parse("file:///uffda/format/lang.uff").expect("lang");
    let print_url = Url::parse("file:///uffda/format/print.uff").expect("print");
    let mut compiler = Languages::new().expect("languages");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(&mut resolver, &print_url, print_source, &mut compiler);
    insert_source(
        &mut resolver,
        &lang_url,
        &lang_source("[Formatter Print]"),
        &mut compiler,
    );
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&lang_url).expect("lang graph"))
            .expect("compile"),
    );
    let member = graph.resolve(&lang_url, "Words").expect("Words");
    let mut metadata_runtime = Runtime::metadata(Rc::clone(&graph)).expect("metadata");
    metadata_runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &metadata_runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert_eq!(metadata["Formatter"]["kind"], "rule");
    assert_eq!(metadata["Formatter"]["name"], "Print");
    assert_eq!(metadata["Formatter"]["moduleUrl"], print_url.as_str());

    let mut languages = Languages::with_resolver(resolver).expect("languages");
    let mut language = ProjectLanguage {
        id: "words".into(),
        name: None,
        description: None,
        extensions: vec![".words".into()],
        module: lang_url.clone(),
        entry: "Words".into(),
        formatter: Some((print_url.clone(), "Print".into())),
        toggle_comment: None,
        specifier: Some("./words.uff".into()),
    };
    assert_eq!(
        languages
            .format_language("a   bc  d", &language)
            .expect("format"),
        "a bc d"
    );
    let failed = languages
        .format_language("a 1 b", &language)
        .expect_err("unclean");
    assert_eq!(failed.phase, "match");
    assert!(!failed.diagnostics.is_empty());

    language.formatter = Some((lang_url.clone(), "Count".into()));
    let untext = languages
        .format_language("a b", &language)
        .expect_err("number");
    assert!(untext.message.contains("did not produce text"), "{untext}");

    language.formatter = None;
    let missing = languages
        .format_language("a b", &language)
        .expect_err("no formatter");
    assert!(missing.message.contains("no Formatter"), "{missing}");

    let unresolved = ProjectLanguage {
        id: "words".into(),
        name: None,
        description: None,
        extensions: vec![".words".into()],
        module: Url::parse("file:///uffda/format/missing.uff").expect("missing"),
        entry: "Words".into(),
        formatter: Some((print_url.clone(), "Print".into())),
        toggle_comment: None,
        specifier: Some("./missing.uff".into()),
    };
    assert!(languages.format_language("a", &unresolved).is_err());

    let print = run_graph(graph, &print_url, "Print", json!([1, 2]), InputMode::Scalar);
    print.read(|execution| {
        assert_eq!(execution.result().expect("result").kind, MatchKind::Fail);
    });
}

#[test]
// req:rule-decorators-004 req:cli-language-server-009
fn language_rule_metadata_names_a_rule_or_nothing() {
    let source = |attributes: &str| {
        format!(
            r#"
export Words;
export Helper;
decorator Companion<r:object> = r;
decorator Value<v:any> = v;
{attributes}
rule Words = [string*];
rule Helper = ok -> 1;
"#
        )
    };
    let url = Url::parse("file:///uffda/language-rule/lang.uff").expect("url");
    let mut compiler = Languages::new().expect("languages");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(
        &mut resolver,
        &url,
        &source("[Companion Helper]"),
        &mut compiler,
    );
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let member = graph.resolve(&url, "Words").expect("Words");
    let mut runtime = Runtime::metadata(Rc::clone(&graph)).expect("metadata");
    runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert_eq!(metadata["Companion"]["kind"], "rule");
    assert_eq!(metadata["Companion"]["name"], "Helper");
    assert_eq!(metadata["Companion"]["moduleUrl"], url.as_str());

    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(&mut resolver, &url, &source(""), &mut compiler);
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let member = graph.resolve(&url, "Words").expect("Words");
    let mut runtime = Runtime::metadata(graph).expect("metadata");
    runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert!(metadata.get("Companion").is_none());

    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(&mut resolver, &url, &source("[Value \"x\"]"), &mut compiler);
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let member = graph.resolve(&url, "Words").expect("Words");
    let mut runtime = Runtime::metadata(graph).expect("metadata");
    runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert_eq!(metadata["Value"], "x");

    let missing = Url::parse("file:///uffda/language-rule/missing.uff").expect("missing");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    assert!(resolver.load_graph(&missing).is_err());
}

#[test]
// req:cli-language-server-009
fn toggle_comment_metadata_runs_the_named_rule_or_reports_why_not() {
    let source = |toggle: &str| {
        format!(
            r#"
export Words;
export Wrap;
export Count;
export Never;
decorator ToggleComment<t:object> = t;
{toggle}
rule Words = [string*];
rule Wrap = s:string -> (join ["<" s ">"] "");
rule Count = ok -> 1;
rule Never = fail;
"#
        )
    };
    let url = Url::parse("file:///uffda/toggle/lang.uff").expect("url");
    let mut compiler = Languages::new().expect("languages");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(
        &mut resolver,
        &url,
        &source("[ToggleComment Wrap]"),
        &mut compiler,
    );
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let member = graph.resolve(&url, "Words").expect("Words");
    let mut runtime = Runtime::metadata(Rc::clone(&graph)).expect("metadata");
    runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert_eq!(metadata["ToggleComment"]["name"], "Wrap");
    let mut toggled = run_graph(
        Rc::clone(&graph),
        &url,
        "Wrap",
        json!("a\nb"),
        InputMode::Scalar,
    );
    toggled.read(|execution| assert!(execution.is_clean()));
    assert_eq!(json_of(&mut toggled), json!("<a\nb>"));

    let never = run_graph(
        Rc::clone(&graph),
        &url,
        "Never",
        json!("a"),
        InputMode::Scalar,
    );
    never.read(|execution| {
        assert_eq!(execution.result().expect("result").kind, MatchKind::Fail);
    });
    let mut count = run_graph(graph, &url, "Count", json!("a"), InputMode::Scalar);
    count.read(|execution| assert!(execution.is_clean()));
    assert_eq!(json_of(&mut count), json!(1));

    let mut resolver = Resolver::from_cwd().expect("artifact root");
    insert_source(&mut resolver, &url, &source(""), &mut compiler);
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let member = graph.resolve(&url, "Words").expect("Words");
    let mut runtime = Runtime::metadata(graph).expect("metadata");
    runtime.run().expect("metadata");
    let metadata: Json = serde_json::from_str(
        &runtime
            .serialize_metadata(&member)
            .expect("serialize")
            .expect("metadata"),
    )
    .expect("json");
    assert!(metadata.get("ToggleComment").is_none());

    let missing = Url::parse("file:///uffda/toggle/missing.uff").expect("missing");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    assert!(resolver.load_graph(&missing).is_err());

    let uffda = metadatas("src/lang/uffda/uffda.lang.uff", &[("UffdaLang", false)]);
    assert_eq!(uffda[0]["ToggleComment"]["name"], "ToggleHashComment");
    assert_text(
        "src/lang/comment/toggle.uff",
        "ToggleHashComment",
        "rule A = a;",
        InputMode::Scalar,
        json!("# rule A = a;"),
    );
}

#[test]
// req:cli-distribution-007 req:error-recovery-009
fn pattern_grammar_parses_any_and_recovers_a_trailing_token() {
    let mut runtime = run(
        "src/lang/pattern/pattern.lang.uff",
        "PatternLang",
        json!("any"),
        InputMode::Scalar,
    );
    runtime.read(|execution| assert!(execution.is_clean()));
    assert_eq!(json_of(&mut runtime)["kind"], "any");

    let mut recovered = run(
        "src/lang/pattern/pattern.lang.uff",
        "PatternLang",
        json!("any )"),
        InputMode::Scalar,
    );
    recovered.read(|execution| {
        let result = execution.result().expect("result");
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
        assert!(!execution.is_clean());
    });
    assert_eq!(json_of(&mut recovered)["kind"], "any");
    let diagnostics = crate::diagnostics::collect(
        &recovered,
        "any )",
        "CLI_STREAM_PARSE_RECOVERED",
        "CLI_STREAM_PARSE_FAILURE",
        "parse",
    )
    .expect("diagnostics");
    assert!(
        diagnostics
            .iter()
            .any(|diagnostic| diagnostic.kind == DiagnosticKind::Recovery)
    );
}

#[test]
// req:cli-distribution-007
fn expression_user_reference_keeps_standard_globals_and_evaluates_the_caller_binding() {
    let mut languages = Languages::new().expect("languages");
    let syntax = languages
        .parse("user", Language::Expression)
        .expect("identifier projection uses standard globals");
    let expression: Expression =
        serde_json::from_str(&serde_json::to_string(&syntax).unwrap()).expect("lowered expression");
    let mut evaluation = Evaluation::with_environment(expression, |mc| {
        Environment::new(
            mc,
            None,
            vec![(Rc::<str>::from("user"), Value::string(mc, "ok"))],
        )
    });
    let rooted = evaluation.finish().expect("evaluate");
    let text = evaluation
        .read(&rooted, |value| {
            crate::coercion::string_text(value)
                .expect("string")
                .to_utf8()
                .expect("utf8")
        })
        .expect("read");
    assert_eq!(text, "ok");
}

#[test]
// req:error-recovery-009
fn recovery_phase_skips_one_unexpected_item_and_keeps_the_rest() {
    let declaration = json!({
        "imports": [],
        "exports": [{"kind":"rule","name":"Main","default":true}],
        "rules": [{
            "name": "Main",
            "parameters": [],
            "pattern": {
                "kind": "into",
                "pattern": {
                    "kind": "then",
                    "patterns": [
                        {
                            "kind": "quantifier",
                            "pattern": {
                                "kind": "recover",
                                "pattern": equal("a"),
                                "skip": {"kind":"any"}
                            },
                            "min": null,
                            "max": null
                        },
                        {"kind":"end"}
                    ]
                }
            }
        }],
        "funcs": [],
        "decorators": []
    });
    let url = Url::parse("file:///grammar.recovery.uff").expect("url");
    let mut resolver = Resolver::from_cwd().expect("artifact root");
    let text = serde_json::to_string(&declaration).unwrap();
    resolver.insert_declaration(
        url.clone(),
        decode_declaration(&url, &text).expect("declaration"),
    );
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("graph")).expect("compile"),
    );
    let clean = run_graph(
        Rc::clone(&graph),
        &url,
        "Main",
        json!("aa"),
        InputMode::Scalar,
    );
    clean.read(|execution| {
        let result = execution.result().expect("result");
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(!result.recovered);
    });
    let mut recovered = run_graph(graph, &url, "Main", json!("axa"), InputMode::Scalar);
    recovered.read(|execution| {
        let result = execution.result().expect("result");
        assert_eq!(result.kind, MatchKind::Ok);
        assert!(result.recovered);
    });
    assert_eq!(json_of(&mut recovered), json!([["a", "x", "a"], null]));
}

#[test]
// req:cli-distribution-007 req:cli-compile-008
fn an_external_grammar_artifact_parses_with_its_entry_rule() {
    let root = std::env::temp_dir().join(format!(
        "uffda-foreign-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    let _cleanup = TempTree(root.clone());
    std::fs::create_dir_all(root.join("bin/ast/src")).expect("artifact dir");
    let mut languages = Languages::new().expect("languages");
    let declaration = languages
        .compile_source_native("export rule Main = \"a\" -> { kind: \"foreign\" };")
        .expect("compile native declaration")
        .encode(false, crate::codec::data::DataLimits::default())
        .expect("encode native declaration");
    std::fs::write(root.join("bin/ast/src/foreign.uff.ast"), declaration).expect("write artifact");
    let mut resolver = Resolver::new(root.clone(), root.join("bin")).expect("resolver");
    let url = Url::from_file_path(root.join("src/foreign.uff")).expect("file url");
    let graph = Rc::new(
        CompiledModuleGraph::compile(resolver.load_graph(&url).expect("load artifact"))
            .expect("compile"),
    );
    let mut runtime = run_graph(graph, &url, "Main", json!("a"), InputMode::Scalar);
    runtime.read(|execution| assert!(execution.is_clean()));
    assert_eq!(json_of(&mut runtime), json!({"kind":"foreign"}));
}

#[test]
// req:cli-distribution-007
fn uffda_module_exports_its_language_entry_and_language_decorator() {
    let (graph, url) = builtin("src/lang/uffda/uffda.lang.uff");
    let module = graph.graph.modules.get(&url).expect("uffda module");
    assert!(module.exports.contains_key("UffdaLang"));
    assert!(module.exports.contains_key("Language"));
}

#[test]
// req:source-normalization-runtime-001 req:source-normalization-runtime-002 req:cli-bootstrap-040
fn source_normalization_canonicalizes_newlines_and_indexes_units() {
    let mut first = run(
        "src/lang/source/mod.uff",
        "Source",
        json!("a\r\nb\rc\n"),
        InputMode::Scalar,
    );
    let origins = first.read(|execution| {
        let value = execution.result().expect("result").value;
        origins_of(field(value, "text"))
    });
    assert_eq!(
        origins,
        vec![(0, 1), (1, 3), (3, 4), (4, 5), (5, 6), (6, 7)]
    );
    let document = json_of(&mut first);
    assert_eq!(document["text"], "a\nb\nc\n");

    let mut repeated = run(
        "src/lang/source/mod.uff",
        "Source",
        json!("ab\r\nc"),
        InputMode::Scalar,
    );
    let again = run(
        "src/lang/source/mod.uff",
        "Source",
        json!("ab\r\nc"),
        InputMode::Scalar,
    );
    let one = json_of(&mut repeated);
    let two = {
        let mut again = again;
        json_of(&mut again)
    };
    assert_eq!(one["text"], "ab\nc");
    assert_eq!(one["documentId"], two["documentId"]);
    assert!(
        one["documentId"]
            .as_str()
            .expect("document id")
            .starts_with("source:4:")
    );
    assert_eq!(one["lineStarts"], json!([0, 3]));
    assert_eq!(one["units"].as_array().map(Vec::len), Some(4));
    assert_eq!(one["units"][0]["value"], "a");
    assert_eq!(one["units"][0]["offsetStart"], 0);
    assert_eq!(one["units"][0]["offsetEnd"], 1);
    assert_eq!(one["units"][0]["lineStart"], 1);
    assert_eq!(one["units"][0]["columnStart"], 1);
    assert_eq!(one["units"][2]["value"], "\n");
    assert_eq!(one["units"][2]["lineStart"], 1);
    assert_eq!(one["units"][2]["columnStart"], 3);
    let mut covered = 0;
    for unit in one["units"].as_array().expect("units") {
        assert_eq!(unit["offsetStart"], covered);
        covered = unit["offsetEnd"].as_u64().expect("offset");
    }
    assert_eq!(covered, 4);

    let trailing = json_of(&mut run(
        "src/lang/source/mod.uff",
        "Source",
        json!("a\n"),
        InputMode::Scalar,
    ));
    assert_eq!(trailing["lineStarts"], json!([0, 2]));

    let raw = json_of(&mut run(
        "src/lang/source/mod.uff",
        "Source",
        json!("a\r\nb"),
        InputMode::Scalar,
    ));
    assert_eq!(raw["text"], "a\nb");
    let values: Vec<_> = raw["units"]
        .as_array()
        .expect("units")
        .iter()
        .map(|unit| unit["value"].as_str().expect("unit").to_string())
        .collect();
    assert_eq!(values, ["a", "\n", "b"]);
}

#[test]
// req:cli-bootstrap-017
fn token_wraps_a_payload_in_optional_whitespace_tokens() {
    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./token.uff","names":["Token"]}],
        "exports": [{"kind":"rule","name":"TokenTest","default":true}],
        "rules": [
            {"name":"T","parameters":[],"pattern": equal("x")},
            {"name":"TokenTest","parameters":[],"pattern": reference("Token", json!([
                reference("T", json!([]))
            ]))}
        ],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness("src/lang/tokenizer/token.harness.uff", &declaration);
    for input in [
        json!("x"),
        json!(["   ", "x"]),
        json!(["x", "   "]),
        json!(["   ", "x", "   "]),
    ] {
        let mut runtime = run_graph(
            Rc::clone(&graph),
            &url,
            "TokenTest",
            input,
            InputMode::Iterable,
        );
        runtime.read(|execution| assert!(execution.is_clean()));
        assert_eq!(json_of(&mut runtime), json!("x"));
    }
}

fn tok(kind: &str, text: &str) -> Json {
    json!({"kind":kind,"text":text})
}

#[test]
// req:cli-bootstrap-039 req:tokenizer-runtime-006 req:tokenizer-runtime-008 req:tokenizer-runtime-009 req:tokenizer-runtime-011
fn tokenizer_emits_structured_tokens_and_semantic_views() {
    let path = "src/lang/tokenizer/mod.uff";
    assert_text(path, "Tokenizer", "", InputMode::Iterable, json!([]));
    assert_text(
        path,
        "Tokenizer",
        " ",
        InputMode::Iterable,
        json!([tok("whitespace", " ")]),
    );
    assert_text(
        path,
        "Tokenizer",
        " \n ",
        InputMode::Iterable,
        json!([
            tok("whitespace", " "),
            tok("newline", "\n"),
            tok("whitespace", " ")
        ]),
    );
    assert_text(
        path,
        "Tokenizer",
        "abc\nxyz",
        InputMode::Iterable,
        json!([tok("word", "abc"), tok("newline", "\n"), tok("word", "xyz")]),
    );
    assert_text(
        path,
        "Tokenizer",
        "abc123-123abc",
        InputMode::Iterable,
        json!([
            tok("word", "abc123"),
            tok("punctuation", "-"),
            tok("word", "123abc")
        ]),
    );
    let punctuation = "!@$%^&*()_+-=[]\\{}|;':\",./<>?";
    let expected: Vec<_> = punctuation
        .chars()
        .map(|character| {
            let text = character.to_string();
            if character == '_' {
                tok("word", &text)
            } else {
                tok("punctuation", &text)
            }
        })
        .collect();
    assert_text(
        path,
        "Tokenizer",
        punctuation,
        InputMode::Iterable,
        json!(expected),
    );
    assert_text(
        path,
        "Tokenizer",
        "\"#\" # comment\n*",
        InputMode::Iterable,
        json!([
            tok("punctuation", "\""),
            tok("punctuation", "#"),
            tok("punctuation", "\""),
            tok("whitespace", " "),
            tok("comment", "# comment"),
            tok("newline", "\n"),
            tok("punctuation", "*")
        ]),
    );
    assert_text(
        path,
        "Tokenizer",
        "abc   123\t\t\txyz\n\n\n456",
        InputMode::Iterable,
        json!([
            tok("word", "abc"),
            tok("whitespace", "   "),
            tok("word", "123"),
            tok("whitespace", "\t\t\t"),
            tok("word", "xyz"),
            tok("newline", "\n"),
            tok("newline", "\n"),
            tok("newline", "\n"),
            tok("word", "456")
        ]),
    );
    assert_text(
        path,
        "Tokenizer",
        "1.2.3",
        InputMode::Iterable,
        json!([
            tok("word", "1"),
            tok("punctuation", "."),
            tok("word", "2"),
            tok("punctuation", "."),
            tok("word", "3")
        ]),
    );
    assert_text(
        path,
        "Tokenizer",
        "x\\{y}z",
        InputMode::Iterable,
        json!([
            tok("word", "x"),
            tok("punctuation", "\\"),
            tok("punctuation", "{"),
            tok("word", "y"),
            tok("punctuation", "}"),
            tok("word", "z")
        ]),
    );
    assert_text(
        path,
        "Tokenizer",
        "x{y}z",
        InputMode::Iterable,
        json!([
            tok("word", "x"),
            tok("punctuation", "{"),
            tok("word", "y"),
            tok("punctuation", "}"),
            tok("word", "z")
        ]),
    );

    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./mod.uff","names":["TokenizerNoWhitespace","StringContentTokenizer"]}],
        "exports": [
            {"kind":"rule","name":"Main","default":true},
            {"kind":"rule","name":"Content"}
        ],
        "rules": [{
            "name": "Main",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "t",
                "pattern": reference("TokenizerNoWhitespace", json!([]))
            },
            "expression": spread_array("t")
        }, {
            "name": "Content",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "t",
                "pattern": reference("StringContentTokenizer", json!([]))
            },
            "expression": spread_array("t")
        }],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness("src/lang/tokenizer/no-whitespace.harness.uff", &declaration);
    let mut words = run_graph(
        Rc::clone(&graph),
        &url,
        "Main",
        json!(" any or fail\n"),
        InputMode::Iterable,
    );
    words.read(|execution| assert!(execution.is_clean()));
    assert_eq!(json_of(&mut words), json!(["any", "or", "fail"]));
    let mut quoted = run_graph(
        Rc::clone(&graph),
        &url,
        "Main",
        json!("#123 punctuation !@*\nany # trailing\n\"# quoted \\\" hash\"\nend"),
        InputMode::Iterable,
    );
    quoted.read(|execution| assert!(execution.is_clean()));
    assert_eq!(
        json_of(&mut quoted),
        json!([
            "any", "\"", "#", " ", "quoted", " ", "\\", "\"", " ", "hash", "\"", "end"
        ])
    );
    let mut escapes = run_graph(
        Rc::clone(&graph),
        &url,
        "Main",
        json!("\"\\t\\n\\r\\\\\\\"\\tab\""),
        InputMode::Iterable,
    );
    escapes.read(|execution| assert!(execution.is_clean()));
    assert_eq!(
        json_of(&mut escapes),
        json!([
            "\"", "\\", "t", "\\", "n", "\\", "r", "\\", "\\", "\\", "\"", "\\", "t", "ab", "\""
        ])
    );
    assert_text(
        path,
        "TokenizerNoWhitespaceWithComments",
        "#123 punctuation !@*\nany # trailing\n\"# quoted\"\nend",
        InputMode::Iterable,
        json!([
            tok("comment", "#123 punctuation !@*"),
            "any",
            {"kind":"lineEnd"},
            tok("comment", "# trailing"),
            "\"",
            "#",
            " ",
            "quoted",
            "\"",
            "end"
        ]),
    );
    let mut content = run_graph(
        Rc::clone(&graph),
        &url,
        "Content",
        json!("./my-lang v2.uff"),
        InputMode::Iterable,
    );
    content.read(|execution| assert!(execution.is_clean()));
    assert_eq!(
        json_of(&mut content),
        json!([".", "/", "my", "-", "lang", " ", "v2", ".", "uff"])
    );
    let quote = run_graph(graph, &url, "Content", json!("a\"b"), InputMode::Iterable);
    quote.read(|execution| {
        assert_eq!(execution.result().expect("result").kind, MatchKind::Fail);
    });
}

#[test]
// req:tokenizer-runtime-002 req:cli-bootstrap-041 req:cli-distribution-007
fn tokenizer_language_normalizes_newlines_before_semantic_tokens() {
    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./tokenizer.lang.uff","names":["TokenizerLang"]}],
        "exports": [{"kind":"rule","name":"Main"}],
        "rules": [{
            "name": "Main",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "v",
                "pattern": reference("TokenizerLang", json!([]))
            },
            "expression": {
                "kind": "object",
                "keys": [
                    {
                        "kind": "objectKey",
                        "name": "source",
                        "expression": {
                            "kind": "member",
                            "name": "source",
                            "expression": {"kind": "reference", "name": "v"}
                        }
                    },
                    {
                        "kind": "objectKey",
                        "name": "tokens",
                        "expression": {
                            "kind": "array",
                            "expressions": [{
                                "kind": "arraySpread",
                                "expression": {
                                    "kind": "member",
                                    "name": "tokens",
                                    "expression": {"kind": "reference", "name": "v"}
                                }
                            }]
                        }
                    }
                ]
            }
        }],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness(
        "src/lang/tokenizer/tokenizer.lang.harness.uff",
        &declaration,
    );
    let mut runtime = run_graph(
        Rc::clone(&graph),
        &url,
        "Main",
        json!("a\r\nb\rc"),
        InputMode::Scalar,
    );
    let origins = runtime.read(|execution| {
        let value = execution.result().expect("result").value;
        origins_of(field(field(value, "source"), "text"))
    });
    assert_eq!(origins, vec![(0, 1), (1, 3), (3, 4), (4, 5), (5, 6)]);
    let value = json_of(&mut runtime);
    assert_eq!(value["source"]["text"], "a\nb\nc");
    assert_eq!(value["tokens"], json!(["a", "\n", "b", "\n", "c"]));

    let mut shorter = run_graph(graph, &url, "Main", json!("a\r\nb"), InputMode::Scalar);
    shorter.read(|execution| assert!(execution.is_clean()));
    let value = json_of(&mut shorter);
    assert_eq!(value["source"]["text"], "a\nb");
    assert_eq!(value["tokens"], json!(["a", "\n", "b"]));
}

fn tokenizer_lang_tokens(source: &str) -> Json {
    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./tokenizer.lang.uff","names":["TokenizerLang"]}],
        "exports": [{"kind":"rule","name":"Main"}],
        "rules": [{
            "name": "Main",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "v",
                "pattern": reference("TokenizerLang", json!([]))
            },
            "expression": {
                "kind": "object",
                "keys": [
                    {
                        "kind": "objectKey",
                        "name": "source",
                        "expression": {
                            "kind": "member",
                            "name": "source",
                            "expression": {"kind": "reference", "name": "v"}
                        }
                    },
                    {
                        "kind": "objectKey",
                        "name": "tokens",
                        "expression": {
                            "kind": "array",
                            "expressions": [{
                                "kind": "arraySpread",
                                "expression": {
                                    "kind": "member",
                                    "name": "tokens",
                                    "expression": {"kind": "reference", "name": "v"}
                                }
                            }]
                        }
                    }
                ]
            }
        }],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness(
        "src/lang/tokenizer/tokenizer.lang.harness.uff",
        &declaration,
    );
    let mut runtime = run_graph(graph, &url, "Main", json!(source), InputMode::Scalar);
    runtime.read(|execution| assert!(execution.is_clean()));
    json_of(&mut runtime)
}

#[test]
// req:tokenizer-runtime-001
fn tokenizer_consumes_canonical_lf_source_documents() {
    let value = tokenizer_lang_tokens("abc\r\nxyz\r123");
    assert_eq!(value["source"]["text"], "abc\nxyz\n123");
    assert_eq!(value["tokens"], json!(["abc", "\n", "xyz", "\n", "123"]));
}

#[test]
// req:tokenizer-runtime-003 req:language-modules-negative-002
fn tokenizer_rejects_non_tokenizable_number_items() {
    let (graph, url) = builtin("src/lang/tokenizer/mod.uff");
    let mut runtime = Runtime::with_mode(
        graph,
        &url,
        Some("Tokenizer"),
        json!([1]),
        InputMode::Iterable,
    )
    .expect("runtime");
    match runtime.run() {
        Ok(()) => {
            runtime.read(|execution| {
                let result = execution.result().expect("result");
                assert_ne!(
                    result.kind,
                    MatchKind::Ok,
                    "non-string item must not tokenize"
                );
                if let Some(error) = execution.error() {
                    let message = error.to_string();
                    assert!(
                        message.contains("string") || message.contains("number"),
                        "{message}"
                    );
                }
            });
        }
        Err(error) => {
            let message = error.to_string();
            assert!(
                message.contains("string")
                    || message.contains("number")
                    || message.contains("type"),
                "{message}"
            );
        }
    }
}

#[test]
// req:tokenizer-runtime-004
fn tokenizer_keeps_string_interpolation_boundaries_tokenizable() {
    let value = tokenizer_lang_tokens("\"hello ${user.name}\"");
    assert_eq!(
        value["tokens"],
        json!(["\"", "hello", " ", "$", "{", "user", ".", "name", "}", "\""])
    );
}

#[test]
// req:tokenizer-runtime-005
fn tokenizer_keeps_object_interpolation_delimiters_tokenizable() {
    let value = tokenizer_lang_tokens("\"${{name:user.name}}\"");
    assert_eq!(
        value["tokens"],
        json!([
            "\"", "$", "{", "{", "name", ":", "user", ".", "name", "}", "}", "\""
        ])
    );
}

#[test]
// req:tokenizer-runtime-010
fn tokenizer_semantic_token_texts_omit_comments() {
    let source = "a #x\n+";
    let value = tokenizer_lang_tokens(source);
    assert_eq!(value["tokens"], json!(["a", " ", "\n", "+"]));

    let declaration = json!({
        "imports": [{"kind":"module","moduleUrl":"./mod.uff","names":[
            "TokenizerNoWhitespace",
            "TokenizerNoWhitespaceWithComments"
        ]}],
        "exports": [
            {"kind":"rule","name":"NoWs","default":true},
            {"kind":"rule","name":"WithComments"}
        ],
        "rules": [{
            "name": "NoWs",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "t",
                "pattern": reference("TokenizerNoWhitespace", json!([]))
            },
            "expression": spread_array("t")
        }, {
            "name": "WithComments",
            "parameters": [],
            "pattern": {
                "kind": "variable",
                "name": "t",
                "pattern": reference("TokenizerNoWhitespaceWithComments", json!([]))
            },
            "expression": spread_array("t")
        }],
        "funcs": [],
        "decorators": []
    });
    let (graph, url) = harness("src/lang/tokenizer/no-whitespace.harness.uff", &declaration);
    let mut no_ws = run_graph(
        Rc::clone(&graph),
        &url,
        "NoWs",
        json!(source),
        InputMode::Iterable,
    );
    assert_eq!(json_of(&mut no_ws), json!(["a", "+"]));
    let mut with_comments = run_graph(
        Rc::clone(&graph),
        &url,
        "WithComments",
        json!(source),
        InputMode::Iterable,
    );
    assert_eq!(
        json_of(&mut with_comments),
        json!(["a", {"kind":"lineEnd"}, {"kind":"comment","text":"#x"}, "+"])
    );
    let mut unmarked = run_graph(
        graph,
        &url,
        "WithComments",
        json!("a\n  #x\n+"),
        InputMode::Iterable,
    );
    assert_eq!(
        json_of(&mut unmarked),
        json!(["a", {"kind":"comment","text":"#x"}, "+"])
    );
}

#[test]
// req:source-normalization-runtime-003
fn expression_language_pipeline_normalizes_before_tokenization() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("bin/ast/src/lang/expression/expression.lang.uff.ast");
    let declaration: crate::resolver::ModuleDeclaration =
        crate::codec::declaration::decode_declaration_codec_as(
            &std::fs::read_to_string(&path).expect("expression.lang artifact"),
        )
        .unwrap();
    let rule = declaration
        .rules
        .iter()
        .find(|rule| {
            rule.field("name")
                .ok()
                .flatten()
                .and_then(|value| value.string_value())
                .as_deref()
                == Some("ExpressionLang")
        })
        .expect("ExpressionLang");
    let pattern = rule.field("pattern").unwrap().unwrap();
    assert_eq!(
        pattern
            .field("kind")
            .unwrap()
            .unwrap()
            .string_value()
            .as_deref(),
        Some("pipeline")
    );
    let steps: Vec<String> = pattern
        .field("steps")
        .unwrap()
        .unwrap()
        .array_items()
        .unwrap()
        .iter()
        .map(|step| {
            let resolved = if step
                .field("kind")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref()
                == Some("into")
            {
                step.field("pattern").unwrap().unwrap()
            } else {
                step.clone()
            };
            if resolved
                .field("kind")
                .unwrap()
                .unwrap()
                .string_value()
                .as_deref()
                == Some("resolve")
                && resolved
                    .field("targetKind")
                    .unwrap()
                    .unwrap()
                    .string_value()
                    .as_deref()
                    == Some("reference")
            {
                resolved
                    .field("name")
                    .unwrap()
                    .unwrap()
                    .string_value()
                    .unwrap_or_default()
                    .to_string()
            } else {
                String::new()
            }
        })
        .collect();
    assert_eq!(
        steps,
        vec![
            "Source".to_string(),
            "TokenizerNoWhitespace".to_string(),
            "ExpressionComplete".to_string()
        ]
    );
}

#[test]
// req:source-normalization-runtime-004
fn source_document_helpers_assemble_indexes() {
    let mut runtime = run(
        "src/lang/source/mod.uff",
        "Source",
        json!("a\nb"),
        InputMode::Scalar,
    );
    let document = json_of(&mut runtime);
    assert_eq!(document["text"], "a\nb");
    assert_eq!(document["lineStarts"], json!([0, 2]));
    assert_eq!(document["units"].as_array().map(Vec::len), Some(3));
    let document_id = document["documentId"].as_str().expect("document id");
    assert!(document_id.starts_with("source:3:"));
    let values: Vec<_> = document["units"]
        .as_array()
        .unwrap()
        .iter()
        .map(|unit| unit["value"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(values, ["a", "\n", "b"]);
}

#[test]
// req:language-modules-negative-001
fn source_normalization_rejects_non_string_entry() {
    assert_fail(
        "src/lang/source/mod.uff",
        "Source",
        json!(123),
        InputMode::Scalar,
    );
}

#[test]
// req:language-modules-negative-003
fn expression_language_fails_on_malformed_source() {
    let incomplete = run(
        "src/lang/expression/expression.lang.uff",
        "ExpressionLang",
        json!("(add 1"),
        InputMode::Scalar,
    );
    incomplete.read(|execution| {
        assert!(!execution.is_clean());
    });
    let trailing = run(
        "src/lang/expression/expression.lang.uff",
        "ExpressionLang",
        json!("(add 1 2) trailing"),
        InputMode::Scalar,
    );
    trailing.read(|execution| {
        assert!(!execution.is_clean());
    });
}
