import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/any", async (t) => {
  await t.step({
    name: "ANY00",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ANY01",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable(["a"]),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "ANY02",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable(""),
      kind: MatchKind.Fail,
      done: true,
    }),
  });

  await t.step({
    name: "ANY03",
    fn: patternTest({
      pattern: { kind: PatternKind.Any },
      input: Input.Iterable("ab"),
      value: "a",
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name:
      "ANY_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: { kind: PatternKind.Any },
      items: ["a"],
    }),
  });
});
