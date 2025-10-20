import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./insignificant.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  ignore: p.state !== "granted",
  name: "lang.common.whitespace.insignificant",
  fn: async (t) => {
    await t.step({
      name: "INSIGNIFICANT00 - empty array",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([]),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT01 - single whitespace token",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([" "]),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT02 - multiple whitespace tokens",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([" ", "\t", "   "]),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT03 - newline token",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["\n"]),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT04 - mixed whitespace and newlines",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([" ", "\n", "\t", "\n"]),
        value: [],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT05 - word tokens preserved",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["abc", "xyz"]),
        value: ["abc", "xyz"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT06 - mixed whitespace and words",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["abc", " ", "xyz"]),
        value: ["abc", "xyz"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT07 - punctuation preserved",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["(", "add", " ", "1", " ", "2", ")"]),
        value: ["(", "add", "1", "2", ")"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT08 - complex expression",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          "(",
          "add",
          " ",
          "1",
          "\n",
          "2",
          ")",
        ]),
        value: ["(", "add", "1", "2", ")"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT09 - multiple expressions",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          "(",
          "mul",
          " ",
          "(",
          "add",
          " ",
          "1",
          " ",
          "2",
          ")",
          " ",
          "3",
          ")",
        ]),
        value: ["(", "mul", "(", "add", "1", "2", ")", "3", ")"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT10 - string with whitespace preserved",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          '"',
          "hello",
          " ",
          "world",
          '"',
        ]),
        value: ['"', "hello", " ", "world", '"'],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT11 - string with interpolation",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          '"',
          "hello",
          " ",
          "$",
          "(",
          "add",
          " ",
          "1",
          " ",
          "2",
          ")",
          " ",
          "world",
          '"',
        ]),
        value: [
          '"',
          "hello",
          " ",
          "$",
          "(",
          "add",
          "1",
          "2",
          ")",
          " ",
          "world",
          '"',
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT12 - nested string interpolation",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          '"',
          "x",
          " ",
          "$",
          "(",
          '"',
          "y",
          " ",
          "z",
          '"',
          ")",
          " ",
          "w",
          '"',
        ]),
        value: [
          '"',
          "x",
          " ",
          "$",
          "(",
          '"',
          "y",
          " ",
          "z",
          '"',
          ")",
          " ",
          "w",
          '"',
        ],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "INSIGNIFICANT13 - expression outside string",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          "(",
          "concat",
          " ",
          '"',
          "hello",
          " ",
          "world",
          '"',
          " ",
          '"',
          "foo",
          '"',
          ")",
        ]),
        value: [
          "(",
          "concat",
          '"',
          "hello",
          " ",
          "world",
          '"',
          '"',
          "foo",
          '"',
          ")",
        ],
        kind: MatchKind.Ok,
      }),
    });
  },
});
