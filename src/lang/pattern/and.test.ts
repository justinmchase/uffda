import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./and.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.and",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "AND_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["any", "&", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.And,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });
  },
});
