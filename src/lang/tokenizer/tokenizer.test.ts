import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./mod.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  ignore: p.state !== "granted",
  name: "lang.tokenizer",
  fn: async (t) => {
    await t.step({
      name: "TOKENIZER00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(""),
        value: [],
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "TOKENIZER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(" "),
        value: [" "],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(" \n "),
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
        input: Input.From("abc\nxyz"),
        value: ["abc", "\n", "xyz"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("abc123-123abc"),
        value: ["abc123", "-", "123abc"],
        kind: MatchKind.Ok,
      }),
    });

    await t.step({
      name: "TOKENIZER05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("!@#$%^&*()_+-=[]\\{}|;':\",./<>?"),
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
        input: Input.From("abc   123\t\t\txyz\r\n\n\n456"),
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
        input: Input.From("1.2.3"),
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
        input: Input.From("x\\{y}z"),
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
        input: Input.From("x{y}z"),
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
  },
});
