import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./whitespace.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.characters.whitespace",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "WHITESPACE00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(" "),
        value: " ",
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "WHITESPACE01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("   "),
        kind: MatchKind.Ok,
        value: " ",
        done: false,
      }),
    });

    await t.step({
      name: "WHITESPACE02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(" \t"),
        value: " ",
        kind: MatchKind.Ok,
        done: false,
      }),
    });

    await t.step({
      name: "WHITESPACE03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(""),
        kind: MatchKind.Fail,
        done: true,
      }),
    });

    await t.step({
      name: "WHITESPACE04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\r"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "WHITESPACE05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\n"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "WHITESPACE06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\t"),
        kind: MatchKind.Ok,
        value: "\t",
      }),
    });
  },
);
