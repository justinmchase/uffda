import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./or.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.or",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "OR_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["any", "|", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });

    await t.step({
      name: "OR_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["|", "any", "|", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });
  },
});
