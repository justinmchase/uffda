import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./prefix.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.prefix",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "PREFIX_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["quantifier", "any", "(", "1", ",", "3", ")"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: 1,
          max: 3,
        },
      }),
    });
  },
});
