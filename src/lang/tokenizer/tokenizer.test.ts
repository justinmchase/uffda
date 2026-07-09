import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./mod.ts", import.meta.url).href;

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

Deno.test({
  ignore: p.state !== "granted",
  name: "lang.tokenizer",
  fn: async (t) => {
    await t.step({
      name: "TOKENIZER00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(""),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(" "),
        value: [" "],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(" \n "),
        value: [
          " ",
          "\n",
          " ",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("abc\nxyz"),
        value: ["abc", "\n", "xyz"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("abc123-123abc"),
        value: ["abc123", "-", "123abc"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("!@#$%^&*()_+-=[]\\{}|;':\",./<>?"),
        value: [
          "!",
          "@",
          "#",
          "$",
          "%",
          "^",
          "&",
          "*",
          "(",
          ")",
          "_",
          "+",
          "-",
          "=",
          "[",
          "]",
          "\\",
          "{",
          "}",
          "|",
          ";",
          "'",
          ":",
          '"',
          ",",
          ".",
          "/",
          "<",
          ">",
          "?",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("abc   123\t\t\txyz\n\n\n456"),
        value: [
          "abc",
          "   ",
          "123",
          "\t\t\t",
          "xyz",
          "\n",
          "\n",
          "\n",
          "456",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER07",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("1.2.3"),
        value: [
          "1",
          ".",
          "2",
          ".",
          "3",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER08",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("x\\{y}z"),
        value: [
          "x",
          "\\",
          "{",
          "y",
          "}",
          "z",
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER09",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable("x{y}z"),
        value: [
          "x",
          "{",
          "y",
          "}",
          "z",
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
  },
});
