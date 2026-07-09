import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./resolve.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.resolve",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "RESOLVE_00",
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

    await t.step({
      name: "RESOLVE_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["@", "any"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "any",
          args: [],
        },
      }),
    });

    await t.step({
      name: "RESOLVE_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["foo", "<", "bar", ",", "@", "or", ",", ">"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "bar",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "or",
              args: [],
            },
          ],
        },
      }),
    });

    await t.step({
      name: "RESOLVE_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["foo", "<", '"', "bar", '"', ">"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [
            {
              kind: PatternKind.Equal,
              value: "bar",
            },
          ],
        },
      }),
    });
  },
});
