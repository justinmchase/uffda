import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./combining.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.characters.combining",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "COMBINING00",
      fn: moduleDeclarationTest({
        moduleUrl,
        kind: MatchKind.Ok,
        input: Input.From("\u0302"),
        value: "\u0302",
      }),
    });
    await t.step({
      name: "COMBINING01",
      fn: moduleDeclarationTest({
        moduleUrl,
        kind: MatchKind.Ok,
        input: Input.From("\u0903"),
        value: "\u0903",
      }),
    });
  },
);
