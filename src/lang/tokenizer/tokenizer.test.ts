import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { StructuredTokenKind, type TokenValue } from "./tokenizer.lang.ts";

const moduleUrl = new URL("./mod.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

const tokenizerNoWhitespaceModule: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl,
      names: ["TokenizerNoWhitespace"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Main",
      default: true,
    },
  ],
  rules: [
    {
      name: "Main",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "TokenizerNoWhitespace",
        args: [],
      },
    },
  ],
};

function tok(kind: StructuredTokenKind, text: string): TokenValue {
  return { kind, text };
}

Deno.test({
  ignore: p.state !== "granted",
  name: "lang.tokenizer",
  fn: async (t) => {
    await t.step({
      name: "TOKENIZER00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable(""),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable(" "),
        value: [tok(StructuredTokenKind.Whitespace, " ")],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER02",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable(" \n "),
        value: [
          tok(StructuredTokenKind.Whitespace, " "),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.Whitespace, " "),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER03",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("abc\nxyz"),
        value: [
          tok(StructuredTokenKind.Word, "abc"),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.Word, "xyz"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER04",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("abc123-123abc"),
        value: [
          tok(StructuredTokenKind.Word, "abc123"),
          tok(StructuredTokenKind.Punctuation, "-"),
          tok(StructuredTokenKind.Word, "123abc"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER05",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("!@$%^&*()_+-=[]\\{}|;':\",./<>?"),
        value: [
          tok(StructuredTokenKind.Punctuation, "!"),
          tok(StructuredTokenKind.Punctuation, "@"),
          tok(StructuredTokenKind.Punctuation, "$"),
          tok(StructuredTokenKind.Punctuation, "%"),
          tok(StructuredTokenKind.Punctuation, "^"),
          tok(StructuredTokenKind.Punctuation, "&"),
          tok(StructuredTokenKind.Punctuation, "*"),
          tok(StructuredTokenKind.Punctuation, "("),
          tok(StructuredTokenKind.Punctuation, ")"),
          tok(StructuredTokenKind.Word, "_"),
          tok(StructuredTokenKind.Punctuation, "+"),
          tok(StructuredTokenKind.Punctuation, "-"),
          tok(StructuredTokenKind.Punctuation, "="),
          tok(StructuredTokenKind.Punctuation, "["),
          tok(StructuredTokenKind.Punctuation, "]"),
          tok(StructuredTokenKind.Punctuation, "\\"),
          tok(StructuredTokenKind.Punctuation, "{"),
          tok(StructuredTokenKind.Punctuation, "}"),
          tok(StructuredTokenKind.Punctuation, "|"),
          tok(StructuredTokenKind.Punctuation, ";"),
          tok(StructuredTokenKind.Punctuation, "'"),
          tok(StructuredTokenKind.Punctuation, ":"),
          tok(StructuredTokenKind.Punctuation, '"'),
          tok(StructuredTokenKind.Punctuation, ","),
          tok(StructuredTokenKind.Punctuation, "."),
          tok(StructuredTokenKind.Punctuation, "/"),
          tok(StructuredTokenKind.Punctuation, "<"),
          tok(StructuredTokenKind.Punctuation, ">"),
          tok(StructuredTokenKind.Punctuation, "?"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER05A",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable('"#" # comment\n*'),
        value: [
          tok(StructuredTokenKind.Punctuation, '"'),
          tok(StructuredTokenKind.Punctuation, "#"),
          tok(StructuredTokenKind.Punctuation, '"'),
          tok(StructuredTokenKind.Whitespace, " "),
          tok(StructuredTokenKind.Comment, "# comment"),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.Punctuation, "*"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER06",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("abc   123\t\t\txyz\n\n\n456"),
        value: [
          tok(StructuredTokenKind.Word, "abc"),
          tok(StructuredTokenKind.Whitespace, "   "),
          tok(StructuredTokenKind.Word, "123"),
          tok(StructuredTokenKind.Whitespace, "\t\t\t"),
          tok(StructuredTokenKind.Word, "xyz"),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.NewLine, "\n"),
          tok(StructuredTokenKind.Word, "456"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER07",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("1.2.3"),
        value: [
          tok(StructuredTokenKind.Word, "1"),
          tok(StructuredTokenKind.Punctuation, "."),
          tok(StructuredTokenKind.Word, "2"),
          tok(StructuredTokenKind.Punctuation, "."),
          tok(StructuredTokenKind.Word, "3"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER08",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("x\\{y}z"),
        value: [
          tok(StructuredTokenKind.Word, "x"),
          tok(StructuredTokenKind.Punctuation, "\\"),
          tok(StructuredTokenKind.Punctuation, "{"),
          tok(StructuredTokenKind.Word, "y"),
          tok(StructuredTokenKind.Punctuation, "}"),
          tok(StructuredTokenKind.Word, "z"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER09",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Tokenizer",
        input: Input.Iterable("x{y}z"),
        value: [
          tok(StructuredTokenKind.Word, "x"),
          tok(StructuredTokenKind.Punctuation, "{"),
          tok(StructuredTokenKind.Word, "y"),
          tok(StructuredTokenKind.Punctuation, "}"),
          tok(StructuredTokenKind.Word, "z"),
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER10",
      fn: moduleDeclarationTest({
        moduleUrl:
          new URL("./tokenizer-no-whitespace.ts", import.meta.url).href,
        declarations: {
          [new URL("./tokenizer-no-whitespace.ts", import.meta.url).href]:
            tokenizerNoWhitespaceModule,
        },
        input: Input.Iterable(" any or fail\n"),
        value: ["any", "or", "fail"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER11",
      fn: moduleDeclarationTest({
        moduleUrl:
          new URL("./tokenizer-no-whitespace.ts", import.meta.url).href,
        declarations: {
          [new URL("./tokenizer-no-whitespace.ts", import.meta.url).href]:
            tokenizerNoWhitespaceModule,
        },
        input: Input.Iterable(
          '#123 punctuation !@*\nany # trailing\n"# quoted \\" hash"\nend',
        ),
        value: [
          "any",
          '"',
          "#",
          " ",
          "quoted",
          " ",
          "\\",
          '"',
          " ",
          "hash",
          '"',
          "end",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER12",
      fn: moduleDeclarationTest({
        moduleUrl:
          new URL("./tokenizer-no-whitespace.ts", import.meta.url).href,
        declarations: {
          [new URL("./tokenizer-no-whitespace.ts", import.meta.url).href]:
            tokenizerNoWhitespaceModule,
        },
        input: Input.Iterable('"\\t\\n\\r\\\\\\"\\tab"'),
        value: [
          '"',
          "\\",
          "t",
          "\\",
          "n",
          "\\",
          "r",
          "\\",
          "\\",
          "\\",
          '"',
          "\\",
          "t",
          "ab",
          '"',
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER13",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "TokenizerNoWhitespaceWithComments",
        input: Input.Iterable(
          '#123 punctuation !@*\nany # trailing\n"# quoted"\nend',
        ),
        value: [
          tok(StructuredTokenKind.Comment, "#123 punctuation !@*"),
          "any",
          { kind: "lineEnd" },
          tok(StructuredTokenKind.Comment, "# trailing"),
          '"',
          "#",
          " ",
          "quoted",
          '"',
          "end",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER14 string content reads as it does between quotes",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "StringContentTokenizer",
        input: Input.Iterable("./my-lang v2.uff"),
        value: [".", "/", "my", "-", "lang", " ", "v2", ".", "uff"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER15 string content ends at a quote",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "StringContentTokenizer",
        input: Input.Iterable('a"b'),
        kind: MatchKind.Fail,
      }),
    });
  },
});
