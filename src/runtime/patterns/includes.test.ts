import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit, ValueSourceKind } from "./value_source.ts";
import { assert, assertStrictEquals } from "@std/assert";
import { rootOrigin, Wrapped } from "../../wrapped.ts";
import { InputNormalizationMode } from "../../input.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import type { Pattern } from "./pattern.ts";

await Deno.test("runtime/patterns/includes", async (t) => {
  await t.step({
    name: "INCLUDES00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [lit("x")],
      },
      input: Input.Iterable("x"),
      value: "x",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "INCLUDES01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [lit("x"), lit("y"), lit("z")],
      },
      input: Input.Iterable("y"),
      value: "y",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "INCLUDES02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [lit("x"), lit("y"), lit("z")],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "INCLUDES_VALUE_SOURCE_VARIABLE",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Includes,
        values: [
          { kind: ValueSourceKind.Variable, name: "a" },
          lit("y"),
        ],
      },
      variables: new Map([["a", "x"]]),
      input: Input.Iterable("x"),
      value: "x",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name:
      "INCLUDES_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.Includes, values: [lit("a"), lit("b")] },
      items: ["b"],
    }),
  });
});

async function matchWrapped(
  pattern: Pattern,
  item: Wrapped,
  variables = new Map<string, unknown>(),
) {
  const scope = Scope.From(new Wrapped([item], item.origin), {
    kind: InputNormalizationMode.Iterable,
  }).addVariables(Object.fromEntries(variables));
  return await match(pattern, scope);
}

Deno.test("runtime/patterns/includes observes the raw value of a wrapped item and carries it", async () => {
  const item = new Wrapped("b", rootOrigin(4));
  const m = await matchWrapped({
    kind: PatternKind.Includes,
    values: [lit("a"), lit("b")],
  }, item);
  assert(m.kind === MatchKind.Ok);
  assertStrictEquals(m.value, item);
});
