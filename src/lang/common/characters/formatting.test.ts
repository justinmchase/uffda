import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./formatting.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.characters.formatting",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "FORMATTING00",
      fn: moduleDeclarationTest({
        moduleUrl,
        kind: MatchKind.Ok,
        input: Input.From("\u200B"),
        value: "\u200B",
      }),
    });
  },
);
