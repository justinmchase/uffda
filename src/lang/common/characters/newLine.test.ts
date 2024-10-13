import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./newLine.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.characters.newLine",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "NEWLINE00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\n"),
        value: "\n",
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "NEWLINE01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\r"),
        value: "\n",
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "NEWLINE02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\r\n"),
        value: "\n",
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "NEWLINE01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("\n\n"),
        value: "\n",
        kind: MatchKind.Ok,
        done: false,
      }),
    });
  },
);
