import { assert, assertEquals } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { walkAnnotatable } from "./editor_metadata.ts";
import {
  HighlightRole,
  highlightRoleOf,
  highlightSource,
  highlightSpansFromMatch,
  isNameRefinementRole,
  isNameRole,
  isTriviaRole,
  renderHighlightAnsi,
} from "./highlight.ts";

Deno.test("cli.highlight name roles", () => {
  assert(isNameRole(HighlightRole.Identifier));
  assert(!isNameRefinementRole(HighlightRole.Identifier));
  for (
    const role of [
      HighlightRole.Type,
      HighlightRole.Function,
      HighlightRole.Variable,
      HighlightRole.Property,
    ]
  ) {
    assert(isNameRole(role) && isNameRefinementRole(role));
  }
  assert(!isNameRole(HighlightRole.Keyword));
  assert(!isNameRole(HighlightRole.String));
});

/**
 * Coverage for the source-highlighting tool (see
 * `.agents/requirements/mcp-server/009-source-highlighting-tool.requirement.md`
 * and `mcp-server.spec.md#source-highlighting-tool`).
 */

function assertFullCoverage(
  spans: { offset: number; length: number }[],
  sourceLength: number,
) {
  let cursor = 0;
  for (const span of spans) {
    assertEquals(span.offset, cursor, "spans must be contiguous, no gaps");
    cursor += span.length;
  }
  assertEquals(cursor, sourceLength, "spans must cover the entire source");
}

Deno.test("cli.highlight classifies uffda module source by syntactic role", async (t) => {
  await t.step(
    "classifies a character class spanning several tokens as a string",
    async () => {
      const source = "rule A = \\cZs | switch { \\cNd: any };";
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      assertEquals(
        result.spans
          .filter((s) => s.role === HighlightRole.String)
          .map((s) => s.text),
        ["\\", "cZs", "\\", "cNd"],
      );
    },
  );

  await t.step(
    "classifies pattern and expression reserved words as keywords",
    async () => {
      const source =
        'rule A = switch { "a": any, default: not end } | in [1] -> (f null);\nrule B = "switch";\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      assertEquals(
        result.spans
          .filter((s) => s.role === HighlightRole.Keyword)
          .map((s) => s.text),
        [
          "rule",
          "switch",
          "any",
          "default",
          "not",
          "end",
          "in",
          "null",
          "rule",
        ],
      );
    },
  );

  await t.step(
    "classifies reserved words as keywords, not identifiers",
    async () => {
      const source = 'import "./x.uff" A;\nexport B;\nrule B = any;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);

      const keywordTexts = result.spans
        .filter((s) => s.role === HighlightRole.Keyword)
        .map((s) => s.text);
      assertEquals(keywordTexts, ["import", "export", "rule", "any"]);

      // The rule's own name ("B") is an ordinary identifier, not a keyword.
      const identifierTexts = result.spans
        .filter((s) => s.role === HighlightRole.Identifier)
        .map((s) => s.text);
      assertEquals(identifierTexts, ["A", "B", "B"]);
    },
  );

  await t.step(
    "classifies decorator/func declarations' keywords",
    async () => {
      const source =
        "decorator Loud = { shout: true };\n[Loud]\nfunc F<a:number> = a;\n";
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      const keywordTexts = result.spans
        .filter((s) => s.role === HighlightRole.Keyword)
        .map((s) => s.text);
      assertEquals(keywordTexts, ["decorator", "true", "func", "number"]);
    },
  );

  await t.step("classifies comments distinctly from code", async () => {
    const source = "# a comment\nrule A = any;\n";
    const result = await highlightSource(source, CliLanguage.FullUffda);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
    const comment = result.spans.find((s) => s.role === HighlightRole.Comment);
    assertEquals(comment?.text, "# a comment");
  });

  await t.step(
    "classifies quoted string content as string, not identifier/punctuation",
    async () => {
      const source = 'import "./sub/mod.uff" A;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(result.ok);
      assertFullCoverage(result.spans, source.length);
      const stringText = result.spans
        .filter((s) => s.role === HighlightRole.String)
        .map((s) => s.text)
        .join("");
      assertEquals(stringText, '"./sub/mod.uff"');
    },
  );

  await t.step(
    "the same source, highlighted twice, produces identical output",
    async () => {
      const source = 'import "./x.uff" A;\nexport A;\n';
      const first = await highlightSource(source, CliLanguage.FullUffda);
      const second = await highlightSource(source, CliLanguage.FullUffda);
      assertEquals(first, second);
    },
  );

  await t.step(
    "source that fails to parse still returns best-effort, gap-free spans plus a diagnostic",
    async () => {
      // Missing semicolon after the import declaration.
      const source = 'import "x.uff" A\nrule B = any;\n';
      const result = await highlightSource(source, CliLanguage.FullUffda);
      assert(!result.ok);
      assertEquals(result.error.code, "CLI_STREAM_PARSE_RECOVERED");
      assertEquals(result.error.phase, "parse");
      assertFullCoverage(result.spans, source.length);
      // The portion that did parse successfully is still classified.
      assertEquals(
        result.spans.find((s) => s.role === HighlightRole.Keyword)?.text,
        "import",
      );
    },
  );

  await t.step("renders spans as ANSI-annotated text", async () => {
    const source = "rule A = any;\n";
    const result = await highlightSource(source, CliLanguage.FullUffda);
    assert(result.ok);
    const rendered = renderHighlightAnsi(result.spans);
    // deno-lint-ignore no-control-regex
    const withoutAnsi = rendered.replace(/\x1b\[[0-9;]*m/g, "");
    assertEquals(withoutAnsi, source);
  });
});

Deno.test("cli.highlight covers pattern/expression sub-language source without gaps", async (t) => {
  await t.step("pattern language source", async () => {
    const source = '"a" | "b"';
    const result = await highlightSource(source, CliLanguage.Pattern);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
  });

  await t.step("expression language source", async () => {
    const source = "(add 1 2)";
    const result = await highlightSource(source, CliLanguage.Expression);
    assert(result.ok);
    assertFullCoverage(result.spans, source.length);
  });
});

Deno.test("cli.highlight derives roles from [Highlight] metadata", async (t) => {
  const source = 'rule A = "in side"; # note\n';
  const match = await uffdaGrammar(source);

  await t.step("reads each annotated token rule's declared role", () => {
    const roles = new Set<HighlightRole>();
    walkAnnotatable(match, (node) => {
      const role = highlightRoleOf(node);
      if (role) roles.add(role);
    });
    assertEquals(
      [...roles].sort(),
      [
        HighlightRole.Comment,
        HighlightRole.Identifier,
        HighlightRole.NewLine,
        HighlightRole.Punctuation,
        HighlightRole.String,
        HighlightRole.Whitespace,
      ],
    );
  });

  await t.step("the outermost Highlight decides a nested token's role", () => {
    const spans = highlightSpansFromMatch(match, source);
    assertFullCoverage(spans, source.length);
    assertEquals(
      spans.map((s) => [s.text, s.role]),
      [
        ["rule", HighlightRole.Keyword],
        [" ", HighlightRole.Whitespace],
        ["A", HighlightRole.Identifier],
        [" ", HighlightRole.Whitespace],
        ["=", HighlightRole.Punctuation],
        [" ", HighlightRole.Whitespace],
        ['"', HighlightRole.String],
        ["in", HighlightRole.String],
        [" ", HighlightRole.String],
        ["side", HighlightRole.String],
        ['"', HighlightRole.String],
        [";", HighlightRole.Punctuation],
        [" ", HighlightRole.Whitespace],
        ["# note", HighlightRole.Comment],
        ["\n", HighlightRole.NewLine],
      ],
    );
  });

  await t.step("ignores nodes without a recognized role", () => {
    assertEquals(highlightRoleOf(match), undefined);
  });

  await t.step(
    "classifies whitespace, line breaks and comments as trivia",
    () => {
      assertEquals(
        Object.values(HighlightRole).filter(isTriviaRole).sort(),
        [
          HighlightRole.Comment,
          HighlightRole.NewLine,
          HighlightRole.Whitespace,
        ],
      );
    },
  );
});

Deno.test("cli.highlight walks a shared parse DAG once per node", async () => {
  // Every nesting level retains rejected alternatives sharing the memoized
  // inner group, so a tree walk would take exponentially many visits.
  const depth = 8;
  const source = `rule X = ${"(".repeat(depth)}A${")".repeat(depth)};`;
  const match = await uffdaGrammar(source);
  const spans = highlightSpansFromMatch(match, source);
  assertFullCoverage(spans, source.length);
  const reference = spans.find((span) => span.text === "A");
  assertEquals(reference?.role, HighlightRole.Type);
});

Deno.test("cli.highlight refines names by what they reference", async (t) => {
  const rolesOf = async (source: string, language?: CliLanguage) => {
    const result = await highlightSource(source, language);
    assert(result.ok);
    return result.spans
      .filter((span) => !isTriviaRole(span.role))
      .filter((span) => span.role !== HighlightRole.Punctuation)
      .map((span) => [span.text, span.role]);
  };

  await t.step(
    "an invoked name is a function, its arguments variables",
    async () => {
      assertEquals(
        await rolesOf(
          "(map (filter tokens IsNotComment) TokenText)",
          CliLanguage.Expression,
        ),
        [
          ["map", HighlightRole.Function],
          ["filter", HighlightRole.Function],
          ["tokens", HighlightRole.Variable],
          ["IsNotComment", HighlightRole.Variable],
          ["TokenText", HighlightRole.Variable],
        ],
      );
    },
  );

  await t.step("a member name is a property", async () => {
    assertEquals(
      await rolesOf("(f a.b)", CliLanguage.Expression),
      [
        ["f", HighlightRole.Function],
        ["a", HighlightRole.Variable],
        ["b", HighlightRole.Property],
      ],
    );
  });

  await t.step("a member callee is not refined as a function", async () => {
    assertEquals(
      await rolesOf("(a.b x)", CliLanguage.Expression),
      [
        ["a", HighlightRole.Variable],
        ["b", HighlightRole.Property],
        ["x", HighlightRole.Variable],
      ],
    );
  });

  await t.step("reserved words keep their keyword role", async () => {
    assertEquals(
      await rolesOf("(f true null)", CliLanguage.Expression),
      [
        ["f", HighlightRole.Function],
        ["true", HighlightRole.Keyword],
        ["null", HighlightRole.Keyword],
      ],
    );
    assertEquals(
      await rolesOf("(not x)", CliLanguage.Expression),
      [["not", HighlightRole.Function], ["x", HighlightRole.Variable]],
    );
  });

  await t.step(
    "pattern references are types, string words are not",
    async () => {
      assertEquals(
        await rolesOf('rule A = B<C> @D "E";'),
        [
          ["rule", HighlightRole.Keyword],
          ["A", HighlightRole.Identifier],
          ["B", HighlightRole.Type],
          ["C", HighlightRole.Type],
          ["D", HighlightRole.Type],
          ['"', HighlightRole.String],
          ["E", HighlightRole.String],
          ['"', HighlightRole.String],
        ],
      );
    },
  );
});

Deno.test("cli.highlight reports parse diagnostics", async () => {
  const result = await highlightSource(")", CliLanguage.Pattern);
  assert(!result.ok);
  assertEquals(result.error.code, "CLI_STREAM_PARSE_FAILURE");
  assertEquals(result.diagnostics, [result.error]);
  assert(result.spans.length > 0);
});
