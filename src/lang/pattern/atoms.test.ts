import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./atoms.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.atoms",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "ATOMS_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["any"]),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Any },
      }),
    });
  },
});
