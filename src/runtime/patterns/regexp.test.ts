import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchErrorCode } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";
import { assert, assertStrictEquals } from "@std/assert";
import { rootOrigin, Wrapped } from "../../wrapped.ts";
import { InputNormalizationMode } from "../../input.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import type { Pattern } from "./pattern.ts";

Deno.test("runtime.patterns.regexp", async (t) => {
  await t.step({
    name: "REGEXP00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });
  await t.step({
    name: "REGEXP01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.Iterable([1]),
      kind: MatchKind.Error,
      code: MatchErrorCode.Type,
      message: `expected value to be a string but got number`,
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
  await t.step({
    name: "REGEXP02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.RegExp,
        pattern: /a/,
      },
      input: Input.Iterable("aa"),
      value: "a",
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name:
      "REGEXP_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.RegExp, pattern: /a/ },
      items: ["a"],
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

Deno.test("runtime/patterns/regexp observes the raw value of a wrapped item and carries it", async () => {
  const item = new Wrapped("7", rootOrigin(4));
  const m = await matchWrapped(
    { kind: PatternKind.RegExp, pattern: /\d/ },
    item,
  );
  assert(m.kind === MatchKind.Ok);
  assertStrictEquals(m.value, item);
});
