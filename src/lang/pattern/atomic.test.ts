import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./atomic.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.atomic",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "ATOMIC_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["foo"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [],
        },
      }),
    });
  },
});
