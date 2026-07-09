import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./literals.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.literals",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "LITERALS_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "hello", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: "hello",
        },
      }),
    });

    await t.step({
      name: "LITERALS_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["in", "[", "x", "y", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: ["x", "y"],
        },
      }),
    });

    await t.step({
      name: "LITERALS_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["1", ".", ".", "5"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: 1,
          right: 5,
        },
      }),
    });
  },
});
