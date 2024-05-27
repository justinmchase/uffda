import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./digit.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.digit",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "DIGIT00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("a"),
        kind: MatchKind.Fail,
      }),
    });
    await t.step({
      name: "DIGIT01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From("1"),
        kind: MatchKind.Ok,
        value: "1",
      }),
    });
  },
);
