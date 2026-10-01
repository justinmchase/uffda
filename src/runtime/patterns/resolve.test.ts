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
import { ExpressionKind } from "../expressions/expression.kind.ts";
import type { Rule } from "../modules/rule.ts";

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

  await t.step(
    "RESOLVE_PATTERN02 - a rule whose body skips is skipped",
    async () => {
      const resolved = await resolve(
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Special,
          value: {
            kind: SpecialKind.Rule,
            rule: {
              name: "Ws",
              module: DefaultModule(),
              parameters: [],
              pattern: {
                kind: PatternKind.Skip,
                pattern: { kind: PatternKind.Any },
              },
            },
          },
        },
        Scope.From("a", { kind: InputNormalizationMode.Iterable }),
      );
      assertEquals(resolved.kind, MatchKind.Skip);
      if (resolved.kind !== MatchKind.Skip) return;
      assertEquals(unwrap(resolved.value), undefined);
    },
  );

  await t.step(
    "RESOLVE_PATTERN03 - a rule expression over a skip is ordinary",
    async () => {
      const resolved = await resolve(
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Special,
          value: {
            kind: SpecialKind.Rule,
            rule: {
              name: "Ws",
              module: DefaultModule(),
              parameters: [],
              pattern: {
                kind: PatternKind.Skip,
                pattern: { kind: PatternKind.Any },
              },
              expression: { kind: ExpressionKind.Value, value: "ws" },
            },
          },
        },
        Scope.From("a", { kind: InputNormalizationMode.Iterable }),
      );
      assertEquals(resolved.kind, MatchKind.Ok);
      if (resolved.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(resolved.value), "ws");
    },
  );

  await t.step(
    "RESOLVE_PATTERN_CLOSURE - an inline argument sees the caller's variables",
    async () => {
      const show: Rule = {
        name: "Show",
        module: DefaultModule(),
        parameters: [{ name: "C" }],
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "C",
          args: [],
        },
      };
      const caller: Rule = {
        name: "Caller",
        module: DefaultModule(),
        parameters: [],
        pattern: { kind: PatternKind.Ok },
      };
      const scope = Scope.Default()
        .pushRule(caller, new Map([["Show", show]]))
        .addVariable("x", "v");
      const m = await resolve(
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Show",
          args: [{
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Ok },
            expression: { kind: ExpressionKind.Reference, name: "x" },
          }],
        },
        scope,
      );
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(m.value), "v");
    },
  );
});
