import { Input } from "../../../input.ts";
import { MatchKind } from "../../../mod.ts";
import { moduleDeclarationTest } from "../../../test.ts";

const moduleUrl = new URL("./connecting.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.characters.connecting",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "CONNECTING",
      fn: moduleDeclarationTest({
        moduleUrl,
        kind: MatchKind.Ok,
        input: Input.From("‿"),
        value: "‿",
      }),
    });
  },
);
