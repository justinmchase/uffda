import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./letter.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.letter",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "LETTER00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("a"),
        value: "a",
        kind: MatchKind.Ok,
      }),
    });
    await t.step({
      name: "LETTER01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("1"),
        kind: MatchKind.Fail,
      }),
    });
  },
);
