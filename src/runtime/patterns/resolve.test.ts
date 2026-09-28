import { assert, assertEquals } from "@std/assert";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { InputNormalizationMode } from "../../input.ts";
import { DefaultModule } from "../modules/module.ts";
import { SpecialKind } from "../modules/special.ts";
import { Scope } from "../scope.ts";
import { PatternKind } from "./pattern.kind.ts";
import { ResolveTargetKind } from "./pattern.ts";
import { resolve } from "./resolve.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("runtime/patterns/resolve", async (t) => {
  await t.step(
    "RESOLVE_PATTERN00 - an unknown reference errors synchronously",
    () => {
      const m = resolve(
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Missing",
          args: [],
        },
        Scope.Default(),
      );
      assert(!(m instanceof Promise));
      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.UnknownReference);
    },
  );

  await t.step(
    "RESOLVE_PATTERN01 - resolving a rule crosses the rule boundary",
    async () => {
      const m = resolve(
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Special,
          value: {
            kind: SpecialKind.Rule,
            rule: {
              name: "Any",
              module: DefaultModule(),
              parameters: [],
              pattern: { kind: PatternKind.Any },
            },
          },
        },
        Scope.From("a", { kind: InputNormalizationMode.Iterable }),
      );
      assert(m instanceof Promise);
      const resolved = await m;
      assertEquals(resolved.kind, MatchKind.Ok);
      if (resolved.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(resolved.value), "a");
    },
  );
});
