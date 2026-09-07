import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./spread.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.common.spread",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "SPREAD_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "SpreadMarker",
        input: Input.Iterable([".", ".", "."]),
        kind: MatchKind.Ok,
        value: [".", ".", "."],
      }),
    });

    await t.step({
      name: "SPREAD_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "SpreadMarker",
        input: Input.Iterable([".", "."]),
        kind: MatchKind.Fail,
      }),
    });
  },
);
